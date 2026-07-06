
from __future__ import annotations

import asyncio
from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks

from app.core.middleware.request_id import REQUEST_ID_CTX
from app.core.responses import APIResponse
from app.dependencies.auth import require_patient
from app.models.user import User
from app.schemas.prescription import PrescriptionResponse, UploadPrescriptionResponse
from app.services.prescription_service import PrescriptionService

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])
_prescription_service = PrescriptionService()


@router.post("/upload", response_model=APIResponse[UploadPrescriptionResponse], summary="Upload Prescription Image")
async def upload_prescription(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(require_patient),
) -> APIResponse:
    image_bytes = await file.read()
    
    prescription = await _prescription_service.upload_prescription(
        patient_id=user.id,
        image_bytes=image_bytes,
        filename=file.filename,
        content_type=file.content_type,
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
    )

    return APIResponse.ok(data=data, request_id=REQUEST_ID_CTX.get(""))
