from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.reports import router as reports_router

# As other routers are built, import and include them here:
from app.api.v1.users import router as users_router

app = FastAPI(
    title="Savana Sentinel API",
    version="0.1.0",
    description="Wildlife operations backend Savana Sentinel",
)

# CORS
# Allow the frontend dev server during development.
# DB NOTE / deployment NOTE: restrict origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/v1")
app.include_router(users_router, prefix="/v1")

app.include_router(ingestion_router, prefix="/v1")
app.include_router(reports_router, prefix="/v1")
app.include_router(audit_router, prefix="/v1")

@app.get("/v1/health", tags=["health"])
async def health():
    """Quick liveness check - returns 200 if the server is running."""
    return {"status": "ok"}
