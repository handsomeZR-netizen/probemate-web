from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services.store import store


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    store.seed()
    yield


app = FastAPI(title="ProbeMate API", version="0.1.0", lifespan=lifespan)

default_local_origins = [
    *(f"http://localhost:{port}" for port in range(3000, 3021)),
    *(f"http://127.0.0.1:{port}" for port in range(3000, 3021)),
]
configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins or default_local_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(router)
