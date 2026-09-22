"""Seed acme_incidents with realistic demo data. Safe to re-run (truncates first)."""

import random
from datetime import timedelta

import bcrypt

from db import connect

random.seed(42)  

NOW = None  # set in main() to the DB's current timestamp

DEMO_PASSWORD = "Password123!"
# Hashed once: every demo user shares the same password.
DEMO_PASSWORD_HASH = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()

ADMIN_NAMES = ["Priya Natarajan", "Marcus DeLuca"]

ENGINEERS = [
    ("Sofia Reyes", "HVAC"),
    ("James Okafor", "Electrical"),
    ("Wei Zhang", "Network"),
    ("Fatima Haddad", "Plumbing"),
    ("Liam O'Connor", "AV/Conference Room"),
    ("Grace Kim", "Furniture"),
]

EMPLOYEE_NAMES = [
    "Alex Johnson", "Maria Garcia", "David Chen", "Sarah Williams",
    "Ahmed Hassan", "Emily Nguyen", "Carlos Mendoza", "Julia Novak",
    "Ravi Patel", "Hannah Cohen", "Tomas Silva", "Nadia Petrova",
]

BUILDINGS = [
    ("Riverside Tower", "500 Riverside Ave, Austin, TX"),
    ("Innovation Campus", "1200 Innovation Way, Denver, CO"),
    ("Harbor Point", "88 Harbor Point Blvd, Boston, MA"),
]

FLOORS_PER_BUILDING = [4, 3, 5]
WINGS = ["A", "B", "C"]

# category -> list of (title_template, description_template); {floor}/{wing}/{seat}/{building} fillable
INCIDENT_TEMPLATES = {
    "HVAC": [
        ("AC not cooling in conference room {wing}", "Temperature in the {wing} conference room on floor {floor} has been stuck above 78F all afternoon."),
        ("Heating not working on floor {floor}", "Radiators on floor {floor} are cold; several employees are working in coats."),
        ("Thermostat unresponsive near {seat}", "The wall thermostat near {seat} does not respond to any button presses."),
    ],
    "Electrical": [
        ("Flickering lights on floor {floor}", "Overhead lights near wing {wing} flicker on and off intermittently."),
        ("Outlet not working at {seat}", "The power outlet under the desk at {seat} has no power; monitor keeps shutting off."),
        ("Breaker tripping in {wing} kitchen", "The breaker for the {wing} wing kitchen trips whenever the microwave and kettle run together."),
    ],
    "Plumbing": [
        ("Leaking faucet in floor {floor} kitchen", "The kitchen sink faucet on floor {floor} is dripping steadily and pooling water on the counter."),
        ("Clogged toilet in {wing} restroom", "One of the stalls in the {wing} wing restroom is clogged and won't flush."),
        ("Low water pressure on floor {floor}", "Sinks on floor {floor} have very weak water pressure since this morning."),
    ],
    "Furniture": [
        ("Broken chair at {seat}", "The office chair at {seat} has a cracked base and tilts to one side."),
        ("Desk won't adjust at {seat}", "The standing desk at {seat} is stuck and won't raise or lower."),
        ("Missing chair in conference room {wing}", "Conference room {wing} on floor {floor} is short two chairs."),
    ],
    "Network": [
        ("Wi-Fi drops on floor {floor}", "Wi-Fi disconnects every few minutes for anyone working on floor {floor}."),
        ("No ethernet connection at {seat}", "The wired connection at {seat} shows no link light and won't get an IP address."),
        ("Slow network in {wing} wing", "File transfers and video calls are extremely slow throughout the {wing} wing."),
    ],
    "AV/Conference Room": [
        ("Projector not turning on in room {wing}", "The projector in conference room {wing} on floor {floor} won't power on."),
        ("Video call audio cutting out in {wing}", "Conference room {wing} audio cuts out a few minutes into every video call."),
        ("HDMI input not detected in room {wing}", "The display in room {wing} doesn't detect any laptop plugged into the HDMI cable."),
    ],
    "Printer": [
        ("Printer jammed on floor {floor}", "The shared printer on floor {floor} has a persistent paper jam."),
        ("Printer out of toner near {wing} wing", "The printer near the {wing} wing is out of toner and needs a replacement cartridge."),
        ("Print jobs not reaching printer on floor {floor}", "Jobs sent to the floor {floor} printer disappear from the queue without printing."),
    ],
    "Access/Badge": [
        ("Badge reader offline at east entrance", "The badge reader at the east entrance of {building} isn't reading any cards."),
        ("Badge not granting access to floor {floor}", "An employee's badge is being denied at the floor {floor} elevator lobby."),
        ("Turnstile stuck at main entrance", "The turnstile at the {building} main entrance is jammed half-open."),
    ],
    "Cleaning": [
        ("Trash not emptied on floor {floor}", "Bins near {seat} have not been emptied in several days."),
        ("Spill in floor {floor} kitchen", "There's a sticky spill on the kitchen floor on {floor} that needs cleanup."),
        ("Carpet stain near {wing} wing", "A large stain has appeared on the carpet near the {wing} wing entrance."),
    ],
    "Other": [
        ("General maintenance request for floor {floor}", "Facilities noted a general upkeep item on floor {floor} that needs a look."),
        ("Signage missing near {wing} wing", "The directional sign near the {wing} wing has fallen off the wall."),
        ("Water cooler empty on floor {floor}", "The water cooler on floor {floor} has been empty since yesterday."),
    ],
}

