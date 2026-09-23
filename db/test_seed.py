"""Phase 0: the seeded DB must store bcrypt hashes, not plaintext.

Run after `python migrate.py && python seed.py`.
"""

import bcrypt

from db import connect
from seed import ADMIN_NAMES, DEMO_PASSWORD, EMPLOYEE_NAMES, ENGINEERS, email_for

# Exactly the accounts seed.py creates, rebuilt the same way it builds them.
SEEDED_EMAILS = (
    {"admin@acme.inc", email_for(ADMIN_NAMES[1])}
    | {email_for(name) for name, *_ in ENGINEERS}
    | {"employee@acme.inc"}
    | {email_for(name) for name in EMPLOYEE_NAMES[1:]}
)


def test_no_password_is_stored_in_plain_text():
    """The Phase 0 bug, and it must stay fixed for *every* row, however created."""
    with connect() as conn:
        rows = conn.execute("SELECT email, password FROM users").fetchall()

    assert rows, "no users at all; run migrate.py + seed.py first"
    for email, stored in rows:
        assert stored != DEMO_PASSWORD, f"{email} stores the password in plain text"
        assert stored.startswith("$2b$"), f"{email} password is not a bcrypt hash: {stored!r}"


def test_seeded_passwords_verify_against_the_demo_password():
    """Scoped to seeded accounts: `users` also holds rows from POST /register,
    and the smoke test registers with a password of its own."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT email, password FROM users WHERE email = ANY(%s)",
            (list(SEEDED_EMAILS),),
        ).fetchall()

    assert len(rows) == len(SEEDED_EMAILS), "seeded accounts are missing; re-run seed.py"
    for email, stored in rows:
        assert bcrypt.checkpw(DEMO_PASSWORD.encode(), stored.encode()), \
            f"{email} hash does not verify against DEMO_PASSWORD"


def test_fixture_data_seeded():
    with connect() as conn:
        counts = {
            t: conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            for t in ("users", "buildings", "floors", "seats", "incidents")
        }
    assert all(counts.values()), f"empty tables after seed: {counts}"
