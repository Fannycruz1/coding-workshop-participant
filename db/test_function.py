"""The deploy-time migration runs on every deploy, so a re-run must not wipe data."""

import function
from db import connect

CANARY = "canary.rerun@acme.inc"


def test_rerunning_the_migration_keeps_existing_rows():
    function.handler()  # leaves a migrated, seeded database either way

    with connect() as conn:
        conn.execute(
            "INSERT INTO users (email, password, full_name, role)"
            " VALUES (%s, '$2b$x', 'Canary', 'employee') ON CONFLICT (email) DO NOTHING",
            (CANARY,),
        )
        conn.commit()

    try:
        result = function.handler()
        assert result == {"schema": "applied", "seed": "skipped"}
        with connect() as conn:
            assert conn.execute("SELECT 1 FROM users WHERE email = %s", (CANARY,)).fetchone()
    finally:
        with connect() as conn:
            conn.execute("DELETE FROM users WHERE email = %s", (CANARY,))
            conn.commit()
