
from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database.connection import disconnect_database, connect_database
from app.core.database.redis_client import disconnect_redis, connect_redis
from app.core.exceptions.handlers import register_exception_handlers
from app.core.logging.logger import get_logger
from app.core.middleware.logging_middleware import LoggingMiddleware
from app.core.middleware.request_id import RequestIDMiddleware

from app.routes import auth, health, medicine, inventory, reservation, prescription, payment, order, analytics, users, notifications, realtime

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Application starting up...")
    
    await connect_database()
    await connect_redis()
    
    import asyncio
    from app.services.backup_service import restore_medicines_from_backup
    asyncio.create_task(restore_medicines_from_backup())
    
    logger.info("Application startup complete.")
    yield
    
    logger.info("Application shutting down...")
    
    await disconnect_redis()
    await disconnect_database()
    
    logger.info("Application shutdown complete.")


def create_app() -> FastAPI:
    settings = get_settings()
    
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Semenq AI-Powered Medicine Discovery & Reservation Platform",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    from fastapi.staticfiles import StaticFiles
    import os
    os.makedirs("uploads", exist_ok=True)
    app.mount("/static", StaticFiles(directory="uploads"), name="static")

    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    register_exception_handlers(app)

    api_prefix = "/api"
    app.include_router(health.router, prefix=api_prefix)
    app.include_router(auth.router, prefix=api_prefix)
    app.include_router(medicine.router, prefix=api_prefix)
    app.include_router(inventory.router, prefix=api_prefix)
    app.include_router(reservation.router, prefix=api_prefix)
    app.include_router(prescription.router, prefix=api_prefix)
    app.include_router(payment.router, prefix=api_prefix)
    app.include_router(order.router, prefix=api_prefix)
    app.include_router(analytics.router, prefix=api_prefix)
    app.include_router(users.router, prefix=api_prefix)
    app.include_router(notifications.router, prefix=api_prefix)
    app.include_router(realtime.router, prefix=api_prefix)

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
