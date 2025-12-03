# Rift Rewind Backend (AWS SAM)

This directory contains the AWS SAM (Serverless Application Model) backend infrastructure for Rift Rewind v2 - a serverless, queue-based processing pipeline for League of Legends match analysis and AI-powered narrative generation.

## 📐 Architecture Overview

```
User Request
     │
     ├─> API Lambda ──> DynamoDB (Job Status)
     │        │
     │        ├─> Cache Check (existing completed jobs)
     │        └─> SQS FetchQueue (Q1)
     │
     ├─> Fetch Lambda ──> Riot API
     │        │
     │        └─> S3 (Match Data) ──> SQS ProcessQueue
     │
     └─> Process Lambda ──> Amazon Bedrock (AI)
              │
              ├─> S3 (Story + Stats)
              ├─> DynamoDB (Status Update)
              └─> SQS FetchQueue (Next Quarter)
```

## 🔧 Lambda Functions

### 1. **ApiFunction** (`src/api.py`)

**Trigger**: API Gateway HTTP requests

**Endpoints**:

#### `POST /journey`
Create new journey by fetching from Riot API

**Request**:
```json
{
  "platform": "euw1",
  "riotId": "PlayerName#TAG",
  "archetype": "explorer",
  "bypassCache": false
}
```

**Response**:
```json
{
  "jobId": "uuid",
  "queued": true
}
```

**Features**:
- PUUID resolution from Riot Account API
- **Cache system**: Returns existing completed job if available (unless `bypassCache: true`)
- Creates DynamoDB job entry
- Enqueues Q1 to FetchQueue

---

#### `POST /journey/upload`
Create journey from pre-fetched match data

**Request**:
```json
{
  "platform": "euw1",
  "riotId": "PlayerName#TAG",
  "archetype": "explorer",
  "uploadedMatches": {
    "Q1": [...],
    "Q2": [...],
    "Q3": [...],
    "Q4": [...]
  }
}
```

**Response**:
```json
{
  "jobId": "uuid",
  "queued": true
}
```

**Features**:
- Uploads match data directly to S3
- Skips Riot API fetch phase
- Enqueues all quarters to ProcessQueue immediately
- Useful for local testing or offline processing

---

#### `GET /status/{jobId}`
Get job status and quarter readiness

**Response**:
```json
{
  "jobId": "uuid",
  "riotId": "PlayerName#TAG",
  "platform": "euw1",
  "archetype": "explorer",
  "status": "running",
  "s3Base": "uuid/",
  "quarters": {
    "Q1": "ready",
    "Q2": "processing",
    "Q3": "pending",
    "Q4": "pending"
  }
}
```

**Quarter Statuses**:
- `pending`: Not started
- `fetching`: Fetching matches from Riot API
- `fetched`: Matches retrieved, awaiting processing
- `processing`: Generating stats and lore
- `ready`: Story.json available in S3
- `error`: Failed (check CloudWatch logs)

---

### 2. **FetchQuarterFunction** (`src/fetch_quarter.py`)

**Trigger**: SQS FetchQueue messages

**Purpose**: Retrieve match data from Riot API

**Process**:
1. Receive message: `{ jobId, quarter, platform, archetype }`
2. Load PUUID from DynamoDB or resolve from Riot ID
3. Query Riot Match-v5 API for matches in quarter date range
4. Fetch detailed match data for each match ID
5. Store matches to S3: `{jobId}/Q1/{matchId}.json` + `index.json`
6. Update DynamoDB: `quarters.Q1 = "fetched"`
7. Enqueue ProcessQueue: `{ jobId, quarter }`
8. Delete SQS message

**Features**:
- Concurrent match fetching (configurable `MAX_CONCURRENCY`)
- Rate limit handling with exponential backoff
- Filters: Ranked only, 2025 season only, valid match data
- Error recovery: Failed matches logged but don't block job

**Configuration**:
- `MAX_MATCHES_PER_QUARTER`: Limit matches per quarter (default 50)
- `MAX_CONCURRENCY`: Parallel match fetches (default 8)
- `RIOT_API_KEY`: From environment variable

