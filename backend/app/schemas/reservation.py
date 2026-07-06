
from __future__ import annotations

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ReservationItemRequest(BaseModel):
    medicine_id: str
    quantity: int = Field(gt=0)


class CreateReservationRequest(BaseModel):
    pharmacy_id: str
    items: list[ReservationItemRequest]
    pickup_method: str = "in_store"
    delivery_address_id: Optional[str] = None
    prescription_id: Optional[str] = None


class VerifyPaymentWebhookRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class ReservationResponse(BaseModel):
    id: str
    reservation_number: str
    pharmacy_id: str
    pharmacy_name: str
    status: str
    pickup_method: str
    medicine_count: int
    subtotal: float
    grand_total: float
    expires_at: datetime
    created_at: datetime
    qr_code_id: Optional[str] = None
