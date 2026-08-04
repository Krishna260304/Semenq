
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.exceptions import OCRException
from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import require_pharmacy, require_pharmacy_or_admin
from app.models.user import User
from app.schemas.medicine import InventoryBatchRequest, MedicineCreateRequest, MedicineInventoryResponse, MedicineResponse
from app.services.medicine_matching import build_medicine_queries, rank_medicines_for_queries
from app.providers.ocr.factory import get_ocr_provider
from app.services.medicine_service import MedicineService

router = APIRouter(prefix="/inventory", tags=["Inventory (Pharmacy)"])
_medicine_service = MedicineService()


def _ocr_form_data(raw_text: str, best_match: dict | None) -> dict:
    """Turn OCR output into safe, editable medicine-form defaults.

    A catalogue match is authoritative.  When there is no match, the
    conservative extraction only fills values that are visibly present and
    leaves the remaining fields editable instead of inventing clinical data.
    """
    if best_match:
        return {
            "name": best_match.get("name", ""),
            "generic_name": best_match.get("generic_name") or "",
            "brand_name": best_match.get("brand_name") or best_match.get("name", ""),
            "composition": best_match.get("composition") or "",
            "strength": best_match.get("strength") or "",
            "manufacturer": best_match.get("manufacturer") or "",
            "category_name": best_match.get("category_name") or "General",
            "dosage_form": best_match.get("dosage_form") or "tablet",
            "prescription_required": bool(best_match.get("prescription_required", False)),
            "average_price": best_match.get("average_price"),
        }

    text = raw_text or ""
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    strength_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu)\b", text, re.IGNORECASE)
    strength = f"{strength_match.group(1)}{strength_match.group(2)}" if strength_match else ""
    form = "tablet"
    for candidate in ("capsule", "syrup", "injection", "cream", "ointment", "drops", "suspension", "tablet"):
        if re.search(rf"\b{candidate}s?\b", text, re.IGNORECASE):
            form = candidate
            break
    manufacturer = ""
    for line in lines:
        if re.search(r"\b(labs?|pharma|pharmaceutical|limited|ltd|healthcare)\b", line, re.IGNORECASE):
            manufacturer = line
            break
    generic_match = re.search(
        r"\b(paracetamol|acetaminophen|ibuprofen|amoxicillin|azithromycin|cetirizine|metformin|omeprazole)\b",
        text,
        re.IGNORECASE,
    )
    generic = generic_match.group(1).title() if generic_match else ""
    signature = re.search(r"\b([A-Za-z][A-Za-z0-9-]{2,20})\s*[- ]\s*\d{2,4}\b", text)
    name = signature.group(0).strip() if signature else (lines[0] if lines else "")
    return {
        "name": name,
        "generic_name": generic,
        "brand_name": name,
        "composition": f"{generic} {strength}".strip(),
        "strength": strength,
        "manufacturer": manufacturer,
        "category_name": "General",
        "dosage_form": form,
        "prescription_required": False,
        "average_price": None,
    }


@router.post("/medicines", response_model=APIResponse[MedicineResponse], status_code=201, summary="Create a medicine from pharmacy inventory")
async def create_inventory_medicine(
    body: MedicineCreateRequest,
    user: User = Depends(require_pharmacy_or_admin),
) -> APIResponse:
    """Allow a pharmacy to add a previously unknown labelled medicine."""
    medicine = await _medicine_service.create_medicine(body.model_dump(), created_by=user.id)
    return APIResponse.ok(
        data=MedicineResponse(**medicine.model_dump()),
        message="Medicine added to the catalogue.",
        request_id=REQUEST_ID_CTX.get(""),
    )


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
            "brand_name": item.medicine.brand_name,
            "strength": item.medicine.strength,
            "dosage_form": item.medicine.dosage_form.value if hasattr(item.medicine.dosage_form, "value") else item.medicine.dosage_form,
            "category_name": item.medicine.category_name,
            "prescription_required": item.medicine.prescription_required,
            "average_price": item.medicine.average_price,
            "match_score": item.score,
            "match_type": item.match_type,
            "matched_query": item.matched_query,
        }
        for item in ranked
    ]

    # Do not silently attach a pharmacy batch to a merely similar medicine.
    # A low-confidence candidate is shown as a suggestion, while the editable
    # OCR form is allowed to create a new catalogue record instead.
    best_match = suggestions[0] if suggestions and float(suggestions[0].get("match_score", 0)) >= 0.72 else None
    form_data = _ocr_form_data(ocr_result.raw_text, best_match)
    return APIResponse.ok(
        data={
            "raw_text": ocr_result.raw_text,
            "confidence": ocr_result.confidence,
            "provider": provider.provider_name,
            "queries": queries,
            "best_match": best_match,
            "suggestions": suggestions,
            "form_data": form_data,
            "catalogue_match": bool(best_match),
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
