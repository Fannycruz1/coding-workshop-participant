"""buildings / floors / seats queries.

All three tables have the same shape, so they share one set of queries. The
table name is always a key of COLUMNS, never anything off the request, and the
column names always come from a pydantic model — neither reaches SQL from a
caller.
"""

from db import connect

COLUMNS = {
    "buildings": ("id", "name", "address"),
    "floors": ("id", "building_id", "floor_number", "name"),
    "seats": ("id", "floor_id", "seat_code"),
}

# The column a list is filtered by, for the two tables that have a parent.
PARENT = {"floors": "building_id", "seats": "floor_id"}


def row_to_dict(table, row):
    return dict(zip(COLUMNS[table], row)) if row else None


def _select(table):
    return f"SELECT {', '.join(COLUMNS[table])} FROM {table}"


def list_rows(table, parent_id=None):
    clause, params = "", []
    if parent_id is not None and table in PARENT:
        clause, params = f" WHERE {PARENT[table]} = %s", [parent_id]
    with connect() as conn:
        return conn.execute(f"{_select(table)}{clause} ORDER BY id", params).fetchall()


def find_row(table, row_id):
    with connect() as conn:
        return conn.execute(f"{_select(table)} WHERE id = %s", (row_id,)).fetchone()


def create_row(table, fields):
    names = ", ".join(fields)
    placeholders = ", ".join(["%s"] * len(fields))
    with connect() as conn:
        return conn.execute(
            f"INSERT INTO {table} ({names}) VALUES ({placeholders})"
            f" RETURNING {', '.join(COLUMNS[table])}",
            list(fields.values()),
        ).fetchone()


def update_row(table, row_id, fields):
    assignments = ", ".join(f"{column} = %s" for column in fields)
    with connect() as conn:
        return conn.execute(
            f"UPDATE {table} SET {assignments} WHERE id = %s"
            f" RETURNING {', '.join(COLUMNS[table])}",
            [*fields.values(), row_id],
        ).fetchone()


def delete_row(table, row_id):
    with connect() as conn:
        return conn.execute(
            f"DELETE FROM {table} WHERE id = %s RETURNING id", (row_id,)
        ).fetchone()
