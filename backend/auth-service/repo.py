"""users / engineer_profiles queries."""

from db import connect

PUBLIC_COLUMNS = "id, email, full_name, role, is_active"

# The same columns, qualified, plus the profile — for the engineer routes.
ENGINEER_COLUMNS = (
    "u.id, u.email, u.full_name, u.role, u.is_active, p.specialty, p.phone"
)
ENGINEER_FIELDS = ("id", "email", "full_name", "role", "is_active", "specialty", "phone")


def engineer(row):
    return dict(zip(ENGINEER_FIELDS, row)) if row else None


def find_by_email(email: str):
    """Row including the password hash — login only."""
    with connect() as conn:
        return conn.execute(
            f"SELECT {PUBLIC_COLUMNS}, password FROM users WHERE email = %s", (email,)
        ).fetchone()


def find_by_id(user_id: int):
    with connect() as conn:
        return conn.execute(
            f"SELECT {PUBLIC_COLUMNS} FROM users WHERE id = %s", (user_id,)
        ).fetchone()


def create_user(email, password_hash, full_name, role):
    with connect() as conn:
        return conn.execute(
            f"INSERT INTO users (email, password, full_name, role)"
            f" VALUES (%s, %s, %s, %s) RETURNING {PUBLIC_COLUMNS}",
            (email, password_hash, full_name, role),
        ).fetchone()


def create_engineer(email, password_hash, full_name, specialty, phone):
    """User + profile in one transaction — an engineer without a profile is broken data."""
    with connect() as conn:
        row = conn.execute(
            f"INSERT INTO users (email, password, full_name, role)"
            f" VALUES (%s, %s, %s, 'engineer') RETURNING {PUBLIC_COLUMNS}",
            (email, password_hash, full_name),
        ).fetchone()
        conn.execute(
            "INSERT INTO engineer_profiles (user_id, specialty, phone) VALUES (%s, %s, %s)",
            (row[0], specialty, phone),
        )
        return row


def list_engineers():
    with connect() as conn:
        return conn.execute(
            f"SELECT {ENGINEER_COLUMNS} FROM users u"
            f" JOIN engineer_profiles p ON p.user_id = u.id"
            f" WHERE u.role = 'engineer' AND u.is_active ORDER BY u.id"
        ).fetchall()


def find_engineer(user_id: int):
    with connect() as conn:
        return conn.execute(
            f"SELECT {ENGINEER_COLUMNS} FROM users u"
            f" JOIN engineer_profiles p ON p.user_id = u.id"
            f" WHERE u.id = %s AND u.role = 'engineer' AND u.is_active",
            (user_id,),
        ).fetchone()


def update_engineer(user_id: int, fields: dict):
    """Only the profile columns are editable here; the user row is auth's business."""
    assignments = ", ".join(f"{column} = %s" for column in fields)
    with connect() as conn:
        return conn.execute(
            f"UPDATE engineer_profiles SET {assignments} FROM users u"
            f" WHERE engineer_profiles.user_id = %s AND u.id = engineer_profiles.user_id"
            f" AND u.is_active"
            f" RETURNING u.id, u.email, u.full_name, u.role, u.is_active,"
            f" engineer_profiles.specialty, engineer_profiles.phone",
            [*fields.values(), user_id],
        ).fetchone()


def deactivate_engineer(user_id: int):
    """Unassign their open work, then switch the account off. One transaction.

    A soft delete, not a DELETE. Their notes, status changes and escalation
    decisions all reference users(id) and none of them cascade — removing the
    row would mean erasing the audit trail to make a person disappear. So the
    row stays and `is_active` goes false; every read path filters on it.
    Their incidents go back to the unclaimed pool for another engineer.
    """
    with connect() as conn:
        conn.execute(
            "UPDATE incidents SET assigned_to = NULL WHERE assigned_to = %s", (user_id,)
        )
        return conn.execute(
            "UPDATE users SET is_active = false"
            " WHERE id = %s AND role = 'engineer' AND is_active RETURNING id",
            (user_id,),
        ).fetchone()
