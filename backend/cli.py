from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import settings
from .service import JourneyService
from .storage import LocalStore


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Rift Rewind journeys locally")
    subcommands = parser.add_subparsers(dest="command", required=True)

    serve = subcommands.add_parser("serve", help="Run the local API")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)

    build = subcommands.add_parser("build", help="Build a journey from a folder of preprocessed match JSON files")
    build.add_argument("folder", type=Path)
    build.add_argument("--player-name", required=True)
    build.add_argument("--archetype", default="explorer")
    build.add_argument("--year", type=int, default=settings.default_year)
    build.add_argument("--output", type=Path, default=Path("journey-local.json"))
    build.add_argument("--no-llm", action="store_true")

    args = parser.parse_args()
    if args.command == "serve":
        import uvicorn
        uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=True)
        return 0

    service = JourneyService(settings, LocalStore(settings))
    journey = service.build_from_folder(args.folder, args.player_name, args.archetype, args.year, not args.no_llm)
    args.output.write_text(json.dumps(journey, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Journey written to {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
