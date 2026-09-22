-- ACME Facility Incident Management schema.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE everywhere.

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('employee', 'facility_admin', 'engineer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('Open', 'In Progress', 'Blocked', 'Resolved', 'Closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_category AS ENUM (
        'HVAC', 'Electrical', 'Plumbing', 'Furniture', 'Network',
        'AV/Conference Room', 'Printer', 'Access/Badge', 'Cleaning', 'Other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE escalation_status AS ENUM ('Pending', 'Approved', 'Rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL CHECK (email ILIKE '%@acme.inc'),
    password VARCHAR NOT NULL, -- plain text for now; temporary for local development
    full_name VARCHAR NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engineer_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty incident_category NOT NULL,
    phone VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    address VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floors (
    id SERIAL PRIMARY KEY,
    building_id INT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INT NOT NULL,
    name VARCHAR,
    UNIQUE (building_id, floor_number)
);

CREATE TABLE IF NOT EXISTS seats (
    id SERIAL PRIMARY KEY,
    floor_id INT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    seat_code VARCHAR NOT NULL,
    UNIQUE (floor_id, seat_code)
);

CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    category incident_category NOT NULL,
    status incident_status NOT NULL DEFAULT 'Open',
    priority incident_priority NOT NULL DEFAULT 'Medium',
    created_by INT NOT NULL REFERENCES users(id),
    assigned_to INT NULL REFERENCES users(id),
    building_id INT NOT NULL REFERENCES buildings(id),
    floor_id INT NOT NULL REFERENCES floors(id),
    seat_id INT NULL REFERENCES seats(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ NULL,
    closed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS incident_notes (
    id SERIAL PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    author_id INT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_status_history (
    id SERIAL PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    from_status incident_status NULL,
    to_status incident_status NOT NULL,
    changed_by INT NOT NULL REFERENCES users(id),
    reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalation_requests (
    id SERIAL PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    requested_by INT NOT NULL REFERENCES users(id),
    current_priority incident_priority NOT NULL,
    requested_priority incident_priority NOT NULL,
    reason TEXT NOT NULL,
    status escalation_status NOT NULL DEFAULT 'Pending',
    decided_by INT NULL REFERENCES users(id),
    decided_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON incidents(created_by);
CREATE INDEX IF NOT EXISTS idx_incidents_building_id ON incidents(building_id);
CREATE INDEX IF NOT EXISTS idx_incidents_fulltext ON incidents
    USING GIN (to_tsvector('english', title || ' ' || coalesce(description, '')));

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON incidents;
CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
