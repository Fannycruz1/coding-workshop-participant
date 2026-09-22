"""Shared fixtures: logins and a throwaway incident, used by all four test files."""

import json

import pytest

from function import handler

PASSWORD = "Password123!"
ADMIN = "admin@acme.inc"
EMPLOYEE = "employee@acme.inc"
OTHER_EMPLOYEE = "maria.garcia@acme.inc"
ENGINEER = "sofia.reyes@acme.inc"
OTHER_ENGINEER = "james.okafor@acme.inc"


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
def other_employee():
    return token_for(OTHER_EMPLOYEE)


@pytest.fixture(scope="session")
def engineer():
    return token_for(ENGINEER)


@pytest.fixture(scope="session")
def other_engineer():
    return token_for(OTHER_ENGINEER)


@pytest.fixture
def make_incident(employee):
    """A fresh incident owned by employee@acme.inc.

    Never reuse a seeded one: the seed holds 5 Pending escalations, so
    idx_escalation_one_pending would fail a test for the wrong reason.
    """

    def _make(**overrides):
        body = {
            "title": "Test incident",
            "description": "created by the test suite",
            "category": "HVAC",
            "building_id": 1,
            "floor_id": 1,
            **overrides,
        }
        status, payload = call("POST", "/incidents", body, token=employee)
        assert status == 201, payload
        return payload["incident"]

    return _make
