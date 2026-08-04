from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import OCRException
from app.core.logging.logger import get_logger
from app.providers.ocr.base import BaseOCRProvider, OCRResult

logger = get_logger(__name__)
_worker: subprocess.Popen[str] | None = None
_worker_ready = False
_worker_lock = threading.Lock()
_worker_engine = "unknown"
_worker_device = "unknown"
_rapidocr_engine: Any | None = None
_rapidocr_lock = threading.Lock()


def _stop_worker() -> None:
    global _worker, _worker_ready, _worker_engine, _worker_device
    if _worker is None:
        return
    _worker.terminate()
    try:
        _worker.wait(timeout=3)
    except subprocess.TimeoutExpired:
        _worker.kill()
    _worker = None
    _worker_ready = False
    _worker_engine = "unknown"
    _worker_device = "unknown"


def _get_worker() -> subprocess.Popen[str]:
    global _worker, _worker_ready, _worker_engine, _worker_device
    if _worker is not None and _worker.poll() is None and _worker_ready:
        return _worker

    _stop_worker()

    backend_root = Path(__file__).resolve().parents[3]
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    worker_env = os.environ.copy()
    worker_env.setdefault("SEMENQ_OCR_DEVICE", get_settings().ML_DEVICE)
    _worker = subprocess.Popen(
        [sys.executable, "-m", "app.providers.ocr.paddleocr_worker"],
        cwd=backend_root,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
        bufsize=1,
        creationflags=creation_flags,
        env=worker_env,
    )
    if _worker.stdout is None:
        _stop_worker()
        raise OCRException("PaddleOCR GPU worker did not provide a startup pipe.")
    startup_line = _worker.stdout.readline()
    if not startup_line:
        _stop_worker()
        raise OCRException("PaddleOCR GPU worker exited during startup.")
    try:
        startup = json.loads(startup_line)
    except json.JSONDecodeError as exc:
        _stop_worker()
        raise OCRException("PaddleOCR GPU worker returned an invalid startup response.") from exc
    if not startup.get("ready"):
        error = startup.get("error", "unknown startup error")
        _stop_worker()
        raise OCRException(f"PaddleOCR GPU worker startup failed: {error}")
    _worker_engine = str(startup.get("engine") or "unknown")
    _worker_device = str(startup.get("device") or "unknown")
    logger.info("PaddleOCR worker ready", engine=_worker_engine, device=_worker_device)
    _worker_ready = True
    return _worker


def _get_rapidocr_engine() -> Any:
    global _rapidocr_engine
    if _rapidocr_engine is not None:
        return _rapidocr_engine

    with _rapidocr_lock:
        if _rapidocr_engine is not None:
            return _rapidocr_engine
        try:
            from rapidocr_onnxruntime import RapidOCR
        except Exception as exc:
            raise OCRException(
                "RapidOCR fallback is unavailable. Install `rapidocr-onnxruntime` to enable CPU fallback."
            ) from exc
        _rapidocr_engine = RapidOCR()
        return _rapidocr_engine


