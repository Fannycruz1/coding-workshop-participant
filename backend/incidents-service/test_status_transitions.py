"""The status graph, its side effects, and the history row."""

import pytest

from conftest import call
from db import connect

# Open → In Progress → Blocked → In Progress → Resolved → Closed, plus the reopen.
LEGAL = [
    ("Open", "In Progress"),
    ("In Progress", "Blocked"),
    ("In Progress", "Resolved"),
    ("Blocked", "In Progress"),
    ("Resolved", "Closed"),
    ("Resolved", "In Progress"),
]

ILLEGAL = [
    ("Open", "Resolved"),
    ("Open", "Closed"),
    ("Open", "Blocked"),
    ("Closed", "Open"),
    ("Closed", "In Progress"),
    ("Blocked", "Resolved"),
    ("In Progress", "Open"),
]

# How to walk an incident to a given start state, once it is assigned.
PATH_TO = {
    "Open": [],
    "In Progress": ["In Progress"],
    "Blocked": ["In Progress", "Blocked"],
    "Resolved": ["In Progress", "Resolved"],
    "Closed": ["In Progress", "Resolved", "Closed"],
}


@pytest.fixture
def incident_at(make_incident, engineer, admin):
    """An incident assigned to our engineer, walked to the requested status."""

    def _at(status):
        incident = make_incident()
        assert call("POST", f"/incidents/{incident['id']}/assign", token=engineer)[0] == 200
        for step in PATH_TO[status]:
            code, payload = call(
                "PATCH", f"/incidents/{incident['id']}/status", {"to_status": step}, token=admin
            )
            assert code == 200, payload
        return incident

    return _at


@pytest.mark.parametrize("start,target", LEGAL)
def test_legal_transition(incident_at, engineer, start, target):
    incident = incident_at(start)
    status, payload = call(
        "PATCH", f"/incidents/{incident['id']}/status", {"to_status": target}, token=engineer
    )
    assert status == 200, payload
    assert payload["incident"]["status"] == target


@pytest.mark.parametrize("start,target", ILLEGAL)
def test_illegal_transition_is_409(incident_at, engineer, start, target):
    incident = incident_at(start)
    status, _ = call(
        "PATCH", f"/incidents/{incident['id']}/status", {"to_status": target}, token=engineer
    )
    assert status == 409


def test_unknown_status_is_400(incident_at, engineer):
    incident = incident_at("Open")
    status, _ = call(
        "PATCH", f"/incidents/{incident['id']}/status", {"to_status": "Banana"}, token=engineer
    )
    assert status == 400


def test_resolved_at_is_set(incident_at, engineer):
    incident = incident_at("In Progress")
    _, payload = call(
        "PATCH", f"/incidents/{incident['id']}/status", {"to_status": "Resolved"}, token=engineer
    )
    assert payload["incident"]["resolved_at"] is not None
    assert payload["incident"]["closed_at"] is None


def test_closed_at_is_set(incident_at, engineer):
    incident = incident_at("Resolved")
    _, payload = call(
        "PATCH", f"/incidents/{incident['id']}/status", {"to_status": "Closed"}, token=engineer
    )
    assert payload["incident"]["closed_at"] is not None


def test_history_row_written(incident_at, engineer):
    incident = incident_at("Open")
    call(
        "PATCH",
        f"/incidents/{incident['id']}/status",
        {"to_status": "In Progress", "reason": "picked it up"},
        token=engineer,
    )
    with connect() as conn:
        rows = conn.execute(
            "SELECT from_status, to_status, reason FROM incident_status_history"
            " WHERE incident_id = %s ORDER BY id",
            (incident["id"],),
        ).fetchall()
    assert rows[-1] == ("Open", "In Progress", "picked it up")


def test_rejected_transition_writes_no_history(incident_at, engineer):
    incident = incident_at("Open")
    call("PATCH", f"/incidents/{incident['id']}/status", {"to_status": "Closed"}, token=engineer)
    with connect() as conn:
        count = conn.execute(
            "SELECT count(*) FROM incident_status_history WHERE incident_id = %s",
            (incident["id"],),
        ).fetchone()[0]
    assert count == 0


def test_non_assigned_engineer_is_403(incident_at, other_engineer):
    incident = incident_at("Open")
    status, _ = call(
        "PATCH",
        f"/incidents/{incident['id']}/status",
        {"to_status": "In Progress"},
        token=other_engineer,
    )
    assert status == 403


def test_reporter_cannot_change_status(incident_at, employee):
    incident = incident_at("Open")
    status, _ = call(
        "PATCH", f"/incidents/{incident['id']}/status", {"to_status": "In Progress"}, token=employee
    )
    assert status == 403
