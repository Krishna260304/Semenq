
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import get_current_active_user, require_admin
from app.models.user import User
from app.schemas.medicine import MedicineResponse, MedicineSearchRequest
from app.services.medicine_service import MedicineService
from app.services.search_service import SearchService

router = APIRouter(prefix="/medicines", tags=["Medicines & Search"])
_medicine_service = MedicineService()
_search_service = SearchService()


@router.post("/search", response_model=APIResponse[list[dict]], summary="Geospatial Medicine Search")
async def search_medicines_geo(
    body: MedicineSearchRequest,
    user: User = Depends(get_current_active_user),
) -> APIResponse:
    medicines, _ = await _medicine_service.search_medicines(query=body.query, page_size=5)
    if not medicines:
        return APIResponse.ok(data=[], message="No medicines found matching the query.")
    
    medicine_ids = [m.id for m in medicines]
    
    session = await _search_service.init_search(
        medicine_ids=medicine_ids,
        patient_id=user.id,
        latitude=body.latitude,
        longitude=body.longitude,
        radius_km=body.radius_km,
    )
    
    results = await _search_service.execute_search(session.id)
    return APIResponse.ok(
        data=results,
        message=f"Found {len(results)} pharmacies with available stock.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/", response_model=APIResponse[list[MedicineResponse]], summary="Browse Medicines")
async def browse_medicines(
    query: str = "",
    category_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> APIResponse:
    items, total = await _medicine_service.search_medicines(
        query=query, category_id=category_id, page=page, page_size=page_size
    )
    data = [MedicineResponse(**m.model_dump()) for m in items]
    return APIResponse.ok(
        data=data,
        message="Medicines retrieved.",
        meta={"total": total, "page": page, "page_size": page_size},
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/categories", response_model=APIResponse[list[dict]], summary="Get Medicine Categories")
async def get_categories() -> APIResponse:
    categories = await _medicine_service.get_categories()
    data = [c.model_dump() for c in categories]
    return APIResponse.ok(data=data, request_id=REQUEST_ID_CTX.get(""))


@router.get("/{medicine_id}", response_model=APIResponse[dict], summary="Get Medicine Details & Availability")
async def get_medicine(medicine_id: str) -> APIResponse:
    result = await _medicine_service.get_medicine_with_availability(medicine_id)
    return APIResponse.ok(data=result, request_id=REQUEST_ID_CTX.get(""))
