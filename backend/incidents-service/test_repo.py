"""Role-scoped listing and the GET /incidents filters."""

from conftest import call


def ids(payload):
    return [i["id"] for i in payload["incidents"]]


def test_employee_sees_only_own(employee, other_employee, make_incident):
    mine = make_incident()

    _, own = call("GET", "/incidents", token=employee)
    assert mine["id"] in ids(own)

    _, theirs = call("GET", "/incidents", token=other_employee)
    assert mine["id"] not in ids(theirs)


def test_admin_sees_everything(admin, employee, make_incident):
    mine = make_incident()
    _, payload = call("GET", "/incidents", token=admin)
    assert mine["id"] in ids(payload)
    # The seeded 60 belong to other people; an admin still sees them.
    assert len(payload["incidents"]) > 1


def test_engineer_sees_unassigned(engineer, make_incident):
    unassigned = make_incident()
    _, payload = call("GET", "/incidents", token=engineer)
    assert unassigned["id"] in ids(payload)


def test_engineer_sees_own_assignments_not_others(engineer, other_engineer, admin, make_incident):
    incident = make_incident()
    status, _ = call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    assert status == 200

    _, assignee_view = call("GET", "/incidents", token=engineer)
    assert incident["id"] in ids(assignee_view)

    # Now assigned to someone else, so it leaves the other engineer's queue.
    _, other_view = call("GET", "/incidents", token=other_engineer)
    assert incident["id"] not in ids(other_view)


def test_unauthenticated_is_rejected():
    status, _ = call("GET", "/incidents")
    assert status == 401


def test_filter_by_status(employee, make_incident):
    make_incident()
    _, payload = call("GET", "/incidents", token=employee, query={"status": "Open"})
    assert payload["incidents"]
    assert {i["status"] for i in payload["incidents"]} == {"Open"}


def test_filter_by_category(employee, make_incident):
    make_incident(category="Plumbing")
    _, payload = call("GET", "/incidents", token=employee, query={"category": "Plumbing"})
    assert {i["category"] for i in payload["incidents"]} == {"Plumbing"}


def test_filter_by_priority(employee, make_incident):
    make_incident(priority="Critical")
    _, payload = call("GET", "/incidents", token=employee, query={"priority": "Critical"})
    assert {i["priority"] for i in payload["incidents"]} == {"Critical"}


def test_filter_by_building(employee, make_incident):
    make_incident(building_id=1, floor_id=1)
    _, payload = call("GET", "/incidents", token=employee, query={"building_id": "1"})
    assert {i["building_id"] for i in payload["incidents"]} == {1}


def test_filter_by_assigned_to(admin, engineer, make_incident):
    incident = make_incident()
    _, assigned = call("POST", f"/incidents/{incident['id']}/assign", token=engineer)
    engineer_id = assigned["incident"]["assigned_to"]

    _, payload = call("GET", "/incidents", token=admin, query={"assigned_to": str(engineer_id)})
    assert incident["id"] in ids(payload)
    assert {i["assigned_to"] for i in payload["incidents"]} == {engineer_id}


def test_full_text_search(employee, make_incident):
    incident = make_incident(title="Zamboni malfunction in the atrium")
    _, payload = call("GET", "/incidents", token=employee, query={"q": "zamboni"})
    assert incident["id"] in ids(payload)


def test_filters_combine(employee, make_incident):
    wanted = make_incident(category="Network", priority="Low")
    make_incident(category="Network", priority="Critical")

    _, payload = call(
        "GET", "/incidents", token=employee, query={"category": "Network", "priority": "Low"}
    )
    assert wanted["id"] in ids(payload)
    assert all(i["category"] == "Network" and i["priority"] == "Low" for i in payload["incidents"])


def test_bad_filter_value_is_400(employee):
    status, _ = call("GET", "/incidents", token=employee, query={"status": "Banana"})
    assert status == 400
