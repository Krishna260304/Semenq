from __future__ import annotations

import asyncio
import io
import time
from typing import Any

import numpy as np
from PIL import Image

from app.core.exceptions import OCRException
from app.core.logging.logger import get_logger
from app.providers.ocr.base import BaseOCRProvider, OCRResult

logger = get_logger(__name__)
_reader = None  # Lazy-loaded PaddleOCR reader


def _get_reader() -> Any:
    global _reader
    if _reader is None:
        try:
            from paddleocr import PaddleOCR

            _reader = PaddleOCR(lang="en", use_angle_cls=True, enable_mkldnn=False, use_gpu=False, show_log=False)
        except Exception as exc:
            raise OCRException(f"PaddleOCR initialization failed: {exc}")
    return _reader


class PaddleOCRProvider(BaseOCRProvider):
    @property
    def provider_name(self) -> str:
        return "paddleocr"

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
            logger.error("PaddleOCR extraction failed", error=str(exc))
            raise OCRException(f"PaddleOCR failed: {exc}")

    def _run_ocr(self, image_bytes: bytes) -> OCRResult:
        reader = _get_reader()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(image)

        detections = reader.ocr(img_array, cls=True)

        lines = []
        boxes = []
        total_confidence = 0.0

        for result in detections:
            if not result:
                continue

            if len(result) == 2 and isinstance(result[1], (list, tuple)):
                bbox, text_info = result
            else:
                continue

            text = str(text_info[0]) if len(text_info) > 0 else ""
            confidence = float(text_info[1]) if len(text_info) > 1 else 0.0

            lines.append(text)
            total_confidence += confidence
            boxes.append({
                "text": text,
                "confidence": round(confidence, 4),
                "bbox": [[int(point[0]), int(point[1])] for point in bbox],
            })

        avg_confidence = (total_confidence / len(boxes)) if boxes else 0.0
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
