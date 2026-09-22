"""Postgres connection. Duplicated per Lambda folder — keep identical across services."""

import os

import psycopg

# POSTGRES_* is what infra/locals.tf injects into the Lambda; DATABASE_URL is the
# local override the db/ scripts already use, so pytest runs against the seeded DB.
CONNINFO = os.environ.get("DATABASE_URL") or (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'postgres')} "
    f"password={os.getenv('POSTGRES_PASS', 'postgres123')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'acme_incidents')} "
    f"connect_timeout=15"
)


def connect():
    return psycopg.connect(CONNINFO)
