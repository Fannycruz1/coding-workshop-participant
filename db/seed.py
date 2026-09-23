"""Seed acme_incidents with a small, hand-written demo dataset. Safe to re-run (truncates first)."""

from datetime import timedelta

import bcrypt

from db import connect

DEMO_PASSWORD = "Password123!"
# Hashed once: every demo user shares the same password.
DEMO_PASSWORD_HASH = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()

ADMIN_NAMES = ["Priya Natarajan", "Marcus DeLuca"]

ENGINEERS = [
    ("Sofia Reyes", "HVAC", "555-0142"),
    ("James Okafor", "Electrical", "555-0118"),
    ("Wei Zhang", "Network", "555-0173"),
    ("Fatima Haddad", "Plumbing", "555-0129"),
]

EMPLOYEE_NAMES = ["Alex Johnson", "Maria Garcia", "David Chen", "Sarah Williams"]

BUILDINGS = [
    ("Riverside Tower", "500 Riverside Ave, Austin, TX", 3),
    ("Harbor Point", "88 Harbor Point Blvd, Boston, MA", 2),
]
SEATS_PER_FLOOR = 3

# Hours after creation for each transition, unless an incident overrides them.
BEATS = {"start": 6, "block": 12, "unblock": 30, "resolve": 36, "close": 60}

