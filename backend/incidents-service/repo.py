"""incidents / incident_notes / incident_status_history / escalation_requests queries."""

from db import connect

INCIDENT_COLUMNS = (
    "id, title, description, category, status, priority, created_by, assigned_to,"
    " building_id, floor_id, seat_id, created_at, updated_at, resolved_at, closed_at"
)
INCIDENT_FIELDS = tuple(c.strip() for c in INCIDENT_COLUMNS.split(","))

ESCALATION_COLUMNS = (
    "id, incident_id, requested_by, current_priority, requested_priority, reason,"
    " status, decided_by, decided_at, created_at"
)
ESCALATION_FIELDS = tuple(c.strip() for c in ESCALATION_COLUMNS.split(","))


def _row_to_dict(row, fields):
    return dict(zip(fields, row)) if row else None


def incident(row):
    return _row_to_dict(row, INCIDENT_FIELDS)


def escalation(row):
    return _row_to_dict(row, ESCALATION_FIELDS)


# --- incidents ------------------------------------------------------------

def create_incident(req, created_by):
    with connect() as conn:
        return conn.execute(
            f"INSERT INTO incidents (title, description, category, priority,"
            f" created_by, building_id, floor_id, seat_id)"
            f" VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING {INCIDENT_COLUMNS}",
            (req.title, req.description, req.category, req.priority,
             created_by, req.building_id, req.floor_id, req.seat_id),
        ).fetchone()


def _scope_clause(role, user_id):
    """What this role is allowed to see, as a WHERE fragment."""
    if role == "facility_admin":
        return "TRUE", []
    if role == "engineer":
        # Their own queue, plus anything still unclaimed.
        return "(assigned_to = %s OR assigned_to IS NULL)", [user_id]
    return "created_by = %s", [user_id]


def list_incidents(role, user_id, filters):
    where, params = _scope_clause(role, user_id)
    clauses = [where]

    for column in ("status", "category", "priority", "building_id", "assigned_to"):
        value = getattr(filters, column)
        if value is not None:
            clauses.append(f"{column} = %s")
            params.append(value)

    if filters.q:
        clauses.append(
            "to_tsvector('english', title || ' ' || coalesce(description, ''))"
            " @@ plainto_tsquery('english', %s)"
        )
        params.append(filters.q)

    with connect() as conn:
        return conn.execute(
            f"SELECT {INCIDENT_COLUMNS} FROM incidents"
            f" WHERE {' AND '.join(clauses)} ORDER BY id DESC",
            params,
        ).fetchall()


def find_incident(incident_id):
    """Unscoped — callers apply the permission rule themselves."""
    with connect() as conn:
        return conn.execute(
            f"SELECT {INCIDENT_COLUMNS} FROM incidents WHERE id = %s", (incident_id,)
        ).fetchone()


def find_visible_incident(incident_id, role, user_id):
    where, params = _scope_clause(role, user_id)
    with connect() as conn:
        return conn.execute(
            f"SELECT {INCIDENT_COLUMNS} FROM incidents WHERE id = %s AND {where}",
            [incident_id, *params],
        ).fetchone()


def delete_incident(incident_id):
    with connect() as conn:
        return conn.execute(
            "DELETE FROM incidents WHERE id = %s RETURNING id", (incident_id,)
        ).fetchone()


def change_status(incident_id, from_status, to_status, changed_by, reason):
    """Status write + history row in one transaction.

    updated_at is left alone — trg_incidents_updated_at maintains it.
    """
    with connect() as conn:
        row = conn.execute(
            f"UPDATE incidents SET status = %s,"
            f" resolved_at = CASE WHEN %s = 'Resolved' THEN now() ELSE resolved_at END,"
            f" closed_at = CASE WHEN %s = 'Closed' THEN now() ELSE closed_at END"
            f" WHERE id = %s RETURNING {INCIDENT_COLUMNS}",
            (to_status, to_status, to_status, incident_id),
        ).fetchone()
        conn.execute(
            "INSERT INTO incident_status_history"
            " (incident_id, from_status, to_status, changed_by, reason)"
            " VALUES (%s, %s, %s, %s, %s)",
            (incident_id, from_status, to_status, changed_by, reason),
        )
        return row


def is_engineer(user_id):
    with connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM users WHERE id = %s AND role = 'engineer'", (user_id,)
        ).fetchone()
    return row is not None


def assign(incident_id, engineer_id):
    with connect() as conn:
        return conn.execute(
            f"UPDATE incidents SET assigned_to = %s WHERE id = %s RETURNING {INCIDENT_COLUMNS}",
            (engineer_id, incident_id),
        ).fetchone()


# --- notes ----------------------------------------------------------------

def add_note(incident_id, author_id, body):
    with connect() as conn:
        row = conn.execute(
            "INSERT INTO incident_notes (incident_id, author_id, body)"
            " VALUES (%s, %s, %s) RETURNING id, incident_id, author_id, body, created_at",
            (incident_id, author_id, body),
        ).fetchone()
    return dict(zip(("id", "incident_id", "author_id", "body", "created_at"), row))


# --- escalations ----------------------------------------------------------

def create_escalation(incident_id, requested_by, current_priority, requested_priority, reason):
    with connect() as conn:
        return conn.execute(
            f"INSERT INTO escalation_requests (incident_id, requested_by,"
            f" current_priority, requested_priority, reason)"
            f" VALUES (%s, %s, %s, %s, %s) RETURNING {ESCALATION_COLUMNS}",
            (incident_id, requested_by, current_priority, requested_priority, reason),
        ).fetchone()


def list_escalations(status=None):
    clause, params = ("WHERE status = %s", [status]) if status else ("", [])
    with connect() as conn:
        return conn.execute(
            f"SELECT {ESCALATION_COLUMNS} FROM escalation_requests {clause} ORDER BY id DESC",
            params,
        ).fetchall()


def find_escalation(escalation_id):
    with connect() as conn:
        return conn.execute(
            f"SELECT {ESCALATION_COLUMNS} FROM escalation_requests WHERE id = %s",
            (escalation_id,),
        ).fetchone()


def decide_escalation(escalation_id, decided_by, approve):
    """Decision + priority bump in one transaction.

    WHERE status = 'Pending' is what makes a double decide impossible: the
    second UPDATE matches no row, even if two admins click at once.
    """
    new_status = "Approved" if approve else "Rejected"
    with connect() as conn:
        row = conn.execute(
            f"UPDATE escalation_requests SET status = %s, decided_by = %s, decided_at = now()"
            f" WHERE id = %s AND status = 'Pending' RETURNING {ESCALATION_COLUMNS}",
            (new_status, decided_by, escalation_id),
        ).fetchone()
        if row and approve:
            escalated = escalation(row)
            conn.execute(
                "UPDATE incidents SET priority = %s WHERE id = %s",
                (escalated["requested_priority"], escalated["incident_id"]),
            )
        return row
