
from __future__ import annotations

import asyncio
import io
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class UploadResult:
    public_id: str
    url: str
    secure_url: str
    width: int
    height: int
    format: str
    bytes: int
    resource_type: str = "image"
    thumbnail_url: Optional[str] = None


class BaseStorageProvider(ABC):
    @abstractmethod
    async def upload(
        self, file_bytes: bytes, folder: str, public_id: Optional[str] = None,
        resource_type: str = "image"
    ) -> UploadResult:
        ...

    @abstractmethod
    async def delete(self, public_id: str, resource_type: str = "image") -> bool:
        ...

    @abstractmethod
    async def get_url(self, public_id: str, transformations: dict | None = None) -> str:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class CloudinaryProvider(BaseStorageProvider):

    def __init__(self) -> None:
        from app.core.config import get_settings
        import cloudinary
        settings = get_settings()
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

    async def upload(
        self,
        file_bytes: bytes,
        folder: str,
        public_id: Optional[str] = None,
        resource_type: str = "image",
    ) -> UploadResult:
        import cloudinary.uploader

        def _upload():
            return cloudinary.uploader.upload(
                file_bytes,
                folder=folder,
                public_id=public_id,
                resource_type=resource_type,
                overwrite=True,
                quality="auto",
                fetch_format="auto",
            )

        result = await asyncio.get_event_loop().run_in_executor(None, _upload)
        thumbnail_url = self._build_thumbnail_url(result["public_id"]) if resource_type == "image" else None

        return UploadResult(
            public_id=result["public_id"],
            url=result["url"],
            secure_url=result["secure_url"],
            width=result.get("width", 0),
            height=result.get("height", 0),
            format=result.get("format", ""),
            bytes=result.get("bytes", 0),
            resource_type=resource_type,
            thumbnail_url=thumbnail_url,
        )

    async def delete(self, public_id: str, resource_type: str = "image") -> bool:
        import cloudinary.uploader

        def _delete():
            return cloudinary.uploader.destroy(public_id, resource_type=resource_type)

        result = await asyncio.get_event_loop().run_in_executor(None, _delete)
        return result.get("result") == "ok"

    async def get_url(self, public_id: str, transformations: dict | None = None) -> str:
        import cloudinary
        return cloudinary.CloudinaryImage(public_id).build_url(**(transformations or {}))

    async def health_check(self) -> bool:
        try:
            import cloudinary.api
            def _ping():
                cloudinary.api.ping()
            await asyncio.get_event_loop().run_in_executor(None, _ping)
            return True
        except Exception:
            return False

    @staticmethod
    def _build_thumbnail_url(public_id: str) -> str:
        import cloudinary
        return cloudinary.CloudinaryImage(public_id).build_url(
            width=200, height=200, crop="fill", quality="auto", format="webp"
        )
