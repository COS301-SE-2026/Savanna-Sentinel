WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger14'
            ),
            'incident',
            'Rangers reported hearing gunfire in the area during patrol.',
            ST_GeogFromText('POINT(31.051696 -24.167160)'),
            NOW() - INTERVAL '291.59 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Gunshot Heard',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger15'
            ),
            'incident',
            'An animal carcass was discovered showing signs of poaching.',
            ST_GeogFromText('POINT(31.041517 -24.176658)'),
            NOW() - INTERVAL '142.35 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Carcass Found',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO tipoffs (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'liaison1'
            ),
            'incident',
            'An animal carcass was discovered showing signs of poaching.',
            ST_GeogFromText('POINT(31.042124 -24.177058)'),
            NOW() - INTERVAL '189.96 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, tipoff_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Carcass Found',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger7'
            ),
            'incident',
            'An unidentified person was seen acting suspiciously near the boundary.',
            ST_GeogFromText('POINT(31.040628 -24.175776)'),
            NOW() - INTERVAL '279.69 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Person',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger4'
            ),
            'incident',
            'An unidentified person was seen acting suspiciously near the boundary.',
            ST_GeogFromText('POINT(31.041616 -24.167232)'),
            NOW() - INTERVAL '95.55 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Person',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger7'
            ),
            'incident',
            'A wire snare was located and removed from the area.',
            ST_GeogFromText('POINT(31.257560 -24.224562)'),
            NOW() - INTERVAL '10.92 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Snare Found',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger15'
            ),
            'incident',
            'A wire snare was located and removed from the area.',
            ST_GeogFromText('POINT(31.167481 -24.268762)'),
            NOW() - INTERVAL '2.07 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Snare Found',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger14'
            ),
            'incident',
            'Rangers reported hearing gunfire in the area during patrol.',
            ST_GeogFromText('POINT(31.248252 -24.124212)'),
            NOW() - INTERVAL '183.20 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Gunshot Heard',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO tipoffs (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'liaison1'
            ),
            'incident',
            'A wire snare was located and removed from the area.',
            ST_GeogFromText('POINT(31.187858 -24.250008)'),
            NOW() - INTERVAL '196.05 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, tipoff_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Snare Found',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger2'
            ),
            'incident',
            'Unusual human tracks were found during a routine patrol.',
            ST_GeogFromText('POINT(31.021845 -24.158410)'),
            NOW() - INTERVAL '282.67 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Tracks',
    'low'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger10'
            ),
            'incident',
            'An unidentified person was seen acting suspiciously near the boundary.',
            ST_GeogFromText('POINT(31.149372 -24.168504)'),
            NOW() - INTERVAL '21.60 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Person',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger8'
            ),
            'incident',
            'An unidentified person was seen acting suspiciously near the boundary.',
            ST_GeogFromText('POINT(31.059183 -24.303192)'),
            NOW() - INTERVAL '297.39 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Person',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger9'
            ),
            'incident',
            'Unauthorized vehicle tracks were found inside the reserve.',
            ST_GeogFromText('POINT(31.159141 -24.141803)'),
            NOW() - INTERVAL '1.22 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Vehicle Tracks',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger9'
            ),
            'incident',
            'An unidentified person was seen acting suspiciously near the boundary.',
            ST_GeogFromText('POINT(31.247455 -24.205862)'),
            NOW() - INTERVAL '225.86 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Person',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger2'
            ),
            'incident',
            'Unusual human tracks were found during a routine patrol.',
            ST_GeogFromText('POINT(31.121260 -24.079010)'),
            NOW() - INTERVAL '149.32 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Tracks',
    'low'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger6'
            ),
            'incident',
            'Unauthorized vehicle tracks were found inside the reserve.',
            ST_GeogFromText('POINT(31.122238 -24.078663)'),
            NOW() - INTERVAL '177.58 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Vehicle Tracks',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger8'
            ),
            'incident',
            'Unusual human tracks were found during a routine patrol.',
            ST_GeogFromText('POINT(31.139724 -24.222901)'),
            NOW() - INTERVAL '195.86 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Tracks',
    'low'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger7'
            ),
            'incident',
            'Unusual human tracks were found during a routine patrol.',
            ST_GeogFromText('POINT(31.238116 -24.178862)'),
            NOW() - INTERVAL '9.35 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Tracks',
    'low'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger3'
            ),
            'incident',
            'An unidentified person was seen acting suspiciously near the boundary.',
            ST_GeogFromText('POINT(31.068208 -24.340030)'),
            NOW() - INTERVAL '4.95 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Suspicious Person',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger12'
            ),
            'incident',
            'An animal carcass was discovered showing signs of poaching.',
            ST_GeogFromText('POINT(31.060460 -24.168320)'),
            NOW() - INTERVAL '166.20 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Carcass Found',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger6'
            ),
            'incident',
            'An animal carcass was discovered showing signs of poaching.',
            ST_GeogFromText('POINT(31.069094 -24.249347)'),
            NOW() - INTERVAL '217.20 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Carcass Found',
    'high'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger7'
            ),
            'incident',
            'Unauthorized vehicle tracks were found inside the reserve.',
            ST_GeogFromText('POINT(31.149154 -24.160075)'),
            NOW() - INTERVAL '265.45 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Vehicle Tracks',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger10'
            ),
            'incident',
            'Unauthorized vehicle tracks were found inside the reserve.',
            ST_GeogFromText('POINT(31.128288 -24.285668)'),
            NOW() - INTERVAL '110.63 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'incident',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO incidents (id, field_report_id, incident_type, severity)
