"""Provide API routes for system health, readiness, and liveness checks."""

from datetime import datetime, timezone

from fastapi import APIRouter

from nexus.api.dependencies import SettingsDep
from nexus.api.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/")
async def root():
    return {"message": "Welcome to Nexus API"}


@router.get("/health", response_model=HealthResponse)
async def health_check(settings: SettingsDep):
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        environment=settings.environment,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/health/live")
async def liveness_check():
    return {"status": "alive"}
