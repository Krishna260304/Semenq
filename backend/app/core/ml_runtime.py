"""Shared runtime helpers for local GPU-backed models.

PaddlePaddle and PyTorch may ship different CUDA/cuDNN builds.  On Windows,
loading both runtimes in the same process can fail with WinError 127 because
their DLLs have identical names but incompatible exports.  PaddleOCR is
therefore run in its own process; this module owns the PyTorch side of device
selection and keeps the policy consistent for every Torch model.
"""

from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings


def configure_model_cache() -> None:
    """Point Hugging Face/Transformers caches at a writable user directory."""

    # Prefer a cache owned by this application. Existing files in the Windows
    # temp directory may have ACLs from a previous process or installation.
    cache_roots = [Path(__file__).resolve().parents[2] / ".runtime"]
    temp_root = Path(tempfile.gettempdir())
    if temp_root not in cache_roots:
        cache_roots.append(temp_root)
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data and Path(local_app_data) not in cache_roots:
        cache_roots.append(Path(local_app_data))
    for root in cache_roots:
        probe: Path | None = None
        try:
            cache = root / "Semenq" / "huggingface"
            cache.mkdir(parents=True, exist_ok=True)
            probe = cache / ".write-probe"
            with probe.open("w", encoding="utf-8") as handle:
                handle.write("ok")
            probe.unlink()
            os.environ["HF_HOME"] = str(cache)
            os.environ["HF_HUB_CACHE"] = str(cache / "hub")
            os.environ["TRANSFORMERS_CACHE"] = str(cache / "transformers")
            return
        except OSError:
            if probe is not None:
                try:
                    probe.unlink(missing_ok=True)
                except OSError:
                    pass
            continue
    raise OSError("No writable directory is available for local model caches.")


@lru_cache(maxsize=1)
def get_torch_device() -> str:
    """Return the configured Torch device and fail clearly when CUDA is absent."""

    configure_model_cache()
    import torch

    requested = get_settings().ML_DEVICE
    if requested == "cpu":
        return "cpu"

    cuda_available = torch.cuda.is_available()
    if requested == "cuda" and not cuda_available:
        raise RuntimeError(
            "ML_DEVICE=cuda, but PyTorch cannot access CUDA. "
            "Check the NVIDIA driver and install a CUDA-enabled PyTorch build."
        )
    return "cuda:0" if cuda_available else "cpu"


def get_configured_device_name() -> str:
    """Return a lightweight device label without importing either ML runtime."""

    return get_settings().ML_DEVICE
