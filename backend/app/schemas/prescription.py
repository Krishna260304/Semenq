
from __future__ import annotations

from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class UploadPrescriptionResponse(BaseModel):
    id: str
    patient_id: str
    original_image_url: str
    thumbnail_url: Optional[str]
    processing_status: str


class ExtractedMedicineItemSchema(BaseModel):
    raw_text: str
    medicine_name: str
    dosage: Optional[str]
    frequency: Optional[str]
    duration: Optional[str]
    quantity: Optional[int]
    special_instructions: str
    confidence: float
    requires_manual_verification: bool


class PrescriptionMatchSchema(BaseModel):
    extracted_name: str
    matched_medicine_id: Optional[str]
    matched_medicine_name: Optional[str]
    match_type: str
    match_score: float


class PrescriptionResponse(BaseModel):
    id: str
    patient_id: str
    original_image_url: Optional[str]
    processing_status: str
    ocr_status: str
    ai_status: str
    doctor_name: Optional[str]
    hospital_name: Optional[str]
    prescription_date: Optional[datetime]
    extracted_medicines: list[ExtractedMedicineItemSchema] = []
    medicine_match_ids: list[str] = []
    overall_confidence: float
    last_error: Optional[str] = None
