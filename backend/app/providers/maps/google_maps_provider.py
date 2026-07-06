
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class GeocodingResult:
    latitude: float
    longitude: float
    formatted_address: str
    place_id: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None


@dataclass
class DistanceResult:
    origin: str
    destination: str
    distance_meters: int
    distance_text: str
    duration_seconds: int
    duration_text: str


class BaseMapsProvider(ABC):
    @abstractmethod
    async def geocode(self, address: str) -> Optional[GeocodingResult]:
        ...

    @abstractmethod
    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[GeocodingResult]:
        ...

    @abstractmethod
    async def distance_matrix(
        self, origins: list[str], destinations: list[str]
    ) -> list[DistanceResult]:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class GoogleMapsProvider(BaseMapsProvider):

    def __init__(self) -> None:
        from app.core.config import get_settings
        self._api_key = get_settings().GOOGLE_MAPS_API_KEY

    async def geocode(self, address: str) -> Optional[GeocodingResult]:
        import googlemaps
        client = googlemaps.Client(key=self._api_key)
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.geocode(address)
            )
            if not result:
                return None
            loc = result[0]["geometry"]["location"]
            components = result[0].get("address_components", [])

            def _get(comp_type: str) -> Optional[str]:
                for c in components:
                    if comp_type in c["types"]:
                        return c["long_name"]
                return None

            return GeocodingResult(
                latitude=loc["lat"],
                longitude=loc["lng"],
                formatted_address=result[0]["formatted_address"],
                place_id=result[0].get("place_id"),
                city=_get("locality"),
                state=_get("administrative_area_level_1"),
                country=_get("country"),
                pincode=_get("postal_code"),
            )
        except Exception:
            return None

    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[GeocodingResult]:
        import googlemaps
        client = googlemaps.Client(key=self._api_key)
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.reverse_geocode((latitude, longitude))
            )
            if not result:
                return None
            loc = {"lat": latitude, "lng": longitude}
            components = result[0].get("address_components", [])

            def _get(comp_type: str) -> Optional[str]:
                for c in components:
                    if comp_type in c["types"]:
                        return c["long_name"]
                return None

            return GeocodingResult(
                latitude=latitude,
                longitude=longitude,
                formatted_address=result[0]["formatted_address"],
                place_id=result[0].get("place_id"),
                city=_get("locality"),
                state=_get("administrative_area_level_1"),
                country=_get("country"),
                pincode=_get("postal_code"),
            )
        except Exception:
            return None

    async def distance_matrix(
        self, origins: list[str], destinations: list[str]
    ) -> list[DistanceResult]:
        import googlemaps
        client = googlemaps.Client(key=self._api_key)
        try:
            matrix = await asyncio.get_event_loop().run_in_executor(
                None, lambda: client.distance_matrix(origins, destinations, units="metric")
            )
            results = []
            for i, row in enumerate(matrix["rows"]):
                for j, element in enumerate(row["elements"]):
                    if element["status"] == "OK":
                        results.append(DistanceResult(
                            origin=origins[i],
                            destination=destinations[j],
                            distance_meters=element["distance"]["value"],
                            distance_text=element["distance"]["text"],
                            duration_seconds=element["duration"]["value"],
                            duration_text=element["duration"]["text"],
                        ))
            return results
        except Exception:
            return []

    async def health_check(self) -> bool:
        result = await self.geocode("New Delhi, India")
        return result is not None
