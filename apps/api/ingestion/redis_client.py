import os
import redis.asyncio as redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)
