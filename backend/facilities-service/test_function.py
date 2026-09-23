"""Phase 5: facilities CRUD. Admin writes, any logged-in user reads."""

import json
import uuid

import pytest

from function import handler

ADMIN = "admin@acme.inc"
EMPLOYEE = "employee@acme.inc"
ENGINEER = "sofia.reyes@acme.inc"


def call(method, path, body=None, token=None, query=None):
    event = {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "headers": {"authorization": f"Bearer {token}"} if token else {},
        "queryStringParameters": query or {},
        "body": json.dumps(body) if body is not None else None,
    }
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def token_for(email):
    """Signed here with the same JWT_SECRET auth-service uses."""
    from auth import create_access_token
    from db import connect

    with connect() as conn:
        row = conn.execute("SELECT id, role FROM users WHERE email = %s", (email,)).fetchone()
    assert row, f"{email} is not seeded — run db/seed.py"
    return create_access_token({"sub": str(row[0]), "role": row[1]})


@pytest.fixture(scope="session")
def admin():
    return token_for(ADMIN)


@pytest.fixture(scope="session")
def employee():
    return token_for(EMPLOYEE)


@pytest.fixture(scope="session")
def engineer():
    return token_for(ENGINEER)


def unique(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def building(admin):
    status, body = call("POST", "/buildings", {"name": unique("Test Tower")}, token=admin)
    assert status == 201, body
    return body["building"]


@pytest.fixture
def floor(admin, building):
    status, body = call(
        "POST", "/floors", {"building_id": building["id"], "floor_number": 1}, token=admin
    )
    assert status == 201, body
    return body["floor"]


@pytest.fixture
def seat(admin, floor):
    status, body = call(
        "POST", "/seats", {"floor_id": floor["id"], "seat_code": unique("S")}, token=admin
    )
    assert status == 201, body
    return body["seat"]


# --- buildings ------------------------------------------------------------

def test_create_building(building):
    assert building["name"].startswith("Test Tower")


def test_list_buildings_includes_new_one(employee, building):
    status, body = call("GET", "/buildings", token=employee)
    assert status == 200
    assert building["id"] in [b["id"] for b in body["buildings"]]


def test_update_building(admin, building):
    status, body = call(
        "PATCH", f"/buildings/{building['id']}", {"address": "1 New Street"}, token=admin
    )
    assert status == 200, body
    assert body["building"]["address"] == "1 New Street"
    assert body["building"]["name"] == building["name"]  # untouched fields stay


def test_delete_building(admin, building):
    assert call("DELETE", f"/buildings/{building['id']}", token=admin)[0] == 200
    assert call("GET", f"/buildings/{building['id']}", token=admin)[0] == 404


def test_duplicate_building_name_rejected(admin, building):
    status, _ = call("POST", "/buildings", {"name": building["name"]}, token=admin)
    assert status == 409


def test_delete_building_still_referenced_by_an_incident(admin, employee, building, floor):
    """incidents.building_id has no ON DELETE rule — the FK must surface as 409, not 500."""
    from db import connect

    with connect() as conn:
        conn.execute(
            "INSERT INTO incidents (title, category, created_by, building_id, floor_id)"
            " SELECT 'fk guard', 'Other', id, %s, %s FROM users WHERE email = %s",
            (building["id"], floor["id"], EMPLOYEE),
        )
    status, _ = call("DELETE", f"/buildings/{building['id']}", token=admin)
    assert status == 409


# --- floors and seats -----------------------------------------------------

def test_create_and_list_floors(employee, building, floor):
    status, body = call("GET", "/floors", token=employee, query={"building_id": building["id"]})
    assert status == 200
    assert [f["id"] for f in body["floors"]] == [floor["id"]]


def test_floor_under_unknown_building(admin):
    status, _ = call("POST", "/floors", {"building_id": 10**9, "floor_number": 1}, token=admin)
    assert status == 400


def test_duplicate_floor_number_rejected(admin, building, floor):
    status, _ = call(
        "POST", "/floors", {"building_id": building["id"], "floor_number": 1}, token=admin
    )
    assert status == 409


def test_update_and_delete_floor(admin, floor):
    status, body = call("PATCH", f"/floors/{floor['id']}", {"name": "Mezzanine"}, token=admin)
    assert status == 200, body
    assert body["floor"]["name"] == "Mezzanine"
    assert call("DELETE", f"/floors/{floor['id']}", token=admin)[0] == 200


def test_create_and_list_seats(engineer, floor, seat):
    status, body = call("GET", "/seats", token=engineer, query={"floor_id": floor["id"]})
    assert status == 200
    assert [s["id"] for s in body["seats"]] == [seat["id"]]


def test_update_and_delete_seat(admin, seat):
    status, body = call("PATCH", f"/seats/{seat['id']}", {"seat_code": unique("Z")}, token=admin)
    assert status == 200, body
    assert call("DELETE", f"/seats/{seat['id']}", token=admin)[0] == 200


def test_delete_missing_row(admin):
    assert call("DELETE", "/seats/999999999", token=admin)[0] == 404


# --- the permission gate --------------------------------------------------

@pytest.mark.parametrize("resource", ["buildings", "floors", "seats"])
def test_reads_are_open_to_any_logged_in_user(employee, resource):
    assert call("GET", f"/{resource}", token=employee)[0] == 200


@pytest.mark.parametrize("method,path", [
    ("POST", "/buildings"), ("PATCH", "/buildings/1"), ("DELETE", "/buildings/1"),
    ("POST", "/floors"), ("PATCH", "/floors/1"), ("DELETE", "/floors/1"),
    ("POST", "/seats"), ("PATCH", "/seats/1"), ("DELETE", "/seats/1"),
])
@pytest.mark.parametrize("who", ["employee", "engineer"])
def test_writes_are_admin_only(request, method, path, who):
    status, _ = call(method, path, {}, token=request.getfixturevalue(who))
    assert status == 403


def test_writes_require_a_token():
    assert call("POST", "/buildings", {"name": "Nope"})[0] == 401


def test_empty_patch_rejected(admin, building):
    assert call("PATCH", f"/buildings/{building['id']}", {}, token=admin)[0] == 400


def test_unknown_route(employee):
    assert call("GET", "/nope")[0] == 401
    assert call("GET", "/nope", token=employee)[0] == 404


def test_double_slash_path(employee):
    # The dev proxy forwards "//buildings"; it must reach the same route.
    assert call("GET", "//buildings", token=employee)[0] == 200


def test_the_cloudfront_path_routes_like_the_bare_one(employee):
    """CloudFront forwards "/api/facilities-service/buildings" unrewritten."""
    bare = call("GET", "/buildings", token=employee)
    assert call("GET", "/api/facilities-service/buildings", token=employee) == bare
    assert bare[0] == 200
