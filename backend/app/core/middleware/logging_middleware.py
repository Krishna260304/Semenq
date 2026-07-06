
from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.logging.logger import get_logger
from app.core.middleware.request_id import REQUEST_ID_CTX

logger = get_logger(__name__)

_SKIP_PATHS = frozenset(["/health", "/health/", "/metrics", "/favicon.ico"])


class LoggingMiddleware(BaseHTTPMiddleware):

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        if path in _SKIP_PATHS:
            return await call_next(request)

        start_time = time.perf_counter()
        request_id = REQUEST_ID_CTX.get("")
        client_ip = self._get_client_ip(request)

        response: Response | None = None
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            logger.error(
                "Unhandled exception in request cycle",
                method=request.method,
                path=path,
                client_ip=client_ip,
                request_id=request_id,
                error=str(exc),
                exc_info=True,
            )
            raise
        finally:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status_code = response.status_code if response else 500
            log_method = logger.warning if status_code >= 400 else logger.info
            log_method(
                "Request completed",
                method=request.method,
                path=path,
                status_code=status_code,
                duration_ms=duration_ms,
                client_ip=client_ip,
                user_agent=request.headers.get("User-Agent", ""),
                request_id=request_id,
            )

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
