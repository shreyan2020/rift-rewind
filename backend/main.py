from __future__ import annotations

from typing import Any, Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field

from .config import settings
from .duo import DuoJourneyService
from .service import JourneyService
from .storage import LocalStore


app = FastAPI(title="Rift Rewind Local API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = LocalStore(settings)
service = JourneyService(settings, store)
duo_service = DuoJourneyService(settings, store)


class CreateJourneyRequest(BaseModel):
    platform: str = "euw1"
    riotId: str
    archetype: str = "explorer"
    year: int = Field(default=settings.default_year, ge=2018, le=2100)
    queue: Literal[420, 440] = 420
    maxMatches: int = Field(default=200, ge=4, le=500)
    useLocalLlm: bool = True


class UploadJourneyRequest(BaseModel):
    playerName: str
    archetype: str = "explorer"
    year: int = Field(default=settings.default_year, ge=2018, le=2100)
    puuid: str | None = None
    useLocalLlm: bool = True
    payload: Any


class DuoJourneyRequest(BaseModel):
    player1: dict[str, Any]
    player2: dict[str, Any]
    useLocalLlm: bool = True


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "mode": "local",
        "ollama": {"available": service.llm.available(), "model": settings.ollama_model},
        "riotApiConfigured": bool(settings.riot_api_key),
    }


@app.post("/api/journeys", status_code=202)
def create_journey(request: CreateJourneyRequest, background: BackgroundTasks) -> dict[str, Any]:
    job = store.create_job(request.riotId)
    background.add_task(
        service.run_riot_job,
        job["jobId"], request.riotId, request.platform, request.archetype,
        request.year, request.queue, request.maxMatches, request.useLocalLlm,
    )
    return job


@app.post("/api/journeys/upload", status_code=202)
def upload_journey(request: UploadJourneyRequest, background: BackgroundTasks) -> dict[str, Any]:
    job = store.create_job(request.playerName)
    background.add_task(
        service.run_upload_job,
        job["jobId"], request.payload, request.playerName, request.archetype,
        request.year, request.puuid, request.useLocalLlm,
    )
    return job


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    try:
        return store.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Job not found") from exc


@app.get("/api/journeys/{job_id}")
def get_journey(job_id: str) -> dict[str, Any]:
    try:
        return store.get_journey(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Journey not found") from exc


@app.get("/api/journeys/{job_id}/export")
def export_journey(job_id: str) -> JSONResponse:
    journey = get_journey(job_id)
    filename = f"rift-rewind-{journey['metadata']['playerName'].split('#')[0]}.json"
    return JSONResponse(journey, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/api/duo-journeys", status_code=202)
def create_duo_journey(request: DuoJourneyRequest, background: BackgroundTasks) -> dict[str, Any]:
    first = request.player1.get("metadata", {}).get("playerName", "Player one")
    second = request.player2.get("metadata", {}).get("playerName", "Player two")
    job = store.create_job(f"{first} + {second}")
    background.add_task(duo_service.run_job, job["jobId"], request.player1, request.player2, request.useLocalLlm)
    return job


@app.get("/api/duo-journeys/{job_id}")
def get_duo_journey(job_id: str) -> dict[str, Any]:
    try:
        return store.get_duo_journey(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Duo journey not found") from exc


@app.get("/api/duo-journeys/{job_id}/agents/{agent_id}/skill")
def export_agent_skill(job_id: str, agent_id: str) -> PlainTextResponse:
    duo = get_duo_journey(job_id)
    agent = next((item for item in duo.get("agents", []) if item.get("id") == agent_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail="Player agent not found")
    filename = f"{agent['skill_name']}-SKILL.md"
    return PlainTextResponse(
        agent["skill_markdown"],
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
