from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings


class LocalStore:
    def __init__(self, config: Settings):
        config.ensure_directories()
        self.jobs_dir = config.data_dir / "jobs"
        self.journeys_dir = config.data_dir / "journeys"
        self.duo_journeys_dir = config.data_dir / "duo-journeys"
        self._lock = threading.RLock()

    @staticmethod
    def _write(path: Path, data: dict[str, Any]) -> None:
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def create_job(self, player_name: str) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        job = {
            "jobId": job_id,
            "playerName": player_name,
            "status": "queued",
            "progress": 0,
            "stage": "Queued",
            "resultReady": False,
            "error": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            self._write(self.jobs_dir / f"{job_id}.json", job)
        return job

    def update_job(self, job_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            job = self.get_job(job_id)
            job.update(fields)
            job["updatedAt"] = datetime.now(timezone.utc).isoformat()
            self._write(self.jobs_dir / f"{job_id}.json", job)
            return job

    def get_job(self, job_id: str) -> dict[str, Any]:
        path = self.jobs_dir / f"{job_id}.json"
        if not path.exists():
            raise KeyError(job_id)
        with self._lock:
            return json.loads(path.read_text(encoding="utf-8"))

    def save_journey(self, job_id: str, journey: dict[str, Any]) -> None:
        with self._lock:
            self._write(self.journeys_dir / f"{job_id}.json", journey)

    def get_journey(self, job_id: str) -> dict[str, Any]:
        path = self.journeys_dir / f"{job_id}.json"
        if not path.exists():
            raise KeyError(job_id)
        with self._lock:
            return json.loads(path.read_text(encoding="utf-8"))

    def save_duo_journey(self, job_id: str, journey: dict[str, Any]) -> None:
        with self._lock:
            self._write(self.duo_journeys_dir / f"{job_id}.json", journey)

    def get_duo_journey(self, job_id: str) -> dict[str, Any]:
        path = self.duo_journeys_dir / f"{job_id}.json"
        if not path.exists():
            raise KeyError(job_id)
        with self._lock:
            return json.loads(path.read_text(encoding="utf-8"))