SELECT ev.id,
    r.id,
    'Vehicle Tracks',
    'medium'
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger4'
            ),
            'sighting',
            'Lion sighted during routine observation.',
            ST_GeogFromText('POINT(31.200133 -24.069474)'),
            NOW() - INTERVAL '46.60 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Lion',
    5
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger3'
            ),
            'sighting',
            'Leopard sighted during routine observation.',
            ST_GeogFromText('POINT(31.050844 -24.167339)'),
            NOW() - INTERVAL '261.99 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Leopard',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger11'
            ),
            'sighting',
            'Elephant sighted during routine observation.',
            ST_GeogFromText('POINT(31.267913 -24.197494)'),
            NOW() - INTERVAL '18.82 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Elephant',
    3
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger15'
            ),
            'sighting',
            'Buffalo sighted during routine observation.',
            ST_GeogFromText('POINT(31.051269 -24.167347)'),
            NOW() - INTERVAL '43.62 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Buffalo',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger9'
            ),
            'sighting',
            'Lion sighted during routine observation.',
            ST_GeogFromText('POINT(31.138516 -24.312473)'),
            NOW() - INTERVAL '10.66 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Lion',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger4'
            ),
            'sighting',
            'Buffalo sighted during routine observation.',
            ST_GeogFromText('POINT(31.255741 -24.314854)'),
            NOW() - INTERVAL '63.04 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Buffalo',
    3
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger8'
            ),
            'sighting',
            'Leopard sighted during routine observation.',
            ST_GeogFromText('POINT(31.228884 -24.152099)'),
            NOW() - INTERVAL '200.15 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Leopard',
    2
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger15'
            ),
            'sighting',
            'Elephant sighted during routine observation.',
            ST_GeogFromText('POINT(31.040947 -24.167259)'),
            NOW() - INTERVAL '238.81 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Elephant',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger11'
            ),
            'sighting',
            'Elephant sighted during routine observation.',
            ST_GeogFromText('POINT(31.190210 -24.043403)'),
            NOW() - INTERVAL '46.02 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Elephant',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger11'
            ),
            'sighting',
            'Buffalo sighted during routine observation.',
            ST_GeogFromText('POINT(31.238614 -24.188123)'),
            NOW() - INTERVAL '153.07 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Buffalo',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger10'
            ),
            'sighting',
            'Lion sighted during routine observation.',
            ST_GeogFromText('POINT(31.100291 -24.231879)'),
            NOW() - INTERVAL '178.64 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Lion',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger11'
            ),
            'sighting',
            'Rhino sighted during routine observation.',
            ST_GeogFromText('POINT(31.099873 -24.240957)'),
            NOW() - INTERVAL '13.88 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Rhino',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger1'
            ),
            'sighting',
            'Elephant sighted during routine observation.',
            ST_GeogFromText('POINT(31.188823 -24.161024)'),
            NOW() - INTERVAL '198.47 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Elephant',
    5
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger13'
            ),
            'sighting',
            'Lion sighted during routine observation.',
            ST_GeogFromText('POINT(31.050907 -24.167069)'),
            NOW() - INTERVAL '227.69 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Lion',
    2
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger9'
            ),
            'sighting',
            'Leopard sighted during routine observation.',
            ST_GeogFromText('POINT(31.188309 -24.250292)'),
            NOW() - INTERVAL '221.49 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Leopard',
    3
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger5'
            ),
            'sighting',
            'Rhino sighted during routine observation.',
            ST_GeogFromText('POINT(31.265746 -24.296518)'),
            NOW() - INTERVAL '46.17 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Rhino',
    5
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger11'
            ),
            'sighting',
            'Rhino sighted during routine observation.',
            ST_GeogFromText('POINT(31.147833 -24.321827)'),
            NOW() - INTERVAL '36.14 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Rhino',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger10'
            ),
            'sighting',
            'Rhino sighted during routine observation.',
            ST_GeogFromText('POINT(31.296628 -24.187966)'),
            NOW() - INTERVAL '115.89 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Rhino',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger14'
            ),
            'sighting',
            'Rhino sighted during routine observation.',
            ST_GeogFromText('POINT(31.041485 -24.176700)'),
            NOW() - INTERVAL '202.18 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Rhino',
    2
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger4'
            ),
            'sighting',
            'Rhino sighted during routine observation.',
            ST_GeogFromText('POINT(31.237661 -24.179471)'),
            NOW() - INTERVAL '119.06 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Rhino',
    5
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger4'
            ),
            'sighting',
            'Rhino sighted during routine observation.',
            ST_GeogFromText('POINT(31.051696 -24.167037)'),
            NOW() - INTERVAL '59.67 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Rhino',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger5'
            ),
            'sighting',
            'Leopard sighted during routine observation.',
            ST_GeogFromText('POINT(31.041883 -24.167153)'),
            NOW() - INTERVAL '278.40 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Leopard',
    2
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger1'
            ),
            'sighting',
            'Lion sighted during routine observation.',
            ST_GeogFromText('POINT(31.177996 -24.287182)'),
            NOW() - INTERVAL '95.24 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Lion',
    5
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger11'
            ),
            'sighting',
            'Leopard sighted during routine observation.',
            ST_GeogFromText('POINT(31.196734 -24.295709)'),
            NOW() - INTERVAL '96.90 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Leopard',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger6'
            ),
            'sighting',
            'Buffalo sighted during routine observation.',
            ST_GeogFromText('POINT(31.041837 -24.176800)'),
            NOW() - INTERVAL '72.17 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Buffalo',
    1
FROM ev,
    r;
WITH r AS (
    INSERT INTO field_reports (
            submitted_by,
            report_type,
            description,
            location,
            occurred_at
        )
    VALUES (
            (
                SELECT id
                FROM users
                WHERE username = 'ranger13'
            ),
            'sighting',
            'Leopard sighted during routine observation.',
            ST_GeogFromText('POINT(31.111493 -24.077994)'),
            NOW() - INTERVAL '253.52 days'
        )
    RETURNING id,
        location,
        occurred_at
),
ev AS (
    INSERT INTO geospatial_events (event_type, location, occurred_at)
    SELECT 'sighting',
        location,
        occurred_at
    FROM r
    RETURNING id
)
INSERT INTO sightings (id, field_report_id, species, count)
SELECT ev.id,
    r.id,
    'Leopard',
    2
FROM ev,
    r;