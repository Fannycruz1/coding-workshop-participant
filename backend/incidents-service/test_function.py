"""Route-level create / read / assign / note / delete, with the permission gate."""

from conftest import call
from db import connect


# --- create ---------------------------------------------------------------

def test_employee_creates(employee):
    status, payload = call("POST", "/incidents", {
        "title": "Aircon dripping", "description": "onto my desk",
        "category": "HVAC", "building_id": 1, "floor_id": 1,
    }, token=employee)
    assert status == 201, payload
    assert payload["incident"]["status"] == "Open"
    assert payload["incident"]["priority"] == "Medium"  # schema default
    assert payload["incident"]["assigned_to"] is None


def test_created_by_is_the_caller_not_the_body(employee, other_employee):
    """created_by comes from the token. Passing someone else's id must not stick."""
    _, mine = call("POST", "/incidents", {
        "title": "Ownership test", "category": "Other",
        "building_id": 1, "floor_id": 1, "created_by": 1,
    }, token=employee)
    _, theirs = call("GET", "/incidents", token=other_employee)
    assert mine["incident"]["id"] not in [i["id"] for i in theirs["incidents"]]


def test_engineer_cannot_create(engineer):
    status, _ = call("POST", "/incidents", {
        "title": "Nope", "category": "Other", "building_id": 1, "floor_id": 1,
    }, token=engineer)
    assert status == 403


def test_create_requires_login():
    status, _ = call("POST", "/incidents", {"title": "x"})
    assert status == 401


def test_create_validates_body(employee):
    status, _ = call("POST", "/incidents", {"title": "no category"}, token=employee)
    assert status == 400


def test_create_with_unknown_building_is_400(employee):
    status, _ = call("POST", "/incidents", {
        "title": "Ghost building", "category": "Other",
        "building_id": 99999, "floor_id": 99999,
    }, token=employee)
    assert status == 400


# --- read -----------------------------------------------------------------

def test_get_one(employee, make_incident):
    incident = make_incident()
    status, payload = call("GET", f"/incidents/{incident['id']}", token=employee)
    assert status == 200
    assert payload["incident"]["id"] == incident["id"]


def test_get_one_outside_your_scope_is_404(other_employee, make_incident):
    """Not 403 — an employee should not learn that someone else's incident exists."""
    incident = make_incident()
    status, _ = call("GET", f"/incidents/{incident['id']}", token=other_employee)
    assert status == 404


def test_get_missing_is_404(employee):
    status, _ = call("GET", "/incidents/99999999", token=employee)
    assert status == 404


def test_unknown_route_logged_out_is_401():
    status, _ = call("GET", "/nope")
    assert status == 401


def test_unknown_route_logged_in_is_404(employee):
    status, _ = call("GET", "/nope", token=employee)
    assert status == 404


def test_double_slash_path(employee):
    """proxy-server.js joins base + path into '//incidents'."""
    status, _ = call("GET", "//incidents", token=employee)
    assert status == 200


# --- assign ---------------------------------------------------------------

def test_engineer_self_assigns(engineer, make_incident):
    incident = make_incident()
    status, payload = call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    assert status == 200
    assert payload["incident"]["assigned_to"] is not None


def test_engineer_cannot_assign_someone_else(engineer, other_engineer, make_incident):
    incident = make_incident()
    _, other = call("POST", f"/incidents/{incident['id']}/assign", token=other_engineer)
    other_id = other["incident"]["assigned_to"]

    incident2 = make_incident()
    status, _ = call(
        "POST", f"/incidents/{incident2['id']}/assign", {"engineer_id": other_id}, token=engineer
    )
    assert status == 403


def test_admin_assigns_and_reassigns(admin, engineer, other_engineer, make_incident):
    incident = make_incident()
    _, first = call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    first_id = first["incident"]["assigned_to"]

    _, second = call("POST", f"/incidents/{incident['id']}/assign", token=other_engineer)
    assert second is not None

    status, payload = call(
        "POST", f"/incidents/{incident['id']}/assign", {"engineer_id": first_id}, token=admin
    )
    assert status == 200
    assert payload["incident"]["assigned_to"] == first_id


def test_employee_cannot_assign(employee, make_incident):
    incident = make_incident()
    status, _ = call("POST", f"/incidents/{incident['id']}/assign", token=employee)
    assert status == 403


def test_assigning_a_non_engineer_is_400(admin, employee, make_incident):
    incident = make_incident()
    status, _ = call(
        "POST", f"/incidents/{incident['id']}/assign", {"engineer_id": 9}, token=admin
    )
    assert status == 400


def test_reads_carry_reporter_and_assignee_names(engineer, employee, make_incident):
    """The API returns ids; a dashboard needs names, and only the DB has them."""
    incident = make_incident()
    _, payload = call("GET", f"/incidents/{incident['id']}", token=employee)
    assert payload["incident"]["reporter_name"] == "Alex Johnson"
    assert payload["incident"]["assignee_name"] is None

    call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    _, listed = call("GET", "/incidents", token=engineer)
    mine = next(i for i in listed["incidents"] if i["id"] == incident["id"])
    assert mine["assignee_name"] == "Sofia Reyes"


# --- limit ----------------------------------------------------------------

def test_list_is_capped_by_default(admin):
    """The seed alone holds hundreds. An uncapped list is a dashboard that
    renders every row it is given — see docs/build-notes.md, Phase 6."""
    _, payload = call("GET", "/incidents", token=admin)
    assert len(payload["incidents"]) == 50


