
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class OrderStatus(str, Enum):
    CREATED = "created"
    CONFIRMED = "confirmed"
    PACKED = "packed"
    DISPATCHED = "dispatched"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class TrackingEventType(str, Enum):
    ORDER_CREATED = "order_created"
    PACKED = "packed"
    COURIER_ASSIGNED = "courier_assigned"
    PICKED_UP = "picked_up"
    AT_HUB = "at_hub"
    IN_TRANSIT = "in_transit"
    AT_DESTINATION_HUB = "at_destination_hub"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERY_ATTEMPTED = "delivery_attempted"
    DELIVERED = "delivered"
    RETURNED = "returned"
    EXCEPTION = "exception"


class Order(BaseDocument):

    order_number: str
    reservation_id: str
    patient_id: str
    pharmacy_id: str
    payment_id: Optional[str] = None
    shipment_id: Optional[str] = None
    receipt_id: Optional[str] = None

    status: OrderStatus = OrderStatus.CREATED

    pharmacy_name: str = ""
    patient_name: str = ""
    total_amount: float = 0.0

    created_at: datetime = Field(default_factory=_utcnow)
    packed_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    class Settings:
        name = "orders"
        indexes = [
            [("order_number", 1)],
            [("reservation_id", 1)],
            [("patient_id", 1), ("created_at", -1)],
            [("pharmacy_id", 1), ("status", 1)],
            [("status", 1)],
        ]


class CourierShipment(BaseDocument):

    reservation_id: str
    order_id: str
    courier_partner: str = "shiprocket"
    provider_shipment_id: Optional[str] = None
    tracking_number: Optional[str] = None
    awb_code: Optional[str] = None

    pickup_address: dict = Field(default_factory=dict)
    delivery_address: dict = Field(default_factory=dict)

    current_status: str = "booked"
    estimated_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None

    charges: float = 0.0
    weight_kg: float = 0.0
    length_cm: float = 0.0
    width_cm: float = 0.0
    height_cm: float = 0.0

    booked_at: datetime = Field(default_factory=_utcnow)
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    label_url: Optional[str] = None
    manifest_url: Optional[str] = None

    class Settings:
        name = "courier_shipments"
        indexes = [
            [("reservation_id", 1)],
            [("tracking_number", 1)],
            [("awb_code", 1)],
            [("provider_shipment_id", 1)],
        ]


class CourierTracking(BaseDocument):

    shipment_id: str
    reservation_id: str
    event_type: TrackingEventType
    event_description: str
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    event_timestamp: datetime = Field(default_factory=_utcnow)
    raw_data: dict = Field(default_factory=dict)

    class Settings:
        name = "courier_tracking"
        indexes = [
            [("shipment_id", 1), ("event_timestamp", -1)],
            [("reservation_id", 1)],
        ]


class Receipt(BaseDocument):

    invoice_number: str         # e.g. INV-2024-000001
    reservation_id: str
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    patient_id: str
    pharmacy_id: str

    patient_name: str = ""
    patient_phone: str = ""
    pharmacy_name: str = ""
    pharmacy_address: str = ""
    pharmacy_license: str = ""

    items: list[dict] = Field(default_factory=list)
    subtotal: float = 0.0
    reservation_fee: float = 0.0
    platform_fee: float = 0.0
    courier_fee: float = 0.0
    discount: float = 0.0
    taxes: float = 0.0
    grand_total: float = 0.0

    currency: str = "INR"
    payment_method: str = ""
    generated_at: datetime = Field(default_factory=_utcnow)
    pdf_url: Optional[str] = None

    class Settings:
        name = "receipts"
        indexes = [
            [("invoice_number", 1)],
            [("reservation_id", 1)],
            [("patient_id", 1), ("generated_at", -1)],
        ]
