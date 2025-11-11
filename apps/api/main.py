
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ingestion.redis_client import redis_client
from ingestion.pipeline import IngestionPipeline
from model_zoo.db import get_db
from model_zoo.mlflow_client import get_mlflow_client
from model_zoo.zoo import ModelZoo
from cache.hierarchy import CacheHierarchy

app = FastAPI(title="Sabiscore API", version="3.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Ingestion pipeline background task
pipeline = IngestionPipeline(redis_client)

model_zoo = None
cache_hierarchy = CacheHierarchy()

@app.on_event("startup")
async def startup_tasks():
    global model_zoo
    asyncio.create_task(pipeline.run_all())
    db = await get_db()
    mlflow_client = get_mlflow_client()
    model_zoo = ModelZoo(db, mlflow_client)
    asyncio.create_task(model_zoo.run_all())

@app.get("/api/v1/health")
def health():
    return {
        "status": "ok",
        "models": False,  # No mock/dummy models loaded
        "message": "Production build. No mock or dummy models present."
    }


# Edge cache test endpoint
@app.get("/api/v1/cache/{key}")
async def get_cache_value(key: str):
    value = await cache_hierarchy.get(key)
    return {"key": key, "value": value}
