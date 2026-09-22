"""Escalation = a priority bump the reporter asks for and an admin decides."""

from conftest import call
from db import connect


def escalate(incident_id, token, priority="High", reason="blocking my work"):
    return call(
        "POST", f"/incidents/{incident_id}/escalate",
        {"requested_priority": priority, "reason": reason}, token=token,
    )


# --- who may ask ----------------------------------------------------------

def test_reporter_can_request(employee, make_incident):
    incident = make_incident(priority="Low")
    status, payload = escalate(incident["id"], employee)
    assert status == 201, payload
    assert payload["escalation"]["status"] == "Pending"
    assert payload["escalation"]["current_priority"] == "Low"
    assert payload["escalation"]["requested_priority"] == "High"


def test_assigned_engineer_cannot_request(engineer, make_incident):
    incident = make_incident(priority="Low")
    call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    status, _ = escalate(incident["id"], engineer)
    assert status == 403


def test_unrelated_employee_cannot_request(other_employee, make_incident):
    incident = make_incident(priority="Low")
    status, _ = escalate(incident["id"], other_employee)
    assert status == 403


def test_admin_cannot_request(admin, make_incident):
    """Filing and then approving your own request is a rubber stamp."""
    incident = make_incident(priority="Low")
    status, _ = escalate(incident["id"], admin)
    assert status == 403


def test_request_requires_login(make_incident):
    incident = make_incident()
    status, _ = escalate(incident["id"], None)
    assert status == 401


# --- the two database invariants -----------------------------------------

def test_non_raising_priority_is_409(employee, make_incident):
    incident = make_incident(priority="High")
    status, _ = escalate(incident["id"], employee, priority="Low")
    assert status == 409


def test_same_priority_is_409(employee, make_incident):
    incident = make_incident(priority="Medium")
    status, _ = escalate(incident["id"], employee, priority="Medium")
    assert status == 409


def test_second_pending_request_is_409(employee, make_incident):
    incident = make_incident(priority="Low")
    assert escalate(incident["id"], employee)[0] == 201
    status, _ = escalate(incident["id"], employee, priority="Critical")
    assert status == 409


def test_current_priority_is_read_server_side(employee, make_incident):
    """A forged low current_priority must not sneak past the CHECK."""
    incident = make_incident(priority="High")
    status, _ = call(
        "POST", f"/incidents/{incident['id']}/escalate",
        {"requested_priority": "Medium", "reason": "sneaky", "current_priority": "Low"},
        token=employee,
    )
    assert status == 409


# --- the admin queue ------------------------------------------------------

def test_admin_sees_pending_queue(admin, employee, make_incident):
    incident = make_incident(priority="Low")
    _, created = escalate(incident["id"], employee)

    status, payload = call("GET", "/escalations", token=admin, query={"status": "Pending"})
    assert status == 200
    assert created["escalation"]["id"] in [e["id"] for e in payload["escalations"]]
    assert {e["status"] for e in payload["escalations"]} == {"Pending"}


def test_non_admin_cannot_see_queue(employee, engineer):
    assert call("GET", "/escalations", token=employee)[0] == 403
    assert call("GET", "/escalations", token=engineer)[0] == 403


# --- deciding -------------------------------------------------------------

def test_approve_bumps_the_incident_priority(admin, employee, make_incident):
    incident = make_incident(priority="Low")
    _, created = escalate(incident["id"], employee, priority="Critical")

    status, payload = call(
        "POST", f"/escalations/{created['escalation']['id']}/decide",
        {"decision": "approve"}, token=admin,
    )
    assert status == 200
    assert payload["escalation"]["status"] == "Approved"
    assert payload["escalation"]["decided_by"] is not None
    assert payload["escalation"]["decided_at"] is not None

    _, after = call("GET", f"/incidents/{incident['id']}", token=employee)
    assert after["incident"]["priority"] == "Critical"


def test_reject_leaves_the_priority_alone(admin, employee, make_incident):
    incident = make_incident(priority="Low")
    _, created = escalate(incident["id"], employee, priority="Critical")

    status, payload = call(
        "POST", f"/escalations/{created['escalation']['id']}/decide",
        {"decision": "reject"}, token=admin,
    )
    assert status == 200
    assert payload["escalation"]["status"] == "Rejected"
    assert payload["escalation"]["decided_at"] is not None

    _, after = call("GET", f"/incidents/{incident['id']}", token=employee)
    assert after["incident"]["priority"] == "Low"


def test_deciding_twice_is_409(admin, employee, make_incident):
    incident = make_incident(priority="Low")
    _, created = escalate(incident["id"], employee)
    escalation_id = created["escalation"]["id"]

    assert call("POST", f"/escalations/{escalation_id}/decide",
                {"decision": "approve"}, token=admin)[0] == 200
    status, _ = call("POST", f"/escalations/{escalation_id}/decide",
                     {"decision": "reject"}, token=admin)
    assert status == 409


def test_non_admin_cannot_decide(employee, engineer, make_incident):
    incident = make_incident(priority="Low")
    _, created = escalate(incident["id"], employee)
    escalation_id = created["escalation"]["id"]

    assert call("POST", f"/escalations/{escalation_id}/decide",
                {"decision": "approve"}, token=employee)[0] == 403
    assert call("POST", f"/escalations/{escalation_id}/decide",
                {"decision": "approve"}, token=engineer)[0] == 403


def test_unknown_decision_is_400(admin, employee, make_incident):
    incident = make_incident(priority="Low")
    _, created = escalate(incident["id"], employee)
    status, _ = call("POST", f"/escalations/{created['escalation']['id']}/decide",
                     {"decision": "maybe"}, token=admin)
    assert status == 400


def test_deciding_a_missing_row_is_404(admin):
    status, _ = call("POST", "/escalations/99999999/decide", {"decision": "approve"}, token=admin)
    assert status == 404


def test_approval_is_one_transaction(admin, employee, make_incident):
    """The escalation row and the priority write must land together."""
    incident = make_incident(priority="Low")
    _, created = escalate(incident["id"], employee, priority="High")
    call("POST", f"/escalations/{created['escalation']['id']}/decide",
         {"decision": "approve"}, token=admin)

    with connect() as conn:
        row = conn.execute(
            "SELECT e.status, i.priority FROM escalation_requests e"
            " JOIN incidents i ON i.id = e.incident_id WHERE e.id = %s",
            (created["escalation"]["id"],),
        ).fetchone()
    assert row == ("Approved", "High")
