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

CREATE TYPE risk_job_type AS ENUM (
    'train',
    'score'
);

CREATE TYPE notification_type AS ENUM (
    'tipoff_submitted',
    'field_report_submitted',
    'high_severity_incident',
    'ingestion_complete'
);

CREATE TABLE file_ingestion_staging (
    record_id           BIGINT,
    ingestion_timestamp TIMESTAMPTZ,
    source_system       TEXT,
    data_domain         TEXT,
    event_type          TEXT,
    payload_size_kb     NUMERIC,
    priority_level      TEXT,
    retry_count         INT,
    is_encrypted        BOOLEAN,
    status              TEXT
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
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE risk_models (
    id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    park_id                TEXT        NOT NULL,
    version                INT         NOT NULL,
    object_storage_key     TEXT        NOT NULL,
    is_active              BOOLEAN     NOT NULL DEFAULT FALSE,
    trained_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trained_by             UUID        NOT NULL REFERENCES users(id),
    training_window_start  TIMESTAMPTZ NOT NULL,
    training_window_end    TIMESTAMPTZ NOT NULL,
    n_training_examples    INT         NOT NULL,
    metrics                JSONB       NOT NULL,
    UNIQUE (park_id, version)
);

CREATE UNIQUE INDEX risk_models_one_active_per_park
    ON risk_models (park_id) WHERE is_active;

CREATE TABLE risk_heatmaps (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id        UUID        NOT NULL REFERENCES risk_models(id),
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
    actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL,
    target_type TEXT,
    target_id   UUID,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert-only with one narrow exception: ON DELETE SET NULL on actor_id
-- (deleting a user) is itself implemented by Postgres as an UPDATE against
-- this table, so it would otherwise be rejected by this same trigger. Allow
-- only that exact shape, actor_id going to NULL and nothing else changing,
-- and reject every other UPDATE/DELETE.
CREATE FUNCTION reject_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.actor_id IS NULL
       AND OLD.action = NEW.action
       AND OLD.target_type IS NOT DISTINCT FROM NEW.target_type
       AND OLD.target_id IS NOT DISTINCT FROM NEW.target_id
       AND OLD.details IS NOT DISTINCT FROM NEW.details
       AND OLD.created_at = NEW.created_at
    THEN
        RETURN NEW;
    END IF;

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
    end_point      GEOGRAPHY(Point, 4326)     NOT NULL,
    max_time       FLOAT,
    max_fuel       FLOAT,
    suggested_path GEOGRAPHY(LineString, 4326) NOT NULL,
    estimated_time FLOAT                      NOT NULL,
    estimated_fuel FLOAT                      NOT NULL,
    risk_coverage  FLOAT                      NOT NULL,
    risk_heatmap   JSONB                      NOT NULL,
    created_at     TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_jobs (
    id           UUID          PRIMARY KEY,
    job_type     risk_job_type NOT NULL,
    park_id      TEXT          NOT NULL,
    triggered_by UUID          NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE route_jobs (
    id           UUID        PRIMARY KEY,
    park_id      TEXT        NOT NULL,
    requested_by UUID        NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE field_reports (
    id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    submitted_by UUID           NOT NULL REFERENCES users(id),
    route_id     UUID           REFERENCES patrol_routes(id) ON DELETE SET NULL,
    report_type  report_type    NOT NULL,
    description  TEXT           NOT NULL,
    location     GEOGRAPHY(Point, 4326) NOT NULL,
    occurred_at  TIMESTAMPTZ    NOT NULL,
    client_id    UUID,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,
    status       TEXT           NOT NULL DEFAULT 'none'
);

CREATE TABLE comments (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES field_reports(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT,
    photo_urls VARCHAR[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status_change VARCHAR
);

CREATE UNIQUE INDEX field_reports_client_id_uniq
    ON field_reports (submitted_by, client_id)
    WHERE client_id IS NOT NULL;

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
    park_id        TEXT                     NOT NULL,
    cell_ref       TEXT                     NOT NULL,
    row_index      INT                      NOT NULL,
    col_index      INT                      NOT NULL,
    polygon_bounds GEOGRAPHY(Polygon, 4326) NOT NULL,
    UNIQUE (park_id, cell_ref)
);

CREATE TABLE cell_risk_scores (
    id            UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    heatmap_id    UUID  NOT NULL REFERENCES risk_heatmaps(id) ON DELETE CASCADE,
    grid_cell_id  UUID  NOT NULL REFERENCES grid_cells(id) ON DELETE CASCADE,
    risk_score    FLOAT NOT NULL
);

CREATE TABLE grid_cell_features (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    heatmap_id    UUID        NOT NULL REFERENCES risk_heatmaps(id) ON DELETE CASCADE,
    grid_cell_id  UUID        NOT NULL REFERENCES grid_cells(id) ON DELETE CASCADE,
    features      JSONB       NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE explainability_metrics (
    id               UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id          UUID  NOT NULL REFERENCES cell_risk_scores(id) ON DELETE CASCADE,
    key_reason       TEXT  NOT NULL,
    confidence_level FLOAT NOT NULL
);

CREATE TABLE notifications (
    id           UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         notification_type  NOT NULL,
    title        TEXT               NOT NULL,
    body         TEXT               NOT NULL,
    related_type TEXT,
    related_id   TEXT,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_unread_idx ON notifications (user_id, read_at);
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
