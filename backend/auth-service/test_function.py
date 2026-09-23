"""Phase 1: route-level tests against the Phase 0 seeded DB."""

import json
import uuid

import pytest

from function import handler

PASSWORD = "Password123!"
ADMIN = "admin@acme.inc"
EMPLOYEE = "employee@acme.inc"


def call(method, path, body=None, token=None, cookie=None):
    headers = {}
    if token:
        headers["authorization"] = f"Bearer {token}"
    if cookie:
        headers["cookie"] = f"acme_session={cookie}"
    event = {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "headers": headers,
        "body": json.dumps(body) if body is not None else None,
    }
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def raw_call(method, path, body=None, cookie=None):
    """The whole Lambda response, for the tests that care about Set-Cookie."""
    return handler({
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "headers": {"cookie": f"acme_session={cookie}"} if cookie else {},
        "body": json.dumps(body) if body is not None else None,
    }, None)


def login(email, password=PASSWORD):
    status, body = call("POST", "/login", {"email": email, "password": password})
    assert status == 200, body
    return body["token"]


@pytest.fixture
def new_email():
    return f"test.{uuid.uuid4().hex[:8]}@acme.inc"


def test_register_success(new_email):
    status, body = call("POST", "/register", {
        "email": new_email, "password": PASSWORD, "full_name": "Test User", "role": "employee",
    })
    assert status == 201, body
    assert body["user"]["email"] == new_email
    assert "password" not in body["user"]
    assert login(new_email)


def test_register_duplicate_rejected():
    status, _ = call("POST", "/register", {
        "email": EMPLOYEE, "password": PASSWORD, "full_name": "Dup", "role": "employee",
    })
    assert status == 409


def test_register_engineer_role_rejected(new_email):
    status, _ = call("POST", "/register", {
        "email": new_email, "password": PASSWORD, "full_name": "Sneaky", "role": "engineer",
    })
    assert status == 400


def test_login_wrong_password():
    status, _ = call("POST", "/login", {"email": EMPLOYEE, "password": "wrong"})
    assert status == 401


def test_login_unknown_user():
    status, _ = call("POST", "/login", {"email": "nobody@acme.inc", "password": PASSWORD})
    assert status == 401


def test_me_returns_profile():
    status, body = call("GET", "/me", token=login(EMPLOYEE))
    assert status == 200
    assert body["email"] == EMPLOYEE
    assert body["role"] == "employee"
    assert "password" not in body


@pytest.mark.parametrize("token", [None, "garbage"])
def test_me_requires_valid_token(token):
    status, _ = call("GET", "/me", token=token)
    assert status == 401


def test_create_engineer_as_admin(new_email):
    status, body = call("POST", "/engineers", {
        "email": new_email, "password": PASSWORD, "full_name": "New Eng",
        "specialty": "HVAC", "phone": "555-0100",
    }, token=login(ADMIN))
    assert status == 201, body
    assert body["user"]["role"] == "engineer"
    status, me = call("GET", "/me", token=login(new_email))
    assert me["role"] == "engineer"


def test_create_engineer_as_employee_forbidden(new_email):
    status, _ = call("POST", "/engineers", {
        "email": new_email, "password": PASSWORD, "full_name": "Nope", "specialty": "HVAC",
    }, token=login(EMPLOYEE))
    assert status == 403


def test_create_engineer_without_token(new_email):
    status, _ = call("POST", "/engineers", {
        "email": new_email, "password": PASSWORD, "full_name": "Nope", "specialty": "HVAC",
    })
    assert status == 401


def test_unknown_route():
    # Auth gate runs before dispatch, so an anonymous caller gets 401, not a route map.
    assert call("GET", "/nope")[0] == 401
    assert call("GET", "/nope", token=login(EMPLOYEE))[0] == 404


def test_unknown_specialty_rejected(new_email):
    status, _ = call("POST", "/engineers", {
        "email": new_email, "password": PASSWORD, "full_name": "Eng", "specialty": "Astrology",
    }, token=login(ADMIN))
    assert status == 400


def test_malformed_body_rejected():
    event = {
        "requestContext": {"http": {"method": "POST"}},
        "rawPath": "/login",
        "headers": {},
        "body": "{not json",
    }
    assert handler(event, None)["statusCode"] == 400


