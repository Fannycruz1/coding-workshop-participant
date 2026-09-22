"""Phase 0: the seeded DB must store bcrypt hashes, not plaintext.

Run after `python migrate.py && python seed.py`.
"""

import bcrypt

from db import connect
from seed import DEMO_PASSWORD


def test_seeded_passwords_are_bcrypt_hashes():
    with connect() as conn:
        rows = conn.execute("SELECT email, password FROM users").fetchall()

    assert rows, "no seeded users; run migrate.py + seed.py first"
    for email, stored in rows:
        assert stored != DEMO_PASSWORD, f"{email} stores the password in plain text"
        assert stored.startswith("$2b$"), f"{email} password is not a bcrypt hash: {stored!r}"
        assert bcrypt.checkpw(DEMO_PASSWORD.encode(), stored.encode()), \
            f"{email} hash does not verify against DEMO_PASSWORD"


def test_fixture_data_seeded():
    with connect() as conn:
        counts = {
            t: conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            for t in ("users", "buildings", "floors", "seats", "incidents")
        }
    assert all(counts.values()), f"empty tables after seed: {counts}"
