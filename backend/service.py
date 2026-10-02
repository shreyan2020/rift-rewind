from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from .analytics import GameSnapshot, build_season_analysis, snapshots_from_payload
from .config import Settings
from .llm import OllamaClient
from .narrative import NarrativeEngine
from .riot import RiotClient
from .storage import LocalStore


def flatten_uploaded_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        raise ValueError("Upload must be a JSON array or object")
    if isinstance(payload.get("matches"), list):
        return [item for item in payload["matches"] if isinstance(item, dict)]
    quarter_lists = [payload.get(label) for label in ("Q1", "Q2", "Q3", "Q4")]
    if any(isinstance(items, list) for items in quarter_lists):
        return [item for items in quarter_lists if isinstance(items, list) for item in items if isinstance(item, dict)]
    raise ValueError("No matches found. Use a list, {matches: [...]}, or Q1–Q4 arrays.")


class JourneyService:
    def __init__(self, config: Settings, store: LocalStore):
        self.config = config
        self.store = store
        self.llm = OllamaClient(config)
        self.narrative = NarrativeEngine(self.llm)

    def _progress(self, job_id: str, progress: int, stage: str) -> None:
        self.store.update_job(job_id, status="running", progress=progress, stage=stage)

    def build(
        self,
        snapshots: Sequence[GameSnapshot],
        player_name: str,
        archetype: str,
        year: int,
        use_llm: bool,
        job_id: str | None = None,
    ) -> dict[str, Any]:
        if len(snapshots) < 4:
            raise ValueError("At least four valid matches are required")
        if job_id:
            self._progress(job_id, 38, "Finding patterns, changes, and turning points")
        analysis = build_season_analysis(snapshots)
        if job_id:
            progress = lambda value, stage: self._progress(job_id, value, stage)
        else:
            progress = None
        enriched = self.narrative.enrich(analysis, player_name, archetype, use_llm, progress)
        quarters = {period["quarter"]: period for period in enriched["periods"]}
        journey = {
            "type": "complete-journey",
            "version": "3.0",
            "metadata": {
                "playerName": player_name,
                "archetype": archetype,
                "year": year,
                "totalGames": len(snapshots),
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "source": "local",
            },
            "quarters": quarters,
            "finale": enriched["finale"],
            "narrative": enriched["narrative"],
        }
        return journey

    def run_riot_job(self, job_id: str, player_name: str, platform: str, archetype: str, year: int, queue: int, max_matches: int, use_llm: bool) -> None:
        try:
            self._progress(job_id, 8, "Resolving the Riot account locally")
            client = RiotClient(self.config)
            self._progress(job_id, 15, f"Fetching ranked match history for {year}")
            snapshots = client.snapshots(player_name, platform, year, queue, min(max_matches, self.config.max_matches))
            self._progress(job_id, 32, f"Prepared {len(snapshots)} ranked matches in chronological order")
            journey = self.build(snapshots, player_name, archetype, year, use_llm, job_id)
            self.store.save_journey(job_id, journey)
            self.store.update_job(job_id, status="completed", progress=100, stage="Journey ready", resultReady=True)
        except Exception as exc:
            self.store.update_job(job_id, status="error", stage="Journey generation failed", error=str(exc))

    def run_upload_job(self, job_id: str, payload: Any, player_name: str, archetype: str, year: int, puuid: str | None, use_llm: bool) -> None:
        try:
            self._progress(job_id, 10, "Reading local match data")
            matches = flatten_uploaded_payload(payload)
            snapshots = snapshots_from_payload(matches, puuid)
            if len(snapshots) < 4:
                raise ValueError(f"Only {len(snapshots)} valid player matches were found")
            self._progress(job_id, 30, f"Prepared {len(snapshots)} matches in chronological order")
            journey = self.build(snapshots, player_name, archetype, year, use_llm, job_id)
            self.store.save_journey(job_id, journey)
            self.store.update_job(job_id, status="completed", progress=100, stage="Journey ready", resultReady=True)
        except Exception as exc:
            self.store.update_job(job_id, status="error", stage="Journey generation failed", error=str(exc))

    def build_from_folder(self, folder: Path, player_name: str, archetype: str, year: int, use_llm: bool) -> dict[str, Any]:
        import json

        matches = []
        for path in sorted(folder.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(payload, list) or (
                    isinstance(payload, dict)
                    and any(key in payload for key in ("matches", "Q1", "Q2", "Q3", "Q4"))
                ):
                    matches.extend(flatten_uploaded_payload(payload))
                elif isinstance(payload, dict):
                    matches.append(payload)
            except (OSError, json.JSONDecodeError):
                continue
        snapshots = snapshots_from_payload(matches)
        return self.build(snapshots, player_name, archetype, year, use_llm)
