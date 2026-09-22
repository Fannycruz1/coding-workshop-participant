"""incidents-service Lambda: incidents, notes, assignment, status, escalations."""

import json
import logging

import psycopg
from pydantic import ValidationError

import repo
from auth import bearer_claims
from models import (
    AssignRequest,
    EscalationCreate,
    EscalationDecision,
    IncidentCreate,
    IncidentFilters,
    NoteCreate,
    StatusChange,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ADMIN_ROLE = "facility_admin"
ENGINEER_ROLE = "engineer"

# The only status changes we allow. Escalation is not in here on purpose: it
# raises the priority, which is a separate column and a separate table.
TRANSITIONS = {
    "Open": {"In Progress"},
    "In Progress": {"Blocked", "Resolved"},
    "Blocked": {"In Progress"},
    "Resolved": {"Closed", "In Progress"},  # reopen on a failed fix
    "Closed": set(),
}


def respond(status, payload):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        # default=str renders the timestamps psycopg hands back as datetimes.
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


def parse_filters(event):
    try:
        return IncidentFilters.model_validate(event.get("queryStringParameters") or {}), None
    except ValidationError as exc:
        return None, respond(400, {
            "error": "invalid query parameters",
            "details": exc.errors(include_url=False, include_input=False),
        })


# --- incidents ------------------------------------------------------------

def create_incident(event, claims):
    req, error = parse(event, IncidentCreate)
    if error:
        return error
    try:
        # created_by comes from the token, never the body.
        row = repo.create_incident(req, int(claims["sub"]))
    except psycopg.errors.ForeignKeyViolation:
        return respond(400, {"error": "unknown building, floor or seat"})
    return respond(201, {"incident": repo.incident(row)})


def list_incidents(event, claims):
    filters, error = parse_filters(event)
    if error:
        return error
    rows = repo.list_incidents(claims.get("role"), int(claims["sub"]), filters)
    return respond(200, {"incidents": [repo.incident(r) for r in rows]})


def get_incident(incident_id, claims):
    row = repo.find_visible_incident(incident_id, claims.get("role"), int(claims["sub"]))
    # Out of scope is a 404, not a 403: you should not learn it exists.
    if not row:
        return respond(404, {"error": "incident not found"})
    return respond(200, {"incident": repo.incident(row)})


def delete_incident(incident_id):
    if not repo.delete_incident(incident_id):
        return respond(404, {"error": "incident not found"})
    return respond(200, {"deleted": incident_id})


def change_status(event, incident, claims):
    req, error = parse(event, StatusChange)
    if error:
        return error
    if req.to_status not in TRANSITIONS[incident["status"]]:
        return respond(409, {
            "error": f"cannot go from {incident['status']} to {req.to_status}",
            "allowed": sorted(TRANSITIONS[incident["status"]]),
        })
    row = repo.change_status(
        incident["id"], incident["status"], req.to_status, int(claims["sub"]), req.reason
    )
    return respond(200, {"incident": repo.incident(row)})


def assign_incident(event, incident, claims):
    req, error = parse(event, AssignRequest)
    if error:
        return error

    caller = int(claims["sub"])
    target = req.engineer_id if req.engineer_id is not None else caller
    # An engineer may only claim work for themselves; an admin may assign anyone.
    if claims.get("role") != ADMIN_ROLE and target != caller:
        return respond(403, {"error": "engineers can only assign incidents to themselves"})
    if not repo.is_engineer(target):
        return respond(400, {"error": "assignee is not an engineer"})

    return respond(200, {"incident": repo.incident(repo.assign(incident["id"], target))})


def add_note(event, incident, claims):
    req, error = parse(event, NoteCreate)
    if error:
        return error
    if incident["status"] == "Closed":
        return respond(409, {"error": "cannot add notes to a closed incident"})
    return respond(201, {"note": repo.add_note(incident["id"], int(claims["sub"]), req.body)})


# --- escalations ----------------------------------------------------------

def create_escalation(event, incident, claims):
    req, error = parse(event, EscalationCreate)
    if error:
        return error
    try:
        row = repo.create_escalation(
            incident["id"], int(claims["sub"]),
            incident["priority"],  # read here, never from the request
            req.requested_priority, req.reason,
        )
    except psycopg.errors.CheckViolation:
        return respond(409, {"error": "requested priority must be higher than the current one"})
    except psycopg.errors.UniqueViolation:
        return respond(409, {"error": "this incident already has a pending escalation"})
    return respond(201, {"escalation": repo.escalation(row)})


def list_escalations(event):
    status = (event.get("queryStringParameters") or {}).get("status")
    rows = repo.list_escalations(status)
    return respond(200, {"escalations": [repo.escalation(r) for r in rows]})


def decide_escalation(event, escalation_id, claims):
    req, error = parse(event, EscalationDecision)
    if error:
        return error
    if not repo.find_escalation(escalation_id):
        return respond(404, {"error": "escalation not found"})

    row = repo.decide_escalation(escalation_id, int(claims["sub"]), req.decision == "approve")
    if not row:
        return respond(409, {"error": "escalation has already been decided"})
    return respond(200, {"escalation": repo.escalation(row)})


# --- dispatch -------------------------------------------------------------

def route(method, segments, event, claims):
    """Every branch checks permission before it does anything else."""
    role = claims.get("role")
    is_admin = role == ADMIN_ROLE

    if segments == ["incidents"]:
        if method == "POST":
            if role == ENGINEER_ROLE:
                return respond(403, {"error": "engineers do not report incidents"})
            return create_incident(event, claims)
        if method == "GET":
            return list_incidents(event, claims)

    if segments == ["escalations"] and method == "GET":
        if not is_admin:
            return respond(403, {"error": "admin only"})
        return list_escalations(event)

    if len(segments) == 3 and segments[0] == "escalations" and segments[2] == "decide":
        if method == "POST":
            if not is_admin:
                return respond(403, {"error": "admin only"})
            return decide_escalation(event, int(segments[1]), claims)

    if len(segments) >= 2 and segments[0] == "incidents" and segments[1].isdigit():
        incident_id = int(segments[1])

        if len(segments) == 2:
            if method == "GET":
                return get_incident(incident_id, claims)
            if method == "DELETE":
                if not is_admin:
                    return respond(403, {"error": "admin only"})
                return delete_incident(incident_id)

        if len(segments) == 3:
            row = repo.find_incident(incident_id)
            if not row:
                return respond(404, {"error": "incident not found"})
            incident = repo.incident(row)
            caller = int(claims["sub"])
            is_reporter = incident["created_by"] == caller
            is_assignee = incident["assigned_to"] == caller

            if segments[2] == "status" and method == "PATCH":
                if not (is_admin or (role == ENGINEER_ROLE and is_assignee)):
                    return respond(403, {"error": "only the assigned engineer or an admin"})
                return change_status(event, incident, claims)

            if segments[2] == "assign" and method == "POST":
                if not (is_admin or role == ENGINEER_ROLE):
                    return respond(403, {"error": "only an engineer or an admin"})
                return assign_incident(event, incident, claims)

            if segments[2] == "notes" and method == "POST":
                if not (is_admin or is_reporter or is_assignee):
                    return respond(403, {"error": "only the reporter, the assignee or an admin"})
                return add_note(event, incident, claims)

            if segments[2] == "escalate" and method == "POST":
                # The reporter asks; the admin decides. Nobody else may ask —
                # an admin filing and approving their own would be a rubber stamp.
                if not is_reporter:
                    return respond(403, {"error": "only the reporter can request an escalation"})
                return create_escalation(event, incident, claims)

    return respond(404, {"error": f"no route for {method} /{'/'.join(segments)}"})


def handler(event=None, context=None):
    event = event or {}
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    # proxy-server.js joins its base URL and the path into "//incidents" — strip
    # both ends so a route matches whether or not the slashes doubled up.
    segments = [s for s in (event.get("rawPath") or "").split("/") if s]

    try:
        # Permission gate first: nothing below runs for a caller who isn't allowed.
        claims = bearer_claims(event)
        if not claims:
            return respond(401, {"error": "missing or invalid token"})
        return route(method, segments, event, claims)
    except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
        logger.exception("handler error")
        return respond(500, {"error": "internal error", "message": str(exc)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/incidents"}))
