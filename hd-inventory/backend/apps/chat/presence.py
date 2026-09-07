"""Presencia del chat sobre Redis (sin migraciones).

- chat:online:{conv_id}  → SET de user_ids con TTL (heartbeat lo renueva).
- chat:seen:{conv_id}:{user_id} → último timestamp visto (para "últ. vez").
"""
import time
from decouple import config

_client = None


def get_redis():
    global _client
    if _client is None:
        import redis.asyncio as redis
        _client = redis.Redis(
            host=config('REDIS_HOST', default='redis'),
            port=config('REDIS_PORT', default=6379, cast=int),
            password=config('REDIS_PASSWORD', default=None),
            decode_responses=True,
        )
    return _client


_sync_client = None


def get_redis_sync():
    """Cliente sync para vistas DRF (evita mezclar loops asyncio)."""
    global _sync_client
    if _sync_client is None:
        import redis as redis_lib
        _sync_client = redis_lib.Redis(
            host=config('REDIS_HOST', default='redis'),
            port=config('REDIS_PORT', default=6379, cast=int),
            password=config('REDIS_PASSWORD', default=None),
            decode_responses=True,
        )
    return _sync_client


def get_online_sync(conv_id):
    try:
        return {int(x) for x in get_redis_sync().smembers(_online_key(conv_id))}
    except Exception:
        return set()


def get_last_seen_sync(conv_id, user_id):
    try:
        ts = get_redis_sync().get(_seen_key(conv_id, user_id))
        return int(ts) if ts else None
    except Exception:
        return None


def _online_key(conv_id):
    return f'chat:online:{conv_id}'


def _seen_key(conv_id, user_id):
    return f'chat:seen:{conv_id}:{user_id}'


ONLINE_TTL = 75  # s; el heartbeat del frontend lo renueva cada 30 s


async def mark_online(conv_id, user_id):
    r = get_redis()
    await r.sadd(_online_key(conv_id), user_id)
    await r.expire(_online_key(conv_id), ONLINE_TTL)


async def refresh_presence(conv_id, user_id):
    await mark_online(conv_id, user_id)


async def mark_offline(conv_id, user_id):
    r = get_redis()
    await r.srem(_online_key(conv_id), user_id)
    await r.set(_seen_key(conv_id, user_id), int(time.time()))


async def get_online(conv_id):
    r = get_redis()
    try:
        return {int(x) for x in await r.smembers(_online_key(conv_id))}
    except Exception:
        return set()


async def get_last_seen(conv_id, user_id):
    r = get_redis()
    try:
        ts = await r.get(_seen_key(conv_id, user_id))
        return int(ts) if ts else None
    except Exception:
        return None
