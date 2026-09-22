"""Shared connection helper for the ACME Incidents migration/seed scripts."""

import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

DEFAULT_URL = "postgresql://postgres@localhost:5432/acme_incidents"


def database_url():
    return os.environ.get("DATABASE_URL", DEFAULT_URL)


def dbname():
    return psycopg.conninfo.conninfo_to_dict(database_url())["dbname"]


def ensure_database():
    """Create the target database if it doesn't exist yet."""
    target = dbname()
    maintenance_url = psycopg.conninfo.make_conninfo(database_url(), dbname="postgres")
    with psycopg.connect(maintenance_url, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (target,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{target}"')
            print(f"Created database {target}")


def connect():
    return psycopg.connect(database_url())
