"""auth-service Lambda: register, login, me, admin-created engineers."""

import json
import logging

import psycopg
from pydantic import ValidationError

import repo
from auth import bearer_claims, create_access_token
from models import EngineerCreateRequest, LoginRequest, RegisterRequest, UserPublic
from security import hash_password, verify_password

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ADMIN_ROLE = "facility_admin"

# Column order of repo.PUBLIC_COLUMNS.
PUBLIC_FIELDS = ("id", "email", "full_name", "role", "is_active")


def respond(status, payload):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def public_user(row):
    return UserPublic(**dict(zip(PUBLIC_FIELDS, row))).model_dump()


def parse(event, model):
    """Returns (instance, None) on success, (None, 400 response) on bad input."""
    try:
        return model.model_validate_json(event.get("body") or "{}"), None
    except ValidationError as exc:
        return None, respond(400, {
            "error": "invalid request body",
            "details": exc.errors(include_url=False, include_input=False),
        })


def register(event):
    req, error = parse(event, RegisterRequest)
    if error:
        return error
    try:
        row = repo.create_user(req.email, hash_password(req.password), req.full_name, req.role)
    except psycopg.errors.UniqueViolation:
        return respond(409, {"error": "email already registered"})
    except psycopg.errors.CheckViolation:
        return respond(400, {"error": "email must be an @acme.inc address"})
    return respond(201, {"user": public_user(row)})


def login(event):
    req, error = parse(event, LoginRequest)
    if error:
        return error
    row = repo.find_by_email(req.email)
    # Same response for unknown email and wrong password — don't leak which accounts exist.
    if not row or not verify_password(req.password, row[-1]):
        return respond(401, {"error": "invalid email or password"})
    user = public_user(row[:-1])
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    return respond(200, {"token": token, "user": user})


def me(claims):
    row = repo.find_by_id(int(claims["sub"]))
    if not row:
        return respond(401, {"error": "unknown user"})
    return respond(200, public_user(row))


def create_engineer(event):
    req, error = parse(event, EngineerCreateRequest)
    if error:
        return error
    try:
        row = repo.create_engineer(
            req.email, hash_password(req.password), req.full_name, req.specialty, req.phone
        )
    except psycopg.errors.UniqueViolation:
        return respond(409, {"error": "email already registered"})
    except psycopg.errors.CheckViolation:
        return respond(400, {"error": "email must be an @acme.inc address"})
    return respond(201, {"user": public_user(row)})


def handler(event=None, context=None):
    event = event or {}
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    # proxy-server.js joins its base URL and the path into "//login" — strip both
    # ends so a route matches whether or not the slashes doubled up.
    path = "/" + (event.get("rawPath") or "").strip("/")

    try:
        # Permission gate first: nothing below runs for a caller who isn't allowed.
        if (method, path) == ("POST", "/register"):
            return register(event)
        if (method, path) == ("POST", "/login"):
            return login(event)

        claims = bearer_claims(event)
        if not claims:
            return respond(401, {"error": "missing or invalid token"})

        if (method, path) == ("GET", "/me"):
            return me(claims)
        if (method, path) == ("POST", "/engineers"):
            if claims.get("role") != ADMIN_ROLE:
                return respond(403, {"error": "admin only"})
            return create_engineer(event)

        return respond(404, {"error": f"no route for {method} {path}"})
    except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
        logger.exception("handler error")
        return respond(500, {"error": "internal error", "message": str(exc)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/me"}))
