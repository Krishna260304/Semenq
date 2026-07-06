
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class SearchScope(str, Enum):
    NEARBY = "nearby"
    CITY = "city"
    DISTRICT = "district"
    STATE = "state"
    NATIONAL = "national"


class SearchSessionStatus(str, Enum):
    SEARCHING = "searching"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class SearchSession(BaseDocument):

    patient_id: Optional[str] = None
    prescription_id: Optional[str] = None
    medicine_ids: list[str] = Field(default_factory=list)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    state: Optional[str] = None
    search_radius_km: float = 5.0
    scope_reached: SearchScope = SearchScope.NEARBY
    status: SearchSessionStatus = SearchSessionStatus.SEARCHING
    total_results: int = 0
    duration_ms: int = 0
    started_at: datetime = Field(default_factory=_utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "search_sessions"
        indexes = [
            [("patient_id", 1), ("created_at", -1)],
            [("status", 1)],
        ]


class SearchResult(BaseDocument):

    session_id: str
    medicine_id: str
    medicine_name: str
    pharmacy_id: str
    pharmacy_name: str
    inventory_id: str
    available_quantity: int
    unit_price: float
    mrp: float
    distance_km: Optional[float] = None
    delivery_available: bool = False
    courier_available: bool = False
    reservation_available: bool = True
    estimated_delivery_minutes: Optional[int] = None
    pharmacy_rating: float = 0.0
    pharmacy_latitude: Optional[float] = None
    pharmacy_longitude: Optional[float] = None
    pharmacy_address: str = ""
    search_scope: SearchScope = SearchScope.NEARBY
    rank_score: float = 0.0

    class Settings:
        name = "search_results"
        indexes = [
            [("session_id", 1), ("rank_score", -1)],
            [("medicine_id", 1)],
        ]


class AvailabilityResult(BaseDocument):

    medicine_id: str
    city: Optional[str] = None
    state: Optional[str] = None
    total_pharmacies: int = 0
    pharmacies_with_stock: int = 0
    lowest_price: Optional[float] = None
    highest_stock: int = 0
    generated_at: datetime = Field(default_factory=_utcnow)
    expires_at: Optional[datetime] = None

    class Settings:
        name = "availability_results"
        indexes = [
            [("medicine_id", 1), ("city", 1)],
            [("expires_at", 1)],
        ]


class SearchCache(BaseDocument):

    cache_key: str
    medicine_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: float = 5.0
    results: list[dict] = Field(default_factory=list)
    hit_count: int = 0
    created_at: datetime = Field(default_factory=_utcnow)
    expires_at: datetime

    class Settings:
        name = "search_cache"
        indexes = [
            [("cache_key", 1)],
            [("expires_at", 1)],
        ]
