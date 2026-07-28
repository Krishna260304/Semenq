from __future__ import annotations

import json
import time
from typing import Optional

from app.core.config import get_settings
from app.core.exceptions import AIException
from app.core.logging.logger import get_logger
from app.providers.ai.base import AIExtractionResult, BaseAIProvider, ExtractedMedicineItem

logger = get_logger(__name__)

_EXTRACTION_PROMPT = """
You are a medical prescription parser. Extract all medicines from the following OCR text from a prescription.

Return a JSON object with this exact structure:
{
  "medicines": [
    {
      "medicine_name": "string",
      "brand_name": "string or null",
      "composition": "string or null",
      "dosage": "string or null",
      "frequency": "string or null (e.g., twice daily)",
      "duration": "string or null (e.g., 7 days)",
      "quantity": integer or null,
      "special_instructions": "string",
      "confidence": float between 0 and 1
    }
  ],
  "doctor_name": "string or null",
  "hospital_name": "string or null",
  "prescription_date": "string or null",
  "patient_name": "string or null",
  "overall_confidence": float between 0 and 1
}

OCR Text:
{ocr_text}

Return only valid JSON. No explanations.
"""


class QwenProvider(BaseAIProvider):
    @property
    def provider_name(self) -> str:
        return "qwen"

    async def extract_prescription(
        self, ocr_text: str, image_bytes: Optional[bytes] = None
    ) -> AIExtractionResult:
        from openai import AsyncOpenAI
        settings = get_settings()
        
        # Configure client for local endpoint
        client = AsyncOpenAI(
            base_url=settings.QWEN_BASE_URL,
            api_key="ollama" # api key is often ignored by local endpoints but required by openai client
        )

        start = time.perf_counter()
        try:
            response = await client.chat.completions.create(
                model=settings.QWEN_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": _EXTRACTION_PROMPT.format(ocr_text=ocr_text),
                    }
                ],
                temperature=0.1, # Lower temperature for better JSON generation
                top_p=1,
                response_format={"type": "json_object"},
                max_tokens=8192,
            )

            raw = response.choices[0].message.content or "{}"
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            tokens = response.usage.total_tokens if response.usage else 0

            parsed = json.loads(raw)
            medicines = [
                ExtractedMedicineItem(**{
                    k: v for k, v in m.items()
                    if k in ExtractedMedicineItem.__dataclass_fields__
                })
                for m in parsed.get("medicines", [])
            ]

            return AIExtractionResult(
                medicines=medicines,
                doctor_name=parsed.get("doctor_name"),
                hospital_name=parsed.get("hospital_name"),
                prescription_date=parsed.get("prescription_date"),
                patient_name=parsed.get("patient_name"),
                overall_confidence=parsed.get("overall_confidence", 0.0),
                provider=self.provider_name,
                model=settings.QWEN_MODEL,
                execution_time_ms=elapsed_ms,
                raw_response=raw,
                estimated_tokens=tokens,
            )

        except json.JSONDecodeError as exc:
            raise AIException(f"Qwen returned invalid JSON: {exc}")
        except Exception as exc:
            logger.error("Qwen extraction failed", error=str(exc))
            raise AIException(f"Qwen failed: {exc}")

    async def health_check(self) -> bool:
        try:
            from openai import AsyncOpenAI
            settings = get_settings()
            client = AsyncOpenAI(
                base_url=settings.QWEN_BASE_URL,
                api_key="ollama"
            )
            # List models to verify connection
            await client.models.list()
            return True
        except Exception:
            return False
