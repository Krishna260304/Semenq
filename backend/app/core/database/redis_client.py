from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.core.logging.logger import get_logger

logger = get_logger(__name__)

_redis_client: aioredis.Redis | None = None


async def connect_redis() -> None:
    global _redis_client
    settings = get_settings()

    logger.info("Connecting to Redis", url=settings.REDIS_URL)
    try:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            encoding="utf-8",
            decode_responses=True,
        )
        await _redis_client.ping()
        logger.info("Redis connected successfully")
    except Exception as exc:
        if _redis_client is not None:
            try:
                await _redis_client.aclose()
            except Exception:
                pass
        _redis_client = None
        logger.warning("Redis unavailable; the app will continue without caching", error=str(exc))


async def disconnect_redis() -> None:
    global _redis_client
    if _redis_client:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None
        logger.info("Redis connection closed")


def get_redis() -> aioredis.Redis | None:
    return _redis_client


async def ping_redis() -> dict:
    if _redis_client is None:
        return {"status": "disconnected", "healthy": False}
    try:
        pong = await _redis_client.ping()
        return {"status": "connected", "healthy": bool(pong)}
    except Exception as exc:
        logger.error("Redis ping failed", error=str(exc))
        return {"status": "error", "healthy": False, "error": str(exc)}


async def cache_set(key: str, value: str, ttl: int | None = None) -> None:
    if _redis_client is None:
        return
    settings = get_settings()
    expire = ttl if ttl is not None else settings.REDIS_CACHE_TTL
    try:
        await _redis_client.set(key, value, ex=expire)
    except Exception as exc:
        logger.warning("cache_set failed", key=key, error=str(exc))


async def cache_get(key: str) -> str | None:
    if _redis_client is None:
        return None
    try:
        return await _redis_client.get(key)
    except Exception as exc:
        logger.warning("cache_get failed", key=key, error=str(exc))
        return None


async def cache_delete(key: str) -> None:
    if _redis_client is None:
        return
    try:
        await _redis_client.delete(key)
    except Exception as exc:
        logger.warning("cache_delete failed", key=key, error=str(exc))


async def cache_delete_pattern(pattern: str) -> int:
    if _redis_client is None:
        return 0
    try:
        keys = await _redis_client.keys(pattern)
        if keys:
            return await _redis_client.delete(*keys)
        return 0
    except Exception as exc:
        logger.warning("cache_delete_pattern failed", pattern=pattern, error=str(exc))
        return 0


async def cache_exists(key: str) -> bool:
    if _redis_client is None:
        return False
    try:
        return bool(await _redis_client.exists(key))
    except Exception as exc:
        logger.warning("cache_exists failed", key=key, error=str(exc))
        return False


async def cache_expire(key: str, ttl: int) -> bool:
    if _redis_client is None:
        return False
    try:
        return bool(await _redis_client.expire(key, ttl))
    except Exception as exc:
        logger.warning("cache_expire failed", key=key, error=str(exc))
        return False


async def cache_increment(key: str, amount: int = 1, ttl: int | None = None) -> int:
    if _redis_client is None:
        return 0
    try:
        value = await _redis_client.incr(key, amount)
        if value == amount and ttl is not None:
            await _redis_client.expire(key, ttl)
        return value
    except Exception as exc:
        logger.warning("cache_increment failed", key=key, error=str(exc))
        return 0
