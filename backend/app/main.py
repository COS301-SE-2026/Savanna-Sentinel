from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.media import _service
from app.api.v1.media import router as media_router
from app.api.v1.reports import router as reports_router
from app.api.v1.risk import router as risk_router
from app.api.v1.routes import router as routes_router
from app.api.v1.tipoffs import router as tipoff_router

# As other routers are built, import and include them here:
from app.api.v1.users import router as users_router

# As other routers are built, import and include them here:
# from app.api.v1.reports import router as reports_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_in_threadpool(_service._ensure_bucket)
    yield


app = FastAPI(
    title="Savanna Sentinel API",
    version="0.1.0",
    description="Wildlife operations backend Savanna Sentinel",
    lifespan=lifespan,
    openapi_url="/v1/openapi.json",
    docs_url="/v1/docs",
)

# CORS
# Dev servers are always allowed, FRONTEND_ORIGIN adds the deployed origin.
allowed_origins = ["http://localhost:5173", "http://localhost:3000"]
if settings.FRONTEND_ORIGIN:
    allowed_origins.append(settings.FRONTEND_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/v1")
app.include_router(users_router, prefix="/v1")
app.include_router(routes_router, prefix="/v1")

app.include_router(ingestion_router, prefix="/v1")
app.include_router(reports_router, prefix="/v1")
app.include_router(audit_router, prefix="/v1")
app.include_router(media_router, prefix="/v1")
app.include_router(risk_router, prefix="/v1")
app.include_router(tipoff_router, prefix="/v1")
app.include_router(dashboard_router, prefix="/v1")


@app.get("/v1/health", tags=["health"])
async def health():
    """Quick liveness check - returns 200 if the server is running."""
    return {"status": "ok"}