def test_double_slash_path():
    # The dev proxy forwards "//me"; it must reach the same route as "/me".
    assert call("GET", "//me", token=login(EMPLOYEE))[0] == 200


# --- Phase 5: engineer profile CRUD, admin only ---------------------------

@pytest.fixture
def engineer(new_email):
    status, body = call("POST", "/engineers", {
        "email": new_email, "password": PASSWORD, "full_name": "Phase 5 Eng",
        "specialty": "Plumbing", "phone": "555-0199",
    }, token=login(ADMIN))
    assert status == 201, body
    return body["user"]


def test_list_engineers_includes_profiles(engineer):
    status, body = call("GET", "/engineers", token=login(ADMIN))
    assert status == 200, body
    listed = {e["id"]: e for e in body["engineers"]}
    assert listed[engineer["id"]]["specialty"] == "Plumbing"
    assert listed[engineer["id"]]["phone"] == "555-0199"
    assert all(e["role"] == "engineer" for e in body["engineers"])
    assert "password" not in listed[engineer["id"]]


def test_update_engineer_profile(engineer):
    status, body = call("PATCH", f"/engineers/{engineer['id']}", {
        "specialty": "Network", "phone": "555-0200",
    }, token=login(ADMIN))
    assert status == 200, body
    assert body["engineer"]["specialty"] == "Network"
    assert body["engineer"]["phone"] == "555-0200"


def test_update_engineer_partially(engineer):
    status, body = call(
        "PATCH", f"/engineers/{engineer['id']}", {"phone": "555-0300"}, token=login(ADMIN)
    )
    assert status == 200, body
    assert body["engineer"]["phone"] == "555-0300"
    assert body["engineer"]["specialty"] == "Plumbing"  # untouched


def test_update_engineer_empty_body_rejected(engineer):
    status, _ = call("PATCH", f"/engineers/{engineer['id']}", {}, token=login(ADMIN))
    assert status == 400


def test_update_non_engineer_is_404(engineer):
    """The route edits engineers; an employee id must not be reachable through it."""
    status, _ = call("PATCH", "/engineers/999999999", {"phone": "x"}, token=login(ADMIN))
    assert status == 404


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
def test_engineer_routes_cannot_touch_a_non_engineer(method):
    """/engineers/{id} must not become a back door for editing or deleting any user."""
    employee_id = call("GET", "/me", token=login(EMPLOYEE))[1]["id"]
    assert call(method, f"/engineers/{employee_id}", {"phone": "x"}, token=login(ADMIN))[0] == 404
    assert call("GET", "/me", token=login(EMPLOYEE))[0] == 200  # still active, still there


def test_delete_engineer_deactivates_and_hides_them(engineer):
    """Soft delete: the row stays for the audit trail, the account stops working."""
    from db import connect

    assert call("DELETE", f"/engineers/{engineer['id']}", token=login(ADMIN))[0] == 200
    status, body = call("GET", "/engineers", token=login(ADMIN))
    assert engineer["id"] not in [e["id"] for e in body["engineers"]]
    with connect() as conn:
        row = conn.execute(
            "SELECT is_active FROM users WHERE id = %s", (engineer["id"],)
        ).fetchone()
    assert row is not None and row[0] is False


def test_deactivated_engineer_cannot_log_in(engineer):
    assert call("DELETE", f"/engineers/{engineer['id']}", token=login(ADMIN))[0] == 200
    status, _ = call("POST", "/login", {"email": engineer["email"], "password": PASSWORD})
    assert status == 401


def test_deactivated_engineer_is_gone_from_the_api(engineer):
    """Once deactivated they are not there any more: no second delete, no edits."""
    assert call("DELETE", f"/engineers/{engineer['id']}", token=login(ADMIN))[0] == 200
    assert call("DELETE", f"/engineers/{engineer['id']}", token=login(ADMIN))[0] == 404
    status, _ = call("PATCH", f"/engineers/{engineer['id']}", {"phone": "x"}, token=login(ADMIN))
    assert status == 404