---

### 3. **ProcessQuarterFunction** (`src/process_quarter.py`)

**Trigger**: SQS ProcessQueue messages

**Purpose**: Calculate stats, generate AI lore and reflections, create story.json

**Process**:
1. Receive message: `{ jobId, quarter, archetype }`
2. Load match data from S3
3. **Calculate stats** (`stats_inference.py`):
  - KDA proxy, CS/min, vision/min, gold/min
   - Role detection and role-specific stats
   - Playstyle values (z-score normalized across games)
   - Top 3 values per quarter
   - Champion frequency
4. **Dynamic region selection** (`choose_region_arc()`):
   - Q1: Dominant current value
   - Q2: Biggest absolute change
   - Q3: Biggest negative change (challenge arc)
   - Q4: Dominant value (resolution)
5. **Generate AI lore** (`bedrock_lore.py`):
   - Invoke Amazon Bedrock (Mistral 7B Instruct)
   - Region-specific narrative with story continuity
   - 2-3 paragraphs, immersive storytelling
6. **Generate role reflection** (`bedrock_lore.py`):
   - Position-specific performance feedback
   - Constructive, encouraging tone
   - 2-3 sentences
7. **Save story.json** to S3: `{jobId}/Q1/story.json`
8. **Update DynamoDB**: `quarters.Q1 = "ready"`
9. **If Q4 complete**: Generate finale.json with advanced analytics
10. **If not Q4**: Enqueue next quarter to FetchQueue

**Features**:
- Per-value z-score normalization for fair top-value ranking
- Story continuity tracking (previous quarter context)
- Region-specific lore templates
- Advanced analytics (finale only)

---

## 🧠 Supporting Modules

### `stats_inference.py`

**Purpose**: Calculate performance metrics and playstyle values

