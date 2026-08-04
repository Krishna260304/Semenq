
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from math import sqrt
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, BackgroundTasks

from app.core.config import get_settings
from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import get_current_active_user, require_patient, require_pharmacy
from app.models.medicine import MedicineInventory
from app.models.user import Address, Patient, Pharmacy, User, UserRole
from app.schemas.prescription import (
    ConfirmPrescriptionRequest,
    PrescriptionResponse,
    UploadPrescriptionResponse,
)
from app.models.prescription import Prescription, PrescriptionStatus
from app.services.prescription_service import PrescriptionService

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])
_prescription_service = PrescriptionService()


@router.get("", response_model=APIResponse[list[dict]], summary="List patient prescriptions")
async def list_prescriptions(user: User = Depends(require_patient)) -> APIResponse:
    prescriptions = await Prescription.find(
        Prescription.patient_id == user.id,
        Prescription.patient_confirmed == True,  # noqa: E712
    ).sort([("created_at", -1)]).to_list()
    return APIResponse.ok(
        data=[item.model_dump() for item in prescriptions],
        message="Prescriptions retrieved.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/pharmacy/requests", response_model=APIResponse[list[dict]], summary="List pharmacy prescription requests")
async def list_pharmacy_prescription_requests(user: User = Depends(require_pharmacy)) -> APIResponse:
    """Return prescription images awaiting review by this pharmacy only."""
    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    if not pharmacy:
        return APIResponse.ok(data=[], message="No pharmacy profile found.")

    prescriptions = await Prescription.find(
        Prescription.pharmacy_id == pharmacy.id,
        Prescription.pharmacy_status.in_({"in_progress", "confirmed", "rejected"}),
    ).sort([("pharmacy_requested_at", -1)]).limit(100).to_list()
    data = []
    for prescription in prescriptions:
        data.append({
            "id": prescription.id,
            "patient_id": prescription.patient_id,
            "image_url": f"/api/prescriptions/{prescription.id}/image",
            "pharmacy_status": prescription.pharmacy_status,
            "pharmacy_requested_at": prescription.pharmacy_requested_at,
            "pharmacy_reviewed_at": prescription.pharmacy_reviewed_at,
            "pharmacy_rejection_reason": prescription.pharmacy_rejection_reason,
            "doctor_name": prescription.doctor_name,
            "hospital_name": prescription.hospital_name,
            "extracted_medicines": prescription.extracted_medicines,
            "created_at": prescription.created_at,
        })
    return APIResponse.ok(data=data, request_id=REQUEST_ID_CTX.get(""))


@router.post("/upload", response_model=APIResponse[UploadPrescriptionResponse], summary="Upload Prescription Image")
async def upload_prescription(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(require_patient),
) -> APIResponse:
    settings = get_settings()
    content_type = (file.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/jpg", "image/png"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG or PNG prescription image.")

    image_bytes = await file.read(settings.max_upload_size_bytes + 1)
    if not image_bytes or len(image_bytes) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=413, detail=f"Image must be no larger than {settings.MAX_UPLOAD_SIZE_MB} MB.")

    # MIME types are controlled by clients. Decode the image before persisting
    # it to block disguised files and malformed-image parser attacks.
    try:
        from PIL import Image
        from io import BytesIO
        with Image.open(BytesIO(image_bytes)) as image:
            image.verify()
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The uploaded file is not a valid image.") from exc
    
    prescription = await _prescription_service.upload_prescription(
        patient_id=user.id,
        image_bytes=image_bytes,
        filename=file.filename,
        content_type=content_type,
    )
    
    background_tasks.add_task(_prescription_service.process_prescription, prescription.id)

    data = UploadPrescriptionResponse(
        id=prescription.id,
        patient_id=prescription.patient_id,
        original_image_url=prescription.original_image_url,
        thumbnail_url=prescription.thumbnail_url,
        processing_status=prescription.processing_status.value,
    )

    return APIResponse.ok(
        data=data,
        message="Prescription uploaded. Processing started in the background.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/{prescription_id}", response_model=APIResponse[PrescriptionResponse], summary="Get Prescription Status")
