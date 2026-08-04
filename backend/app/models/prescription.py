
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from app.models.base import BaseDocument, _utcnow


class PrescriptionStatus(str, Enum):
    UPLOADED = "uploaded"
    ENHANCING = "enhancing"
    OCR_PROCESSING = "ocr_processing"
    AI_PROCESSING = "ai_processing"
    MATCHING = "matching"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class OCRStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class ConfidenceLevel(str, Enum):
    HIGH = "high"       # >= 90%
    MEDIUM = "medium"   # 70–89%
    LOW = "low"         # < 70%


class PrescriptionImage(BaseDocument):

    prescription_id: str
    cloudinary_id: str
    original_url: str
    enhanced_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    file_size: int = 0
    width: int = 0
    height: int = 0
    content_type: str = ""
    file_hash: str = ""       # SHA-256 for dedup detection
    uploaded_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "prescription_images"
        indexes = [[("prescription_id", 1)], [("file_hash", 1)]]


class OCRLog(BaseDocument):

    prescription_id: str
    ocr_provider: str
    status: OCRStatus = OCRStatus.PENDING
    raw_text: str = ""
    detected_language: str = "en"
    confidence: float = 0.0
    bounding_boxes: list[dict] = Field(default_factory=list)
    execution_time_ms: int = 0
    retry_count: int = 0
    error_message: Optional[str] = None
    started_at: datetime = Field(default_factory=_utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "ocr_logs"
        indexes = [[("prescription_id", 1)], [("status", 1)]]


class ExtractedMedicineItem(BaseDocument):
    raw_text: str = ""
    medicine_name: str = ""
    brand_name: Optional[str] = None
    composition: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[int] = None
    special_instructions: str = ""
    warnings: str = ""
    confidence: float = 0.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.LOW
    requires_manual_verification: bool = True

    class Settings:
        name = "extracted_medicine_items"


class AILog(BaseDocument):

    prescription_id: str
    ai_provider: str
    model_name: str
    prompt_version: str = "v1"
    status: OCRStatus = OCRStatus.PENDING
    raw_response: str = ""
    extracted_medicines: list[dict] = Field(default_factory=list)
    overall_confidence: float = 0.0
    execution_time_ms: int = 0
    estimated_tokens: int = 0
    retry_count: int = 0
    error_message: Optional[str] = None
    started_at: datetime = Field(default_factory=_utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "ai_logs"
        indexes = [[("prescription_id", 1)], [("status", 1)]]


class MedicineMatch(BaseDocument):

    prescription_id: str
    extracted_name: str
    matched_medicine_id: Optional[str] = None
    matched_medicine_name: Optional[str] = None
    match_type: str = "none"    # exact | brand | generic | composition | typo | none
    match_score: float = 0.0
    alternative_matches: list[dict] = Field(default_factory=list)
    manually_corrected: bool = False
    correction_by: Optional[str] = None
    correction_at: Optional[datetime] = None
    corrected_medicine_id: Optional[str] = None

    class Settings:
        name = "medicine_matches"
        indexes = [[("prescription_id", 1)], [("matched_medicine_id", 1)]]


class Prescription(BaseDocument):

    patient_id: str
    image_id: Optional[str] = None
    original_image_url: Optional[str] = None
    enhanced_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    processing_status: PrescriptionStatus = PrescriptionStatus.UPLOADED
    ocr_status: OCRStatus = OCRStatus.PENDING
    ai_status: OCRStatus = OCRStatus.PENDING

    ocr_log_id: Optional[str] = None
    ai_log_id: Optional[str] = None

    extracted_medicines: list[dict] = Field(default_factory=list)
    medicine_match_ids: list[str] = Field(default_factory=list)

    overall_confidence: float = 0.0
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    prescription_date: Optional[datetime] = None
    patient_name_on_rx: Optional[str] = None

    has_search_results: bool = False
    search_session_id: Optional[str] = None
    reservation_id: Optional[str] = None
    patient_confirmed: bool = False
    patient_confirmed_at: Optional[datetime] = None

    # Pharmacy verification is deliberately separate from OCR processing and
    # patient confirmation.  A request starts in progress and only becomes
    # confirmed after the selected pharmacy reviews the prescription image.
    pharmacy_id: Optional[str] = None
    pharmacy_name: Optional[str] = None
    pharmacy_status: str = "not_requested"  # not_requested | in_progress | confirmed | rejected
    pharmacy_requested_at: Optional[datetime] = None
    pharmacy_reviewed_at: Optional[datetime] = None
    pharmacy_rejection_reason: Optional[str] = None

    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    retry_count: int = 0
    last_error: Optional[str] = None

    class Settings:
        name = "prescriptions"
        indexes = [
            [("patient_id", 1), ("created_at", -1)],
            [("processing_status", 1)],
            [("reservation_id", 1)],
        ]
