
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, Any

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class AnalyticsEventType(str, Enum):
    MEDICINE_SEARCH = "medicine_search"
    PRESCRIPTION_UPLOAD = "prescription_upload"
    PRESCRIPTION_PROCESSED = "prescription_processed"
    RESERVATION_CREATED = "reservation_created"
    RESERVATION_CONFIRMED = "reservation_confirmed"
    RESERVATION_CANCELLED = "reservation_cancelled"
    RESERVATION_COMPLETED = "reservation_completed"
    RESERVATION_EXPIRED = "reservation_expired"
    PAYMENT_INITIATED = "payment_initiated"
    PAYMENT_SUCCESSFUL = "payment_successful"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_REFUNDED = "payment_refunded"
    COURIER_CREATED = "courier_created"
    COURIER_DELIVERED = "courier_delivered"
    INVENTORY_UPDATED = "inventory_updated"
    MEDICINE_ADDED = "medicine_added"
    USER_REGISTERED = "user_registered"
    USER_LOGIN = "user_login"
    PHARMACY_VERIFIED = "pharmacy_verified"


class AnalyticsEvent(BaseDocument):

    event_type: AnalyticsEventType
    user_id: Optional[str] = None
    user_role: Optional[str] = None
    pharmacy_id: Optional[str] = None
    medicine_id: Optional[str] = None
    reservation_id: Optional[str] = None
    payment_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device: str = ""
    amount: Optional[float] = None
    metadata: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "analytics_events"
        indexes = [
            [("event_type", 1), ("timestamp", -1)],
            [("user_id", 1), ("timestamp", -1)],
            [("pharmacy_id", 1), ("timestamp", -1)],
            [("medicine_id", 1), ("timestamp", -1)],
            [("timestamp", -1)],
        ]


class DailyStatistics(BaseDocument):

    date: str                   # ISO date: "2024-01-15"
    pharmacy_id: Optional[str] = None   # None = platform-wide

    total_searches: int = 0
    total_prescriptions: int = 0
    total_reservations: int = 0
    confirmed_reservations: int = 0
    cancelled_reservations: int = 0
    expired_reservations: int = 0
    completed_reservations: int = 0
    total_payments: int = 0
    successful_payments: int = 0
    failed_payments: int = 0
    total_revenue: float = 0.0
    new_users: int = 0
    active_users: int = 0
    new_pharmacies: int = 0
    inventory_updates: int = 0
    low_stock_alerts: int = 0
    courier_shipments: int = 0

    class Settings:
        name = "daily_statistics"
        indexes = [
            [("date", 1), ("pharmacy_id", 1)],
        ]


class WeeklyStatistics(BaseDocument):
    year: int
    week: int
    pharmacy_id: Optional[str] = None
    total_reservations: int = 0
    total_revenue: float = 0.0
    active_users: int = 0
    top_medicines: list[dict] = Field(default_factory=list)

    class Settings:
        name = "weekly_statistics"
        indexes = [[("year", 1), ("week", 1), ("pharmacy_id", 1)]]


class MonthlyStatistics(BaseDocument):
    year: int
    month: int
    pharmacy_id: Optional[str] = None
    total_reservations: int = 0
    total_revenue: float = 0.0
    active_users: int = 0
    new_users: int = 0
    growth_percent: float = 0.0
    top_medicines: list[dict] = Field(default_factory=list)
    top_pharmacies: list[dict] = Field(default_factory=list)

    class Settings:
        name = "monthly_statistics"
        indexes = [[("year", 1), ("month", 1), ("pharmacy_id", 1)]]


class MedicinePopularity(BaseDocument):

    medicine_id: str
    medicine_name: str
    period: str                 # "daily" | "weekly" | "monthly"
    period_key: str             # "2024-01-15" | "2024-W03" | "2024-01"
    search_count: int = 0
    reservation_count: int = 0
    purchase_count: int = 0
    view_count: int = 0
    city: Optional[str] = None
    state: Optional[str] = None

    class Settings:
        name = "medicine_popularity"
        indexes = [
            [("medicine_id", 1), ("period", 1), ("period_key", 1)],
            [("period", 1), ("search_count", -1)],
            [("period", 1), ("reservation_count", -1)],
        ]


class PharmacyStatistics(BaseDocument):
    pharmacy_id: str
    date: str
    revenue: float = 0.0
    reservations: int = 0
    completed_orders: int = 0
    cancelled_orders: int = 0
    new_inventory_items: int = 0
    low_stock_count: int = 0
    expired_items: int = 0

    class Settings:
        name = "pharmacy_statistics"
        indexes = [[("pharmacy_id", 1), ("date", -1)]]


class TrendAnalysis(BaseDocument):
    medicine_id: str
    pharmacy_id: Optional[str] = None
    period: str
    period_key: str
    search_velocity: float = 0.0       # change rate
    reservation_velocity: float = 0.0
    growth_label: str = "stable"       # "growing" | "declining" | "stable" | "spike"
    generated_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "trend_analysis"
        indexes = [
            [("medicine_id", 1), ("period_key", -1)],
            [("growth_label", 1)],
        ]