async def get_prescription(
    prescription_id: str,
    user: User = Depends(require_patient),
) -> APIResponse:
    from app.models.prescription import Prescription
    from app.core.exceptions import PrescriptionNotFoundException

    prescription = await Prescription.find_one(
        Prescription.id == prescription_id,
        Prescription.patient_id == user.id,
    )
    if not prescription:
        raise PrescriptionNotFoundException()

    data = PrescriptionResponse(
        id=prescription.id,
        patient_id=prescription.patient_id,
        original_image_url=prescription.original_image_url,
        processing_status=prescription.processing_status.value,
        ocr_status=prescription.ocr_status.value,
        ai_status=prescription.ai_status.value,
        doctor_name=prescription.doctor_name,
        hospital_name=prescription.hospital_name,
        prescription_date=prescription.prescription_date,
        extracted_medicines=prescription.extracted_medicines,
        medicine_match_ids=prescription.medicine_match_ids,
        overall_confidence=prescription.overall_confidence,
        last_error=prescription.last_error,
        patient_confirmed=prescription.patient_confirmed,
        pharmacy_id=prescription.pharmacy_id,
        pharmacy_name=prescription.pharmacy_name,
        pharmacy_status=prescription.pharmacy_status,
        pharmacy_requested_at=prescription.pharmacy_requested_at,
        pharmacy_reviewed_at=prescription.pharmacy_reviewed_at,
        pharmacy_rejection_reason=prescription.pharmacy_rejection_reason,
    )

    return APIResponse.ok(data=data, request_id=REQUEST_ID_CTX.get(""))


@router.get("/{prescription_id}/pharmacies", response_model=APIResponse[list[dict]], summary="List pharmacies with prescription medicines in stock")
async def get_prescription_pharmacies(
    prescription_id: str,
    user: User = Depends(require_patient),
) -> APIResponse:
    """Return only pharmacies that currently have a matched prescription medicine."""
    from app.core.exceptions import PrescriptionNotFoundException
    from app.models.prescription import MedicineMatch

    prescription = await Prescription.find_one(
        Prescription.id == prescription_id,
        Prescription.patient_id == user.id,
    )
    if not prescription:
        raise PrescriptionNotFoundException()

    matches = await MedicineMatch.find(MedicineMatch.prescription_id == prescription.id).to_list()
    medicine_ids = {match.matched_medicine_id for match in matches if match.matched_medicine_id}
    if not medicine_ids:
        return APIResponse.ok(data=[], message="No matched medicines are available for pharmacy search.")

    inventories = await MedicineInventory.find(
        MedicineInventory.medicine_id.in_(list(medicine_ids)),
        MedicineInventory.available_quantity > 0,
        MedicineInventory.is_deleted == False,  # noqa: E712
    ).to_list()
    inventories = [inventory for inventory in inventories if inventory.net_available > 0]
    if not inventories:
        return APIResponse.ok(data=[], message="No pharmacy currently has these medicines in stock.")

    patient_lat = patient_lng = None
    patient = await Patient.find_one(Patient.user_id == user.id)
    if patient and patient.primary_address_id:
        address = await Address.find_one(Address.id == patient.primary_address_id)
        if address:
            patient_lat, patient_lng = address.latitude, address.longitude

    # A prescription is fulfilled by one pharmacy only when it has every
    # matched medicine in stock.  Partial-stock pharmacies must not be shown
    # as valid choices for a multi-medicine prescription.
    pharmacy_ids = {
        pharmacy_id
        for pharmacy_id in {inventory.pharmacy_id for inventory in inventories}
        if medicine_ids.issubset({inventory.medicine_id for inventory in inventories if inventory.pharmacy_id == pharmacy_id})
    }
    if not pharmacy_ids:
        return APIResponse.ok(data=[], message="No pharmacy currently has all prescription medicines in stock.")
    pharmacies = await Pharmacy.find(Pharmacy.id.in_(list(pharmacy_ids))).to_list()
    by_id = {pharmacy.id: pharmacy for pharmacy in pharmacies}
    results = []
    for pharmacy_id in pharmacy_ids:
        pharmacy = by_id.get(pharmacy_id)
        if not pharmacy:
            continue
        pharmacy_inventory = [inventory for inventory in inventories if inventory.pharmacy_id == pharmacy_id]
        available_medicines = sorted({inventory.medicine_name for inventory in pharmacy_inventory})
        distance_km = None
        if (
            patient_lat is not None and patient_lng is not None
            and pharmacy.latitude is not None and pharmacy.longitude is not None
        ):
            distance_km = round(sqrt((pharmacy.latitude - patient_lat) ** 2 + (pharmacy.longitude - patient_lng) ** 2) * 111, 1)
        results.append({
            "id": pharmacy.id,
            "name": pharmacy.pharmacy_name,
            "address": ", ".join(part for part in [pharmacy.street, pharmacy.area, pharmacy.city, pharmacy.state, pharmacy.pincode] if part),
            "city": pharmacy.city,
            "latitude": pharmacy.latitude,
            "longitude": pharmacy.longitude,
            "distance_km": distance_km,
            "distance_text": f"{distance_km} km away" if distance_km is not None else "Distance unavailable",
            "available_medicines": available_medicines,
            "offers_courier": pharmacy.courier_enabled or pharmacy.home_delivery_enabled,
        })
    results.sort(key=lambda item: item["distance_km"] if item["distance_km"] is not None else float("inf"))
    return APIResponse.ok(data=results, request_id=REQUEST_ID_CTX.get(""))


