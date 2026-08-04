from types import SimpleNamespace

from app.providers.ocr.base import OCRResult
from app.providers.ocr.paddleocr_provider import PaddleOCRProvider
from app.services.medicine_matching import rank_medicines_for_queries, score_medicine_against_query
from app.services.prescription_service import PrescriptionService


def _medicine(name: str, composition: str = "Paracetamol 650mg") -> SimpleNamespace:
    return SimpleNamespace(
        name=name,
        brand_name=None,
        generic_name="Paracetamol",
        composition=composition,
        manufacturer="",
        strength="650mg",
        category_name="",
        search_keywords=[],
    )


def test_explicit_dolo_650_outranks_same_composition_brand() -> None:
    dolo = _medicine("Dolo 650 Tablet")
    extramol = _medicine("Extramol 650mg Tablet")

    ranked = rank_medicines_for_queries(
        ["Dolo-650", "Paracetamol Tablets IP 650mg"],
        [extramol, dolo],
    )

    assert ranked[0].medicine.name == "Dolo 650 Tablet"
    assert ranked[0].match_type == "exact"
    assert next(item for item in ranked if item.medicine is extramol).score <= 0.49


def test_exact_generic_composition_is_not_reported_as_exact_product() -> None:
    extramol = _medicine("Extramol 650mg Tablet")

    _, match_type, _ = score_medicine_against_query("Paracetamol 650mg", extramol)

    assert match_type == "generic"


def test_fast_extractor_preserves_visible_dolo_650_brand() -> None:
    service = PrescriptionService.__new__(PrescriptionService)

    result = service._extract_medicines_fast(
        "Dolo-650\nParacetamol Tablets IP\nEach uncoated tablet contains Paracetamol 650 mg"
    )

    assert result is not None
    assert [item.medicine_name for item in result.medicines] == ["Dolo-650"]


def test_fast_extractor_keeps_multiple_medicines_and_formats() -> None:
    service = PrescriptionService.__new__(PrescriptionService)

    result = service._extract_medicines_fast(
        "Amoxicillin 500 mg Capsule\n"
        "Metformin 500mg Tablet\n"
        "Hydrochlorothiazide 25 mg tablet"
    )

    assert result is not None
    assert [item.medicine_name for item in result.medicines] == [
        "Amoxicillin 500 mg",
        "Metformin 500mg",
        "Hydrochlorothiazide 25 mg",
    ]


async def test_ocr_uses_cpu_fallback_when_paddle_worker_fails(monkeypatch) -> None:
    provider = PaddleOCRProvider()
    expected = OCRResult(
        raw_text="Dolo-650",
        confidence=0.91,
        provider="rapidocr-onnxruntime",
        bounding_boxes=[],
        execution_time_ms=0,
    )

    def fail(_image: bytes):
        from app.core.exceptions import OCRException

        raise OCRException("CUDA unavailable")

    monkeypatch.setattr(provider, "_run_ocr", fail)
    monkeypatch.setattr(provider, "_run_rapidocr", lambda _image: expected)

    result = await provider.extract_text(b"image")

    assert result.raw_text == "Dolo-650"
    assert result.provider == "rapidocr-onnxruntime"
