
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, TypeVar
from uuid import uuid4

from pydantic import BaseModel, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):

    success: bool = True
    message: str
    data: T | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    request_id: str = Field(default_factory=lambda: str(uuid4()))

    @classmethod
    def ok(
        cls,
        data: Any = None,
        message: str = "Success",
        request_id: str | None = None,
    ) -> "APIResponse":
        instance = cls(message=message, data=data)
        if request_id:
            instance.request_id = request_id
        return instance


class APIErrorResponse(BaseModel):

    success: bool = False
    message: str
    error_code: str
    details: Any | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    request_id: str = Field(default_factory=lambda: str(uuid4()))

    @classmethod
    def error(
        cls,
        message: str,
        error_code: str,
        details: Any = None,
        request_id: str | None = None,
    ) -> "APIErrorResponse":
        instance = cls(message=message, error_code=error_code, details=details)
        if request_id:
            instance.request_id = request_id
        return instance


class PaginatedResponse(BaseModel, Generic[T]):

    success: bool = True
    message: str = "Success"
    data: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    request_id: str = Field(default_factory=lambda: str(uuid4()))

    @classmethod
    def paginate(
        cls,
        data: list[Any],
        total: int,
        page: int,
        page_size: int,
        request_id: str | None = None,
    ) -> "PaginatedResponse":
        total_pages = max(1, -(-total // page_size))  # ceiling division
        instance = cls(
            data=data,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )
        if request_id:
            instance.request_id = request_id
        return instance
