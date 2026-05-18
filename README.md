# Savanna Sentinel

Wildlife conservation anti-poaching intelligence platform. Helps game reserve rangers, analysts, and community liaisons detect poaching hotspots, plan optimal patrols, and capture field data, even while offline.

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

- **Backend** — FastAPI with `--reload`: edit files in `backend/` and the server restarts.
- **Frontend** — Vite dev server on port 5173: edit files in `frontend/src/` and the browser hot-reloads.

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

1. `01_schema.sql` — creates all tables and types
2. `02_seed.sql` — inserts one seed account per role

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