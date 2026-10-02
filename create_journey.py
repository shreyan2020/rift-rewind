#!/usr/bin/env python3
"""Compatibility entry point for the local Rift Rewind journey builder."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from backend.config import settings
from backend.service import JourneyService
from backend.storage import LocalStore


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a local Rift Rewind journey from match JSON files")
    parser.add_argument("folder", type=Path, help="Folder containing preprocessed or normalized match JSON files")
    parser.add_argument("--player-name", required=True)
    parser.add_argument("--output", default="journey-local.json", type=Path)
    parser.add_argument("--upload-file", type=Path, help="Deprecated alias for --output")
    parser.add_argument("--archetype", default="explorer", choices=["explorer", "warrior", "sage", "guardian"])
    parser.add_argument("--year", type=int, default=settings.default_year)
    parser.add_argument("--no-llm", action="store_true", help="Use deterministic narratives without Ollama")
    args = parser.parse_args()

    output = args.upload_file or args.output
    service = JourneyService(settings, LocalStore(settings))
    journey = service.build_from_folder(args.folder, args.player_name, args.archetype, args.year, not args.no_llm)
    output.write_text(json.dumps(journey, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Created local journey: {output.resolve()}")
    print(f"Narrative provider: {journey['narrative']['provider']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
