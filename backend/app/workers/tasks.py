
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from celery.utils.log import get_task_logger

from app.workers.celery_app import celery_app
from app.core.database.connection import connect_to_mongo

logger = get_task_logger(__name__)


def _run_async(coro):
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


async def _init_db():
    from beanie import init_beanie
    import motor.motor_asyncio
    from app.core.config import get_settings
    from app.models.base import __beanie_models__
    
    settings = get_settings()
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    await init_beanie(database=db, document_models=__beanie_models__)


@celery_app.task(name="app.workers.tasks.process_prescription")
def process_prescription(prescription_id: str):
    logger.info(f"Starting prescription processing for {prescription_id}")
    
    async def _process():
        await _init_db()
        from app.services.prescription_service import PrescriptionService
        service = PrescriptionService()
        await service.process_prescription(prescription_id)

    _run_async(_process())
    logger.info(f"Finished prescription processing for {prescription_id}")


@celery_app.task(name="app.workers.tasks.expire_reservations")
def expire_reservations():
    async def _process():
        await _init_db()
        from app.models.reservation import Reservation, ReservationStatus
        from app.services.reservation_service import ReservationService
        
        service = ReservationService()
        now = datetime.now(timezone.utc)
        
        expired_reservations = await Reservation.find(
            Reservation.expires_at <= now,
            Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.AWAITING_PAYMENT])
        ).to_list()
        
        for res in expired_reservations:
            try:
                await service.expire_reservation(res.id)
                logger.info(f"Expired reservation {res.reservation_number}")
            except Exception as e:
                logger.error(f"Failed to expire {res.reservation_number}: {e}")

    _run_async(_process())


@celery_app.task(name="app.workers.tasks.check_low_stock")
def check_low_stock():
    async def _process():
        await _init_db()
        from app.models.medicine import InventoryAlert
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationType, NotificationChannel
        
        unresolved = await InventoryAlert.find(InventoryAlert.resolved == False).to_list()
        pass

    _run_async(_process())
