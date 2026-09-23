# Rift Rewind

A League of Legends season recap that combines match statistics with generated stories set in Runeterra. Players can fetch ranked matches, upload match data, or open an exported journey. A comparison view puts two journeys side by side.

The project explores how a narrative interface can make personal activity data easier to explore. It is a prototype built around the 2025 season.

## How it works

1. Fetch match records from Riot, or upload previously collected records.
2. Sort matches chronologically and divide them into four chapters by match count.
3. Compute chapter statistics and heuristic playstyle scores.
4. Generate chapter narratives through Amazon Bedrock and display the recap in React.

The backend uses API Gateway, Lambda, SQS, DynamoDB, and S3. The frontend uses React, TypeScript, Recharts, and Framer Motion.

## Run the frontend

Use Node.js 22.12 or newer within a supported release line.

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Set `VITE_API_BASE_URL` to your API Gateway URL and `VITE_STORY_BASE_URL` to your story bucket's HTTPS URL. These are public deployment addresses, not credentials. Without an API URL, development requests use `/api`, proxied to `http://127.0.0.1:3001` for a local SAM API. Completed journey imports can be explored without fetching new matches.

```bash
npm run build
```

## Backend

The backend requires Python 3.11, AWS SAM, configured AWS access, a Riot API key, and access to the Bedrock model configured in the source.

```bash
cd infra
python -m pip install -r src/requirements.txt
sam build
sam deploy --guided
```

Supply the `RiotApiKey` parameter during deployment. It is marked `NoEcho`; do not put its value in source files or commit deployment configuration containing it. For a local API, run `sam local start-api --port 3001` with your local parameter configuration.

The supplied S3 template permits public reads. Use it only with data intended for public display. This setup has not been deployed or exercised against live AWS services as part of the repository cleanup.

## Code map

- [`frontend/src/`](frontend/src/): journey views, charts, comparison, and API client.
- [`infra/src/api.py`](infra/src/api.py): create jobs and retrieve status.
- [`infra/src/fetch_quarter.py`](infra/src/fetch_quarter.py): collect match data.
- [`infra/src/process_quarter.py`](infra/src/process_quarter.py): aggregate chapters and generate narratives.
- [`infra/src/stats_inference.py`](infra/src/stats_inference.py): gameplay features and heuristic scoring.
- [`create_journey.py`](create_journey.py) and [`fetch_matches.py`](fetch_matches.py): local data tools.

## Interpretation and limitations

The playstyle labels borrow terminology from human values research. They are hand-built gameplay heuristics, not validated measurements of a player's psychological values. Generated stories and coaching text can be inaccurate.

The current ranking code averages within-chapter z-scores. Those averages are approximately zero by construction, so the resulting top-value rankings need a redesigned reference distribution before they can support meaningful comparisons. The original scoring is retained to preserve existing outputs; do not interpret its rankings as validated findings.

The original detailed documentation remains in Git history and the backup branch. The component READMEs contain historical implementation notes and may describe an earlier deployment.
