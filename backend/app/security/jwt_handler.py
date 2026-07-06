
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.exceptions import InvalidTokenException, TokenExpiredException
from app.core.logging.logger import get_logger

logger = get_logger(__name__)


class TokenPayload:

    def __init__(self, data: dict[str, Any]) -> None:
        self.sub: str = data.get("sub", "")          # user_id
        self.role: str = data.get("role", "")
        self.session_id: str = data.get("sid", "")
        self.jti: str = data.get("jti", "")          # token ID
        self.exp: int = data.get("exp", 0)
        self.token_type: str = data.get("type", "access")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    user_id: str,
    role: str,
    session_id: str = "",
    extra_claims: dict | None = None,
) -> tuple[str, datetime]:
    settings = get_settings()
    expiry = _utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = secrets.token_urlsafe(16)

    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "sid": session_id,
        "jti": jti,
        "type": "access",
        "iat": int(_utcnow().timestamp()),
        "exp": int(expiry.timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expiry


def create_refresh_token() -> tuple[str, str, datetime]:
    settings = get_settings()
    raw = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    expiry = _utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    return raw, token_hash, expiry


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def decode_access_token(token: str) -> TokenPayload:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": True},
        )
        if payload.get("type") != "access":
            raise InvalidTokenException("Not an access token.")
        return TokenPayload(payload)
    except jwt.ExpiredSignatureError:
        raise TokenExpiredException()
    except JWTError as exc:
        logger.warning("JWT decode failed", error=str(exc))
        raise InvalidTokenException()


def create_verification_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash
