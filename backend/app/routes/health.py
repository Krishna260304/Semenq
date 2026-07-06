
from __future__ import annotations

import platform
from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.database.connection import ping_database
from app.core.database.redis_client import ping_redis

router = APIRouter(tags=["Health"])
_started_at = datetime.now(timezone.utc)


@router.get("/healthz", summary="Application health check")
async def health_check() -> dict:
    settings = get_settings()
    return {
        "success": True,
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV.value,
        "uptime_seconds": (datetime.now(timezone.utc) - _started_at).total_seconds(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(),
    }


@router.get("/database", summary="MongoDB health check")
async def database_health() -> dict:
    result = await ping_database()
    return {
        "success": result["healthy"],
        "component": "mongodb",
        **result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/redis", summary="Redis health check")
async def redis_health() -> dict:
    result = await ping_redis()
    return {
        "success": result["healthy"],
        "component": "redis",
        **result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/full", summary="Full dependency health check")
async def full_health_check() -> dict:
    settings = get_settings()
    db_status = await ping_database()
    redis_status = await ping_redis()

    all_healthy = db_status["healthy"] and redis_status["healthy"]

    return {
        "success": all_healthy,
        "status": "healthy" if all_healthy else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV.value,
        "dependencies": {
            "mongodb": db_status,
            "redis": redis_status,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
