from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from .config import Settings


class LocalLLMError(RuntimeError):
    pass


class OllamaClient:
    """Small Ollama HTTP client with no cloud SDK dependency."""

    def __init__(self, config: Settings):
        self.base_url = config.ollama_base_url
        self.model = config.ollama_model
        self.timeout = config.llm_timeout

    def _request(self, path: str, payload: dict[str, Any] | None = None, timeout: int | None = None) -> Any:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST" if payload is not None else "GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout or self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise LocalLLMError(str(exc)) from exc

    def available(self) -> bool:
        try:
            data = self._request("/api/tags", timeout=2)
            models = data.get("models") or []
            names = {str(item.get("name")) for item in models if isinstance(item, dict)}
            return self.model in names or self.model.split(":", 1)[0] in {name.split(":", 1)[0] for name in names}
        except LocalLLMError:
            return False

    def generate_json(self, prompt: str) -> dict[str, Any]:
        response = self._request(
            "/api/generate",
            {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.55, "top_p": 0.9},
            },
        )
        raw = str(response.get("response") or "").strip()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            start, end = raw.find("{"), raw.rfind("}")
            if start < 0 or end <= start:
                raise LocalLLMError("The local model did not return JSON") from exc
            try:
                parsed = json.loads(raw[start:end + 1])
            except json.JSONDecodeError as inner_exc:
                raise LocalLLMError("The local model returned malformed JSON") from inner_exc
        if not isinstance(parsed, dict):
            raise LocalLLMError("The local model returned the wrong JSON shape")
        return parsed
