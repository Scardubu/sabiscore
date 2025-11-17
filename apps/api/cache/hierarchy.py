"""
Cache hierarchy: Cloudflare KV (edge) -> Upstash Redis -> Postgres fallback
"""
from .kv import CloudflareKV
from ingestion.redis_client import redis_client
from model_zoo.db import get_db

class CacheHierarchy:
    def __init__(self):
        self.kv = CloudflareKV()
        self.redis = redis_client
        self.db = None

    async def get(self, key: str):
        # Try Cloudflare KV
        val = await self.kv.get(key)
        if val is not None:
            return val
        # Try Redis
        val = await self.redis.get(key)
        if val is not None:
            return val
        # Try Postgres
        if self.db is None:
            self.db = await get_db()
        # TODO: Implement Postgres fallback
        return None

    async def set(self, key: str, value: str):
        await self.kv.put(key, value)
        await self.redis.set(key, value)
        # Optionally persist to Postgres
