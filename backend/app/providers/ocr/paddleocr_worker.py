"""Standalone PaddleOCR worker.

This module is launched with ``python -m`` so PaddlePaddle's CUDA/cuDNN DLLs
never share a process with PyTorch.  Communication is one JSON request per
line on stdin and one JSON response per line on stdout.
"""

from __future__ import annotations

import base64
import io
import json
import os
import sys
import tempfile
import types
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any


def _configure_cache() -> None:
    # A worker-specific cache prevents PaddleX from reusing model files that
    # were created by another Windows identity (for example, an elevated
    # installer or a sandboxed development process). Such files can look
    # readable but still raise PermissionError when the API user opens them.
    fresh_root = Path(tempfile.mkdtemp(prefix=f"Semenq-paddleocr-{os.getpid()}-", dir=tempfile.gettempdir()))
    runtime_root = Path(__file__).resolve().parents[3] / ".runtime"
    cache_candidates = [fresh_root / "paddleocr", runtime_root / "Semenq" / "paddleocr"]
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        cache_candidates.append(Path(local_app_data) / "Semenq" / "paddleocr")

    for cache in cache_candidates:
        probe: Path | None = None
        try:
            base = cache.parent
            mpl = base / "matplotlib"
            home = base / "runtime-home"
            cache.mkdir(parents=True, exist_ok=True)
            mpl.mkdir(parents=True, exist_ok=True)
            home.mkdir(parents=True, exist_ok=True)

            # mkdir() alone does not prove that PaddleOCR can create model
            # files. Probe the actual cache before selecting this root.
            probe = cache / ".write-probe"
            with probe.open("w", encoding="utf-8") as handle:
                handle.write("ok")
            probe.unlink()

            os.environ.update(
                {
                    "PADDLE_PDX_CACHE_HOME": str(cache),
                    "PADDLE_PDX_MODEL_SOURCE": "huggingface",
                    "PADDLE_HOME": str(home / "paddle"),
                    "MPLCONFIGDIR": str(mpl),
                    "XDG_CACHE_HOME": str(home / ".cache"),
                    "USERPROFILE": str(home),
                    "HOME": str(home),
                }
            )
            return
        except OSError:
            if probe is not None:
                try:
                    probe.unlink(missing_ok=True)
                except OSError:
                    pass
            continue
    raise OSError("No writable directory is available for the PaddleOCR model cache.")


def _prevent_modelscope_from_loading_torch() -> None:
    """Avoid PaddleX importing PyTorch through its optional ModelScope client.

    PaddleX imports ModelScope at module import time even when Hugging Face is
    the selected model source.  ModelScope imports PyTorch, which is precisely
    the DLL collision this worker is designed to avoid.
    """

    if "modelscope" in sys.modules or "torch" in sys.modules:
        return
    modelscope = types.ModuleType("modelscope")

    def unavailable(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("ModelScope is disabled; use the configured Hugging Face model source.")

    modelscope.snapshot_download = unavailable  # type: ignore[attr-defined]
    sys.modules["modelscope"] = modelscope


def _reader() -> Any:
    _configure_cache()
    _prevent_modelscope_from_loading_torch()

    # PaddleOCR writes model/cache messages to stdout. Keep stdout reserved
    # for the JSON protocol used by the parent process.
    with redirect_stdout(sys.stderr):
        import paddle
        from paddleocr import PaddleOCR

        if not paddle.device.is_compiled_with_cuda():
            raise RuntimeError("PaddlePaddle was installed without CUDA support.")
        paddle.device.set_device("gpu:0")
        return PaddleOCR(
            lang="en",
            device="gpu:0",
            enable_mkldnn=False,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )


def _parse(reader: Any, image_bytes: bytes) -> dict[str, Any]:
    import numpy as np
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    try:
        detections = reader.predict(np.array(image))
    except AttributeError:
        # Compatibility with older PaddleOCR releases.
        try:
            detections = reader.ocr(np.array(image), cls=True)
        except TypeError:
            detections = reader.ocr(np.array(image))

    entries: list[tuple[int, int, list[list[int]], str, float]] = []

    def add_detection(item: Any) -> None:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            return
        bbox, text_info = item
        if not isinstance(text_info, (list, tuple)) or len(text_info) < 2:
            return
        if not isinstance(text_info[0], str):
            return
        try:
            points = [[int(point[0]), int(point[1])] for point in bbox]
            confidence = float(text_info[1])
        except (TypeError, ValueError, IndexError):
            return
        text = text_info[0].strip()
        if len(points) >= 4 and text:
            entries.append((min(point[1] for point in points), min(point[0] for point in points), points, text, confidence))

    def walk(items: Any) -> None:
        if not isinstance(items, (list, tuple)):
            return
        if len(items) == 2:
            before = len(entries)
            add_detection(items)
            if len(entries) != before:
                return
        for child in items:
            walk(child)

    walk(detections)
    pages = detections if isinstance(detections, (list, tuple)) else [detections]
    for page in pages:
        try:
            texts = page["rec_texts"]
            scores = page["rec_scores"]
            polygons = page.get("dt_polys", [])
        except (TypeError, KeyError, AttributeError):
            continue
        for index, text in enumerate(texts):
            if index >= len(scores):
                break
            points = polygons[index].tolist() if index < len(polygons) and hasattr(polygons[index], "tolist") else polygons[index] if index < len(polygons) else []
            if not text or len(points) < 4:
                continue
            try:
                bbox = [[int(point[0]), int(point[1])] for point in points]
                confidence = float(scores[index])
            except (TypeError, ValueError, IndexError):
                continue
            entries.append((min(point[1] for point in bbox), min(point[0] for point in bbox), bbox, str(text).strip(), confidence))

    entries.sort(key=lambda item: (item[0], item[1]))
    boxes = [
        {"text": text, "confidence": round(confidence, 4), "bbox": points}
        for _, _, points, text, confidence in entries
    ]
    return {
        "raw_text": "\n".join(item["text"] for item in boxes),
        "confidence": round(sum(item["confidence"] for item in boxes) / len(boxes), 4) if boxes else 0.0,
        "bounding_boxes": boxes,
    }


def main() -> None:
    try:
        reader = _reader()
    except Exception as exc:
        sys.stdout.write(json.dumps({"ready": False, "error": f"{type(exc).__name__}: {exc}"}) + "\n")
        sys.stdout.flush()
        return

    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
            image_bytes = base64.b64decode(request["image"])
            response = {"ok": True, "result": _parse(reader, image_bytes)}
        except Exception as exc:  # the parent turns this into OCRException
            response = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
