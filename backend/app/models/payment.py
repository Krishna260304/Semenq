
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class PaymentStatus(str, Enum):
    CREATED = "created"
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PARTIAL_REFUND = "partial_refund"


class PaymentMethod(str, Enum):
    UPI = "upi"
    CARD = "card"
    NET_BANKING = "net_banking"
    WALLET = "wallet"
    EMI = "emi"
    COD = "cod"
    UNKNOWN = "unknown"


class RefundStatus(str, Enum):
    INITIATED = "initiated"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Payment(BaseDocument):

    reservation_id: str
    patient_id: str
    provider: str = "razorpay"
    provider_order_id: str = ""          # e.g. Razorpay order_id
    provider_payment_id: Optional[str] = None
    provider_signature: Optional[str] = None

    amount: float
    currency: str = "INR"
    amount_in_paise: int = 0             # Razorpay stores in smallest unit

    status: PaymentStatus = PaymentStatus.CREATED
    payment_method: PaymentMethod = PaymentMethod.UNKNOWN

    failure_reason: Optional[str] = None
    failure_code: Optional[str] = None

    created_at: datetime = Field(default_factory=_utcnow)
    authorized_at: Optional[datetime] = None
    captured_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None

    metadata: dict = Field(default_factory=dict)

    class Settings:
        name = "payments"
        indexes = [
            [("reservation_id", 1)],
            [("patient_id", 1), ("created_at", -1)],
            [("provider_order_id", 1)],
            [("provider_payment_id", 1)],
            [("status", 1)],
        ]


class PaymentTransaction(BaseDocument):

    payment_id: str
    event_type: str             # created | authorized | captured | failed | refunded
    provider_event_id: Optional[str] = None
    amount: float
    currency: str = "INR"
    status: str
    raw_payload: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "payment_transactions"
        indexes = [[("payment_id", 1)], [("timestamp", -1)]]


class PaymentRefund(BaseDocument):

    payment_id: str
    reservation_id: str
    patient_id: str
    provider_refund_id: Optional[str] = None
    amount: float
    currency: str = "INR"
    reason: str = ""
    status: RefundStatus = RefundStatus.INITIATED
    initiated_by: str = ""      # User ID or "system"
    initiated_at: datetime = Field(default_factory=_utcnow)
    processed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    is_full_refund: bool = True
    notes: str = ""

    class Settings:
        name = "payment_refunds"
        indexes = [
            [("payment_id", 1)],
            [("reservation_id", 1)],
            [("status", 1)],
        ]
