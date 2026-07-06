
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class OCRResult:
    raw_text: str
    confidence: float
    language: str = "en"
    bounding_boxes: list[dict] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    prescription_date: Optional[str] = None
    patient_name: Optional[str] = None
    provider: str = "unknown"
    execution_time_ms: int = 0

    def __post_init__(self):
        if self.bounding_boxes is None:
            self.bounding_boxes = []


class BaseOCRProvider(ABC):

    @abstractmethod
    async def extract_text(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> OCRResult:
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...
