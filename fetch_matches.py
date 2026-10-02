#!/usr/bin/env python3
"""Fetch ranked Riot matches locally and store normalized, analysis-ready JSON."""

from __future__ import annotations

import argparse
import json
from dataclasses import replace
from pathlib import Path

from backend.config import settings
from backend.riot import PLATFORM_TO_REGION, RiotClient


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch ranked matches for the local Rift Rewind pipeline")
    parser.add_argument("--riot-id", required=True, help="GameName#TAG")
    parser.add_argument("--platform", required=True, choices=sorted(PLATFORM_TO_REGION))
    parser.add_argument("--api-key", help="Riot development key; RIOT_API_KEY is preferred")
    parser.add_argument("--max-matches", type=int, default=settings.max_matches)
    parser.add_argument("--year", type=int, default=settings.default_year)
    parser.add_argument("--queue", type=int, choices=[420, 440], default=420)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    config = replace(settings, riot_api_key=args.api_key or settings.riot_api_key)
    client = RiotClient(config)
    snapshots = client.snapshots(args.riot_id, args.platform, args.year, args.queue, args.max_matches)
    output = args.output or Path(f"dataset-{args.riot_id.replace('#', '-')}")
    output.mkdir(parents=True, exist_ok=True)
    for snapshot in snapshots:
        path = output / f"{snapshot.match_id}.json"
        path.write_text(json.dumps(snapshot.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(snapshots)} chronological ranked matches to {output.resolve()}")
    print(f"Next: python create_journey.py {output} --player-name \"{args.riot_id}\"")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
