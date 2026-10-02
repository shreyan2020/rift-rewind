from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from .analytics import GameSnapshot, snapshot_from_riot_match
from .config import Settings


PLATFORM_TO_REGION = {
    "euw1": "europe", "eun1": "europe", "tr1": "europe", "ru": "europe",
    "na1": "americas", "br1": "americas", "la1": "americas", "la2": "americas", "oc1": "americas",
    "kr": "asia", "jp1": "asia",
    "ph2": "sea", "sg2": "sea", "th2": "sea", "tw2": "sea", "vn2": "sea",
}


class RiotAPIError(RuntimeError):
    pass


class RiotClient:
    def __init__(self, config: Settings):
        if not config.riot_api_key:
            raise RiotAPIError("RIOT_API_KEY is not configured in the local environment")
        self.api_key = config.riot_api_key
        self.timeout = config.request_timeout

    def _get(self, url: str, params: dict[str, Any] | None = None) -> Any:
        if params:
            url = f"{url}?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(url, headers={"X-Riot-Token": self.api_key})
        delay = 1.0
        for attempt in range(6):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                if exc.code == 429 and attempt < 5:
                    wait = float(exc.headers.get("Retry-After", delay))
                    time.sleep(wait)
                    delay = min(delay * 2, 16)
                    continue
                message = exc.read().decode("utf-8", errors="replace")[:300]
                raise RiotAPIError(f"Riot API returned {exc.code}: {message}") from exc
            except urllib.error.URLError as exc:
                raise RiotAPIError(f"Could not reach Riot API: {exc.reason}") from exc
        raise RiotAPIError("Riot API retry limit reached")

    def account(self, riot_id: str, platform: str) -> tuple[str, str]:
        if "#" not in riot_id:
            raise RiotAPIError("Riot ID must use the GameName#TAG format")
        region = PLATFORM_TO_REGION.get(platform.lower())
        if not region:
            raise RiotAPIError(f"Unsupported platform: {platform}")
        game_name, tag = (urllib.parse.quote(part.strip()) for part in riot_id.split("#", 1))
        data = self._get(f"https://{region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag}")
        puuid = str(data.get("puuid") or "")
        if not puuid:
            raise RiotAPIError("Player account was not found")
        return puuid, region

    def ranked_match_ids(self, puuid: str, region: str, year: int, queue: int, limit: int) -> list[str]:
        start_time = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp())
        end_time = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp())
        ids: list[str] = []
        while len(ids) < limit:
            batch = self._get(
                f"https://{region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{urllib.parse.quote(puuid)}/ids",
                {"start": len(ids), "count": min(100, limit - len(ids)), "startTime": start_time, "endTime": end_time, "queue": queue},
            )
            if not isinstance(batch, list) or not batch:
                break
            ids.extend(str(match_id) for match_id in batch)
            if len(batch) < 100:
                break
        return ids[:limit]

    def snapshots(self, riot_id: str, platform: str, year: int, queue: int, limit: int) -> list[GameSnapshot]:
        puuid, region = self.account(riot_id, platform)
        match_ids = self.ranked_match_ids(puuid, region, year, queue, limit)
        if not match_ids:
            raise RiotAPIError(f"No ranked matches were found for {year}")

        def fetch(match_id: str) -> GameSnapshot:
            match = self._get(f"https://{region}.api.riotgames.com/lol/match/v5/matches/{urllib.parse.quote(match_id)}")
            return snapshot_from_riot_match(match, puuid)

        snapshots: list[GameSnapshot] = []
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(fetch, match_id): match_id for match_id in match_ids}
            for future in as_completed(futures):
                try:
                    snapshots.append(future.result())
                except (RiotAPIError, ValueError):
                    continue
        return sorted(snapshots, key=lambda item: item.timestamp_ms)
