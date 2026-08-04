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


def _install_modelscope_shim() -> None:
    """Install a tiny ModelScope shim that delegates to Hugging Face.

    PaddleX may import `modelscope.snapshot_download` even when Hugging Face is
    configured as the model source. Importing the full ModelScope package pulls
    in Torch, which can collide with Paddle DLLs in this process. The shim
    preserves compatibility without importing Torch.
    """

    if "modelscope" in sys.modules:
        return

    modelscope = types.ModuleType("modelscope")

    def snapshot_download(repo_id: str, *args: Any, **kwargs: Any) -> str:
        from huggingface_hub import snapshot_download as hf_snapshot_download

        revision = kwargs.get("revision")
        cache_dir = kwargs.get("cache_dir")
        local_dir = kwargs.get("local_dir")
        local_dir_use_symlinks = kwargs.get("local_dir_use_symlinks", False)
        return hf_snapshot_download(
            repo_id=repo_id,
            revision=revision,
            cache_dir=cache_dir,
            local_dir=local_dir,
            local_dir_use_symlinks=local_dir_use_symlinks,
        )

    modelscope.snapshot_download = snapshot_download  # type: ignore[attr-defined]
    sys.modules["modelscope"] = modelscope


def _reader() -> tuple[Any, str, str]:
    _configure_cache()
    _install_modelscope_shim()

    # PaddleOCR writes model/cache messages to stdout. Keep stdout reserved
    # for the JSON protocol used by the parent process.
    with redirect_stdout(sys.stderr):
        import paddle
        from paddleocr import PaddleOCR, PaddleOCRVL

        # VL is more capable than the line OCR pipeline for prescriptions: it
        # understands document layout before reading the text.  Prefer CUDA but
        # retain a CPU fallback so an unavailable GPU does not take scanning
        # down completely.
        requested_device = os.environ.get("SEMENQ_OCR_DEVICE", "auto").lower()
        if requested_device == "cuda" and not paddle.device.is_compiled_with_cuda():
            raise RuntimeError("CUDA was explicitly requested but this Paddle runtime is not CUDA-capable.")

        use_gpu = requested_device != "cpu" and paddle.device.is_compiled_with_cuda()
        device = "gpu:0" if use_gpu else "cpu"
        try:
            paddle.device.set_device(device)
        except Exception:
            if requested_device == "cuda":
                raise RuntimeError("CUDA was explicitly requested but GPU device initialization failed.")
            # A CUDA-enabled wheel can be installed on a machine without a
            # usable driver. Fall back to CPU for auto mode.
            device = "cpu"
            paddle.device.set_device(device)

        require_vl = os.environ.get("SEMENQ_OCR_REQUIRE_VL", "1").lower() not in {"0", "false", "no", "off"}

        # Primary path: PaddleOCR-VL 1.6 from Hugging Face collection.
        try:
            return PaddleOCRVL(pipeline_version="v1.6", device=device), "paddleocr-vl-1.6", device
        except Exception as exc:
            if require_vl:
                raise RuntimeError(f"PaddleOCRVL initialization failed: {exc}") from exc
            # Some environments miss VL dependencies. Keep OCR within the
            # Paddle stack by falling back to the classic line OCR pipeline.
            # Medicine packaging is predominantly Latin-script even in
            # multilingual markets.  Keep this configurable for deployments
            # that need a regional OCR model instead of silently using the
            # library default language.
            language = os.environ.get("SEMENQ_OCR_LANG", "en")
            return PaddleOCR(use_angle_cls=True, lang=language, device=device), "paddleocr-classic", device


def _parse(reader: Any, image_bytes: bytes) -> dict[str, Any]:
    import numpy as np
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    try:
        # Current PaddleOCR pipelines return an iterator; materialize it once
        # so structured VL pages are handled instead of being treated as a
        # single opaque generator object.
        detections = list(reader.predict(np.array(image)))
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
        # Pipeline result objects expose JSON through a method in PaddleOCR 3.x.
        # Normalize that shape while retaining compatibility with dict results.
        if not isinstance(page, dict):
            json_value = getattr(page, "json", None)
            try:
                page = json_value() if callable(json_value) else json_value
                if isinstance(page, str):
                    page = json.loads(page)
            except Exception:
                page = None
        if not isinstance(page, dict):
            continue
        if isinstance(page.get("res"), dict):
            page = page["res"]
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

        # PaddleOCR-VL document results expose structured parsing blocks.  Keep
        # their reading order and use the Markdown/text payload when geometry
        # is not applicable (for example, a table or a handwritten line).
        try:
            blocks = page.get("parsing_res_list", [])
        except AttributeError:
            blocks = []
        for block in blocks:
            if not isinstance(block, dict):
                continue
            text = str(block.get("markdown") or block.get("text") or "").strip()
            if text:
                entries.append((len(entries), 0, [], text, 1.0))

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
        reader, engine_name, device = _reader()
    except Exception as exc:
        sys.stdout.write(json.dumps({"ready": False, "error": f"{type(exc).__name__}: {exc}"}) + "\n")
        sys.stdout.flush()
        return

    sys.stdout.write(json.dumps({"ready": True, "engine": engine_name, "device": device}) + "\n")
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
