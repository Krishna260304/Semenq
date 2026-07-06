
from __future__ import annotations

import asyncio
import io
import time
from typing import Optional

import numpy as np
from PIL import Image

from app.core.exceptions import OCRException
from app.core.logging.logger import get_logger
from app.providers.ocr.base import BaseOCRProvider, OCRResult

logger = get_logger(__name__)

_reader = None  # Lazy-loaded EasyOCR reader


def _get_reader():
    global _reader
    if _reader is None:
        try:
            import easyocr
            _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        except Exception as exc:
            raise OCRException(f"EasyOCR initialization failed: {exc}")
    return _reader


class EasyOCRProvider(BaseOCRProvider):

    @property
    def provider_name(self) -> str:
        return "easyocr"

    async def extract_text(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> OCRResult:
        start = time.perf_counter()
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, self._run_ocr, image_bytes
            )
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            result.execution_time_ms = elapsed_ms
            result.provider = self.provider_name
            return result
        except OCRException:
            raise
        except Exception as exc:
            logger.error("EasyOCR extraction failed", error=str(exc))
            raise OCRException(f"EasyOCR failed: {exc}")

    def _run_ocr(self, image_bytes: bytes) -> OCRResult:
        reader = _get_reader()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(image)

        detections = reader.readtext(img_array, detail=1, paragraph=False)

        lines = []
        boxes = []
        total_confidence = 0.0

        for bbox, text, confidence in detections:
            lines.append(text)
            total_confidence += confidence
            boxes.append({
                "text": text,
                "confidence": round(confidence, 4),
                "bbox": [[int(p[0]), int(p[1])] for p in bbox],
            })

        avg_confidence = (total_confidence / len(detections)) if detections else 0.0
        raw_text = "\n".join(lines)

        return OCRResult(
            raw_text=raw_text,
            confidence=round(avg_confidence, 4),
            bounding_boxes=boxes,
        )

    async def health_check(self) -> bool:
        try:
            _get_reader()
            return True
        except Exception:
            return False
