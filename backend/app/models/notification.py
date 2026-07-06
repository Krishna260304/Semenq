
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    READ = "read"


class NotificationType(str, Enum):
    RESERVATION_CREATED = "reservation_created"
    RESERVATION_CONFIRMED = "reservation_confirmed"
    RESERVATION_EXPIRING = "reservation_expiring"
    RESERVATION_EXPIRED = "reservation_expired"
    RESERVATION_CANCELLED = "reservation_cancelled"
    PAYMENT_SUCCESSFUL = "payment_successful"
    PAYMENT_FAILED = "payment_failed"
    QR_GENERATED = "qr_generated"
    COURIER_ASSIGNED = "courier_assigned"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    REFUND_INITIATED = "refund_initiated"
    REFUND_COMPLETED = "refund_completed"
    LOW_STOCK_ALERT = "low_stock_alert"
    INVENTORY_EXPIRY = "inventory_expiry"
    ACCOUNT_LOCKED = "account_locked"
    PASSWORD_CHANGED = "password_changed"
    EMAIL_VERIFICATION = "email_verification"
    WELCOME = "welcome"
    PHARMACY_VERIFIED = "pharmacy_verified"
    PHARMACY_REJECTED = "pharmacy_rejected"
    GENERAL = "general"


class NotificationTemplate(BaseDocument):

    notification_type: NotificationType
    channel: NotificationChannel
    subject: str = ""
    body_template: str              # Jinja2 template
    push_title_template: str = ""
    sms_template: str = ""
    is_active: bool = True
    version: int = 1

    class Settings:
        name = "notification_templates"
        indexes = [
            [("notification_type", 1), ("channel", 1)],
        ]


class Notification(BaseDocument):

    user_id: str
    notification_type: NotificationType
    channel: NotificationChannel
    title: str
    body: str
    status: NotificationStatus = NotificationStatus.PENDING
    reference_id: Optional[str] = None    # reservation_id, order_id, etc.
    reference_type: Optional[str] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    retry_count: int = 0
    metadata: dict = Field(default_factory=dict)

    class Settings:
        name = "notifications"
        indexes = [
            [("user_id", 1), ("created_at", -1)],
            [("user_id", 1), ("is_read", 1)],
            [("status", 1)],
            [("reference_id", 1)],
        ]


class NotificationLog(BaseDocument):

    notification_id: str
    provider: str
    channel: NotificationChannel
    recipient: str              # email/phone/device_token
    provider_message_id: Optional[str] = None
    status_code: Optional[int] = None
    response_body: str = ""
    latency_ms: int = 0
    timestamp: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "notification_logs"
        indexes = [
            [("notification_id", 1)],
            [("timestamp", -1)],
        ]
