"""users / engineer_profiles queries."""

from db import connect

PUBLIC_COLUMNS = "id, email, full_name, role, is_active"


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