INCIDENTS = [
    dict(
        title="Server room AC failed, room at 91F and climbing",
        description=(
            "The CRAC unit in the floor 3 server room tripped off around 02:00 and never restarted. "
            "Rack inlet temps are at 91F and two switches have already thermal-throttled. "
            "We have portable fans in there but the door has to stay propped open."
        ),
        category="HVAC", priority="Critical", status="Blocked",
        building="Riverside Tower", floor=3, seat=None,
        reporter="Maria Garcia", engineer="Sofia Reyes", days_ago=4,
        beats={"start": 1, "block": 5},
        block_reason="Compressor is shot. Replacement unit is with the vendor, earliest delivery is Thursday.",
        notes=[
            (2, "engineer", "On site. Compressor won't spin up, running on portable cooling for now."),
            (6, "employee", "Confirmed the racks are holding around 84F with the fans running."),
            (26, "engineer", "Vendor quoted Thursday for the replacement compressor. Keeping the portables in place until then."),
        ],
    ),
    dict(
        title="Breaker trip killed power to the floor 2 east desks",
        description=(
            "A breaker tripped just after 09:00 and about a dozen desks along the east wall lost power. "
            "Resetting it holds for a few minutes, then it trips again. Lights are fine, only the floor outlets are out."
        ),
        category="Electrical", priority="High", status="In Progress",
        building="Riverside Tower", floor=2, seat="2A-01",
        reporter="Alex Johnson", engineer="James Okafor", days_ago=2,
        notes=[
            (3, "engineer", "Traced it to the east outlet circuit. Something on it is pulling too much, isolating desk by desk."),
            (9, "employee", "We've moved everyone to the west side in the meantime."),
        ],
    ),
    dict(
        title="Wi-Fi drops every few minutes on floor 1",
        description=(
            "Since Monday, anyone on floor 1 gets dropped off the wifi roughly every five minutes. "
            "Reconnecting works but video calls don't survive it. Wired desks are unaffected."
        ),
        category="Network", priority="High", status="Open",
        building="Harbor Point", floor=1, seat=None,
        reporter="David Chen", engineer="Wei Zhang", days_ago=1,
        notes=[(4, "employee", "Happening to at least six of us, all on floor 1.")],
    ),
    dict(
        title="Kitchen sink leaking onto the floor",
        description=(
            "The floor 2 kitchen sink drips steadily from the base of the faucet and has soaked the cabinet below. "
            "Someone put a towel down but it needs wringing out twice a day."
        ),
        category="Plumbing", priority="Medium", status="Resolved",
        building="Riverside Tower", floor=2, seat=None,
        reporter="Sarah Williams", engineer="Fatima Haddad", days_ago=11,
        notes=[
            (8, "engineer", "Supply line fitting was loose and the washer had perished. Replaced both."),
            (40, "employee", "Dry this morning, thanks."),
        ],
    ),
    dict(
        title="Office chair at 1A-02 has a cracked base",
        description="The five-star base on the chair at 1A-02 is cracked and the seat leans hard to the left. Not safe to sit on.",
        category="Furniture", priority="Low", status="Closed",
        building="Riverside Tower", floor=1, seat="1A-02",
        reporter="Alex Johnson", engineer=None, days_ago=24,
        notes=[(50, "employee", "New chair arrived, old one tagged for disposal.")],
    ),
    dict(
        title="Projector in the floor 3 conference room won't power on",
        description=(
            "No response from the projector in the floor 3 conference room, not from the remote and not from the wall panel. "
            "No standby light on the unit at all. Meetings are being moved to Harbor Point."
        ),
        category="AV/Conference Room", priority="Medium", status="In Progress",
        building="Riverside Tower", floor=3, seat=None,
        reporter="Maria Garcia", engineer="Wei Zhang", days_ago=5,
        notes=[(20, "engineer", "Ceiling outlet is dead, not the projector. Looping in electrical.")],
    ),
    dict(
        title="Floor 1 printer jams on every duplex job",
        description=(
            "The shared printer by the floor 1 copy room jams part way through anything double-sided. "
            "Single-sided printing is fine. Clearing the jam takes about ten minutes each time."
        ),
        category="Printer", priority="Low", status="Open",
        building="Harbor Point", floor=1, seat=None,
        reporter="David Chen", engineer=None, days_ago=6,
        notes=[],
    ),
    dict(
        title="Badge reader at the east entrance stopped reading cards",
        description=(
            "The east entrance reader at Harbor Point gives a red light for every badge. "
            "People are walking round to the main lobby, which adds a few minutes each morning."
        ),
        category="Access/Badge", priority="High", status="Resolved",
        building="Harbor Point", floor=1, seat=None,
        reporter="Sarah Williams", engineer="James Okafor", days_ago=9,
        notes=[
            (5, "engineer", "Reader had dropped off the access controller. Reseated the network drop and re-enrolled it."),
            (38, "employee", "Badged in there this morning without trouble."),
        ],
    ),
    dict(
        title="Coffee spill left on the floor 2 kitchen floor",
        description="Someone dropped a full carafe in the floor 2 kitchen. Sticky patch about a metre across, near the fridge.",
        category="Cleaning", priority="Low", status="Closed",
        building="Harbor Point", floor=2, seat=None,
        reporter="Maria Garcia", engineer=None, days_ago=16,
        beats={"resolve": 5, "close": 20},
        notes=[],
    ),
    dict(
        title="Floor 1 runs warm all afternoon",
        description=(
            "From about 14:00 onwards floor 1 sits around 79F while the thermostat reads 72F. "
            "It's been like this for a couple of weeks now."
        ),
        category="HVAC", priority="Medium", status="Open",
        building="Riverside Tower", floor=1, seat=None,
        reporter="Alex Johnson", engineer="Sofia Reyes", days_ago=3,
        notes=[(10, "employee", "Worst by the south windows, cooler near the lifts.")],
    ),
    dict(
        title="Access switch down, floor 2 wired desks offline",
        description=(
            "The floor 2 access switch at Harbor Point is unreachable and every wired desk on that floor is offline. "
            "Wi-Fi is up, so people are working off that, but the desk phones are down too."
        ),
        category="Network", priority="Critical", status="In Progress",
        building="Harbor Point", floor=2, seat="2A-03",
        reporter="David Chen", engineer="Wei Zhang", days_ago=1,
        beats={"start": 1},
        notes=[(2, "engineer", "Switch is powered but not passing traffic. Swapping in a spare and restoring the config.")],
    ),
    dict(
        title="Water cooler on floor 3 has been empty since Monday",
        description="The floor 3 water cooler is out and there are no spare bottles in the store cupboard.",
        category="Other", priority="Low", status="Blocked",
        building="Riverside Tower", floor=3, seat=None,
        reporter="Sarah Williams", engineer="Fatima Haddad", days_ago=7,
        block_reason="Supplier missed the delivery slot; next scheduled drop is Monday.",
        notes=[(30, "engineer", "Chased the supplier, they can't deliver before Monday.")],
    ),
]

