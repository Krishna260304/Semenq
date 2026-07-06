
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class ForecastPeriod(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ForecastResult(BaseDocument):

    medicine_id: str
    medicine_name: str
    pharmacy_id: Optional[str] = None   # None = nationwide
    city: Optional[str] = None

    forecast_period: ForecastPeriod = ForecastPeriod.WEEKLY
    prediction_date: datetime
    forecast_horizon_days: int = 7

    predicted_demand: float
    predicted_demand_min: float
    predicted_demand_max: float
    recommended_reorder_quantity: int
    expected_stockout_date: Optional[datetime] = None
    risk_level: RiskLevel = RiskLevel.LOW
    confidence_score: float = 0.0

    input_features: dict = Field(default_factory=dict)

    algorithm: str = "prophet"       # prophet | linear | xgboost
    algorithm_version: str = "1.0"
    model_id: Optional[str] = None

    generated_at: datetime = Field(default_factory=_utcnow)
    notification_sent: bool = False

    class Settings:
        name = "forecast_results"
        indexes = [
            [("medicine_id", 1), ("pharmacy_id", 1), ("prediction_date", -1)],
            [("risk_level", 1)],
            [("expected_stockout_date", 1)],
        ]


class ForecastJob(BaseDocument):

    job_type: str = "demand_forecast"
    status: str = "pending"           # pending | running | completed | failed
    pharmacy_id: Optional[str] = None
    medicine_ids: list[str] = Field(default_factory=list)
    scheduled_for: datetime = Field(default_factory=_utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_count: int = 0
    error: Optional[str] = None
    celery_task_id: Optional[str] = None

    class Settings:
        name = "forecast_jobs"
        indexes = [[("status", 1)], [("scheduled_for", 1)]]


class DashboardCache(BaseDocument):

    cache_key: str                   # e.g. "pharmacy_dashboard:pharm_id:2024-01-15"
    data: dict = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=_utcnow)
    expires_at: datetime
    version: int = 1

    class Settings:
        name = "dashboard_cache"
        indexes = [
            [("cache_key", 1)],
            [("expires_at", 1)],
        ]
