
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class ReservationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    AWAITING_PAYMENT = "awaiting_payment"
    PAID = "paid"
    READY_FOR_PICKUP = "ready_for_pickup"
    COURIER_REQUESTED = "courier_requested"
    COURIER_ASSIGNED = "courier_assigned"
    PACKED = "packed"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    REFUNDED = "refunded"


class PickupMethod(str, Enum):
    IN_STORE = "in_store"
    COURIER = "courier"
    HOME_DELIVERY = "home_delivery"


class QRStatus(str, Enum):
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"
    REVOKED = "revoked"


RESERVATION_TRANSITIONS: dict[ReservationStatus, list[ReservationStatus]] = {
    ReservationStatus.PENDING: [
        ReservationStatus.CONFIRMED,
        ReservationStatus.CANCELLED,
        ReservationStatus.EXPIRED,
    ],
    ReservationStatus.CONFIRMED: [
        ReservationStatus.AWAITING_PAYMENT,
        ReservationStatus.CANCELLED,
        ReservationStatus.EXPIRED,
    ],
    ReservationStatus.AWAITING_PAYMENT: [
        ReservationStatus.PAID,
        ReservationStatus.CANCELLED,
        ReservationStatus.EXPIRED,
    ],
    ReservationStatus.PAID: [
        ReservationStatus.READY_FOR_PICKUP,
        ReservationStatus.COURIER_REQUESTED,
        ReservationStatus.REFUNDED,
    ],
    ReservationStatus.READY_FOR_PICKUP: [
        ReservationStatus.COMPLETED,
        ReservationStatus.REFUNDED,
    ],
    ReservationStatus.COURIER_REQUESTED: [
        ReservationStatus.COURIER_ASSIGNED,
        ReservationStatus.REFUNDED,
    ],
    ReservationStatus.COURIER_ASSIGNED: [
        ReservationStatus.PACKED,
        ReservationStatus.REFUNDED,
    ],
    ReservationStatus.PACKED: [ReservationStatus.DISPATCHED],
    ReservationStatus.DISPATCHED: [ReservationStatus.COMPLETED],
    ReservationStatus.COMPLETED: [],
    ReservationStatus.CANCELLED: [ReservationStatus.REFUNDED],
    ReservationStatus.EXPIRED: [ReservationStatus.REFUNDED],
    ReservationStatus.REFUNDED: [],
}


class ReservationItem(BaseDocument):

    reservation_id: str
    medicine_id: str
    medicine_name: str          # Snapshot at reservation time
    medicine_composition: str = ""
    batch_id: Optional[str] = None
    batch_number: Optional[str] = None
    reserved_quantity: int
    unit_price: float
    mrp: float
    total_price: float
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    inventory_snapshot: dict = Field(default_factory=dict)
    prescription_id: Optional[str] = None

    class Settings:
        name = "reservation_items"
        indexes = [[("reservation_id", 1)], [("medicine_id", 1)]]


class ReservationLog(BaseDocument):

    reservation_id: str
    from_status: Optional[ReservationStatus] = None
    to_status: ReservationStatus
    changed_by: str = ""
    changed_by_role: str = ""
    reason: str = ""
    metadata: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "reservation_logs"
        indexes = [[("reservation_id", 1), ("timestamp", -1)]]


class QRCode(BaseDocument):

    reservation_id: str
    qr_payload: str          # Encrypted, signed payload
    qr_image_url: Optional[str] = None
    status: QRStatus = QRStatus.ACTIVE
    generated_at: datetime = Field(default_factory=_utcnow)
    expires_at: datetime
    scan_count: int = 0
    last_scanned_at: Optional[datetime] = None
    last_scanned_by: Optional[str] = None   # Pharmacy user ID

    class Settings:
        name = "qr_codes"
        indexes = [
            [("reservation_id", 1)],
            [("status", 1)],
            [("expires_at", 1)],
        ]


class Reservation(BaseDocument):

    reservation_number: str    # Human-readable, e.g. SEM-2024-001234
    patient_id: str
    pharmacy_id: str
    pharmacy_name: str         # Snapshot
    pharmacy_address: str = ""

    status: ReservationStatus = ReservationStatus.PENDING
    pickup_method: PickupMethod = PickupMethod.IN_STORE

    reserved_at: datetime = Field(default_factory=_utcnow)
    expires_at: datetime
    confirmed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    item_ids: list[str] = Field(default_factory=list)
    medicine_count: int = 0
    subtotal: float = 0.0
    reservation_fee: float = 0.0
    platform_fee: float = 0.0
    courier_fee: float = 0.0
    discount: float = 0.0
    taxes: float = 0.0
    grand_total: float = 0.0

    payment_status: str = "unpaid"
    payment_id: Optional[str] = None

    qr_code_id: Optional[str] = None
    qr_generated: bool = False

    courier_shipment_id: Optional[str] = None
    delivery_address_id: Optional[str] = None

    prescription_id: Optional[str] = None

    cancellation_reason: Optional[str] = None
    cancelled_by: Optional[str] = None

    class Settings:
        name = "reservations"
        indexes = [
            [("reservation_number", 1)],
            [("patient_id", 1), ("created_at", -1)],
            [("pharmacy_id", 1), ("status", 1)],
            [("status", 1)],
            [("expires_at", 1)],
            [("payment_id", 1)],
        ]
