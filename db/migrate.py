"""Create the acme_incidents database (if needed) and apply db/schema.sql."""

from pathlib import Path

from db import connect, ensure_database

SCHEMA_FILE = Path(__file__).parent / "schema.sql"


def main():
    ensure_database()
    with connect() as conn:
        conn.execute(SCHEMA_FILE.read_text())
        conn.commit()
    print("Schema applied.")


if __name__ == "__main__":
    main()
