
from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging.logger import get_logger

logger = get_logger(__name__)

_redis_client: aioredis.Redis | None = None


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
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
            await _redis_client.aclose()
            _redis_client = None

        logger.warning("Redis unavailable; continuing without cache", error=str(exc))


async def disconnect_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis connection closed")


def get_redis() -> aioredis.Redis:
    if _redis_client is None:
        raise RuntimeError("Redis not initialized. Call connect_redis() first.")
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
    client = get_redis()
    settings = get_settings()
    expire = ttl if ttl is not None else settings.REDIS_CACHE_TTL
    await client.set(key, value, ex=expire)


async def cache_get(key: str) -> str | None:
    client = get_redis()
    return await client.get(key)


async def cache_delete(key: str) -> None:
    client = get_redis()
    await client.delete(key)


async def cache_delete_pattern(pattern: str) -> int:
    client = get_redis()
    keys = await client.keys(pattern)
    if keys:
        return await client.delete(*keys)
    return 0


async def cache_exists(key: str) -> bool:
    client = get_redis()
    return bool(await client.exists(key))


async def cache_expire(key: str, ttl: int) -> bool:
    client = get_redis()
    return bool(await client.expire(key, ttl))


async def cache_increment(key: str, amount: int = 1, ttl: int | None = None) -> int:
    client = get_redis()
    value = await client.incr(key, amount)
    if value == amount and ttl is not None:
        await client.expire(key, ttl)
    return value