class PaddleOCRProvider(BaseOCRProvider):
    @property
    def provider_name(self) -> str:
        return "paddleocr-vl-1.6"

    async def extract_text(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> OCRResult:
        del mime_type
        start = time.perf_counter()
        try:
            result = await asyncio.get_event_loop().run_in_executor(None, self._run_ocr, image_bytes)
            result.execution_time_ms = int((time.perf_counter() - start) * 1000)
            result.provider = _worker_engine if _worker_engine != "unknown" else self.provider_name
            return result
        except Exception as exc:
            # CUDA/Paddle is an acceleration path, not a prerequisite for
            # scanning.  A machine/container without a CUDA-capable Paddle
            # build must still be able to read a medicine package with the
            # installed CPU engine.
            if get_settings().ML_DEVICE == "cuda":
                logger.warning("PaddleOCR CUDA unavailable; falling back to CPU OCR", error=str(exc))
            else:
                logger.warning("PaddleOCR unavailable; attempting RapidOCR fallback", error=str(exc))
            try:
                fallback_result = await asyncio.get_event_loop().run_in_executor(None, self._run_rapidocr, image_bytes)
            except Exception as fallback_exc:
                raise OCRException(
                    f"OCR failed in PaddleOCR and CPU fallback: {fallback_exc}"
                ) from fallback_exc
            fallback_result.execution_time_ms = int((time.perf_counter() - start) * 1000)
            fallback_result.provider = "rapidocr-onnxruntime"
            return fallback_result
    def _run_ocr(self, image_bytes: bytes) -> OCRResult:
        with _worker_lock:
            request = {"image": base64.b64encode(image_bytes).decode("ascii")}
            for attempt in range(2):
                worker = _get_worker()
                if worker.stdin is None or worker.stdout is None:
                    _stop_worker()
                    raise OCRException("PaddleOCR GPU worker could not open its communication pipes.")
                try:
                    worker.stdin.write(json.dumps(request) + "\n")
                    worker.stdin.flush()
                    line = worker.stdout.readline()
                    if not line:
                        raise BrokenPipeError("worker exited before returning a result")
                    payload = json.loads(line)
                    break
                except (BrokenPipeError, OSError, json.JSONDecodeError) as exc:
                    _stop_worker()
                    if attempt == 1:
                        raise OCRException(f"PaddleOCR worker communication failed: {exc}") from exc

        if not payload.get("ok"):
            raise OCRException(payload.get("error", "PaddleOCR GPU worker failed."))
        return OCRResult(**payload["result"])

    def _run_rapidocr(self, image_bytes: bytes) -> OCRResult:
        import io

        import cv2
        import numpy as np
        from PIL import Image

        engine = _get_rapidocr_engine()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        base = np.array(image)
        gray = cv2.cvtColor(base, cv2.COLOR_RGB2GRAY)
        # Small phone photos lose thin characters (decimal strengths, dosage
        # units, and brand suffixes). Upscale before recognition while keeping
        # the original image as a separate pass for layout fidelity.
        height, width = gray.shape[:2]
        scale = 2.0 if max(height, width) < 1800 else 1.0
        enlarged = cv2.resize(base, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC) if scale > 1 else base
        enlarged_gray = cv2.cvtColor(enlarged, cv2.COLOR_RGB2GRAY)
        variants = [
            base,
            cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB),
            cv2.cvtColor(cv2.equalizeHist(gray), cv2.COLOR_GRAY2RGB),
            cv2.cvtColor(
                cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 7),
                cv2.COLOR_GRAY2RGB,
            ),
            enlarged,
            cv2.cvtColor(cv2.equalizeHist(enlarged_gray), cv2.COLOR_GRAY2RGB),
        ]

        # Do not select only the single highest-scoring pass: a thresholded
        # pass may read the small dosage while the colour pass reads the brand.
        # Merge the strongest observation for each text fragment instead.
        merged: list[tuple[Any, str, float]] = []
        for variant in variants:
            detections, _ = engine(variant)
            if not detections:
                continue
            for det in detections:
                if isinstance(det, (list, tuple)) and len(det) >= 3:
                    try:
                        confidence = float(det[2])
                    except (TypeError, ValueError):
                        continue
                    text = str(det[1]).strip()
                    if text and confidence >= 0.2:
                        merged.append((det[0], text, confidence))

        detections: list[tuple[Any, str, float]] = []
        for points, text, confidence in merged:
            key = re.sub(r"[^a-z0-9]+", "", text.lower())
            duplicate = next((index for index, item in enumerate(detections)
                              if re.sub(r"[^a-z0-9]+", "", item[1].lower()) == key), None)
            if duplicate is None:
                detections.append((points, text, confidence))
            elif confidence > detections[duplicate][2]:
                detections[duplicate] = (points, text, confidence)

        detections.sort(key=lambda det: (
            min((point[1] for point in det[0]), default=0) if isinstance(det[0], (list, tuple)) else 0,
            min((point[0] for point in det[0]), default=0) if isinstance(det[0], (list, tuple)) else 0,
        ))
        boxes: list[dict] = []
        if detections:
            for det in detections:
                if not isinstance(det, (list, tuple)) or len(det) < 3:
                    continue
                points, text, confidence = det[0], det[1], det[2]
                if not text:
                    continue
                try:
                    bbox = [[int(point[0]), int(point[1])] for point in points]
                    score = float(confidence)
                except (TypeError, ValueError, IndexError):
                    continue
                boxes.append({"text": str(text).strip(), "confidence": round(score, 4), "bbox": bbox})

        raw_text = "\n".join(item["text"] for item in boxes)
        confidence = round(sum(item["confidence"] for item in boxes) / len(boxes), 4) if boxes else 0.0
        return OCRResult(
            raw_text=raw_text,
            confidence=confidence,
            provider="rapidocr-onnxruntime",
            bounding_boxes=boxes,
            execution_time_ms=0,
        )

    async def health_check(self) -> bool:
        # Starting the worker validates PaddlePaddle's CUDA runtime without
        # importing it into the API process.
        try:
            with _worker_lock:
                _get_worker()
            return True
        except Exception:
            return False
