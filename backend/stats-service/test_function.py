"""Phase 7: read-only aggregates for the admin dashboard."""

import json

import pytest

from db import connect
from function import TOP_N, handler

ADMIN = "admin@acme.inc"
EMPLOYEE = "employee@acme.inc"
ENGINEER = "sofia.reyes@acme.inc"


def call(path, token=None):
    event = {
        "requestContext": {"http": {"method": "GET"}},
        "rawPath": path,
        "headers": {"authorization": f"Bearer {token}"} if token else {},
    }
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def token_for(email):
    from auth import create_access_token

    with connect() as conn:
        row = conn.execute("SELECT id, role FROM users WHERE email = %s", (email,)).fetchone()
    assert row, f"{email} is not seeded — run db/seed.py"
    return create_access_token({"sub": str(row[0]), "role": row[1]})


def count(where, params=()):
    with connect() as conn:
        return conn.execute(f"SELECT count(*) FROM incidents WHERE {where}", params).fetchone()[0]


@pytest.fixture(scope="session")
def admin():
    return token_for(ADMIN)


@pytest.fixture(scope="session")
def employee():
    return token_for(EMPLOYEE)


@pytest.fixture(scope="session")
def engineer():
    return token_for(ENGINEER)


@pytest.mark.parametrize("path", ["/stats/hotspots", "/stats/categories"])
def test_rejects_anonymous(path):
    assert call(path)[0] == 401


@pytest.mark.parametrize("path", ["/stats/hotspots", "/stats/categories"])
def test_rejects_non_admin(path, employee, engineer):
    assert call(path, token=employee)[0] == 403
    assert call(path, token=engineer)[0] == 403


def test_unknown_route_is_404(admin):
    assert call("/stats/nonsense", token=admin)[0] == 404
    assert call("/nonsense", token=admin)[0] == 404


def test_hotspots_has_all_three_groups(admin):
    status, body = call("/stats/hotspots", token=admin)
    assert status == 200, body
    assert set(body) == {"buildings", "floors", "reporters"}


@pytest.mark.parametrize(
    "group,column",
    [("buildings", "building_id"), ("floors", "floor_id"), ("reporters", "created_by")],
)
def test_hotspot_counts_match_the_table(group, column, admin):
    """Each row's count is that row's real incident count, not a join artefact."""
    rows = call("/stats/hotspots", token=admin)[1][group]
    assert rows, f"seed data has no {group}"
    for row in rows:
        assert row["count"] == count(f"{column} = %s", (row["id"],))
        assert row["name"]


@pytest.mark.parametrize("group", ["buildings", "floors", "reporters"])
def test_hotspots_are_the_top_n_biggest_first(group, admin):
    rows = call("/stats/hotspots", token=admin)[1][group]
    assert len(rows) <= TOP_N
    assert [r["count"] for r in rows] == sorted((r["count"] for r in rows), reverse=True)


def test_hotspots_leader_really_leads(admin):
    """The first building beats every building the query left out."""
    rows = call("/stats/hotspots", token=admin)[1]["buildings"]
    with connect() as conn:
        biggest = conn.execute(
            "SELECT count(*) FROM incidents GROUP BY building_id ORDER BY count(*) DESC LIMIT 1"
        ).fetchone()[0]
    assert rows[0]["count"] == biggest


def test_categories_cover_every_incident(admin):
    status, body = call("/stats/categories", token=admin)
    assert status == 200, body
    assert [c["count"] for c in body["categories"]] == sorted(
        (c["count"] for c in body["categories"]), reverse=True
    )
    for entry in body["categories"]:
        assert entry["count"] == count("category = %s", (entry["category"],))
    assert sum(c["count"] for c in body["categories"]) == count("TRUE")


def test_the_cloudfront_path_routes_like_the_bare_one(admin):
    """CloudFront forwards "/api/stats-service/stats/categories" unrewritten."""
    bare = call("/stats/categories", token=admin)
    assert call("/api/stats-service/stats/categories", token=admin) == bare
    assert bare[0] == 200
