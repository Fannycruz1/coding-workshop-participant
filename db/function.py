"""Lambda entry point: apply db/schema.sql, and seed demo data if the DB is empty.

The deployed Aurora cluster has no public address, so nothing outside the VPC can
reach it. bin/deploy-backend.sh invokes this once after `terraform apply`.
"""

import os

import psycopg

# Must precede the db import: on AWS only the POSTGRES_* vars Terraform injects
# exist, and db.py falls back to a localhost URL when DATABASE_URL is unset.
if not os.environ.get("DATABASE_URL") and os.environ.get("POSTGRES_HOST"):
    os.environ["DATABASE_URL"] = psycopg.conninfo.make_conninfo(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ["POSTGRES_PORT"],
        dbname=os.environ["POSTGRES_NAME"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASS"],
    )

import migrate  # noqa: E402
import seed  # noqa: E402
from db import connect  # noqa: E402


def has_users():
    with connect() as conn:
        return conn.execute("SELECT EXISTS (SELECT 1 FROM users)").fetchone()[0]


def handler(event=None, context=None):
    """Re-applies the schema every time; seeds only an empty database.

    seed.main() TRUNCATEs, so seeding unconditionally would wipe real data on
    every deploy. Send {"force_seed": true} to re-seed on purpose.
    """
    migrate.main()
    if (event or {}).get("force_seed") or not has_users():
        seed.main()
        return {"schema": "applied", "seed": "applied"}
    return {"schema": "applied", "seed": "skipped"}
