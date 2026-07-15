CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM (
    'ranger',
    'analyst',
    'community_liaison',
    'admin'
);

CREATE TYPE severity_level AS ENUM (
    'low',
    'medium',
    'high'
);

CREATE TYPE report_type AS ENUM (
    'incident',
    'sighting'
);

CREATE TYPE event_type AS ENUM (
    'incident',
    'sighting',
    'patrol_track'
);

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      TEXT        NOT NULL UNIQUE,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    first_name    TEXT        NOT NULL,
    last_name     TEXT        NOT NULL,
    role          user_role   NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_heatmaps (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    grid_resolution TEXT        NOT NULL,
    time_interval   TEXT        NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE geospatial_events (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type  event_type  NOT NULL,
    location    GEOGRAPHY(Point, 4326) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);

-- Multiple tokens per user (multiple devices/sessions).
CREATE TABLE refresh_tokens (
    jti        UUID        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE TABLE password_reset_tokens (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id    UUID        NOT NULL REFERENCES users(id),
    action      TEXT        NOT NULL,
    target_type TEXT,
    target_id   UUID,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE FUNCTION reject_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is insert-only: % not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

CREATE TRIGGER audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

-- request_id groups the alternative routes generated from a single planning request.
CREATE TABLE patrol_routes (
    id             UUID                       PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id     UUID                       NOT NULL,
    requested_by   UUID                       NOT NULL REFERENCES users(id),
    start_point    GEOGRAPHY(Point, 4326)     NOT NULL,
    max_time       FLOAT                      NOT NULL,
    max_fuel       FLOAT                      NOT NULL,
    suggested_path GEOGRAPHY(LineString, 4326) NOT NULL,
    estimated_time FLOAT                      NOT NULL,
    estimated_fuel FLOAT                      NOT NULL,
    risk_coverage  FLOAT                      NOT NULL,
    created_at     TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

CREATE TABLE field_reports (
    id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    submitted_by UUID           NOT NULL REFERENCES users(id),
    route_id     UUID           REFERENCES patrol_routes(id) ON DELETE SET NULL,
    report_type  report_type    NOT NULL,
    description  TEXT           NOT NULL,
    location     GEOGRAPHY(Point, 4326) NOT NULL,
    occurred_at  TIMESTAMPTZ    NOT NULL,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE TABLE tipoffs (
    id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    submitted_by UUID           NOT NULL REFERENCES users(id),
    report_type  report_type    NOT NULL,
    description  TEXT           NOT NULL,
    location     GEOGRAPHY(Point, 4326) NOT NULL,
    occurred_at  TIMESTAMPTZ    NOT NULL,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

-- Exactly one of field_report_id / tipoff_id is set; both null means CSV ingestion.
CREATE TABLE incidents (
    id              UUID           PRIMARY KEY REFERENCES geospatial_events(id) ON DELETE CASCADE,
    field_report_id UUID           UNIQUE REFERENCES field_reports(id) ON DELETE SET NULL,
    tipoff_id       UUID           UNIQUE REFERENCES tipoffs(id)       ON DELETE SET NULL,
    incident_type   TEXT           NOT NULL,
    description     TEXT,
    severity        severity_level
);

CREATE TABLE sightings (
    id              UUID  PRIMARY KEY REFERENCES geospatial_events(id) ON DELETE CASCADE,
    field_report_id UUID  UNIQUE REFERENCES field_reports(id) ON DELETE SET NULL,
    tipoff_id       UUID  UNIQUE REFERENCES tipoffs(id)       ON DELETE SET NULL,
    species         TEXT  NOT NULL,
    count           INT
);

-- Available roads
CREATE TABLE patrol_tracks (
    id               UUID                        PRIMARY KEY REFERENCES geospatial_events(id) ON DELETE CASCADE,
    route_line       GEOGRAPHY(LineString, 4326)  NOT NULL,
    distance_covered FLOAT
);

CREATE TABLE photos (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    geospatial_event_id UUID        NOT NULL REFERENCES geospatial_events(id) ON DELETE CASCADE,
    image_url           TEXT        NOT NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grid_cells (
    id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    heatmap_id     UUID                     NOT NULL REFERENCES risk_heatmaps(id) ON DELETE CASCADE,
    polygon_bounds GEOGRAPHY(Polygon, 4326) NOT NULL,
    risk_score     FLOAT                    NOT NULL
);

CREATE TABLE explainability_metrics (
    id               UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id          UUID  NOT NULL REFERENCES grid_cells(id) ON DELETE CASCADE,
    key_reason       TEXT  NOT NULL,
    confidence_level FLOAT NOT NULL
);
