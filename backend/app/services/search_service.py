
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.database.redis_client import cache_get, cache_set
from app.core.logging.logger import get_logger
from app.models.medicine import MedicineInventory
from app.models.search import SearchResult, SearchScope, SearchSession, SearchSessionStatus
from app.models.user import Pharmacy
from app.providers.maps.google_maps_provider import GoogleMapsProvider

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SearchService:
    def __init__(self) -> None:
        self._maps = GoogleMapsProvider()

    async def init_search(
        self,
        medicine_ids: list[str],
        patient_id: Optional[str] = None,
        prescription_id: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        radius_km: float = 5.0,
    ) -> SearchSession:
        session = SearchSession(
            patient_id=patient_id,
            prescription_id=prescription_id,
            medicine_ids=medicine_ids,
            latitude=latitude,
            longitude=longitude,
            search_radius_km=radius_km,
        )
        await session.insert()
        return session

    async def execute_search(self, session_id: str) -> list[dict]:
        session = await SearchSession.find_one(SearchSession.id == session_id)
        if not session:
            return []

        if not session.latitude or not session.longitude:
            session.status = SearchSessionStatus.FAILED
            await session.save()
            return []

        lat_offset = session.search_radius_km / 111.0
        lon_offset = session.search_radius_km / 85.0

        pharmacies = await Pharmacy.find(
            Pharmacy.latitude >= session.latitude - lat_offset,
            Pharmacy.latitude <= session.latitude + lat_offset,
            Pharmacy.longitude >= session.longitude - lon_offset,
            Pharmacy.longitude <= session.longitude + lon_offset,
            Pharmacy.is_deleted == False,
        ).to_list()

        if not pharmacies:
            session.status = SearchSessionStatus.COMPLETED
            session.total_results = 0
            session.completed_at = _utcnow()
            await session.save()
            return []

        pharmacy_ids = [p.id for p in pharmacies]
        pharmacy_map = {p.id: p for p in pharmacies}

        inventories = await MedicineInventory.find(
            MedicineInventory.pharmacy_id.in_(pharmacy_ids),
            MedicineInventory.medicine_id.in_(session.medicine_ids),
            MedicineInventory.available_quantity > 0,
            MedicineInventory.is_deleted == False,
        ).to_list()

        results = []
        patient_origin = f"{session.latitude},{session.longitude}"
        pharmacy_destinations = [f"{p.latitude},{p.longitude}" for p in pharmacies if p.latitude and p.longitude]

        distance_matrix = []
        if pharmacy_destinations:
            distance_matrix = await self._maps.distance_matrix([patient_origin], pharmacy_destinations)
        
        dist_lookup = {}
        for d in distance_matrix:
            dist_lookup[d.destination] = d

        for inv in inventories:
            p = pharmacy_map[inv.pharmacy_id]
            dest = f"{p.latitude},{p.longitude}"
            dist_info = dist_lookup.get(dest)

            dist_km = (dist_info.distance_meters / 1000.0) if dist_info else None
            rank_score = (inv.available_quantity * 0.4) + ( (1.0 / dist_km * 10) if dist_km else 0 )

            sr = SearchResult(
                session_id=session.id,
                medicine_id=inv.medicine_id,
                medicine_name=inv.medicine_name,
                pharmacy_id=p.id,
                pharmacy_name=p.pharmacy_name,
                inventory_id=inv.id,
                available_quantity=inv.available_quantity,
                unit_price=inv.unit_price,
                mrp=inv.mrp,
                distance_km=dist_km,
                delivery_available=p.delivery_available,
                pharmacy_latitude=p.latitude,
                pharmacy_longitude=p.longitude,
                pharmacy_address=f"{p.street}, {p.city}",
                rank_score=rank_score,
            )
            await sr.insert()
            results.append(sr)

        session.status = SearchSessionStatus.COMPLETED
        session.total_results = len(results)
        session.completed_at = _utcnow()
        await session.save()

        grouped = {}
        for r in results:
            if r.pharmacy_id not in grouped:
                grouped[r.pharmacy_id] = {
                    "pharmacy_id": r.pharmacy_id,
                    "pharmacy_name": r.pharmacy_name,
                    "distance_km": r.distance_km,
                    "medicines": [],
                }
            grouped[r.pharmacy_id]["medicines"].append({
                "medicine_id": r.medicine_id,
                "medicine_name": r.medicine_name,
                "quantity": r.available_quantity,
                "price": r.unit_price,
            })
        
        return sorted(list(grouped.values()), key=lambda x: x["distance_km"] or 999)
