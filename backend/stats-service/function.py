"""stats-service Lambda: the two admin-only aggregates the dashboard charts.

Two read-only queries, so the SQL lives here rather than in a repo.py.
"""

import json
import logging

from auth import bearer_claims
from db import connect

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ADMIN_ROLE = "facility_admin"
TOP_N = 5

# id, label, count — one row shape for all three hotspot groups so the frontend
# renders them with a single component.
HOTSPOTS = {
    "buildings": ("b.id, b.name", "buildings b ON b.id = i.building_id"),
    "floors": ("f.id, coalesce(f.name, 'Floor ' || f.floor_number)", "floors f ON f.id = i.floor_id"),
    "reporters": ("u.id, u.full_name", "users u ON u.id = i.created_by"),
}


def respond(status, payload):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def hotspots():
    with connect() as conn:
        return {
            group: [
                {"id": row[0], "name": row[1], "count": row[2]}
                for row in conn.execute(
                    f"SELECT {columns}, count(*) FROM incidents i JOIN {join}"
                    " GROUP BY 1, 2 ORDER BY count(*) DESC, 1 LIMIT %s",
                    (TOP_N,),
                )
            ]
            for group, (columns, join) in HOTSPOTS.items()
        }


def categories():
    with connect() as conn:
        rows = conn.execute(
            "SELECT category, count(*) FROM incidents GROUP BY category ORDER BY count(*) DESC"
        ).fetchall()
    return [{"category": row[0], "count": row[1]} for row in rows]


def handler(event=None, context=None):
    event = event or {}
    # proxy-server.js joins its base URL and the path into "//stats/hotspots" —
    # drop the empty pieces so a route matches either way.
    segments = [s for s in (event.get("rawPath") or "").split("/") if s]

    try:
        # Permission gate first: every route here is admin only.
        claims = bearer_claims(event)
        if not claims:
            return respond(401, {"error": "missing or invalid token"})
        if claims.get("role") != ADMIN_ROLE:
            return respond(403, {"error": "admin only"})

        if segments == ["stats", "hotspots"]:
            return respond(200, hotspots())
        if segments == ["stats", "categories"]:
            return respond(200, {"categories": categories()})
        return respond(404, {"error": f"no route for /{'/'.join(segments)}"})
    except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
        logger.exception("handler error")
        return respond(500, {"error": "internal error", "message": str(exc)})


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/stats/hotspots"}))
