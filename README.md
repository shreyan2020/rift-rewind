# Rift Rewind

A local League of Legends recap that turns match records into an interactive journey through Runeterra. It combines season statistics, a four-act map, optional generated stories, and a two-player expedition.

Built with React, TypeScript, Vite, FastAPI, and local JSON storage. Ollama supplies optional narrative text. Riot API access is needed only to fetch live match history.

## How it works

1. Import match data or fetch ranked Solo/Duo or Flex games from Riot.
2. Normalize records, sort chronologically, and split them into four acts by match count.
3. Compute statistics, gameplay scores, trends, and route choices in Python.
4. Display the journey with charts, evidence, and narrative text. If Ollama is unavailable or returns invalid output, use deterministic fallback text.

The two-player mode derives player profiles from two complete journey exports, scripts a five-turn negotiation, and constructs a shared route and pact. Each profile can be downloaded as a `SKILL.md`. The negotiation protocol and scoring are deterministic; an LLM can voice the dialogue.

## Run locally

Requires Python 3.11 or newer and Node.js 22.12 or newer. From the repository root, in PowerShell:

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m backend.cli serve
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open [Rift Rewind](http://127.0.0.1:5173). The frontend proxies `/api` to the local API at `http://127.0.0.1:8000`.

Upload the included [synthetic demo matches](examples/demo-matches.json) and turn off local narrative generation to try the app without a model or Riot key. These eight fabricated matches are demonstration data. Upload at least four matches as an array, `{ "matches": [...] }`, or `Q1`–`Q4` arrays. Raw Riot records require the player's PUUID; processed records already identify the player. Complete journey exports can be opened directly.

For optional stories, run Ollama with the model configured in `.env`:

```powershell
ollama pull qwen2.5
```

Set `RIOT_API_KEY` in `.env` for live fetching. The environment file and generated `.local-data/` files are ignored by Git. Default settings target the 2025 season; the interface and CLI accept a year.

## Command-line workflow

Build from a folder of processed match JSON files:

```powershell
python create_journey.py path/to/matches --player-name "Player#TAG" --no-llm --output journey-local.json
```

Fetch a local ranked dataset:

```powershell
python fetch_matches.py --riot-id "Player#TAG" --platform euw1 --year 2025
```

## Verify

```powershell
python -m pip install -r backend/requirements.txt
python -m unittest discover -s backend/tests -v
cd frontend
npm ci
npm run build
npm run lint
```

Three end-to-end tests start a real local API with temporary storage and exercise upload-to-export, two-player expedition-to-skill-download, and CLI journey generation. They use the included demo matches and deterministic narratives. These checks do not validate psychological interpretations or live model output.

## Code map

| Path | Responsibility |
| --- | --- |
| `backend/analytics.py` | Match normalization, statistics, gameplay heuristics, trends, and routes |
| `backend/narrative.py`, `backend/llm.py` | Ollama requests and fallback text |
| `backend/duo.py` | Player profiles, scripted negotiation, shared route, and pact |
| `backend/main.py`, `backend/service.py` | Local API and job orchestration |
| `backend/riot.py`, `backend/storage.py` | Riot client and local persistence |
| `frontend/src/` | Journey map, charts, comparison, and export views |
| `create_journey.py`, `fetch_matches.py` | Command-line entry points |
| `infra/` | Archived AWS prototype; unused by the local application |

## Interpretation

The ten gameplay scores borrow labels from human values research. They are hand-built heuristics on a common 0–100 range, not validated measurements of a person's values or personality. Shared-route scores likewise describe the application's rules, not measured interpersonal compatibility.

Statistics and route decisions are computed independently of the model. Generated prose is prompted to use those inputs, but its factual accuracy is not automatically verified. Review stories and coaching suggestions before sharing them.

This is a personal prototype, with no affiliation to Riot Games. Live Riot fetching and Ollama generation require their respective services; the tests use local inputs and mocked model responses.
