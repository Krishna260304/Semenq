"""
Semenq — Local Storage Provider
"""
from __future__ import annotations

import os
import uuid
import asyncio
from pathlib import Path
from typing import Optional

from app.providers.storage.cloudinary_provider import BaseStorageProvider, UploadResult
from app.core.config import get_settings

class LocalStorageProvider(BaseStorageProvider):
    def __init__(self):
        self.upload_dir = Path("uploads")
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.settings = get_settings()
        self.base_url = f"http://localhost:{self.settings.PORT}/static"

    async def upload(
        self,
        file_bytes: bytes,
        folder: str,
        public_id: Optional[str] = None,
        resource_type: str = "image",
    ) -> UploadResult:
        if not public_id:
            public_id = str(uuid.uuid4())
            
        file_name = f"{public_id}.jpg"
        
        target_dir = self.upload_dir / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = target_dir / file_name
        
        def _write():
            with open(file_path, "wb") as f:
                f.write(file_bytes)
                
        await asyncio.get_event_loop().run_in_executor(None, _write)
        
        url = f"{self.base_url}/{folder}/{file_name}"
        
        return UploadResult(
            public_id=f"{folder}/{public_id}",
            url=url,
            secure_url=url,
            width=0,
            height=0,
            format="jpg",
            bytes=len(file_bytes),
            resource_type=resource_type,
            thumbnail_url=url,
        )

    async def delete(self, public_id: str, resource_type: str = "image") -> bool:
        file_path = self.upload_dir / f"{public_id}.jpg"
        if file_path.exists():
            file_path.unlink()
            return True
        return False

    async def get_url(self, public_id: str, transformations: dict | None = None) -> str:
        return f"{self.base_url}/{public_id}.jpg"

    async def health_check(self) -> bool:
        return self.upload_dir.exists()