@router.post("/{prescription_id}/request-pharmacy", response_model=APIResponse[dict], summary="Send prescription to a pharmacy")
async def request_pharmacy_review(
    prescription_id: str,
    body: dict,
    user: User = Depends(require_patient),
) -> APIResponse:
    from app.models.prescription import Prescription
    from app.core.exceptions import PrescriptionNotFoundException

    prescription = await Prescription.find_one(
        Prescription.id == prescription_id,
        Prescription.patient_id == user.id,
    )
    if not prescription:
        raise PrescriptionNotFoundException()
    if prescription.processing_status not in {PrescriptionStatus.COMPLETED, PrescriptionStatus.PARTIAL}:
        raise HTTPException(status_code=409, detail="Wait for prescription processing to complete.")
    if not prescription.patient_confirmed:
        raise HTTPException(status_code=409, detail="Confirm the extracted medicines before sending the prescription.")

    pharmacy_id = str(body.get("pharmacy_id") or body.get("pharmacyId") or "").strip()
    if not pharmacy_id:
        raise HTTPException(status_code=422, detail="A pharmacy must be selected.")
    pharmacy = await Pharmacy.find_one(
        Pharmacy.id == pharmacy_id,
        Pharmacy.is_deleted == False,  # noqa: E712
    )
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Active pharmacy not found.")
    # Enforce the same stock rule server-side as the chooser UI.  This keeps a
    # client from selecting a pharmacy that cannot fulfil a multi-medicine Rx.
    from app.models.prescription import MedicineMatch
    matches = await MedicineMatch.find(MedicineMatch.prescription_id == prescription.id).to_list()
    required_medicine_ids = {match.matched_medicine_id for match in matches if match.matched_medicine_id}
    if required_medicine_ids:
        stock = await MedicineInventory.find(
            MedicineInventory.pharmacy_id == pharmacy.id,
            MedicineInventory.medicine_id.in_(list(required_medicine_ids)),
            MedicineInventory.available_quantity > 0,
            MedicineInventory.is_deleted == False,  # noqa: E712
        ).to_list()
        if required_medicine_ids != {item.medicine_id for item in stock if item.net_available > 0}:
            raise HTTPException(status_code=409, detail="This pharmacy does not have all prescription medicines in stock.")
    if prescription.pharmacy_status == "confirmed":
        raise HTTPException(status_code=409, detail="This prescription has already been confirmed by a pharmacy.")

    prescription.pharmacy_id = pharmacy.id
    prescription.pharmacy_name = pharmacy.pharmacy_name
    prescription.pharmacy_status = "in_progress"
    prescription.pharmacy_requested_at = datetime.now(timezone.utc)
    prescription.pharmacy_reviewed_at = None
    prescription.pharmacy_rejection_reason = None
    await prescription.save()

    return APIResponse.ok(
        data={
            "id": prescription.id,
            "pharmacy_id": prescription.pharmacy_id,
            "pharmacy_name": prescription.pharmacy_name,
            "pharmacy_status": prescription.pharmacy_status,
        },
        message="Prescription sent to the pharmacy for verification.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.patch("/{prescription_id}/pharmacy-review", response_model=APIResponse[dict], summary="Approve or reject a prescription")
async def review_prescription(
    prescription_id: str,
    body: dict,
    user: User = Depends(require_pharmacy),
) -> APIResponse:
    from app.models.prescription import Prescription
    from app.core.exceptions import PrescriptionNotFoundException

    pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy profile not found.")
    prescription = await Prescription.find_one(
        Prescription.id == prescription_id,
        Prescription.pharmacy_id == pharmacy.id,
    )
    if not prescription:
        raise PrescriptionNotFoundException()
    if prescription.pharmacy_status != "in_progress":
        raise HTTPException(status_code=409, detail="This pharmacy request has already been reviewed.")

    status = str(body.get("status", "")).strip().lower()
    if status not in {"confirmed", "rejected"}:
        raise HTTPException(status_code=422, detail="Status must be confirmed or rejected.")
    prescription.pharmacy_status = status
    prescription.pharmacy_reviewed_at = datetime.now(timezone.utc)
    prescription.pharmacy_rejection_reason = (
        str(body.get("reason", "")).strip() or None
        if status == "rejected" else None
    )
    await prescription.save()
    return APIResponse.ok(
        data={
            "id": prescription.id,
            "pharmacy_id": prescription.pharmacy_id,
            "pharmacy_name": prescription.pharmacy_name,
            "pharmacy_status": prescription.pharmacy_status,
            "pharmacy_rejection_reason": prescription.pharmacy_rejection_reason,
        },
        message="Prescription approved." if status == "confirmed" else "Prescription rejected.",
        request_id=REQUEST_ID_CTX.get(""),
    )

@router.post("/{prescription_id}/confirm", response_model=APIResponse[dict], summary="Confirm Prescription OCR Result")
async def confirm_prescription(
    prescription_id: str,
    body: ConfirmPrescriptionRequest,
    user: User = Depends(require_patient),
) -> APIResponse:
    from datetime import datetime, timezone
    from app.models.prescription import Prescription
    from app.core.exceptions import PrescriptionNotFoundException

    prescription = await Prescription.find_one(
        Prescription.id == prescription_id,
        Prescription.patient_id == user.id,
    )
    if not prescription:
        raise PrescriptionNotFoundException()

    if prescription.processing_status in {PrescriptionStatus.FAILED, PrescriptionStatus.UPLOADED, PrescriptionStatus.OCR_PROCESSING, PrescriptionStatus.AI_PROCESSING, PrescriptionStatus.MATCHING}:
        raise HTTPException(status_code=409, detail="Prescription is still processing or failed and cannot be confirmed yet.")

    if body.medicines:
        updated = []
        for index, med in enumerate(body.medicines):
            existing = prescription.extracted_medicines[index] if index < len(prescription.extracted_medicines) else {}
            updated.append(
                {
                    **existing,
                    "medicine_name": med.medicine_name,
                    "dosage": med.dosage,
                    "frequency": med.frequency,
                    "duration": med.duration,
                    "confidence": med.confidence if med.confidence is not None else existing.get("confidence", 0.0),
                    "requires_manual_verification": False,
                }
            )
        prescription.extracted_medicines = updated

    prescription.patient_confirmed = True
    prescription.patient_confirmed_at = datetime.now(timezone.utc)
    if prescription.processing_status == PrescriptionStatus.PARTIAL:
        prescription.processing_status = PrescriptionStatus.COMPLETED
    await prescription.save()

    return APIResponse.ok(
        data={
            "id": prescription.id,
            "patient_confirmed": prescription.patient_confirmed,
            "processing_status": prescription.processing_status.value,
        },
        message="Prescription confirmed.",
        request_id=REQUEST_ID_CTX.get(""),
    )


@router.get("/{prescription_id}/image", summary="Get a prescription image")
async def get_prescription_image(
    prescription_id: str,
    user: User = Depends(get_current_active_user),
) -> Response:
    """Return a private image to its patient or assigned pharmacy."""
    from app.models.prescription import Prescription, PrescriptionImage
    from app.core.exceptions import PrescriptionNotFoundException
    from app.providers.storage.local_provider import LocalStorageProvider

    prescription = await Prescription.find_one(Prescription.id == prescription_id)
    if prescription:
        allowed = prescription.patient_id == user.id
        if user.role == UserRole.PHARMACY:
            pharmacy = await Pharmacy.find_one(Pharmacy.user_id == user.id)
            allowed = pharmacy is not None and prescription.pharmacy_id == pharmacy.id
        if not allowed:
            raise HTTPException(status_code=403, detail="You are not authorized to view this prescription.")
    if not prescription or not prescription.image_id:
        raise PrescriptionNotFoundException()
    image = await PrescriptionImage.find_one(PrescriptionImage.id == prescription.image_id)
    if not image:
        raise PrescriptionNotFoundException()
    try:
        content = await LocalStorageProvider().read(image.cloudinary_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Prescription image not found.") from exc
    return Response(
        content=content,
        media_type=image.content_type if image.content_type in {"image/jpeg", "image/jpg", "image/png"} else "application/octet-stream",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
