from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _load_local_env(path: Path) -> None:
    """Load a small .env file without adding another runtime dependency."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_local_env(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path(os.getenv("RIFT_DATA_DIR", PROJECT_ROOT / ".local-data"))
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:latest")
    riot_api_key: str = os.getenv("RIOT_API_KEY", "")
    default_year: int = int(os.getenv("RIFT_DEFAULT_YEAR", "2025"))
    max_matches: int = int(os.getenv("RIFT_MAX_MATCHES", "200"))
    request_timeout: int = int(os.getenv("RIFT_REQUEST_TIMEOUT", "30"))
    llm_timeout: int = int(os.getenv("RIFT_LLM_TIMEOUT", "180"))

    def ensure_directories(self) -> None:
        (self.data_dir / "jobs").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "journeys").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "duo-journeys").mkdir(parents=True, exist_ok=True)


settings = Settings()
