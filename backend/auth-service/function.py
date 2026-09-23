"""auth-service Lambda: register, login, me, admin-created engineers."""

import json
import logging

import psycopg
from pydantic import ValidationError

import repo
from auth import create_access_token, request_claims, session_cookie
from models import (
    EngineerCreateRequest,
    EngineerUpdate,
    LoginRequest,
    RegisterRequest,
    UserPublic,
)
from security import hash_password, verify_password

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ADMIN_ROLE = "facility_admin"

# Column order of repo.PUBLIC_COLUMNS.
PUBLIC_FIELDS = ("id", "email", "full_name", "role", "is_active")


def respond(status, payload, cookie=None):
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Set-Cookie"] = cookie
    return {"statusCode": status, "headers": headers, "body": json.dumps(payload)}


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
    # Same response for unknown email, wrong password and a deactivated account —
    # don't leak which accounts exist, or which ones used to.
    if not row or not row[4] or not verify_password(req.password, row[-1]):
        return respond(401, {"error": "invalid email or password"})
    user = public_user(row[:-1])
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    # The cookie is what the browser uses. The token stays in the body for API
    # clients with no cookie jar — curl and the smoke tests. The app ignores it.
    return respond(200, {"token": token, "user": user}, cookie=session_cookie(token))


def me(claims):
    row = repo.find_by_id(int(claims["sub"]))
    # A token outlives a deactivation by up to 8 hours, so re-check here.
    if not row or not row[4]:
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


def list_engineers():
    return respond(200, {"engineers": [repo.engineer(r) for r in repo.list_engineers()]})


def update_engineer(event, user_id):
    req, error = parse(event, EngineerUpdate)
    if error:
        return error
    # exclude_unset keeps "phone": null (clear it) apart from an omitted phone.
    fields = req.model_dump(exclude_unset=True)
    if not fields:
        return respond(400, {"error": "nothing to update"})
    row = repo.update_engineer(user_id, fields)
    if not row:
        return respond(404, {"error": "engineer not found"})
    return respond(200, {"engineer": repo.engineer(row)})


def delete_engineer(user_id):
    if not repo.deactivate_engineer(user_id):
        return respond(404, {"error": "engineer not found"})
    return respond(200, {"deleted": user_id})


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
        # Before the token gate on purpose: clearing the cookie must work even
        # when the session it holds has already expired.
        if (method, path) == ("POST", "/logout"):
            return respond(200, {"logged_out": True}, cookie=session_cookie(expires_in=0))

        claims = request_claims(event)
        if not claims:
            return respond(401, {"error": "missing or invalid token"})

        if (method, path) == ("GET", "/me"):
            return me(claims)

        segments = path.strip("/").split("/")
        if segments[0] == "engineers":
            if claims.get("role") != ADMIN_ROLE:
                return respond(403, {"error": "admin only"})
            if len(segments) == 1:
                if method == "POST":
                    return create_engineer(event)
                if method == "GET":
                    return list_engineers()
            if len(segments) == 2 and segments[1].isdigit():
                if method == "PATCH":
                    return update_engineer(event, int(segments[1]))
                if method == "DELETE":
                    return delete_engineer(int(segments[1]))

        return respond(404, {"error": f"no route for {method} {path}"})
    except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
        logger.exception("handler error")
        return respond(500, {"error": "internal error", "message": str(exc)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/me"}))
