-- Seed data: one account per role.
-- Password for all accounts: SentinelSeed1!
-- Hashes use the same PBKDF2-SHA256 scheme as app/core/security.py (390000 iterations).

INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
VALUES
    (
        'ranger1',
        'ranger1@sentinel.dev',
        'pbkdf2_sha256$390000$1cd94a96ed908bc29ddd803ba8228bc3$Xowk2msJMpGWErYyHHMeR+kssT0sjvs5AG1cDSRYWJw=',
        'Ranger',
        'One',
        'ranger',
        TRUE
    ),
    (
        'analyst1',
        'analyst1@sentinel.dev',
        'pbkdf2_sha256$390000$2851237afacbac74b84dd5c3f285734d$rI51hPoNToGsjqU2yItxPhX4BJUe035Y5lW2ayeLSf0=',
        'Analyst',
        'One',
        'analyst',
        TRUE
    ),
    (
        'liaison1',
        'liaison1@sentinel.dev',
        'pbkdf2_sha256$390000$bd1750f29422e274a7d12cc6556bbe72$c25X+xwMKt/VffbdOL51LqmdoZaNWJx1HE+KvfZFBjQ=',
        'Liaison',
        'One',
        'community_liaison',
        TRUE
    ),
    (
        'admin1',
        'admin1@sentinel.dev',
        'pbkdf2_sha256$390000$4b0b9be897b944a0f6c8211c85f74dd0$r1R5mBeA7ByTMk3j9kw2bx71m/mMmmO03XalBuG3Suk=',
        'Admin',
        'One',
        'admin',
        TRUE
    );
