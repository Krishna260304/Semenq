
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, Optional, Type, TypeVar

from beanie import Document
from pydantic import BaseModel

from app.core.exceptions import NotFoundException
from app.core.logging.logger import get_logger

TDocument = TypeVar("TDocument", bound=Document)

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BaseRepository(Generic[TDocument]):

    def __init__(self, model: Type[TDocument]) -> None:
        self._model = model

    async def get_by_id(self, entity_id: str) -> Optional[TDocument]:
        return await self._model.find_one(
            self._model.id == entity_id,
            self._model.is_deleted == False,  # noqa: E712
        )

    async def get_by_id_or_raise(self, entity_id: str) -> TDocument:
        doc = await self.get_by_id(entity_id)
        if doc is None:
            raise NotFoundException(
                f"{self._model.__name__} with id={entity_id} not found."
            )
        return doc

    async def find_one(self, **filters) -> Optional[TDocument]:
        query = {k: v for k, v in filters.items()}
        return await self._model.find_one(
            query,
            {"is_deleted": False},
        )

    async def find_many(
        self,
        filters: dict | None = None,
        skip: int = 0,
        limit: int = 20,
        sort: list[tuple[str, int]] | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[TDocument], int]:
        query: dict[str, Any] = filters or {}
        if not include_deleted:
            query["is_deleted"] = False

        find_query = self._model.find(query)

        total = await find_query.count()

        if sort:
            find_query = find_query.sort(sort)
        else:
            find_query = find_query.sort([("created_at", -1)])

        items = await find_query.skip(skip).limit(limit).to_list()
        return items, total

    async def create(self, document: TDocument) -> TDocument:
        await document.insert()
        return document

    async def update(self, document: TDocument, updated_by: str | None = None) -> TDocument:
        document.updated_at = _utcnow()
        document.version += 1
        if updated_by:
            document.updated_by = updated_by
        await document.save()
        return document

    async def soft_delete(self, entity_id: str, deleted_by: str | None = None) -> bool:
        doc = await self.get_by_id(entity_id)
        if doc is None:
            return False
        await doc.soft_delete(deleted_by=deleted_by)
        return True

    async def count(self, filters: dict | None = None, include_deleted: bool = False) -> int:
        query: dict[str, Any] = filters or {}
        if not include_deleted:
            query["is_deleted"] = False
        return await self._model.find(query).count()

    async def exists(self, **filters) -> bool:
        query = dict(filters) | {"is_deleted": False}
        return bool(await self._model.find_one(query))
