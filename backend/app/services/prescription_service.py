
from __future__ import annotations

import asyncio
import json
import hashlib
import re
from difflib import SequenceMatcher
from datetime import datetime, timezone
from typing import Optional

from app.core.config import get_settings
from app.core.exceptions import PrescriptionNotFoundException, PrescriptionProcessingException
from app.core.logging.logger import get_logger
from app.models.medicine import Medicine
from app.models.prescription import (
    AILog,
    ConfidenceLevel,
    ExtractedMedicineItem as PrescriptionExtractedMedicineItem,
    MedicineMatch,
    OCRLog,
    OCRStatus,
    Prescription,
    PrescriptionImage,
    PrescriptionStatus,
)
from app.providers.ai.qwen_provider import QwenProvider
from app.providers.ai.base import AIExtractionResult, ExtractedMedicineItem as AIExtractedMedicineItem
from app.providers.ocr.factory import get_ocr_provider
from app.providers.storage.local_provider import LocalStorageProvider
from app.services.medicine_matching import build_medicine_queries, rank_medicines_for_queries

logger = get_logger(__name__)
settings = get_settings()

BLOCKED_BRAND_STEMS = {
    "sikkim", "south", "north", "east", "west", "india", "road", "trade",
    "mark", "regd", "mfg", "lic", "mode", "namthang", "namchi", "mamring",
    "microlabs", "tablet", "tablets", "paracetamol", "plot", "phase",
    "industrial", "estate", "district", "pincode",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PrescriptionService:
    def __init__(self) -> None:
        self._storage = LocalStorageProvider()
        self._ocr = get_ocr_provider()
        if settings.AI_PROVIDER == "qwen":
            self._ai = QwenProvider()

    async def _extract_text(self, image_bytes: bytes) -> tuple[str, float, str, list[dict], int]:
        ocr_result = await self._ocr.extract_text(image_bytes)
        return (
            ocr_result.raw_text,
            ocr_result.confidence,
            ocr_result.provider,
            ocr_result.bounding_boxes,
            ocr_result.execution_time_ms,
        )

    def _extract_medicines_fast(self, ocr_text: str) -> AIExtractionResult | None:
        lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]
        if not lines:
            return None

        reject_line_re = re.compile(
            r"(?i)\b(warning|store|dosage|dose|physician|doctor|tablet contains|each uncoated|mfg|lic|made in|regd|trade mark|batch|expiry|manufactured|temperature|liver|keep out|schedule|address|road|namchi|mamring|namthang|sikkim|plot|phase|industrial|estate|pincode|district|phone|email)\b"
        )
        medicine_hint_re = re.compile(
            r"(?i)\b([a-z][a-z0-9]+(?:[- ][a-z0-9]+){0,2}(?:\s+\d{2,4}\s*(?:mg|mcg|g|ml))?)\b"
        )
        branded_name_re = re.compile(r"(?i)\b([a-z][a-z0-9]{2,}(?:[- ][a-z0-9]{1,})+)\b")
        # Brand names can be long (e.g. hydrochlorothiazide combinations),
        # and OCR may separate the strength with a space instead of a hyphen.
        strict_brand_dose_re = re.compile(r"(?i)\b([a-z][a-z0-9+/-]{2,39}[-\s]+\d{1,5}(?:\.\d+)?(?:\s*(?:mg|mcg|g|ml|l|iu|%))?)\b")
        blocked_brand_stems = {
            "sikkim",
            "south",
            "north",
            "east",
            "west",
            "india",
            "road",
            "trade",
            "mark",
            "regd",
            "mfg",
            "lic",
            "mode",
            "namthang",
            "namchi",
            "mamring",
            "microlabs",
            "tablet",
            "tablets",
            "paracetamol",
            "plot",
            "phase",
            "industrial",
            "estate",
            "district",
            "pincode",
        }

        prioritized_lines = sorted(
            lines,
            key=lambda value: 0 if branded_name_re.search(value) else 1,
        )

        dosage_re = re.compile(
            r"(?i)\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|l|iu|%|mg/ml|mcg/ml|unit|units|tab|tabs|tablet|tablets|cap|caps|capsule|capsules|drop|drops|syrup|spray|patch))\b"
        )
        frequency_re = re.compile(
            r"(?i)\b(once daily|twice daily|thrice daily|four times daily|od|bd|bid|tid|qid|hs|morning|night|before food|after food)\b"
        )
        duration_re = re.compile(r"(?i)\b(\d+\s*(?:day|days|week|weeks|month|months))\b")
        noise_re = re.compile(r"(?i)\b(tab|tablet|cap|capsule|syrup|inj|injection|ointment|cream|drop|drops|ip|usp|bp)\b")

        medicines: list[AIExtractedMedicineItem] = []
        total_confidence = 0.0

        for line in prioritized_lines:
            if len(medicines) >= 20:
                break
            if not any(char.isalpha() for char in line):
                continue
            if reject_line_re.search(line):
                continue

            dosage_match = dosage_re.search(line)
            frequency_match = frequency_re.search(line)
            duration_match = duration_re.search(line)

            candidate = line
            candidate = dosage_re.sub(" ", candidate)
            candidate = frequency_re.sub(" ", candidate)
            candidate = duration_re.sub(" ", candidate)
            candidate = noise_re.sub(" ", candidate)
            candidate = re.sub(r"(?i)^\s*(take|use|apply|inject|give|administer)\s+", "", candidate)
            candidate = re.split(r"[-:,/]", candidate, maxsplit=1)[0]
            candidate = re.sub(r"\s+", " ", candidate).strip(" .")

            tokens = [token for token in candidate.split() if len(token) > 1 and token.lower() not in {"ip", "usp", "bp"}]
            if not tokens:
                continue
            if all(token.lower() in {"for", "the", "and", "with", "once", "twice", "thrice", "daily", "day", "days", "week", "weeks"} for token in tokens):
                continue

            strict_match = strict_brand_dose_re.search(line)
            # If OCR sees a generic prefix (Vitamin B12, Losartan potassium),
            # keep the complete prefix instead of starting at the last token
            # before the strength.
            explicit_brand = strict_match if strict_match and strict_match.start() == 0 else None
            branded = explicit_brand or branded_name_re.search(candidate)
            hinted = medicine_hint_re.search(candidate)
            if branded:
                medicine_name = re.sub(r"\s+", " ", branded.group(1)).strip(" .")
            elif hinted:
                medicine_name = re.sub(r"\s+", " ", hinted.group(1)).strip(" .")
            else:
                medicine_name = " ".join(tokens[:8]).strip()
            if len(medicine_name) < 3:
                continue

            if reject_line_re.search(medicine_name):
                continue
            if explicit_brand and not strict_brand_dose_re.search(medicine_name):
                continue
            strict_token = strict_brand_dose_re.search(medicine_name)
            if strict_token:
                stem = strict_token.group(1).split("-", 1)[0].lower()
                if stem in blocked_brand_stems:
                    continue

            confidence = 0.5
            if dosage_match:
                confidence += 0.18
            if explicit_brand:
                confidence += 0.14
            if frequency_match:
                confidence += 0.12
            if duration_match:
                confidence += 0.05
            if medicine_name[:1].isupper():
                confidence += 0.03

            confidence = min(confidence, 0.92)
            total_confidence += confidence

            medicines.append(
                AIExtractedMedicineItem(
                    raw_text=line,
                    medicine_name=medicine_name,
                    dosage=dosage_match.group(1) if dosage_match else None,
                    frequency=frequency_match.group(1) if frequency_match else None,
                    duration=duration_match.group(1) if duration_match else None,
                    quantity=None,
                    special_instructions="",
                    confidence=confidence,
                )
            )

        # De-duplicate repeated OCR lines without discarding other medicines.
        # The previous implementation kept only one brand-strength candidate,
        # which is why a Dolo label appeared to work while multi-medicine Rx
        # images lost every other item.
        explicit_brand_present = any(strict_brand_dose_re.search(item.medicine_name) for item in medicines)
        unique: dict[str, AIExtractedMedicineItem] = {}
        for item in medicines:
            key = re.sub(r"[^a-z0-9]+", " ", item.medicine_name.lower()).strip()
            if not key:
                continue
            # Ingredient-only lines such as “Paracetamol Tablets IP” are label
            # composition text, not a second product, when a branded product
            # with a strength is present on the same package.
            if explicit_brand_present and not strict_brand_dose_re.search(item.medicine_name):
                raw_lower = item.raw_text.lower()
                if item.dosage is None and re.search(r"\b(tablet|capsule|syrup|injection)s?\b", raw_lower):
                    continue
            previous = unique.get(key)
            if previous is None or item.confidence > previous.confidence:
                unique[key] = item
        medicines = list(unique.values())
        total_confidence = sum(item.confidence for item in medicines)

        if not medicines:
            return None

        overall_confidence = round(total_confidence / len(medicines), 4)
        return AIExtractionResult(
            medicines=medicines,
            overall_confidence=overall_confidence,
            provider="heuristic",
            model="heuristic-rule-extractor",
            raw_response=json.dumps(
                {
                    "medicines": [item.__dict__ for item in medicines],
                    "overall_confidence": overall_confidence,
                }
            ),
        )

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
        image_url = f"/api/prescriptions/{prescription.id}/image"
        prescription.original_image_url = image_url
        prescription.thumbnail_url = image_url
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

        try:
            # Local uploads are already on this server. Reading them directly
            # avoids an unreliable localhost HTTP dependency and removes an
            # SSRF-shaped fetch path from OCR processing.
            image_bytes = await self._storage.read(image_record.cloudinary_id)
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
            ocr_text, ocr_confidence, ocr_provider_name, ocr_boxes, ocr_time_ms = await self._extract_text(image_bytes)
            ocr_log.status = OCRStatus.COMPLETED
            ocr_log.ocr_provider = ocr_provider_name
            ocr_log.raw_text = ocr_text
            ocr_log.confidence = ocr_confidence
            ocr_log.bounding_boxes = ocr_boxes
            ocr_log.execution_time_ms = ocr_time_ms
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

        ai_result = self._extract_medicines_fast(ocr_log.raw_text)
        using_fast_path = ai_result is not None and ai_result.overall_confidence >= 0.65
        if not using_fast_path and not hasattr(self, "_ai"):
            # OCR must still complete on installations without a local LLM.
            # Return a reviewable partial result instead of marking the whole
            # prescription as failed just because the heuristic was uncertain.
            ai_result = ai_result or AIExtractionResult(
                medicines=[],
                overall_confidence=0.0,
                provider="heuristic",
                model="heuristic-rule-extractor",
                raw_response=json.dumps({"medicines": [], "overall_confidence": 0.0}),
            )
            using_fast_path = True

        ai_log = AILog(
            prescription_id=prescription.id,
            ai_provider="heuristic" if using_fast_path else self._ai.provider_name,
            model_name="heuristic-rule-extractor" if using_fast_path else settings.QWEN_MODEL,
        )
        await ai_log.insert()
        prescription.ai_log_id = ai_log.id
        await prescription.save()

        try:
            if not using_fast_path:
                ai_result = await self._ai.extract_prescription(ocr_log.raw_text)
                ai_log.ai_provider = ai_result.provider
                ai_log.model_name = ai_result.model

            if ai_result is None:
                raise PrescriptionProcessingException("AI extraction returned no result.")

            ai_log.status = OCRStatus.COMPLETED
            ai_log.raw_response = ai_result.raw_response
            ai_log.overall_confidence = ai_result.overall_confidence
            ai_log.execution_time_ms = ai_result.execution_time_ms
            ai_log.estimated_tokens = ai_result.estimated_tokens
            ai_log.completed_at = _utcnow()
            ai_log.ai_provider = ai_result.provider
            ai_log.model_name = ai_result.model
            
            extracted_items = []
            for m in ai_result.medicines:
                conf_level = (
                    ConfidenceLevel.HIGH if m.confidence >= 0.9 else
                    ConfidenceLevel.MEDIUM if m.confidence >= 0.7 else
                    ConfidenceLevel.LOW
                )
                item = PrescriptionExtractedMedicineItem(
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
        prescription.extracted_medicines = [item.model_dump(by_alias=True) for item in extracted_items]
        prescription.medicine_match_ids = [m.id for m in matches]
        
        needs_verification = not matches or any(m.match_type == "none" or m.match_score < 0.8 for m in matches)
        prescription.processing_status = PrescriptionStatus.PARTIAL if needs_verification else PrescriptionStatus.COMPLETED
        prescription.processing_completed_at = _utcnow()
        await prescription.save()

        logger.info("Prescription processed", prescription_id=prescription.id, status=prescription.processing_status.value)
        return prescription

    async def _match_medicines_with_db(
        self, prescription_id: str, extracted_items: list[PrescriptionExtractedMedicineItem]
    ) -> list[MedicineMatch]:
        matches = []
        for item in extracted_items:
            queries = build_medicine_queries(
                item.raw_text,
                item.medicine_name,
                item.brand_name,
                item.composition,
                item.dosage,
                item.frequency,
                item.duration,
                item.special_instructions,
            )
            candidate_pool = []
            seen_ids: set[str] = set()

            # 1. Direct Regex Brand Search (e.g. 'Dolo' from 'Dolo-650')
            brand_stems = set()
            for text_val in (item.medicine_name, item.raw_text):
                if text_val:
                    for m in re.finditer(r"(?i)\b([a-z]{3,15})\b", text_val):
                        stem = m.group(1).lower()
                        if stem not in BLOCKED_BRAND_STEMS and stem not in {"tablet", "tablets", "capsule", "capsules", "syrup", "injection"}:
                            brand_stems.add(stem)

            for b_stem in brand_stems:
                regex_results = await Medicine.find(
                    {"name": {"$regex": rf"^{re.escape(b_stem)}\b", "$options": "i"}, "is_deleted": False}
                ).limit(10).to_list()
                for medicine in regex_results:
                    if medicine.id not in seen_ids:
                        seen_ids.add(medicine.id)
                        candidate_pool.append(medicine)

            # 2. Text Search with Hyphens Sanitized (MongoDB treats leading '-' as exclusion/negation)
            for query in queries:
                clean_query = re.sub(r"-+", " ", query).strip()
                if not clean_query:
                    continue
                search_results = await Medicine.find(
                    {"$text": {"$search": clean_query}, "is_deleted": False}
                ).limit(10).to_list()
                for medicine in search_results:
                    if medicine.id in seen_ids:
                        continue
                    seen_ids.add(medicine.id)
                    candidate_pool.append(medicine)

            ranked = rank_medicines_for_queries(queries, candidate_pool, limit=3)
            match_record = MedicineMatch(
                prescription_id=prescription_id,
                extracted_name=item.medicine_name,
            )

            if ranked:
                top_match = ranked[0]

                original_brand_token = re.search(r"(?i)\b([a-z]{3,12})[-\s](\d{2,4})\b", item.medicine_name or "")
                if original_brand_token:
                    original_stem = original_brand_token.group(1).lower()
                    original_dose = original_brand_token.group(2)
                    best_brand_variant = top_match
                    best_brand_variant_score = 0.0

                    for candidate in ranked:
                        candidate_label = str(getattr(candidate.medicine, "brand_name", None) or getattr(candidate.medicine, "name", "") or "")
                        candidate_token = re.search(r"(?i)\b([a-z]{3,12})[-\s](\d{2,4})\b", candidate_label)
                        if not candidate_token:
                            continue
                        candidate_stem = candidate_token.group(1).lower()
                        candidate_dose = candidate_token.group(2)
                        if candidate_dose != original_dose:
                            continue
                        stem_similarity = SequenceMatcher(None, original_stem, candidate_stem).ratio()
                        candidate_score = stem_similarity * 0.7 + candidate.score * 0.3
                        if candidate_score > best_brand_variant_score:
                            best_brand_variant = candidate
                            best_brand_variant_score = candidate_score

                    if best_brand_variant_score >= 0.65:
                        top_match = best_brand_variant

                match_record.matched_medicine_id = top_match.medicine.id
                match_record.matched_medicine_name = top_match.medicine.name
                match_record.match_type = top_match.match_type if top_match.match_type != "none" else "typo"
                match_record.match_score = top_match.score
                match_record.alternative_matches = [
                    {
                        "id": item.medicine.id,
                        "name": item.medicine.name,
                        "score": item.score,
                    }
                    for item in ranked[1:]
                ]

                original_name = (item.medicine_name or "").strip()
                original_raw = (item.raw_text or "").strip()
                original_brand_like = re.search(r"(?i)\b([a-z][a-z0-9]{2,}(?:[- ][a-z0-9]{1,})+)\b", f"{original_name} {original_raw}")

                if top_match.match_type in {"exact", "brand"} and top_match.score >= 0.9:
                    preferred_name = top_match.medicine.name
                    if top_match.match_type == "brand" and getattr(top_match.medicine, "brand_name", None):
                        preferred_name = str(top_match.medicine.brand_name)

                    clean_orig = re.sub(r"[^a-z0-9]", "", original_brand_like.group(1).lower()) if original_brand_like else ""
                    clean_pref = re.sub(r"[^a-z0-9]", "", preferred_name.lower())

                    if clean_orig and clean_orig not in clean_pref:
                        # Keep explicit OCR brand tokens (example: Dolo-650)
                        # if DB normalization suggests a completely different product label.
                        item.requires_manual_verification = True
                    else:
                        item.medicine_name = preferred_name
                        if getattr(top_match.medicine, "brand_name", None):
                            item.brand_name = top_match.medicine.brand_name
                        if getattr(top_match.medicine, "composition", None):
                            item.composition = top_match.medicine.composition
                        item.requires_manual_verification = top_match.score < 0.95
                else:
                    # Preserve OCR/AI medicine naming when the DB link is only
                    # a generic/typo-level guess to avoid confident mislabeling.
                    item.requires_manual_verification = True

            await match_record.insert()
            matches.append(match_record)
            
        return matches
