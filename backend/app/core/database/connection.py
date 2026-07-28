
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging.logger import get_logger

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorDatabase

logger = get_logger(__name__)

_client: AsyncIOMotorClient | None = None
_database: "AsyncIOMotorDatabase | None" = None


def _get_document_models() -> list:
    from app.models.user import (
        User,
        Patient,
        Pharmacy,
        Admin,
        Address,
        Role,
        Permission,
        RefreshToken,
        Session,
        AuditLog,
        VerificationToken,
        PasswordResetToken,
        Device,
        UserPreferences,
    )
    from app.models.medicine import (
        Medicine,
        MedicineCategory,
        MedicineBrand,
        MedicineInventory,
        InventoryBatch,
        InventoryTransaction,
        MedicineImage,
        InventoryAlert,
        FavoriteMedicine,
        MedicineSearchHistory,
    )
    from app.models.prescription import (
        Prescription,
        PrescriptionImage,
        OCRLog,
        AILog,
        MedicineMatch,
    )
    from app.models.search import (
        SearchSession,
        SearchResult,
        AvailabilityResult,
        SearchCache,
    )
    from app.models.reservation import (
        Reservation,
        ReservationItem,
        ReservationLog,
        QRCode,
    )
    from app.models.payment import (
        Payment,
        PaymentTransaction,
        PaymentRefund,
    )
    from app.models.order import (
        Order,
        CourierShipment,
        CourierTracking,
        Receipt,
    )
    from app.models.analytics import (
        AnalyticsEvent,
        DailyStatistics,
        WeeklyStatistics,
        MonthlyStatistics,
        MedicinePopularity,
        PharmacyStatistics,
        TrendAnalysis,
    )
    from app.models.forecast import (
        ForecastResult,
        ForecastJob,
        DashboardCache,
    )
    from app.models.notification import (
        Notification,
        NotificationTemplate,
        NotificationLog,
    )

    return [
        User, Patient, Pharmacy, Admin, Address, Role, Permission,
        RefreshToken, Session, AuditLog, VerificationToken,
        PasswordResetToken, Device, UserPreferences,
        Medicine, MedicineCategory, MedicineBrand, MedicineInventory,
        InventoryBatch, InventoryTransaction, MedicineImage, InventoryAlert,
        FavoriteMedicine, MedicineSearchHistory,
        Prescription, PrescriptionImage, OCRLog, AILog, MedicineMatch,
        SearchSession, SearchResult, AvailabilityResult, SearchCache,
        Reservation, ReservationItem, ReservationLog, QRCode,
        Payment, PaymentTransaction, PaymentRefund,
        Order, CourierShipment, CourierTracking, Receipt,
        AnalyticsEvent, DailyStatistics, WeeklyStatistics, MonthlyStatistics,
        MedicinePopularity, PharmacyStatistics, TrendAnalysis,
        ForecastResult, ForecastJob, DashboardCache,
        Notification, NotificationTemplate, NotificationLog,
    ]


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
async def connect_database() -> None:
    global _client, _database
    settings = get_settings()

    logger.info("Connecting to MongoDB", db=settings.MONGODB_DB_NAME)

    _client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        maxPoolSize=settings.MONGODB_MAX_CONNECTIONS,
        minPoolSize=settings.MONGODB_MIN_CONNECTIONS,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=30000,
        retryWrites=True,
        retryReads=True,
    )

    await _client.admin.command("ping")

    _database = _client[settings.MONGODB_DB_NAME]

    document_models = _get_document_models()

    await init_beanie(
        database=_database,
        document_models=document_models,
        allow_index_dropping=False,
    )

    logger.info("MongoDB connected and Beanie initialized", model_count=len(document_models))


async def disconnect_database() -> None:
    global _client, _database
    if _client:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed")


async def get_database() -> "AsyncIOMotorDatabase":
    if _database is None:
        raise RuntimeError("Database not initialized. Call connect_database() first.")
    return _database


async def ping_database() -> dict:
    if _client is None:
        return {"status": "disconnected", "healthy": False}
    try:
        result = await _client.admin.command("ping")
        return {"status": "connected", "healthy": True, "ok": result.get("ok")}
    except Exception as exc:
        logger.error("MongoDB ping failed", error=str(exc))
        return {"status": "error", "healthy": False, "error": str(exc)}