See [main README](../README.md#how-playstyle-values-are-calculated) for the complete algorithm explanation including:
- Feature extraction process
- Weighted scoring formulas
- Z-score normalization
- Why we rank by z-score but display raw values

#### **Quick Reference**

| Bundle | Features Extracted | Purpose |
|--------|-------------------|---------|
| `power` | Gold/min, damage dealt/taken, pings | Measures dominance and resource control |
| `achiev` | First bloods, killing sprees, team damage %, KDA | Measures competitive achievement |
| `hed` | Fountain kills, minion clears, blast cones | Measures playful, risky behavior |
| `stim` | Bounty gold, epic steals, deaths | Measures aggressive, high-action play |
| `selfD` | Solo kills, unique combos, gold spending | Measures independent decision-making |
| `bene` | Kill participation, assists, immobilizations | Measures supportive, team-oriented play |
| `trad` | CS/min, early CS, longest life | Measures adherence to farming fundamentals |
| `conf` | Stealth wards, ward guarding, deaths (negative) | Measures team structure and safety |
| `secs` | Vision score, ward takedowns, damage mitigation | Measures defensive positioning |
| `univ` | Champion diversity, role flexibility | Measures adaptability |

**Example Output** (one game):
```python
{
  "power": {"goldEarnedperMin": 340.5, "magicDamageDealtToChampions": 15234, ...},
  "achiev": {"firstBloodKill": 1.0, "killingSprees": 2.0, "teamDamagePercentage": 0.25, ...},
  "bene": {"killParticipation": 0.68, "controlWardsPlaced": 3.0, ...},
  ...
}
```

---

#### **Step 2: Weighted Value Scoring** (`score_values`)

Each of the 10 Schwartz values has a formula defined in the `WEIGHTS` dictionary (lines 209-262):

**Complete Feature Mapping:**

```python
WEIGHTS = {
    "Power": [
        ("power.goldEarnedperMin", 1.0),
        ("power.magicDamageDealtToChampions", 0.5),
        ("power.physicalDamageDealtToChampions", 0.5),
        ("power.damageSelfMitigated", 0.2),
    ],
    "Achievement": [
        ("achiev.firstBloodKill", 0.8),
        ("achiev.killingSprees", 0.6),
        ("achiev.teamDamagePercentage", 0.8),
        ("achiev.highkda", 0.6),
    ],
    "Hedonism": [
        ("hed.takedownsInEnemyFountain", 1.0),
        ("hed.twentyMinionsIn3SecondsCount", 0.5),
        ("hed.blastConeOppositeOpponentCount", 0.3),
    ],
    "Stimulation": [
        ("stim.bountyGold", 0.6),
        ("stim.epicMonsterSteals", 0.8),
        ("stim.killsNearEnemyTurret", 0.5),
        ("stim.deaths", 0.2),  # Aggressive = more deaths
    ],
    "Self-Direction": [
        ("selfD.soloKills", 0.8),
        ("selfD.knockEnemyIntoTeamAndKill", 0.5),
        ("selfD.goldSpentperMin", 0.3),
    ],
    "Benevolence": [
        ("bene.killParticipation", 1.0),
        ("secs.visionScorePerMinute", 0.8),  # Vision = teamwork
        ("secs.wardTakedowns", 0.5),
        ("bene.controlWardsPlaced", 0.5),
        ("bene.immobilizeAndKillWithAlly", 0.5),
    ],
    "Tradition": [
        ("trad.csPerMin", 0.8),
        ("trad.csPerMinPre10", 0.8),
        ("secs.longestTimeSpentLiving", 0.2),
    ],
    "Conformity": [
        ("bene.stealthWardsPlaced", 0.3),
        ("secs.wardsGuarded", 0.3),
        ("secs.deaths", -0.6),  # Negative: avoiding deaths
    ],
    "Security": [
        ("secs.visionScorePerMinute", 0.8),
        ("secs.wardTakedowns", 0.5),
        ("secs.damageSelfMitigated", 0.4),
        ("secs.killsUnderOwnTurret", 0.3),
    ],
    "Universalism": []  # Injected as diversity bonus later
}
```

**Formula**: For each game, for each value:
```python
value_score = sum(weight * feature_value for feature, weight in WEIGHTS[value])
```

**Example** (one game, Power calculation):
```python
Power = (340.5 * 1.0) + (15234 * 0.5) + (8921 * 0.5) + (5123 * 0.2)
      = 340.5 + 7617 + 4460.5 + 1024.6
      = 13442.6
```

---

#### **Step 3: Z-Score Normalization** (`zscore_rows`)

**The Problem**: Different values have wildly different scales:
- Power (gold-based): 2000-5000
- Conformity (ward-based): -2 to +2
- Without normalization, Power always dominates

**The Solution**: Normalize each value **independently** across all games in the quarter:

```python
def _z(xs: List[float]) -> List[float]:
    n = len(xs)
    if n == 0: return []
    mu = sum(xs) / n
    var = sum((x - mu) ** 2 for x in xs) / n
    sd = math.sqrt(var) or 1.0  # Avoid division by zero
    return [(x - mu) / sd for x in xs]

def zscore_rows(rows: List[Dict[str, float]]) -> List[Dict[str, float]]:
    """
    For each value (column), compute z-scores independently.
    This gives all 10 values equal footing in the ranking.
    """
    keys = sorted({k for r in rows for k in r})
    cols = {k: [r.get(k, 0.0) for r in rows] for k in keys}
    zs = {k: _z(vals) for k, vals in cols.items()}
    return [{k: zs[k][i] for k in keys} for i in range(len(rows))]
```

**Example** (Player with 3 games):

| Game | Power (raw) | Benevolence (raw) | Tradition (raw) |
|------|-------------|-------------------|-----------------|
| 1 | 4200 | 15 | 180 |
| 2 | 3800 | 28 | 175 |
| 3 | 5100 | 12 | 182 |
| **Mean** | 4366.7 | 18.3 | 179.0 |
| **Std** | 559.4 | 7.0 | 2.9 |

**Z-Scores**:
| Game | Power (z) | Benevolence (z) | Tradition (z) |
|------|-----------|-----------------|---------------|
| 1 | -0.30 | -0.47 | +0.34 |
| 2 | -1.01 | +1.39 | -1.38 |
| 3 | +1.31 | -0.90 | +1.03 |
| **Avg** | 0.0 | 0.0 | 0.0 |

---

#### **Step 4: Aggregation & Ranking**

```python
# Average z-scores across all games (gives normalized profile)
values_normalized = aggregate_mean(zscored_per_game)

# Also keep raw scores for display
raw_aggregated = aggregate_mean(raw_per_game)

# Rank by z-score (fair comparison)
top_by_zscore = sorted(values_normalized.items(), key=lambda kv: kv[1], reverse=True)[:3]

# But display raw scores (cross-player comparison)
top_values = [(name, raw_aggregated[name]) for name, _ in top_by_zscore]
```

**Why this hybrid approach?**
- **Rank by z-score**: Ensures all 10 values have equal chance (no scale bias)
- **Display raw scores**: Enables friend comparison (upload journeys and see who has higher Benevolence!)

---

#### **Key Functions**

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `bundles_from_participant(p)` | Extract features | Participant dict | Bundle dict |
| `score_values(bundles_list)` | Weight features into values | List of bundles | List of raw value dicts |
| `zscore_rows(rows)` | Normalize per-value | List of raw value dicts | List of z-score dicts |
| `aggregate_mean(vecs)` | Average across games | List of dicts | Single dict (averages) |
| `chapter_stats(bundles)` | Aggregate non-value stats | List of bundles | Stats dict (KDA, CS, etc.) |
| `universalism_bonus(bundles)` | Champion & role diversity | List of bundles | Float (0.0-1.0) |

---

#### **Playstyle Values** (Schwartz Theory Adaptation)

Inspired by Schwartz's theory of basic human values, adapted for League:

| Value | Psychological Meaning | LoL Behaviors |
|-------|----------------------|---------------|
| **Power** | Dominance, control, prestige | Gold/min, damage dealt, carry potential |
| **Achievement** | Personal success, competence | First bloods, KDA, team damage % |
| **Hedonism** | Pleasure, sensuous gratification | Fountain kills, flashy plays, BM |
| **Stimulation** | Excitement, novelty, challenge | Risky plays, steals, near-death escapes |
| **Self-Direction** | Independent thought, creativity | Solo kills, unique builds, 1v1s |
| **Benevolence** | Preserving welfare of close others | Assists, vision for team, peeling |
| **Tradition** | Respect for customs, humility | CS fundamentals, standard builds |
| **Conformity** | Restraint, not violating norms | Team structure, low deaths, safe play |
| **Security** | Safety, stability of self & team | Vision control, defensive positioning |
| **Universalism** | Understanding, tolerance, welfare of all | Diverse champion pool, role flexibility |

---

### `bedrock_lore.py`

**Purpose**: AI generation via Amazon Bedrock (Mistral 7B Instruct)

**Functions**:
- `generate_quarter_lore()`: Region-specific narrative
- `generate_quarter_reflection()`: Role-specific performance feedback
- `generate_finale_lore()`: Season-long conclusion
- `generate_finale_reflection()`: Consolidated insights
- `generate_friend_comparison_lore()`: Relationship narrative (Allies vs Rivals)

See [main README](../README.md#how-lore-generation-works) for complete prompt engineering details, parameters, and examples.

---

### `advanced_analytics.py`

**Purpose**: Enhanced finale analytics (trends, highlights, insights)

**Functions**:

#### `calculate_trends(quarters_data)`
- Linear regression across quarters
- KDA, CS, gold, vision trends
- Percentage change and best quarter

#### `extract_best_moments(matches, puuid)`
- Best KDA game
- Most kills game
- Most damage game
- Perfect games (0 deaths)
- First bloods, pentakills

#### `analyze_champion_pool(matches, puuid)`
- Top champions with KDA and win rate
- One-tricks identification (>30% of games on one champ)
- Versatility score (Shannon entropy)

#### `find_comeback_games(matches, puuid)`
- Games with gold deficit > 3000 at 15 min but won
- Resilience score calculation

#### `generate_insights(quarters_data, highlights, champion_analysis, comebacks)`
- AI-driven insights with priority (high/medium/low)
- Pattern recognition (consistency, adaptability, resilience)

#### `generate_year_summary(quarters_data, highlights, champion_analysis, comebacks)`
- Overall achievements, strengths, growth areas
- Best quarter identification
- Overall trend (improving/steady/needs_focus)

**Output** (added to finale.json):
```json
{
  "trends": {...},
  "highlights": {...},
  "champion_analysis": {...},
  "comebacks": {...},
  "insights": [...],
  "year_summary": {...}
}
```

---

### `common.py`

**Purpose**: Shared utilities

**Functions**:
- `get_puuid(region, game_name, tag_line)`: Resolve Riot ID → PUUID
- `get_match_ids(region, puuid, start_ts, end_ts, count)`: Query match IDs
- `get_match_detail(region, match_id)`: Fetch match data
- Platform → region mapping (`PLATFORM_TO_REGION`)

---

## 📊 Data Flow

### Standard Flow (API Fetch Mode)

```
1. POST /journey
   └─> ApiFunction
       ├─> Cache check (skip if bypassCache=true)
       │   └─> If hit: return existing jobId
       ├─> Create DynamoDB entry
       │   └─> quarters: {Q1: "pending", Q2: "pending", ...}
       └─> Enqueue SQS FetchQueue: {jobId, quarter: "Q1"}

2. FetchQueue → FetchQuarterFunction
   ├─> Resolve PUUID
   ├─> Query Riot API for match IDs
   ├─> Fetch match details (parallel)
   ├─> Save to S3: jobId/Q1/{matchId}.json
   ├─> Update DynamoDB: quarters.Q1 = "fetched"
   └─> Enqueue ProcessQueue: {jobId, quarter: "Q1"}

3. ProcessQueue → ProcessQuarterFunction
   ├─> Load matches from S3
   ├─> Calculate stats (stats_inference.py)
   ├─> Determine region (choose_region_arc)
   ├─> Generate lore (Bedrock)
   ├─> Generate reflection (Bedrock)
   ├─> Save story.json to S3: jobId/Q1/story.json
   ├─> Update DynamoDB: quarters.Q1 = "ready"
   └─> If Q1: Enqueue FetchQueue: {quarter: "Q2"}
       If Q2: Enqueue FetchQueue: {quarter: "Q3"}
       If Q3: Enqueue FetchQueue: {quarter: "Q4"}
       If Q4: Generate finale.json with advanced analytics

4. GET /status/{jobId} (polled by frontend every 3s)
   └─> Returns quarter statuses
       └─> Frontend loads story.json when "ready"
```

---

### Upload Flow (Pre-fetched Matches)

```
1. POST /journey/upload
   └─> ApiFunction
       ├─> Validate uploadedMatches (Q1-Q4 present)
       ├─> Upload to S3: jobId/Q1/matches.json, Q2/..., etc.
       ├─> Create DynamoDB entry
       │   └─> quarters: {Q1: "fetched", Q2: "fetched", ...}
       └─> Enqueue ProcessQueue (all 4 quarters immediately)
           └─> {jobId, quarter: "Q1", preProcessed: true}
           └─> {jobId, quarter: "Q2", preProcessed: true}
           └─> {jobId, quarter: "Q3", preProcessed: true}
           └─> {jobId, quarter: "Q4", preProcessed: true}

2. ProcessQueue → ProcessQuarterFunction (x4 in parallel)
   └─> Same as standard flow (steps 3-4)
```

**Benefit**: Bypasses Riot API rate limits, useful for testing or batch processing.

---

## 🗂️ DynamoDB Schema

**Table**: `rift-rewind-jobs-{AccountId}`

**Primary Key**: `jobId` (String)

**Attributes**:
```json
{
  "jobId": "uuid",
  "riotId": "PlayerName#TAG",
  "platform": "euw1",
  "archetype": "explorer",
  "createdAt": 1672531200,
  "status": "running",
  "s3Base": "uuid/",
  "quarters": {
    "Q1": "ready",
    "Q2": "ready",
    "Q3": "processing",
    "Q4": "pending"
  },
  "uploadedData": false,
  "puuid": "abc123..." 
}
```

---

## 🪣 S3 Structure

**Bucket**: `rift-rewind-data-{AccountId}-{Region}`

**Layout**:
```
{jobId}/
├── Q1/
│   ├── index.json            # Match IDs list
│   ├── {matchId}.json        # Individual match data
│   ├── matches.json          # (Upload mode: all matches)
│   └── story.json            # Generated narrative + stats
├── Q2/
│   └── ...
├── Q3/
│   └── ...
├── Q4/
│   └── ...
└── finale.json               # Season summary with advanced analytics
```

**Public Access**:
- `*/story.json` and `*/finale.json` are publicly readable (via bucket policy)
- Frontend fetches directly from S3 (no Lambda proxying)

---

## ⚙️ Configuration

### Environment Variables

Set in `template.yaml` for each Lambda:

| Variable | Description | Example |
|----------|-------------|---------|
| `TABLE_NAME` | DynamoDB jobs table | `rift-rewind-jobs-{AccountId}` |
| `BUCKET_NAME` | S3 data bucket | `rift-rewind-data-{AccountId}-{Region}` |
| `FETCH_QUEUE_URL` | SQS fetch queue | `https://sqs.{region}.amazonaws.com/...` |
| `PROCESS_QUEUE_URL` | SQS process queue | `https://sqs.{region}.amazonaws.com/...` |
| `RIOT_API_KEY` | Riot API key | `RGAPI-...` |
| `MAX_MATCHES_PER_QUARTER` | Match limit | `50` |
| `MAX_CONCURRENCY` | Parallel fetches | `8` |
| `REGION_HINT` | AWS region | `eu-west-1` |

---

### Files

- **`template.yaml`**: SAM template (all resources)
- **`samconfig.toml`**: SAM deployment config
- **`src/requirements.txt`**: Python dependencies
- **`events/`**: Test event payloads for local invocation

---

## 🚀 Deployment

### Prerequisites

- AWS CLI configured with credentials
- SAM CLI installed (`brew install aws-sam-cli`)
- Python 3.11+
- Valid Riot API key

---

### Steps

1. **Update Riot API key** in `template.yaml`:
   ```yaml
   Environment:
     Variables:
       RIOT_API_KEY: "RGAPI-your-key-here"
   ```

2. **Build Lambda packages**:
```bash
cd infra
sam build
   ```

3. **Deploy (first time)**:
   ```bash
sam deploy --guided
   ```
   
   Follow prompts:
   - Stack name: `rift-rewind`
   - Region: `eu-west-1` (or your region)
   - Confirm changes: `y`
   - Allow SAM CLI IAM role creation: `y`
   - Save arguments to config: `y`

4. **Subsequent deployments**:
   ```bash
sam deploy --no-confirm-changeset
```

---

### What Gets Created

- **Lambda Functions**:
  - `rift-rewind-api` (512 MB, 120s timeout)
  - `rift-rewind-fetch` (1024 MB, 900s timeout)
  - `rift-rewind-process` (1024 MB, 300s timeout)

- **DynamoDB Table**: `rift-rewind-jobs-{AccountId}`
  - Billing: On-demand
  - Primary key: `jobId`

- **S3 Bucket**: `rift-rewind-data-{AccountId}-{Region}`
  - CORS enabled for GET/HEAD
  - Public read policy for story files

- **SQS Queues**:
  - `rift-rewind-fetch-{AccountId}` (1800s visibility, 24h retention)
  - `rift-rewind-process-{AccountId}` (300s visibility, 24h retention)

- **API Gateway**: HTTP API with CORS
  - Routes: `POST /journey`, `POST /journey/upload`, `GET /status/{jobId}`

- **IAM Roles**: Least-privilege roles for each Lambda
  - DynamoDB read/write
  - S3 read/write
  - SQS send/receive
  - Bedrock invoke
  - CloudWatch Logs

---

## 🧪 Local Development

### Run API Locally

```bash
sam local start-api --port 3001
```

Access at `http://localhost:3001`

---

### Invoke Function Directly

```bash
# Test API function
sam local invoke ApiFunction --event events/post_journey.json

# Test with custom event
sam local invoke ProcessQuarterFunction \
  --event events/process_quarter.json \
  --env-vars env.json
```

---

### Test Individual Modules

```bash
cd src

# Test stats calculation
python -c "from stats_inference import chapter_stats; print(chapter_stats([...], 'puuid'))"

# Test Bedrock integration (requires AWS credentials)
python -c "from bedrock_lore import generate_quarter_lore; print(generate_quarter_lore(...))"
```

---

## 📈 Monitoring

### CloudWatch Logs

- `/aws/lambda/rift-rewind-api`
- `/aws/lambda/rift-rewind-fetch`
- `/aws/lambda/rift-rewind-process`

**Tail logs**:
```bash
aws logs tail /aws/lambda/rift-rewind-process --follow
```

---

### Metrics to Monitor

- **Lambda Invocations**: Number of executions
- **Lambda Errors**: Failed invocations
- **Lambda Duration**: Execution time (watch for timeouts)
- **SQS Messages**: ApproximateNumberOfMessages (backlog)
- **DynamoDB Throttles**: ReadThrottleEvents/WriteThrottleEvents

---

### Common Issues

#### 1. **Rate limit exceeded (Riot API)**

**Symptom**: Fetch Lambda fails with 429 status

**Solution**:
- Reduce `MAX_CONCURRENCY` in template.yaml
- Add exponential backoff in fetch_quarter.py (already implemented)
- Consider distributed fetch across multiple accounts

---

#### 2. **Quarters stuck on "fetched"**

**Symptom**: Quarter never moves to "ready"

**Cause**: Process Lambda failed or SQS message not delivered

**Solution**:
1. Check CloudWatch logs for ProcessQuarterFunction
2. Verify Bedrock permissions in IAM role
3. Check SQS queue for dead-letter messages
4. Manually update DynamoDB status if needed:
   ```bash
   aws dynamodb update-item \
     --table-name rift-rewind-jobs-{AccountId} \
     --key '{"jobId": {"S": "uuid"}}' \
     --update-expression "SET quarters.Q1 = :status" \
     --expression-attribute-values '{":status": {"S": "ready"}}'
   ```

---

#### 3. **Finale not generating**

**Symptom**: Q4 completes but no finale.json

**Cause**: Process Lambda failing at finale generation step

**Solution**:
1. Check CloudWatch logs for advanced_analytics.py errors
2. Verify all 4 quarters have valid story.json in S3
3. Check Bedrock quota limits

---

#### 4. **Cache not working**

**Symptom**: Every request creates new job even with same riotId

**Cause**: Cache logic not finding existing jobs

**Solution**:
1. Verify DynamoDB scan filter expression
2. Check that previous job has all quarters = "ready"
3. Use `bypassCache: true` to force new job creation

---

## 💰 Cost Optimization

### Estimated Monthly Costs (1000 journeys)

- **Lambda**: ~$2 (within free tier for most)
- **DynamoDB**: ~$0.50 (on-demand pricing)
- **S3**: ~$0.10 (<1 GB storage, minimal requests)
- **SQS**: Free (first 1M requests)
- **Bedrock**: ~$5 (Mistral 7B @ ~$0.001/1K tokens)
- **API Gateway**: ~$1 (HTTP API)

**Total**: ~$8-10/month for 1000 complete journeys

---

### Optimization Tips

1. **Use cache**: Avoid re-fetching identical jobs
2. **Reduce MAX_MATCHES_PER_QUARTER**: Fewer matches = faster processing
3. **Batch Bedrock calls**: Combine lore + reflection (already optimized)
4. **Use reserved DynamoDB capacity**: If traffic is predictable
5. **S3 lifecycle policy**: Archive old jobs to Glacier after 30 days

---

## 🔐 Security

### Best Practices

- ✅ **API key in environment variables** (not hardcoded)
- ✅ **Least-privilege IAM roles** (each Lambda has minimal permissions)
- ✅ **CORS configured** for frontend origin only (or `*` for demo)
- ✅ **S3 bucket policy** restricts public access to story files only
- ✅ **No PII storage** (PUUID is hashed identifier, not personal data)
- ✅ **CloudWatch Logs** encrypted at rest

### API Key Rotation

When Riot API key expires:

```bash
# 1. Update template.yaml
vim infra/template.yaml  # Update RIOT_API_KEY variable

# 2. Redeploy
sam build
sam deploy --no-confirm-changeset
```

---

## 🧬 Advanced Features

### Story Continuity

Process Lambda tracks previous quarters to maintain narrative coherence:

```python
previous_quarters = [
    {"quarter": "Q1", "region": "Demacia", "lore": "...", "reflection": "..."}
]
generate_quarter_lore(..., previous_quarters=previous_quarters)
```

AI receives context from past chapters to build a connected story arc.

---

### Dynamic Region Selection

Regions are chosen algorithmically based on playstyle values:

- **Q1**: Dominant value (starting point)
- **Q2**: Biggest change (growth)
- **Q3**: Biggest decline (challenge/conflict)
- **Q4**: Dominant value (resolution/mastery)

Creates a 4-act structure: Setup → Growth → Challenge → Resolution

---

### Playstyle Value Normalization

Raw per-game values are z-score normalized **per-value** across games:

```python
z = (x - mean(value_over_games)) / std(value_over_games)
```

This prevents scale bias (e.g., "Power" having larger raw numbers than "Tradition") and ensures fair top-3 ranking.

---

## 🔮 Future Enhancements

- [ ] **WebSocket support**: Real-time status updates (replace polling)
- [ ] **Caching layer**: ElastiCache for Riot API responses
- [ ] **Batch processing**: Process multiple users in parallel
- [ ] **Admin dashboard**: Monitor jobs, queue depths, errors
- [ ] **Retry logic**: Dead-letter queue handling
- [ ] **Circuit breaker**: Graceful degradation if Riot API down
- [ ] **GSI on DynamoDB**: Faster cache lookups (riotId + platform index)
- [ ] **Multi-model AI**: Compare Mistral vs Claude vs GPT-4 narratives

---

## 📚 Related Documentation

- **Frontend**: See [`../frontend/README.md`](../frontend/README.md) for React app, components, and deployment
- **Main Project**: See [`../README.md`](../README.md) for overall architecture, features, and getting started

---

## 🛠️ Troubleshooting Commands

### Check DynamoDB Item
   ```bash
   aws dynamodb get-item \
  --table-name rift-rewind-jobs-{AccountId} \
  --key '{"jobId": {"S": "uuid"}}'
   ```

### List S3 Files for Job
   ```bash
aws s3 ls s3://rift-rewind-data-{AccountId}-{Region}/{jobId}/ --recursive
   ```

### Monitor SQS Queue Depth
   ```bash
   aws sqs get-queue-attributes \
     --queue-url {queue-url} \
     --attribute-names ApproximateNumberOfMessages
   ```

### Manually Trigger Processing
```bash
aws sqs send-message \
  --queue-url {process-queue-url} \
  --message-body '{"jobId": "uuid", "quarter": "Q1", "archetype": "explorer"}'
```

---

**For questions or issues, check CloudWatch logs first, then DynamoDB status, then S3 file structure.**

*Built with AWS Serverless for scalability, reliability, and cost-efficiency.*
