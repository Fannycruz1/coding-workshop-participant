"""facilities-service Lambda: CRUD for buildings, floors and seats.

Admins define the facility; everyone logged in can read it, because the
incident form needs the three lists to build its dropdowns.
"""

import json
import logging

import psycopg
from pydantic import ValidationError

import repo
from auth import request_claims
from models import (
    BuildingCreate,
    BuildingUpdate,
    FloorCreate,
    FloorUpdate,
    SeatCreate,
    SeatUpdate,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ADMIN_ROLE = "facility_admin"

# One entry per table: what to validate a write against, and what to call a
# single row in the response body.
RESOURCES = {
    "buildings": {"create": BuildingCreate, "update": BuildingUpdate, "one": "building"},
    "floors": {"create": FloorCreate, "update": FloorUpdate, "one": "floor"},
    "seats": {"create": SeatCreate, "update": SeatUpdate, "one": "seat"},
}


def respond(status, payload):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def parse(event, model):
    """Returns (instance, None) on success, (None, 400 response) on bad input."""
    try:
        return model.model_validate_json(event.get("body") or "{}"), None
    except ValidationError as exc:
        return None, respond(400, {
            "error": "invalid request body",
            "details": exc.errors(include_url=False, include_input=False),
        })


def one(table, row):
    return respond(200, {RESOURCES[table]["one"]: repo.row_to_dict(table, row)})


def list_resource(table, event):
    raw = (event.get("queryStringParameters") or {}).get(repo.PARENT.get(table, ""))
    if raw is not None and not str(raw).lstrip("-").isdigit():
        return respond(400, {"error": f"{repo.PARENT[table]} must be a number"})
    rows = repo.list_rows(table, int(raw) if raw is not None else None)
    return respond(200, {table: [repo.row_to_dict(table, r) for r in rows]})


def create(table, event):
    req, error = parse(event, RESOURCES[table]["create"])
    if error:
        return error
    try:
        row = repo.create_row(table, req.model_dump())
    except psycopg.errors.UniqueViolation:
        return respond(409, {"error": f"that {RESOURCES[table]['one']} already exists"})
    except psycopg.errors.ForeignKeyViolation:
        return respond(400, {"error": f"unknown {repo.PARENT[table]}"})
    return respond(201, {RESOURCES[table]["one"]: repo.row_to_dict(table, row)})


def update(table, row_id, event):
    req, error = parse(event, RESOURCES[table]["update"])
    if error:
        return error
    fields = req.model_dump(exclude_unset=True)
    if not fields:
        return respond(400, {"error": "nothing to update"})
    try:
        row = repo.update_row(table, row_id, fields)
    except psycopg.errors.UniqueViolation:
        return respond(409, {"error": f"that {RESOURCES[table]['one']} already exists"})
    except psycopg.errors.ForeignKeyViolation:
        return respond(400, {"error": f"unknown {repo.PARENT[table]}"})
    if not row:
        return respond(404, {"error": f"{RESOURCES[table]['one']} not found"})
    return one(table, row)


def delete(table, row_id):
    try:
        if not repo.delete_row(table, row_id):
            return respond(404, {"error": f"{RESOURCES[table]['one']} not found"})
    except psycopg.errors.ForeignKeyViolation:
        # An incident still points at this row. Floors and seats cascade from
        # their building; incidents deliberately do not, so refuse instead.
        return respond(409, {"error": "still referenced by an incident"})
    return respond(200, {"deleted": row_id})


def route(method, segments, event, claims):
    """Every branch checks permission before it does anything else."""
    table = segments[0]
    if table not in RESOURCES:
        return respond(404, {"error": f"no route for {method} /{'/'.join(segments)}"})

    # Reads are open to anyone logged in; every write is admin only.
    if method != "GET" and claims.get("role") != ADMIN_ROLE:
        return respond(403, {"error": "admin only"})

    if len(segments) == 1:
        if method == "GET":
            return list_resource(table, event)
        if method == "POST":
            return create(table, event)

    if len(segments) == 2 and segments[1].isdigit():
        row_id = int(segments[1])
        if method == "GET":
            row = repo.find_row(table, row_id)
            if not row:
                return respond(404, {"error": f"{RESOURCES[table]['one']} not found"})
            return one(table, row)
        if method == "PATCH":
            return update(table, row_id, event)
        if method == "DELETE":
            return delete(table, row_id)

    return respond(404, {"error": f"no route for {method} /{'/'.join(segments)}"})


def handler(event=None, context=None):
    event = event or {}
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    # proxy-server.js joins its base URL and the path into "//buildings" — drop
    # the empty pieces so a route matches whether or not the slashes doubled up.
    segments = [s for s in (event.get("rawPath") or "").split("/") if s]

    try:
        # Permission gate first: nothing below runs for a caller who isn't allowed.
        claims = request_claims(event)
        if not claims:
            return respond(401, {"error": "missing or invalid token"})
        if not segments:
            return respond(404, {"error": "no route for /"})
        return route(method, segments, event, claims)
    except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
        logger.exception("handler error")
        return respond(500, {"error": "internal error", "message": str(exc)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/buildings"}))
