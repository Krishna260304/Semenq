
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import UUID, uuid4

from beanie import Document
from pydantic import Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BaseDocument(Document):

    id: str = Field(default_factory=lambda: str(uuid4()))

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    created_by: Optional[str] = None   # User ID of creator
    updated_by: Optional[str] = None   # User ID of last modifier

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None

    version: int = Field(default=1)

    class Settings:
        use_state_management = True
        validate_on_save = True

    async def soft_delete(self, deleted_by: str | None = None) -> None:
        self.is_deleted = True
        self.deleted_at = _utcnow()
        self.deleted_by = deleted_by
        self.updated_at = _utcnow()
        self.version += 1
        await self.save()

    async def touch(self, updated_by: str | None = None) -> None:
        self.updated_at = _utcnow()
        self.updated_by = updated_by
        self.version += 1
        await self.save()

    @classmethod
    def now(cls) -> datetime:
        return _utcnow()
