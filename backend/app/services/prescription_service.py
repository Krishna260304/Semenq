
from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Optional

from app.core.config import get_settings
from app.core.exceptions import PrescriptionNotFoundException, PrescriptionProcessingException
from app.core.logging.logger import get_logger
from app.models.medicine import Medicine
from app.models.prescription import (
    AILog,
    ConfidenceLevel,
    ExtractedMedicineItem,
    MedicineMatch,
    OCRLog,
    OCRStatus,
    Prescription,
    PrescriptionImage,
    PrescriptionStatus,
)
from app.providers.ai.groq_provider import GroqProvider
from app.providers.ocr.easyocr_provider import EasyOCRProvider
from app.providers.storage.local_provider import LocalStorageProvider

logger = get_logger(__name__)
settings = get_settings()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PrescriptionService:
    def __init__(self) -> None:
        self._storage = LocalStorageProvider()
        self._ocr = EasyOCRProvider()
        self._ai = GroqProvider()

    async def upload_prescription(
        self, patient_id: str, image_bytes: bytes, filename: str, content_type: str
    ) -> Prescription:
        file_hash = hashlib.sha256(image_bytes).hexdigest()
        existing_image = await PrescriptionImage.find_one(PrescriptionImage.file_hash == file_hash)
        if existing_image:
            logger.info("Duplicate prescription image detected", hash=file_hash)
        
        prescription = Prescription(
            patient_id=patient_id,
            processing_status=PrescriptionStatus.UPLOADED,
        )
        await prescription.insert()

        try:
            upload_result = await self._storage.upload(
                file_bytes=image_bytes,
                folder=f"semenq/prescriptions/{patient_id}",
                public_id=f"rx_{prescription.id}",
            )
        except Exception as exc:
            logger.error("Cloudinary upload failed", error=str(exc))
            prescription.processing_status = PrescriptionStatus.FAILED
            prescription.last_error = "Image upload failed."
            await prescription.save()
            raise PrescriptionProcessingException("Image upload failed.")

        image_record = PrescriptionImage(
            prescription_id=prescription.id,
            cloudinary_id=upload_result.public_id,
            original_url=upload_result.secure_url,
            thumbnail_url=upload_result.thumbnail_url,
            file_size=upload_result.bytes,
            width=upload_result.width,
            height=upload_result.height,
            content_type=content_type,
            file_hash=file_hash,
        )
        await image_record.insert()

        prescription.image_id = image_record.id
        prescription.original_image_url = upload_result.secure_url
        prescription.thumbnail_url = upload_result.thumbnail_url
        await prescription.save()


        return prescription

    async def process_prescription(self, prescription_id: str) -> Prescription:
        prescription = await Prescription.find_one(Prescription.id == prescription_id)
        if not prescription:
            raise PrescriptionNotFoundException()

        image_record = await PrescriptionImage.find_one(PrescriptionImage.id == prescription.image_id)
        if not image_record:
            raise PrescriptionProcessingException("Image record not found.")

        prescription.processing_started_at = _utcnow()
        prescription.processing_status = PrescriptionStatus.OCR_PROCESSING
        await prescription.save()

        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(image_record.original_url)
                resp.raise_for_status()
                image_bytes = resp.content
        except Exception as exc:
            prescription.processing_status = PrescriptionStatus.FAILED
            prescription.last_error = f"Failed to fetch image: {exc}"
            await prescription.save()
            return prescription

        ocr_log = OCRLog(prescription_id=prescription.id, ocr_provider=self._ocr.provider_name)
        await ocr_log.insert()
        prescription.ocr_log_id = ocr_log.id
        await prescription.save()

        try:
            ocr_result = await self._ocr.extract_text(image_bytes)
            ocr_log.status = OCRStatus.COMPLETED
            ocr_log.raw_text = ocr_result.raw_text
            ocr_log.confidence = ocr_result.confidence
            ocr_log.bounding_boxes = ocr_result.bounding_boxes
            ocr_log.execution_time_ms = ocr_result.execution_time_ms
            ocr_log.completed_at = _utcnow()
            await ocr_log.save()
            
            prescription.ocr_status = OCRStatus.COMPLETED
        except Exception as exc:
            ocr_log.status = OCRStatus.FAILED
            ocr_log.error_message = str(exc)
            await ocr_log.save()
            prescription.ocr_status = OCRStatus.FAILED
            prescription.processing_status = PrescriptionStatus.FAILED
            prescription.last_error = "OCR failed."
            await prescription.save()
            return prescription

        prescription.processing_status = PrescriptionStatus.AI_PROCESSING
        await prescription.save()

        ai_log = AILog(
            prescription_id=prescription.id,
            ai_provider=self._ai.provider_name,
            model_name=settings.GROQ_MODEL,
        )
        await ai_log.insert()
        prescription.ai_log_id = ai_log.id
        await prescription.save()

        try:
            ai_result = await self._ai.extract_prescription(ocr_log.raw_text)
            ai_log.status = OCRStatus.COMPLETED
            ai_log.raw_response = ai_result.raw_response
            ai_log.overall_confidence = ai_result.overall_confidence
            ai_log.execution_time_ms = ai_result.execution_time_ms
            ai_log.estimated_tokens = ai_result.estimated_tokens
            ai_log.completed_at = _utcnow()
            
            extracted_items = []
            for m in ai_result.medicines:
                conf_level = (
                    ConfidenceLevel.HIGH if m.confidence >= 0.9 else
                    ConfidenceLevel.MEDIUM if m.confidence >= 0.7 else
                    ConfidenceLevel.LOW
                )
                item = ExtractedMedicineItem(
                    raw_text=m.raw_text,
                    medicine_name=m.medicine_name,
                    brand_name=m.brand_name,
                    composition=m.composition,
                    dosage=m.dosage,
                    frequency=m.frequency,
                    duration=m.duration,
                    quantity=m.quantity,
                    special_instructions=m.special_instructions,
                    warnings=m.warnings,
                    confidence=m.confidence,
                    confidence_level=conf_level,
                    requires_manual_verification=(conf_level != ConfidenceLevel.HIGH),
                )
                await item.insert()
                extracted_items.append(item)
                ai_log.extracted_medicines.append(item.model_dump(by_alias=True))
            
            await ai_log.save()

            prescription.ai_status = OCRStatus.COMPLETED
            prescription.extracted_medicines = [item.model_dump(by_alias=True) for item in extracted_items]
            prescription.doctor_name = ai_result.doctor_name
            prescription.hospital_name = ai_result.hospital_name
            prescription.patient_name_on_rx = ai_result.patient_name
            prescription.overall_confidence = ai_result.overall_confidence
            
            if ai_result.prescription_date:
                try:
                    prescription.prescription_date = datetime.strptime(ai_result.prescription_date, "%Y-%m-%d")
                except ValueError:
                    pass

            await prescription.save()
        except Exception as exc:
            ai_log.status = OCRStatus.FAILED
            ai_log.error_message = str(exc)
            await ai_log.save()
            prescription.ai_status = OCRStatus.FAILED
            prescription.processing_status = PrescriptionStatus.FAILED
            prescription.last_error = "AI Extraction failed."
            await prescription.save()
            return prescription

        prescription.processing_status = PrescriptionStatus.MATCHING
        await prescription.save()

        matches = await self._match_medicines_with_db(prescription.id, extracted_items)
        prescription.medicine_match_ids = [m.id for m in matches]
        
        needs_verification = any(m.match_type == "none" or m.match_score < 0.8 for m in matches)
        prescription.processing_status = PrescriptionStatus.PARTIAL if needs_verification else PrescriptionStatus.COMPLETED
        prescription.processing_completed_at = _utcnow()
        await prescription.save()

        logger.info("Prescription processed", prescription_id=prescription.id, status=prescription.processing_status.value)
        return prescription

    async def _match_medicines_with_db(
        self, prescription_id: str, extracted_items: list[ExtractedMedicineItem]
    ) -> list[MedicineMatch]:
        matches = []
        for item in extracted_items:
            db_medicine = await Medicine.find_one(
                Medicine.name == item.medicine_name.strip(),
                Medicine.is_deleted == False
            )
            
            match_record = MedicineMatch(
                prescription_id=prescription_id,
                extracted_name=item.medicine_name,
            )

            if db_medicine:
                match_record.matched_medicine_id = db_medicine.id
                match_record.matched_medicine_name = db_medicine.name
                match_record.match_type = "exact"
                match_record.match_score = 1.0
            else:
                search_results = await Medicine.find(
                    {"$text": {"$search": item.medicine_name}, "is_deleted": False}
                ).limit(3).to_list()

                if search_results:
                    top_match = search_results[0]
                    match_record.matched_medicine_id = top_match.id
                    match_record.matched_medicine_name = top_match.name
                    match_record.match_type = "fuzzy"
                    match_record.match_score = 0.85 # Heuristic
                    
                    match_record.alternative_matches = [
                        {"id": r.id, "name": r.name} for r in search_results[1:]
                    ]
            
            await match_record.insert()
            matches.append(match_record)
            
        return matches
