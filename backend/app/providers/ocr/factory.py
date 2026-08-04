from __future__ import annotations

import importlib.util

from app.core.exceptions import OCRException
from app.core.logging.logger import get_logger
from app.providers.ocr.paddleocr_provider import PaddleOCRProvider

logger = get_logger(__name__)


def _is_provider_available(provider: str) -> bool:
    return provider.lower() == "paddleocr" and importlib.util.find_spec("paddleocr") is not None


def _build_provider(provider: str):
    provider = provider.lower()
    if provider == "paddleocr":
        return PaddleOCRProvider()
    raise ValueError(f"Unsupported OCR provider: {provider}")


def _candidate_providers(preferred: str | None = None, exclude: str | None = None) -> list[str]:
    del preferred, exclude
    return ["paddleocr"]


def get_ocr_provider(provider_name: str | None = None):
    del provider_name

    provider = "paddleocr"
    try:
        # PaddleOCRProvider owns a CPU RapidOCR fallback, so do not reject the
        # provider here just because PaddleOCR is absent or cannot load CUDA.
        # The provider will report a useful error only if both engines fail.
        return _build_provider(provider)
    except OCRException as exc:
        logger.error("Failed to initialize PaddleOCR provider", error=str(exc))
        raise


def get_fallback_ocr_provider(exclude: str | None = None):
    del exclude
    return get_ocr_provider()


def get_fast_ocr_provider():
    return get_ocr_provider()
