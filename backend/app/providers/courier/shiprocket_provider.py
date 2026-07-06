
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import get_settings
from app.core.exceptions import CourierException
from app.core.logging.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ShipmentCreateResult:
    shipment_id: str
    order_id: str
    awb_code: str
    courier_name: str
    estimated_delivery: Optional[str] = None
    label_url: Optional[str] = None
    manifest_url: Optional[str] = None
    charges: float = 0.0


@dataclass
class TrackingEvent:
    status: str
    description: str
    location: str = ""
    timestamp: Optional[str] = None


@dataclass
class TrackingResult:
    awb_code: str
    current_status: str
    events: list[TrackingEvent] = field(default_factory=list)
    estimated_delivery: Optional[str] = None


class BaseCourierProvider(ABC):
    @abstractmethod
    async def create_shipment(self, order_data: dict) -> ShipmentCreateResult:
        ...

    @abstractmethod
    async def track_shipment(self, awb_code: str) -> TrackingResult:
        ...

    @abstractmethod
    async def cancel_shipment(self, awb_codes: list[str]) -> bool:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class ShiprocketProvider(BaseCourierProvider):

    def __init__(self) -> None:
        self._settings = get_settings()
        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    async def _get_auth_token(self) -> str:
        now = datetime.utcnow()
        if self._token and self._token_expires and now < self._token_expires:
            return self._token

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self._settings.SHIPROCKET_BASE_URL}/auth/login",
                json={
                    "email": self._settings.SHIPROCKET_EMAIL,
                    "password": self._settings.SHIPROCKET_PASSWORD,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            self._token = data["token"]
            from datetime import timedelta
            self._token_expires = now + timedelta(days=9)
            return self._token

    async def _headers(self) -> dict:
        token = await self._get_auth_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def create_shipment(self, order_data: dict) -> ShipmentCreateResult:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self._settings.SHIPROCKET_BASE_URL}/orders/create/adhoc",
                headers=headers,
                json=order_data,
            )
            if not resp.is_success:
                raise CourierException(f"Shiprocket shipment creation failed: {resp.text}")
            data = resp.json()
            return ShipmentCreateResult(
                shipment_id=str(data.get("shipment_id", "")),
                order_id=str(data.get("order_id", "")),
                awb_code=data.get("response", {}).get("data", {}).get("awb_code", ""),
                courier_name=data.get("courier_name", ""),
            )

    async def track_shipment(self, awb_code: str) -> TrackingResult:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self._settings.SHIPROCKET_BASE_URL}/courier/track/awb/{awb_code}",
                headers=headers,
            )
            if not resp.is_success:
                raise CourierException(f"Tracking failed: {resp.text}")
            data = resp.json()
            tracking_data = data.get("tracking_data", {})
            shipment_track = tracking_data.get("shipment_track", [{}])[0] if tracking_data.get("shipment_track") else {}

            events = [
                TrackingEvent(
                    status=e.get("status", ""),
                    description=e.get("activity", ""),
                    location=e.get("location", ""),
                    timestamp=e.get("date", ""),
                )
                for e in tracking_data.get("shipment_track_activities", [])
            ]

            return TrackingResult(
                awb_code=awb_code,
                current_status=shipment_track.get("current_status", "unknown"),
                events=events,
                estimated_delivery=shipment_track.get("edd"),
            )

    async def cancel_shipment(self, awb_codes: list[str]) -> bool:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self._settings.SHIPROCKET_BASE_URL}/orders/cancel/shipment/awbs",
                headers=headers,
                json={"awbs": awb_codes},
            )
            return resp.is_success

    async def health_check(self) -> bool:
        try:
            await self._get_auth_token()
            return True
        except Exception:
            return False