def test_limit_can_be_lowered(admin):
    _, payload = call("GET", "/incidents", query={"limit": "5"}, token=admin)
    assert len(payload["incidents"]) == 5


def test_limit_is_bounded(admin):
    for bad in ("0", "-1", "1000", "all"):
        status, _ = call("GET", "/incidents", query={"limit": bad}, token=admin)
        assert status == 400, bad


def test_limit_keeps_the_newest(admin):
    _, capped = call("GET", "/incidents", query={"limit": "3"}, token=admin)
    ids = [i["id"] for i in capped["incidents"]]
    assert ids == sorted(ids, reverse=True)


# --- notes ----------------------------------------------------------------

def test_reporter_adds_note(employee, make_incident):
    incident = make_incident()
    status, payload = call(
        "POST", f"/incidents/{incident['id']}/notes", {"body": "any update?"}, token=employee
    )
    assert status == 201, payload
    assert payload["note"]["body"] == "any update?"


def test_assigned_engineer_adds_note(engineer, make_incident):
    incident = make_incident()
    call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    status, _ = call(
        "POST", f"/incidents/{incident['id']}/notes", {"body": "on my way"}, token=engineer
    )
    assert status == 201


def test_admin_adds_note(admin, make_incident):
    incident = make_incident()
    status, _ = call(
        "POST", f"/incidents/{incident['id']}/notes", {"body": "chasing this"}, token=admin
    )
    assert status == 201


def test_unrelated_engineer_cannot_note(other_engineer, engineer, make_incident):
    incident = make_incident()
    call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    status, _ = call(
        "POST", f"/incidents/{incident['id']}/notes", {"body": "butting in"}, token=other_engineer
    )
    assert status == 403


def test_unrelated_employee_cannot_note(other_employee, make_incident):
    incident = make_incident()
    status, _ = call(
        "POST", f"/incidents/{incident['id']}/notes", {"body": "nosy"}, token=other_employee
    )
    assert status == 403


def test_notes_blocked_once_closed(employee, engineer, make_incident):
    incident = make_incident()
    call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    for step in ("In Progress", "Resolved", "Closed"):
        call("PATCH", f"/incidents/{incident['id']}/status", {"to_status": step}, token=engineer)

    status, _ = call(
        "POST", f"/incidents/{incident['id']}/notes", {"body": "too late"}, token=employee
    )
    assert status == 409


def test_notes_allowed_while_resolved(employee, engineer, make_incident):
    """Resolved is not final — the reporter must be able to say the fix failed."""
    incident = make_incident()
    call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    for step in ("In Progress", "Resolved"):
        call("PATCH", f"/incidents/{incident['id']}/status", {"to_status": step}, token=engineer)

    status, _ = call(
        "POST", f"/incidents/{incident['id']}/notes", {"body": "still broken"}, token=employee
    )
    assert status == 201


def test_empty_note_is_400(employee, make_incident):
    incident = make_incident()
    status, _ = call("POST", f"/incidents/{incident['id']}/notes", {"body": ""}, token=employee)
    assert status == 400


def test_reads_notes_oldest_first_with_author_names(employee, engineer, make_incident):
    incident = make_incident()
    call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    call("POST", f"/incidents/{incident['id']}/notes", {"body": "any update?"}, token=employee)
    call("POST", f"/incidents/{incident['id']}/notes", {"body": "on my way"}, token=engineer)

    status, payload = call("GET", f"/incidents/{incident['id']}/notes", token=employee)
    assert status == 200, payload
    assert [n["body"] for n in payload["notes"]] == ["any update?", "on my way"]
    assert payload["notes"][1]["author_name"] == "Sofia Reyes"


def test_unrelated_employee_cannot_read_notes(other_employee, make_incident):
    """Same rule as GET /incidents/{id}: out of scope is a 404, not a 403."""
    incident = make_incident()
    status, _ = call("GET", f"/incidents/{incident['id']}/notes", token=other_employee)
    assert status == 404


def test_reading_notes_requires_login(make_incident):
    incident = make_incident()
    status, _ = call("GET", f"/incidents/{incident['id']}/notes")
    assert status == 401


# --- delete ---------------------------------------------------------------

def test_admin_deletes(admin, make_incident):
    incident = make_incident()
    status, _ = call("DELETE", f"/incidents/{incident['id']}", token=admin)
    assert status == 200

    with connect() as conn:
        assert conn.execute(
            "SELECT count(*) FROM incidents WHERE id = %s", (incident["id"],)
        ).fetchone()[0] == 0


def test_delete_cascades_to_notes(admin, employee, make_incident):
    incident = make_incident()
    call("POST", f"/incidents/{incident['id']}/notes", {"body": "doomed"}, token=employee)
    call("DELETE", f"/incidents/{incident['id']}", token=admin)

    with connect() as conn:
        assert conn.execute(
            "SELECT count(*) FROM incident_notes WHERE incident_id = %s", (incident["id"],)
        ).fetchone()[0] == 0


def test_engineer_cannot_delete(engineer, make_incident):
    incident = make_incident()
    status, _ = call("DELETE", f"/incidents/{incident['id']}", token=engineer)
    assert status == 403


def test_reporter_cannot_delete(employee, make_incident):
    incident = make_incident()
    status, _ = call("DELETE", f"/incidents/{incident['id']}", token=employee)
    assert status == 403


def test_delete_missing_is_404(admin):
    status, _ = call("DELETE", "/incidents/99999999", token=admin)
    assert status == 404
