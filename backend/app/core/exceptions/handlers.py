
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions.base import SemenqBaseException
from app.core.logging.logger import get_logger
from app.core.middleware.request_id import REQUEST_ID_CTX

logger = get_logger(__name__)


def _get_request_id(request: Request) -> str:
    try:
        return REQUEST_ID_CTX.get("") or request.headers.get("X-Request-ID", "")
    except Exception:
        return ""


def _error_response(
    status_code: int,
    message: str,
    error_code: str,
    details: object,
    request_id: str,
) -> JSONResponse:
    from datetime import datetime, timezone
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "error_code": error_code,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
        },
    )


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(SemenqBaseException)
    async def semenq_exception_handler(request: Request, exc: SemenqBaseException) -> JSONResponse:
        request_id = _get_request_id(request)
        logger.warning(
            "Business exception",
            error_code=exc.error_code,
            message=exc.message,
            path=request.url.path,
            request_id=request_id,
        )
        return _error_response(
            status_code=exc.status_code,
            message=exc.message,
            error_code=exc.error_code,
            details=exc.details,
            request_id=request_id,
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = _get_request_id(request)
        field_errors = [
            {
                "field": ".".join(str(loc) for loc in err["loc"] if loc != "body"),
                "message": err["msg"],
                "type": err["type"],
            }
            for err in exc.errors()
        ]
        logger.warning(
            "Request validation failed",
            path=request.url.path,
            errors=field_errors,
            request_id=request_id,
        )
        return _error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Request validation failed.",
            error_code="VALIDATION_ERROR",
            details=field_errors,
            request_id=request_id,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        request_id = _get_request_id(request)
        error_map = {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            429: "RATE_LIMITED",
        }
        error_code = error_map.get(exc.status_code, "HTTP_ERROR")
        logger.warning(
            "HTTP exception",
            status_code=exc.status_code,
            detail=exc.detail,
            path=request.url.path,
            request_id=request_id,
        )
        return _error_response(
            status_code=exc.status_code,
            message=str(exc.detail),
            error_code=error_code,
            details=None,
            request_id=request_id,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = _get_request_id(request)
        logger.error(
            "Unhandled exception",
            error=str(exc),
            error_type=type(exc).__name__,
            path=request.url.path,
            request_id=request_id,
            exc_info=True,
        )
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="An unexpected error occurred. Please try again later.",
            error_code="INTERNAL_ERROR",
            details=None,
            request_id=request_id,
        )
