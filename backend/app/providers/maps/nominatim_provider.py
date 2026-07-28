"""
Nominatim (OpenStreetMap) geocoding provider.

100% open-source and free — no API key required.
Rate limit: 1 request/second per Nominatim policy.
"""

from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass
from typing import Optional

import httpx

from app.core.logging.logger import get_logger
from app.providers.maps.google_maps_provider import (
    BaseMapsProvider,
    DistanceResult,
    GeocodingResult,
)

logger = get_logger(__name__)

_NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
_HEADERS = {"User-Agent": "Semenq-App/1.0 (semenq@example.com)"}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance in km using Haversine formula."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _km_to_text(km: float) -> str:
    if km < 1:
        return f"{int(km * 1000)} m"
    return f"{km:.1f} km"


def _seconds_to_text(secs: int) -> str:
    minutes = secs // 60
    if minutes < 60:
        return f"{minutes} mins"
    return f"{minutes // 60} hr {minutes % 60} mins"


class NominatimProvider(BaseMapsProvider):
    """
    Open-source maps provider backed by OpenStreetMap Nominatim.

    - geocode / reverse_geocode: calls Nominatim REST API
    - distance_matrix: computed locally via Haversine (no external call,
      road-accurate estimates require OSRM but straight-line is sufficient
      for pharmacy proximity ranking)
    """

    async def geocode(self, address: str) -> Optional[GeocodingResult]:
        params = {
            "q": address,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 1,
        }
        async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
            try:
                resp = await client.get(f"{_NOMINATIM_BASE}/search", params=params)
                resp.raise_for_status()
                data = resp.json()
                if not data:
                    return None
                item = data[0]
                addr = item.get("address", {})
                return GeocodingResult(
                    latitude=float(item["lat"]),
                    longitude=float(item["lon"]),
                    formatted_address=item.get("display_name", address),
                    place_id=item.get("place_id"),
                    city=addr.get("city") or addr.get("town") or addr.get("village"),
                    state=addr.get("state"),
                    country=addr.get("country"),
                    pincode=addr.get("postcode"),
                )
            except Exception as exc:
                logger.warning("Nominatim geocode failed", error=str(exc))
                return None

    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[GeocodingResult]:
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
        }
        async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
            try:
                resp = await client.get(f"{_NOMINATIM_BASE}/reverse", params=params)
                resp.raise_for_status()
                item = resp.json()
                addr = item.get("address", {})
                return GeocodingResult(
                    latitude=latitude,
                    longitude=longitude,
                    formatted_address=item.get("display_name", f"{latitude},{longitude}"),
                    place_id=item.get("place_id"),
                    city=addr.get("city") or addr.get("town") or addr.get("village"),
                    state=addr.get("state"),
                    country=addr.get("country"),
                    pincode=addr.get("postcode"),
                )
            except Exception as exc:
                logger.warning("Nominatim reverse_geocode failed", error=str(exc))
                return None

    async def distance_matrix(
        self, origins: list[str], destinations: list[str]
    ) -> list[DistanceResult]:
        """
        Compute straight-line Haversine distances.
        Format expected: "lat,lon" strings (e.g. "12.9716,77.5946").
        A 1.3× factor is applied to approximate road distance from crow-fly distance.
        Average speed of 30 km/h is used for duration estimates.
        """
        results = []
        ROAD_FACTOR = 1.3
        AVG_SPEED_KM_H = 30.0

        def _parse(coord_str: str):
            lat, lon = coord_str.split(",")
            return float(lat.strip()), float(lon.strip())

        for origin in origins:
            try:
                olat, olon = _parse(origin)
            except Exception:
                continue
            for dest in destinations:
                try:
                    dlat, dlon = _parse(dest)
                except Exception:
                    continue
                crow_km = _haversine_km(olat, olon, dlat, dlon)
                road_km = crow_km * ROAD_FACTOR
                dist_m = int(road_km * 1000)
                duration_s = int((road_km / AVG_SPEED_KM_H) * 3600)
                results.append(
                    DistanceResult(
                        origin=origin,
                        destination=dest,
                        distance_meters=dist_m,
                        distance_text=_km_to_text(road_km),
                        duration_seconds=duration_s,
                        duration_text=_seconds_to_text(duration_s),
                    )
                )
        return results

    async def health_check(self) -> bool:
        result = await self.geocode("New Delhi, India")
        return result is not None