def _assign_incident_to(engineer_id):
    """A fresh incident assigned to this engineer. Returns its id."""
    from db import connect

    with connect() as conn:
        return conn.execute(
            "INSERT INTO incidents (title, category, created_by, assigned_to,"
            " building_id, floor_id) SELECT 'fk guard', 'Other', u.id, %s,"
            " i.building_id, i.floor_id FROM users u, incidents i"
            " WHERE u.email = %s LIMIT 1 RETURNING id",
            (engineer_id, EMPLOYEE),
        ).fetchone()[0]


def test_delete_engineer_unassigns_their_incidents(engineer):
    """incidents.assigned_to has no ON DELETE rule, so the work goes back to the pool."""
    from db import connect

    incident_id = _assign_incident_to(engineer["id"])
    assert call("DELETE", f"/engineers/{engineer['id']}", token=login(ADMIN))[0] == 200
    with connect() as conn:
        assigned = conn.execute(
            "SELECT assigned_to FROM incidents WHERE id = %s", (incident_id,)
        ).fetchone()[0]
    assert assigned is None  # unclaimed, not deleted along with them


def test_delete_engineer_keeps_their_audit_trail(engineer):
    """The point of the soft delete: notes written by a departed engineer survive."""
    from db import connect

    incident_id = _assign_incident_to(engineer["id"])
    with connect() as conn:
        conn.execute(
            "INSERT INTO incident_notes (incident_id, author_id, body)"
            " VALUES (%s, %s, 'on my way')",
            (incident_id, engineer["id"]),
        )
    assert call("DELETE", f"/engineers/{engineer['id']}", token=login(ADMIN))[0] == 200
    with connect() as conn:
        notes = conn.execute(
            "SELECT count(*) FROM incident_notes WHERE author_id = %s", (engineer["id"],)
        ).fetchone()[0]
    assert notes == 1


@pytest.mark.parametrize("method,path", [
    ("GET", "/engineers"), ("PATCH", "/engineers/1"), ("DELETE", "/engineers/1"),
])
def test_engineer_routes_are_admin_only(method, path):
    assert call(method, path, {"phone": "x"}, token=login(EMPLOYEE))[0] == 403
    assert call(method, path, {"phone": "x"})[0] == 401


def test_login_sets_session_cookie():
    res = raw_call("POST", "/login", {"email": EMPLOYEE, "password": PASSWORD})
    cookie = res["headers"]["Set-Cookie"]
    assert cookie.startswith("acme_session=")
    assert "HttpOnly" in cookie
    # The token stays in the body for curl and the smoke tests.
    assert json.loads(res["body"])["token"]


def test_cookie_alone_authenticates():
    token = login(EMPLOYEE)
    status, body = call("GET", "/me", cookie=token)
    assert status == 200, body
    assert body["email"] == EMPLOYEE


def test_bad_cookie_is_401():
    status, _ = call("GET", "/me", cookie="not-a-jwt")
    assert status == 401


def test_logout_kills_a_captured_token():
    """The whole point of revocation: the cookie is gone, the token must be too."""
    token = login(EMPLOYEE)
    assert call("GET", "/me", token=token)[0] == 200
    assert raw_call("POST", "/logout", cookie=token)["statusCode"] == 200
    # Same token, replayed the way a captured copy would be.
    assert call("GET", "/me", token=token)[0] == 401
    assert call("GET", "/me", cookie=token)[0] == 401


def test_logout_leaves_other_sessions_alone():
    """Logging out one browser must not sign the same user out everywhere."""
    phone, laptop = login(EMPLOYEE), login(ADMIN)
    raw_call("POST", "/logout", cookie=phone)
    assert call("GET", "/me", token=laptop)[0] == 200


def test_logout_clears_cookie_without_a_session():
    # Logout sits before the token gate: an expired session must still be clearable.
    res = raw_call("POST", "/logout")
    assert res["statusCode"] == 200
    assert "acme_session=; Max-Age=0" in res["headers"]["Set-Cookie"]


def test_the_cloudfront_path_routes_like_the_bare_one():
    """CloudFront forwards "/api/auth-service/login" unrewritten — it must still log in.

    Nothing rewrites the URI between CloudFront and the Function URL, so the
    deployed stack only ever sends this shape. Unstripped it fell past /login to
    the token gate and every request on AWS came back 401.
    """
    status, body = call("POST", "/api/auth-service/login", {"email": ADMIN, "password": PASSWORD})
    assert status == 200, body
    assert body["user"]["email"] == ADMIN
