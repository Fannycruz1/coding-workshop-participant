"""Phase 1: route-level tests against the Phase 0 seeded DB."""

import json
import uuid

import pytest

from function import handler

PASSWORD = "Password123!"
ADMIN = "admin@acme.inc"
EMPLOYEE = "employee@acme.inc"


def call(method, path, body=None, token=None):
    event = {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "headers": {"authorization": f"Bearer {token}"} if token else {},
        "body": json.dumps(body) if body is not None else None,
    }
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


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
