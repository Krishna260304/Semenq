from __future__ import annotations

import asyncio
import base64
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

from app.core.exceptions import OCRException
from app.core.logging.logger import get_logger
from app.providers.ocr.base import BaseOCRProvider, OCRResult

logger = get_logger(__name__)
_worker: subprocess.Popen[str] | None = None
_worker_ready = False
_worker_lock = threading.Lock()


def _stop_worker() -> None:
    global _worker, _worker_ready
    if _worker is None:
        return
    _worker.terminate()
    try:
        _worker.wait(timeout=3)
    except subprocess.TimeoutExpired:
        _worker.kill()
    _worker = None
    _worker_ready = False


def _get_worker() -> subprocess.Popen[str]:
    global _worker, _worker_ready
    if _worker is not None and _worker.poll() is None and _worker_ready:
        return _worker

    _stop_worker()

    backend_root = Path(__file__).resolve().parents[3]
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    _worker = subprocess.Popen(
        [sys.executable, "-m", "app.providers.ocr.paddleocr_worker"],
        cwd=backend_root,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=None,
        text=True,
        bufsize=1,
        creationflags=creation_flags,
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
    _worker_ready = True
    return _worker


class PaddleOCRProvider(BaseOCRProvider):
    @property
    def provider_name(self) -> str:
        return "paddleocr"

    async def extract_text(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> OCRResult:
        del mime_type
        start = time.perf_counter()
        try:
            result = await asyncio.get_event_loop().run_in_executor(None, self._run_ocr, image_bytes)
            result.execution_time_ms = int((time.perf_counter() - start) * 1000)
            result.provider = self.provider_name
            return result
        except OCRException:
            raise
        except Exception as exc:
            logger.error("PaddleOCR extraction failed", error=str(exc))
            raise OCRException(f"PaddleOCR failed: {exc}") from exc

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

    async def health_check(self) -> bool:
        # Starting the worker validates PaddlePaddle's CUDA runtime without
        # importing it into the API process.
        try:
            with _worker_lock:
                _get_worker()
            return True
        except Exception:
            return False