CATEGORIES = list(INCIDENT_TEMPLATES.keys())

BLOCKED_REASONS = [
    "Waiting on a replacement part from the vendor.",
    "Needs building management approval before work can continue.",
    "Escalated to an outside contractor; awaiting their schedule.",
    "Parts on backorder, no estimated delivery date yet.",
    "Requires after-hours access, waiting on security to schedule.",
]

NOTE_LINES_EMPLOYEE = [
    "Any update on this? It's still an issue.",
    "Thanks for looking into it.",
    "This got worse overnight, just flagging.",
    "Confirming this is still happening as of today.",
    "Appreciate the quick response.",
]

NOTE_LINES_ENGINEER = [
    "Took a look, working on a fix now.",
    "Ordered the part, should be here in a few days.",
    "Should be resolved, please confirm on your end.",
    "Found the root cause, applying a fix.",
    "Followed up with the vendor, waiting to hear back.",
]

PRIORITY_ORDER = ["Low", "Medium", "High", "Critical"]


def priority_above(p, tiers=1):
    idx = min(PRIORITY_ORDER.index(p) + tiers, len(PRIORITY_ORDER) - 1)
    return PRIORITY_ORDER[idx]


def email_for(full_name):
    first, last = full_name.split()[0], full_name.split()[-1]
    return f"{first.lower()}.{last.lower()}@acme.inc"


def seed_users(cur):
    users = {}  # full_name -> id

    admin_emails = ["admin@acme.inc", email_for(ADMIN_NAMES[1])]
    for name, email in zip(ADMIN_NAMES, admin_emails):
        cur.execute(
            "INSERT INTO users (email, password, full_name, role) VALUES (%s, %s, %s, 'facility_admin') RETURNING id",
            (email, DEMO_PASSWORD_HASH, name),
        )
        users[name] = cur.fetchone()[0]

    engineer_ids = {}  # specialty -> user_id
    for name, specialty in ENGINEERS:
        cur.execute(
            "INSERT INTO users (email, password, full_name, role) VALUES (%s, %s, %s, 'engineer') RETURNING id",
            (email_for(name), DEMO_PASSWORD_HASH, name),
        )
        uid = cur.fetchone()[0]
        users[name] = uid
        cur.execute(
            "INSERT INTO engineer_profiles (user_id, specialty, phone) VALUES (%s, %s, %s)",
            (uid, specialty, f"555-01{random.randint(10, 99)}"),
        )
        engineer_ids[specialty] = uid

    employee_emails = ["employee@acme.inc"] + [email_for(n) for n in EMPLOYEE_NAMES[1:]]
    employee_ids = []
    for name, email in zip(EMPLOYEE_NAMES, employee_emails):
        cur.execute(
            "INSERT INTO users (email, password, full_name, role) VALUES (%s, %s, %s, 'employee') RETURNING id",
            (email, DEMO_PASSWORD_HASH, name),
        )
        uid = cur.fetchone()[0]
        users[name] = uid
        employee_ids.append(uid)

    admin_ids = [users[n] for n in ADMIN_NAMES]
    return admin_ids, engineer_ids, employee_ids


