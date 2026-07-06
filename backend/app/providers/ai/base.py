
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ExtractedMedicineItem:
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


@dataclass
class AIExtractionResult:
    medicines: list[ExtractedMedicineItem] = field(default_factory=list)
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    prescription_date: Optional[str] = None
    patient_name: Optional[str] = None
    overall_confidence: float = 0.0
    provider: str = "unknown"
    model: str = ""
    execution_time_ms: int = 0
    raw_response: str = ""
    estimated_tokens: int = 0


class BaseAIProvider(ABC):

    @abstractmethod
    async def extract_prescription(self, ocr_text: str, image_bytes: Optional[bytes] = None) -> AIExtractionResult:
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...
