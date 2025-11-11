import os
import asyncpg

POSTGRES_URL = os.environ.get("DATABASE_URL", "postgresql://sabi:sabiscore@localhost:5432/sabiscore")

async def get_db():
    return await asyncpg.create_pool(dsn=POSTGRES_URL)