def seed_facilities(cur):
    """Returns building_id -> [(floor_id, floor_number, [seat_ids...])]."""
    layout = {}
    for (name, address), n_floors in zip(BUILDINGS, FLOORS_PER_BUILDING):
        cur.execute(
            "INSERT INTO buildings (name, address) VALUES (%s, %s) RETURNING id", (name, address)
        )
        building_id = cur.fetchone()[0]
        floors = []
        for floor_number in range(1, n_floors + 1):
            cur.execute(
                "INSERT INTO floors (building_id, floor_number, name) VALUES (%s, %s, %s) RETURNING id",
                (building_id, floor_number, f"Floor {floor_number}"),
            )
            floor_id = cur.fetchone()[0]
            n_seats = random.randint(10, 20)
            seat_ids = []
            for i in range(1, n_seats + 1):
                wing = WINGS[(i - 1) // 10 % len(WINGS)]
                seat_code = f"{floor_number}{wing}-{i:03d}"
                cur.execute(
                    "INSERT INTO seats (floor_id, seat_code) VALUES (%s, %s) RETURNING id",
                    (floor_id, seat_code),
                )
                seat_ids.append((cur.fetchone()[0], seat_code))
            floors.append((floor_id, floor_number, seat_ids))
        layout[building_id] = (name, floors)
    return layout


STATUS_COUNTS = [("Open", 15), ("In Progress", 15), ("Blocked", 6), ("Resolved", 12), ("Closed", 12)]
PRIORITY_POOL = ["Critical"] * 4 + ["High"] * 11 + ["Medium"] * 25 + ["Low"] * 20


def seed_incidents(cur, admin_ids, engineer_ids, employee_ids, layout):
    statuses = [s for s, n in STATUS_COUNTS for _ in range(n)]
    priorities = PRIORITY_POOL[:]
    random.shuffle(statuses)
    random.shuffle(priorities)
    building_ids = list(layout.keys())

    incidents = []  # collected rows for later notes/escalations
    for status, priority in zip(statuses, priorities):
        category = random.choice(CATEGORIES)
        building_id = random.choice(building_ids)
        building_name, floors = layout[building_id]
        floor_id, floor_number, seat_ids = random.choice(floors)
        has_seat = random.random() < 0.7 and seat_ids
        seat_id, seat_code = random.choice(seat_ids) if has_seat else (None, None)

        title_tpl, desc_tpl = random.choice(INCIDENT_TEMPLATES[category])
        fmt = dict(floor=floor_number, wing=random.choice(WINGS), seat=seat_code or "the shared area", building=building_name)
        title = title_tpl.format(**fmt)
        description = desc_tpl.format(**fmt)

        creator = random.choice(employee_ids)

        days_ago = random.uniform(10, 90) if status in ("Resolved", "Closed") else random.uniform(1, 60)
        created_at = NOW - timedelta(days=days_ago)

        engineer_id = engineer_ids.get(category, random.choice(list(engineer_ids.values())))
        if status == "Open":
            assigned_to = engineer_id if random.random() < 0.5 else None
        else:
            assigned_to = engineer_id

        history = []  # (from_status, to_status, changed_by, changed_at, reason)
        t = created_at
        history.append((None, "Open", creator, t, None))

        resolved_at = None
        closed_at = None

        if status != "Open":
            t += timedelta(hours=random.uniform(2, 48))
            changer = random.choice(admin_ids + [assigned_to])
            history.append(("Open", "In Progress", changer, t, None))

        if status == "Blocked":
            t += timedelta(hours=random.uniform(2, 24))
            history.append(("In Progress", "Blocked", assigned_to, t, random.choice(BLOCKED_REASONS)))

        if status in ("Resolved", "Closed"):
            if random.random() < 0.3:
                t += timedelta(hours=random.uniform(2, 24))
                history.append(("In Progress", "Blocked", assigned_to, t, random.choice(BLOCKED_REASONS)))
                t += timedelta(hours=random.uniform(4, 48))
                history.append(("Blocked", "In Progress", assigned_to, t, None))
            t += timedelta(hours=random.uniform(4, 72))
            history.append(("In Progress", "Resolved", assigned_to, t, None))
            resolved_at = t

        if status == "Closed":
            t += timedelta(hours=random.uniform(4, 72))
            history.append(("Resolved", "Closed", creator, t, None))
            closed_at = t

        updated_at = history[-1][3]

        cur.execute(
            """INSERT INTO incidents
               (title, description, category, status, priority, created_by, assigned_to,
                building_id, floor_id, seat_id, created_at, updated_at, resolved_at, closed_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (title, description, category, status, priority, creator, assigned_to,
             building_id, floor_id, seat_id, created_at, updated_at, resolved_at, closed_at),
        )
        incident_id = cur.fetchone()[0]

        for from_status, to_status, changed_by, changed_at, reason in history:
            cur.execute(
                """INSERT INTO incident_status_history
                   (incident_id, from_status, to_status, changed_by, reason, changed_at)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (incident_id, from_status, to_status, changed_by, reason, changed_at),
            )

        incidents.append(dict(
            id=incident_id, category=category, priority=priority, status=status,
            creator=creator, assigned_to=assigned_to, created_at=created_at,
            end_time=updated_at,
        ))

    return incidents


def seed_notes(cur, incidents):
    for inc in incidents:
        n_notes = random.randint(1, 5)
        window = (inc["end_time"] - inc["created_at"]).total_seconds()
        t = inc["created_at"]
        for i in range(n_notes):
            t = t + timedelta(seconds=window * random.uniform(0.05, 0.3)) if window > 0 else t + timedelta(hours=1)
            author = inc["creator"] if i % 2 == 0 or not inc["assigned_to"] else inc["assigned_to"]
            body = random.choice(NOTE_LINES_EMPLOYEE if author == inc["creator"] else NOTE_LINES_ENGINEER)
            cur.execute(
                "INSERT INTO incident_notes (incident_id, author_id, body, created_at) VALUES (%s, %s, %s, %s)",
                (inc["id"], author, body, t),
            )


def seed_escalations(cur, incidents, admin_ids):
    # Only the assigned engineer may request an escalation, so skip unassigned incidents.
    candidates_up = [
        i for i in incidents if i["priority"] != "Critical" and i["assigned_to"]
    ]
    random.shuffle(candidates_up)
    n = min(10, len(candidates_up))
    chosen = candidates_up[:n]

    for idx, inc in enumerate(chosen):
        requested_at = inc["created_at"] + timedelta(hours=random.uniform(1, 12))
        if idx < 4 and PRIORITY_ORDER.index(inc["priority"]) > 0:
            # Approved: incident's stored priority already reflects the escalated value.
            current_priority = PRIORITY_ORDER[PRIORITY_ORDER.index(inc["priority"]) - 1]
            requested_priority = inc["priority"]
            status = "Approved"
        else:
            current_priority = inc["priority"]
            requested_priority = priority_above(inc["priority"], random.choice([1, 2]))
            status = random.choice(["Pending", "Rejected"])
            if requested_priority == current_priority:
                continue

        decided_by = None
        decided_at = None
        if status in ("Approved", "Rejected"):
            decided_by = random.choice(admin_ids)
            decided_at = requested_at + timedelta(hours=random.uniform(2, 48))

        cur.execute(
            """INSERT INTO escalation_requests
               (incident_id, requested_by, current_priority, requested_priority, reason, status,
                decided_by, decided_at, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (inc["id"], inc["assigned_to"], current_priority, requested_priority,
             "Impact has grown; requesting a higher priority to get faster attention.",
             status, decided_by, decided_at, requested_at),
        )


TABLES = [
    "users", "engineer_profiles", "buildings", "floors", "seats",
    "incidents", "incident_notes", "incident_status_history", "escalation_requests",
]


def main():
    global NOW
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE " + ", ".join(TABLES) + " RESTART IDENTITY CASCADE")
            cur.execute("SELECT now()")
            NOW = cur.fetchone()[0]

            admin_ids, engineer_ids, employee_ids = seed_users(cur)
            layout = seed_facilities(cur)
            incidents = seed_incidents(cur, admin_ids, engineer_ids, employee_ids, layout)
            seed_notes(cur, incidents)
            seed_escalations(cur, incidents, admin_ids)

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