# (incident index, current, requested, status, reason)
ESCALATIONS = [
    (1, "Medium", "High", "Approved",
     "Twelve desks have been without power for two days and the trips are getting more frequent."),
    (5, "Medium", "High", "Pending",
     "This is the only room that seats the whole team, and every meeting is being relocated."),
    (11, "Low", "Medium", "Rejected",
     "Nobody on floor 3 has drinking water without going down two floors."),
]


def email_for(full_name):
    first, last = full_name.split()[0], full_name.split()[-1]
    return f"{first.lower()}.{last.lower()}@acme.inc"


def seed_users(cur):
    """Returns full_name -> user_id."""
    users = {}

    for i, name in enumerate(ADMIN_NAMES):
        email = "admin@acme.inc" if i == 0 else email_for(name)
        cur.execute(
            "INSERT INTO users (email, password, full_name, role) VALUES (%s, %s, %s, 'facility_admin') RETURNING id",
            (email, DEMO_PASSWORD_HASH, name),
        )
        users[name] = cur.fetchone()[0]

    for name, specialty, phone in ENGINEERS:
        cur.execute(
            "INSERT INTO users (email, password, full_name, role) VALUES (%s, %s, %s, 'engineer') RETURNING id",
            (email_for(name), DEMO_PASSWORD_HASH, name),
        )
        users[name] = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO engineer_profiles (user_id, specialty, phone) VALUES (%s, %s, %s)",
            (users[name], specialty, phone),
        )

    for i, name in enumerate(EMPLOYEE_NAMES):
        email = "employee@acme.inc" if i == 0 else email_for(name)
        cur.execute(
            "INSERT INTO users (email, password, full_name, role) VALUES (%s, %s, %s, 'employee') RETURNING id",
            (email, DEMO_PASSWORD_HASH, name),
        )
        users[name] = cur.fetchone()[0]

    return users


def seed_facilities(cur):
    """Returns (building name, floor number) -> (building_id, floor_id, {seat_code: seat_id})."""
    layout = {}
    for name, address, n_floors in BUILDINGS:
        cur.execute(
            "INSERT INTO buildings (name, address) VALUES (%s, %s) RETURNING id", (name, address)
        )
        building_id = cur.fetchone()[0]
        for floor_number in range(1, n_floors + 1):
            cur.execute(
                "INSERT INTO floors (building_id, floor_number, name) VALUES (%s, %s, %s) RETURNING id",
                (building_id, floor_number, f"Floor {floor_number}"),
            )
            floor_id = cur.fetchone()[0]
            seats = {}
            for i in range(1, SEATS_PER_FLOOR + 1):
                seat_code = f"{floor_number}A-{i:02d}"
                cur.execute(
                    "INSERT INTO seats (floor_id, seat_code) VALUES (%s, %s) RETURNING id",
                    (floor_id, seat_code),
                )
                seats[seat_code] = cur.fetchone()[0]
            layout[(name, floor_number)] = (building_id, floor_id, seats)
    return layout


