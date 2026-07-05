"""
WebSocket server entrypoint for SabiScore (FastAPI + websockets)
Production-ready, stateless, scalable. Use for real-time events, odds, and live data.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import redis


# Redis connection (stub for pub/sub integration). REDIS_URL must be supplied by
# the environment (compose sets it to the internal redis service). No credential
# is ever hardcoded here — the default is an inert local address for dev only.
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

app = FastAPI()

# allow_credentials with a wildcard origin is rejected by browsers; the ws echo
# endpoint needs no cookies, so keep credentials off with the open origin default.
_ALLOWED_ORIGINS = [o for o in os.environ.get("WS_ALLOWED_ORIGINS", "*").split(",") if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # Echo for now; replace with real-time logic
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import os
    port = int(os.environ.get("WS_PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
