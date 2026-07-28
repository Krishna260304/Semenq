
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.exceptions import OCRException
from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import require_pharmacy
from app.models.user import User
from app.schemas.medicine import InventoryBatchRequest, MedicineInventoryResponse
from app.services.medicine_matching import build_medicine_queries, rank_medicines_for_queries
from app.providers.ocr.factory import get_ocr_provider
from app.services.medicine_service import MedicineService

router = APIRouter(prefix="/inventory", tags=["Inventory (Pharmacy)"])
_medicine_service = MedicineService()


@router.post("/{medicine_id}/batches", response_model=APIResponse[MedicineInventoryResponse], summary="Add Batch to Inventory")
async def add_inventory_batch(
    medicine_id: str,
    body: InventoryBatchRequest,
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    from app.repositories.user_repository import PharmacyRepository
    pharmacy = await PharmacyRepository().get_by_user_id(user.id)
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy profile not found.")

    inventory, batch = await _medicine_service.add_to_inventory(
        pharmacy_id=pharmacy.id,
        medicine_id=medicine_id,
        batch_data=body.model_dump(),
        performed_by=user.id,
    )

    data = MedicineInventoryResponse(
        id=inventory.id,
        medicine_id=inventory.medicine_id,
        medicine_name=inventory.medicine_name,
        available_quantity=inventory.available_quantity,
        reserved_quantity=inventory.reserved_quantity,
        unit_price=inventory.unit_price,
        mrp=inventory.mrp,
        status=inventory.status.value,
        last_restocked_at=inventory.last_restocked_at,
    )

    return APIResponse.ok(
        data=data,
        message="Batch added to inventory successfully.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.post("/scan-medicine", response_model=APIResponse[dict], summary="Scan a medicine label with OCR")
async def scan_medicine_label(
    file: UploadFile = File(...),
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    from app.repositories.user_repository import PharmacyRepository

    pharmacy = await PharmacyRepository().get_by_user_id(user.id)
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy profile not found.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="No image data received.")

    provider = get_ocr_provider()
    try:
        ocr_result = await provider.extract_text(image_bytes, mime_type=file.content_type or "image/jpeg")
    except OCRException as exc:
        raise HTTPException(status_code=503, detail=f"PaddleOCR failed: {exc}") from exc

    queries = build_medicine_queries(ocr_result.raw_text)

    candidate_pool = []
    seen_ids: set[str] = set()
    for query in queries:
        medicines, _ = await _medicine_service.search_medicines(query=query, page_size=10)
        for medicine in medicines:
            if medicine.id in seen_ids:
                continue
            seen_ids.add(medicine.id)
            candidate_pool.append(medicine)

    ranked = rank_medicines_for_queries(queries, candidate_pool, limit=5)
    suggestions: list[dict] = [
        {
            "id": item.medicine.id,
            "name": item.medicine.name,
            "generic_name": item.medicine.generic_name,
            "manufacturer": item.medicine.manufacturer,
            "composition": item.medicine.composition,
            "match_score": item.score,
            "match_type": item.match_type,
            "matched_query": item.matched_query,
        }
        for item in ranked
    ]

    best_match = suggestions[0] if suggestions else None
    return APIResponse.ok(
        data={
            "raw_text": ocr_result.raw_text,
            "confidence": ocr_result.confidence,
            "provider": provider.provider_name,
            "queries": queries,
            "best_match": best_match,
            "suggestions": suggestions,
        },
        message="Medicine label scanned successfully.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/expiring", response_model=APIResponse[list[dict]], summary="Get Expiring Batches")
async def get_expiring_batches(
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    from app.repositories.user_repository import PharmacyRepository
    pharmacy = await PharmacyRepository().get_by_user_id(user.id)
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy profile not found.")
    
    batches = await _medicine_service.check_expiring_batches(pharmacy_id=pharmacy.id)
    return APIResponse.ok(data=batches, request_id=REQUEST_ID_CTX.get(""))