def status_history(spec, created_at, reporter_id, engineer_id, admin_id):
    """(from, to, changed_by, at, reason) rows implied by the incident's final status."""
    status = spec["status"]
    beats = dict(BEATS, **spec.get("beats", {}))
    at = lambda key: created_at + timedelta(hours=beats[key])
    worker = engineer_id or admin_id

    rows = [(None, "Open", reporter_id, created_at, None)]
    if status == "Open":
        return rows

    rows.append(("Open", "In Progress", worker, at("start"), None))
    if status == "Blocked":
        rows.append(("In Progress", "Blocked", worker, at("block"), spec["block_reason"]))
    elif status in ("Resolved", "Closed"):
        rows.append(("In Progress", "Resolved", worker, at("resolve"), None))
        if status == "Closed":
            rows.append(("Resolved", "Closed", reporter_id, at("close"), None))
    return rows


def seed_incidents(cur, users, layout, now):
    for spec in INCIDENTS:
        building_id, floor_id, seats = layout[(spec["building"], spec["floor"])]
        seat_id = seats[spec["seat"]] if spec["seat"] else None
        reporter_id = users[spec["reporter"]]
        engineer_id = users[spec["engineer"]] if spec["engineer"] else None
        admin_id = users[ADMIN_NAMES[0]]

        created_at = now - timedelta(days=spec["days_ago"])
        history = status_history(spec, created_at, reporter_id, engineer_id, admin_id)
        by_status = {to: at for _, to, _, at, _ in history}
        updated_at = history[-1][3]

        cur.execute(
            """INSERT INTO incidents
               (title, description, category, status, priority, created_by, assigned_to,
                building_id, floor_id, seat_id, created_at, updated_at, resolved_at, closed_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (spec["title"], spec["description"], spec["category"], spec["status"], spec["priority"],
             reporter_id, engineer_id, building_id, floor_id, seat_id,
             created_at, updated_at, by_status.get("Resolved"), by_status.get("Closed")),
        )
        spec["id"] = cur.fetchone()[0]

        cur.executemany(
            """INSERT INTO incident_status_history
               (incident_id, from_status, to_status, changed_by, reason, changed_at)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            [(spec["id"], f, t, by, reason, at) for f, t, by, at, reason in history],
        )

        cur.executemany(
            "INSERT INTO incident_notes (incident_id, author_id, body, created_at) VALUES (%s, %s, %s, %s)",
            [(spec["id"], reporter_id if who == "employee" else engineer_id, body,
              created_at + timedelta(hours=hours))
             for hours, who, body in spec["notes"]],
        )


def seed_escalations(cur, users, now):
    admin_id = users[ADMIN_NAMES[0]]
    for index, current, requested, status, reason in ESCALATIONS:
        spec = INCIDENTS[index]
        requested_at = now - timedelta(days=spec["days_ago"]) + timedelta(hours=8)
        decided = (admin_id, requested_at + timedelta(hours=6)) if status != "Pending" else (None, None)
        cur.execute(
            """INSERT INTO escalation_requests
               (incident_id, requested_by, current_priority, requested_priority, reason, status,
                decided_by, decided_at, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (spec["id"], users[spec["engineer"]], current, requested, reason, status,
             decided[0], decided[1], requested_at),
        )


TABLES = [
    "users", "engineer_profiles", "buildings", "floors", "seats",
    "incidents", "incident_notes", "incident_status_history", "escalation_requests",
]


def main():
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE " + ", ".join(TABLES) + " RESTART IDENTITY CASCADE")
            cur.execute("SELECT now()")
            now = cur.fetchone()[0]

            users = seed_users(cur)
            layout = seed_facilities(cur)
            seed_incidents(cur, users, layout, now)
            seed_escalations(cur, users, now)

            counts = {}
            for table in TABLES:
                cur.execute(f"SELECT count(*) FROM {table}")
                counts[table] = cur.fetchone()[0]
        conn.commit()

    print("Seed complete. Row counts:")
    for table, count in counts.items():
        print(f"  {table}: {count}")

    print("\nDemo login credentials (password for all):", DEMO_PASSWORD)
    print("  Facility admin: admin@acme.inc")
    print("  Employee:       employee@acme.inc")
    print("  Engineer:       sofia.reyes@acme.inc")


if __name__ == "__main__":
    main()
