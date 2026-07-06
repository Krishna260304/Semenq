
from __future__ import annotations

import string
import random
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from app.core.config import get_settings
from app.core.exceptions import (
    InsufficientStockException,
    InvalidReservationStateException,
    MedicineNotFoundException,
    NotFoundException,
    ReservationExpiredException,
    ReservationNotFoundException,
)
from app.core.logging.logger import get_logger
from app.models.reservation import (
    PickupMethod,
    QRCode,
    QRStatus,
    Reservation,
    ReservationItem,
    ReservationLog,
    ReservationStatus,
    RESERVATION_TRANSITIONS,
)
from app.services.medicine_service import MedicineService

logger = get_logger(__name__)
settings = get_settings()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_reservation_number() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    year = _utcnow().year
    return f"SEM-{year}-{suffix}"


class ReservationService:
    def __init__(self) -> None:
        self._medicine_service = MedicineService()

    async def create_reservation(
        self,
        patient_id: str,
        pharmacy_id: str,
        items: list[dict],
        pickup_method: str = "in_store",
        delivery_address_id: Optional[str] = None,
        prescription_id: Optional[str] = None,
    ) -> Reservation:
        from app.repositories.medicine_repository import MedicineInventoryRepository
        from app.repositories.user_repository import PharmacyRepository

        pharmacy_repo = PharmacyRepository()
        inventory_repo = MedicineInventoryRepository()

        pharmacy = await pharmacy_repo.get_by_id_or_raise(pharmacy_id)

        reservation_number = _generate_reservation_number()
        expiry = _utcnow() + timedelta(hours=settings.RESERVATION_EXPIRY_HOURS)

        validated_items = []
        subtotal = 0.0

        for item_data in items:
            medicine_id = item_data["medicine_id"]
            quantity = int(item_data["quantity"])

            inventory = await inventory_repo.get_by_pharmacy_medicine(pharmacy_id, medicine_id)
            if not inventory:
                raise MedicineNotFoundException(f"Medicine {medicine_id} not found in this pharmacy.")
            if inventory.net_available < quantity:
                raise InsufficientStockException(
                    f"Only {inventory.net_available} units of {inventory.medicine_name} available."
                )

            item_total = inventory.unit_price * quantity
            subtotal += item_total
            validated_items.append({
                "medicine_id": medicine_id,
                "medicine_name": inventory.medicine_name,
                "medicine_composition": inventory.medicine_composition,
                "inventory_id": inventory.id,
                "quantity": quantity,
                "unit_price": inventory.unit_price,
                "mrp": inventory.mrp,
                "total_price": item_total,
                "inventory": inventory,
            })

        reservation_fee = round(subtotal * (settings.RESERVATION_FEE_PERCENT / 100), 2)
        platform_fee = round(subtotal * (settings.PLATFORM_FEE_PERCENT / 100), 2)
        courier_fee = 0.0
        if pickup_method == PickupMethod.COURIER.value:
            courier_fee = 50.0  # Base courier fee
        gst = round(subtotal * 0.18, 2)
        grand_total = round(subtotal + reservation_fee + platform_fee + courier_fee + gst, 2)

        reservation = Reservation(
            reservation_number=reservation_number,
            patient_id=patient_id,
            pharmacy_id=pharmacy_id,
            pharmacy_name=pharmacy.pharmacy_name,
            pharmacy_address=f"{pharmacy.street}, {pharmacy.city}, {pharmacy.state}",
            status=ReservationStatus.PENDING,
            pickup_method=PickupMethod(pickup_method),
            expires_at=expiry,
            medicine_count=len(validated_items),
            subtotal=subtotal,
            reservation_fee=reservation_fee,
            platform_fee=platform_fee,
            courier_fee=courier_fee,
            taxes=gst,
            grand_total=grand_total,
            delivery_address_id=delivery_address_id,
            prescription_id=prescription_id,
        )
        await reservation.insert()

        item_ids = []
        for vitem in validated_items:
            res_item = ReservationItem(
                reservation_id=reservation.id,
                medicine_id=vitem["medicine_id"],
                medicine_name=vitem["medicine_name"],
                medicine_composition=vitem["medicine_composition"],
                reserved_quantity=vitem["quantity"],
                unit_price=vitem["unit_price"],
                mrp=vitem["mrp"],
                total_price=vitem["total_price"],
                inventory_snapshot={
                    "available_before": vitem["inventory"].available_quantity,
                    "reserved_before": vitem["inventory"].reserved_quantity,
                },
            )
            await res_item.insert()
            item_ids.append(res_item.id)

            await self._medicine_service.reserve_stock(
                pharmacy_id=pharmacy_id,
                medicine_id=vitem["medicine_id"],
                quantity=vitem["quantity"],
                reservation_id=reservation.id,
                performed_by=patient_id,
            )

        reservation.item_ids = item_ids
        reservation.status = ReservationStatus.CONFIRMED
        reservation.confirmed_at = _utcnow()
        await reservation.save()

        await self._log_state_change(
            reservation.id, None, ReservationStatus.CONFIRMED, patient_id, "reservation_created"
        )

        logger.info(
            "Reservation created",
            reservation_id=reservation.id,
            reservation_number=reservation_number,
            patient_id=patient_id,
        )
        return reservation

    async def transition_state(
        self,
        reservation_id: str,
        new_status: ReservationStatus,
        changed_by: str,
        changed_by_role: str = "",
        reason: str = "",
    ) -> Reservation:
        reservation = await Reservation.find_one(Reservation.id == reservation_id)
        if not reservation:
            raise ReservationNotFoundException()

        current = reservation.status
        allowed = RESERVATION_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise InvalidReservationStateException(
                f"Cannot transition from '{current.value}' to '{new_status.value}'."
            )

        reservation.status = new_status
        reservation.updated_at = _utcnow()

        if new_status == ReservationStatus.COMPLETED:
            reservation.completed_at = _utcnow()
        elif new_status in (ReservationStatus.CANCELLED, ReservationStatus.EXPIRED):
            reservation.cancelled_at = _utcnow()
            reservation.cancellation_reason = reason
            reservation.cancelled_by = changed_by
            await self._release_all_items(reservation, changed_by)

        await reservation.save()
        await self._log_state_change(reservation_id, current, new_status, changed_by, reason)
        return reservation

    async def cancel_reservation(
        self, reservation_id: str, patient_id: str, reason: str = ""
    ) -> Reservation:
        return await self.transition_state(
            reservation_id=reservation_id,
            new_status=ReservationStatus.CANCELLED,
            changed_by=patient_id,
            changed_by_role="patient",
            reason=reason or "Cancelled by patient",
        )

    async def expire_reservation(self, reservation_id: str) -> Reservation:
        return await self.transition_state(
            reservation_id=reservation_id,
            new_status=ReservationStatus.EXPIRED,
            changed_by="system",
            changed_by_role="system",
            reason="Reservation expired",
        )

    async def get_reservation(self, reservation_id: str, patient_id: str) -> Reservation:
        reservation = await Reservation.find_one(
            Reservation.id == reservation_id,
            Reservation.patient_id == patient_id,
        )
        if not reservation:
            raise ReservationNotFoundException()
        return reservation

    async def get_patient_reservations(
        self,
        patient_id: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Reservation], int]:
        skip = (page - 1) * page_size
        filters = {"patient_id": patient_id}
        if status:
            filters["status"] = status
        items = await Reservation.find(filters).sort([("created_at", -1)]).skip(skip).limit(page_size).to_list()
        total = await Reservation.find(filters).count()
        return items, total

    async def get_pharmacy_reservations(
        self,
        pharmacy_id: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Reservation], int]:
        skip = (page - 1) * page_size
        filters = {"pharmacy_id": pharmacy_id}
        if status:
            filters["status"] = status
        items = await Reservation.find(filters).sort([("created_at", -1)]).skip(skip).limit(page_size).to_list()
        total = await Reservation.find(filters).count()
        return items, total

    async def _release_all_items(self, reservation: Reservation, performed_by: str) -> None:
        items = await ReservationItem.find(
            ReservationItem.reservation_id == reservation.id
        ).to_list()
        for item in items:
            await self._medicine_service.release_stock(
                pharmacy_id=reservation.pharmacy_id,
                medicine_id=item.medicine_id,
                quantity=item.reserved_quantity,
                reference_id=reservation.id,
                performed_by=performed_by,
            )

    async def _log_state_change(
        self,
        reservation_id: str,
        from_status: Optional[ReservationStatus],
        to_status: ReservationStatus,
        changed_by: str,
        reason: str,
    ) -> None:
        log = ReservationLog(
            reservation_id=reservation_id,
            from_status=from_status,
            to_status=to_status,
            changed_by=changed_by,
            reason=reason,
        )
        await log.insert()
