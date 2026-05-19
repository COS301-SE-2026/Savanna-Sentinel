# Savanna Sentinel
Wildlife conservation anti-poaching intelligence platform. Helps game reserve rangers, analysts, and community liaisons detect poaching hotspots, plan optimal patrols, and capture field data, even while offline.

**SIGILL - Savanna Sentinel - Wildlife conservation anti-poaching intelligence platform.**

[![Codecov](https://codecov.io/gh/COS301-SE-2026/Savanna-Sentinel/branch/dev/graph/badge.svg)](https://codecov.io/gh/COS301-SE-2026/Savanna-Sentinel)
[![Backend CI pipeline](https://github.com/COS301-SE-2026/Savanna-Sentinel/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/COS301-SE-2026/Savanna-Sentinel/actions/workflows/backend-ci.yml)
[![Frontend CI pipeline](https://github.com/COS301-SE-2026/Savanna-Sentinel/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/COS301-SE-2026/Savanna-Sentinel/actions/workflows/frontend-ci.yml)

[![GitHub issues](https://img.shields.io/github/issues/COS301-SE-2026/Savanna-Sentinel)](https://github.com/COS301-SE-2026/Savanna-Sentinel/issues)
[![GitHub closed issues](https://img.shields.io/github/issues-closed/COS301-SE-2026/Savanna-Sentinel)](https://github.com/COS301-SE-2026/Savanna-Sentinel/issues?q=is%3Aissue+is%3Aclosed)
[![GitHub raw issues](https://img.shields.io/github/issues-raw/COS301-SE-2026/Savanna-Sentinel)](https://github.com/COS301-SE-2026/Savanna-Sentinel/issues)

## Documentation

- [Software Requirements Specification (SRS)](https://github.com/COS301-SE-2026/Savanna-Sentinel/blob/main/docs/SRS.md)
- [GitHub Project Board](https://github.com/orgs/COS301-SE-2026/projects/72/)

## Team

| Name | Role | GitHub | LinkedIn |
|---|---|---|---|
| David van Rooijen | Project Lead | [@davidvrjn](https://github.com/davidvrjn) | [david-van-rooijen](https://www.linkedin.com/in/david-van-rooijen/) |
| Stephan Kritzinger | Developer | [@Stephan-Kritzinger](https://github.com/Stephan-Kritzinger) | [stephan-kritzinger](https://www.linkedin.com/in/stephan-kritzinger-134702375/) |
| Daniel Cohen | Developer | [@Sashumi-6](https://github.com/Sashumi-6) | [daniel-cohen](https://www.linkedin.com/in/daniel-cohen-057640235) |
| Michael Koch | Developer | [@MichaelKoch23](https://github.com/MichaelKoch23) | [michael-koch](https://www.linkedin.com/in/michael-koch-6a8599240/) |
| Dandré Nel | Developer | [@DandreNel7](https://github.com/DandreNel7) | [dandré-nel](https://www.linkedin.com/in/dandré-nel-065b70183/) |

## Requirements

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/) v2

## Quick Start

```bash
# 1. Copy the env template
cp backend/.env.example backend/.env

# 2. Start all services (DB will be initialised and seeded on first run)
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (dev) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| MinIO console | http://localhost:9001 |

### Seed accounts

All seed accounts use the password **`SentinelSeed1!`**

| Username | Role |
|---|---|
| `ranger1` | Ranger |
| `analyst1` | Analyst |
| `liaison1` | Community Liaison |
| `admin1` | Admin |

## Development

The `docker-compose.override.yml` is applied automatically. It mounts source directories into the containers so changes take effect without rebuilding.

- **Backend** - FastAPI with `--reload`: edit files in `backend/` and the server restarts.
- **Frontend** - Vite dev server on port 5173: edit files in `frontend/src/` and the browser hot-reloads.

### Running services individually

```bash
# Start only infrastructure (DB, Redis, MinIO)
docker compose up db redis minio

# Backend only (against local infra)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend only
cd frontend
npm install
npm run dev
```

### Useful commands

```bash
# Rebuild a single service after changing its Dockerfile
docker compose up --build backend

# View logs for a specific service
docker compose logs -f backend

# Open a psql shell
docker compose exec db psql -U sentinel -d savanna_sentinel

# Stop all services and remove containers (data volumes are preserved)
docker compose down

# Full reset, destroys all data volumes
docker compose down -v
```

## Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

## Database

The database is initialised automatically on the first `docker compose up` using the scripts in `backend/init-db/`:

1. `01_schema.sql` - creates all tables and types
2. `02_seed.sql` - inserts one seed account per role

To reset the database and re-run init scripts:

```bash
docker compose down -v
docker compose up --build
```

## Project Structure

```
.
├── backend/          # FastAPI (Python)
│   ├── app/
│   │   ├── api/v1/   # Route handlers
│   │   ├── services/ # Business logic
│   │   ├── repositories/ # DB queries
│   │   ├── models/   # SQLAlchemy ORM models
│   │   └── schemas/  # Pydantic request/response schemas
│   ├── init-db/      # SQL run by Postgres on first boot
│   └── tests/
└── frontend/         # React 19 + TypeScript + Vite
    └── src/
        ├── pages/
        ├── components/
        ├── services/ # API clients
        └── store/    # Zustand state
```