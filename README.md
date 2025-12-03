# Rift Rewind v2 🎮

**A League of Legends journey through Runeterra** - An AI-powered narrative experience that transforms your 2025 ranked season into an epic saga across the regions of Runeterra.

![Rift Rewind Banner](https://img.shields.io/badge/League%20of%20Legends-Season%202025-gold?style=for-the-badge)
![AWS](https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazonaws)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)

## 🌟 Overview

Rift Rewind v2 analyzes your League of Legends ranked matches from 2025 and creates a personalized narrative journey through Runeterra. Each quarter of the year corresponds to a different region, dynamically selected based on your playstyle and performance.

### Key Features

- **🤖 AI-Generated Narratives**: Powered by Amazon Bedrock (Mistral 7B Instruct)
- **📊 Quarterly Analysis**: Year divided into equal quarters by match count
- **🗺️ Dynamic Region Mapping**: Runeterra regions chosen based on your playstyle values
- **🎯 Personalized Insights**: AI-generated reflections and actionable tips
- **📈 Performance Tracking**: Visual progression of key metrics across quarters
- **🤝 Friend Comparison**: Compare two journeys with AI-generated relationship analysis
- **💾 Journey Export/Import**: Download complete journeys or upload pre-processed data
- **⚡ Serverless Architecture**: AWS Lambda, DynamoDB, S3, SQS, API Gateway, Bedrock
- **🔄 Cache System**: Avoid re-processing identical journeys (with bypass option)
- **📤 Upload Mode**: Skip Riot API and process pre-fetched matches locally

## 📖 How It Works

### Your Season, Divided into Chapters

Rift Rewind transforms your 2025 ranked season into a story by dividing all your matches into **four equal quarters by count** (not time):

| Chapter | Distribution | Narrative Role |
|---------|--------------|----------------|
| **Q1** | First 25% of matches | Your journey begins |
| **Q2** | Matches 26-50% | Growth and adaptation |
| **Q3** | Matches 51-75% | Challenges and trials |
| **Q4** | Final 25% of matches | Mastery and resolution |

**How it works:**
1. System fetches ALL your 2025 ranked matches from Riot API
2. Sorts them chronologically by game creation time
3. Divides into 4 equal groups by position (not calendar quarters)
4. Each quarter gets roughly the same number of games

This ensures:
- ✅ Balanced sample sizes for statistical accuracy
- ✅ Consistent storytelling pace
- ✅ Fair comparison across quarters
- ✅ Works for any play schedule (casual or hardcore)

Each quarter becomes one chapter of your Runeterra adventure, complete with:
- 🗺️ A **unique region** chosen based on playstyle evolution
- 📜 **AI-generated lore** (200-300 words) telling your story in that region  
- 💭 **Performance reflection** with actionable tips (50-100 words)
- 📊 **Stats summary** showing your performance metrics
- ⭐ **Top 3 playstyle values** that defined your gameplay
- 🏆 **Top champions** with game counts

After all four chapters, you get a **Finale** with:
- 📈 Performance trends across all quarters
- 🎯 Season highlights (best games, achievements)
- 🏅 Champion mastery analysis
- 💡 AI-generated insights (high/medium/low priority)
- 📊 Year summary with overall assessment

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   API Fetch  │  │ Upload Mode  │  │   Compare    │     │
│  │   (Riot API) │  │  (Pre-fetch) │  │  (Friends)   │     │
│  └───────┬──────┘  └──────┬───────┘  └──────────────┘     │
└──────────┼─────────────────┼──────────────────────────────┘
           │                 │
           ▼                 ▼
┌─────────────────────────────────────────┐
│         API Gateway (HTTP API)          │
│  POST /journey                          │
│  POST /journey/upload                   │
│  GET  /status/{jobId}                   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐     ┌──────────────┐
│         API Lambda (api.py)             │────▶│  DynamoDB    │
│  - Create journey                       │     │  Job Status  │
│  - Cache check                          │     └──────────────┘
│  - Status retrieval                     │
└──────────┬──────────────────────────────┘
           │
           ├─────────────────┐
           ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│   SQS Fetch      │  │  SQS Process     │
│   Queue          │  │  Queue           │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐     ┌──────────────┐
│  Fetch Lambda    │  │ Process Lambda   │────▶│   Bedrock    │
│  (fetch_quarter) │  │ (process_quarter)│     │  (Mistral)   │
└────────┬─────────┘  └────────┬─────────┘     └──────────────┘
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│   Riot API       │  │   S3 Bucket      │
│   (Matches)      │  │   (Stories)      │
└──────────────────┘  └──────────────────┘
```

### Data Flow

#### Mode 1: API Fetch (Standard)
```
User → Frontend → API Gateway → API Lambda → SQS Fetch Queue
  → Fetch Lambda (Riot API) → S3 (matches) → SQS Process Queue
  → Process Lambda (stats + AI) → S3 (story.json) → Frontend
```

#### Mode 2: Upload Pre-fetched Matches
```
User → Frontend (upload JSON) → API Gateway → API Lambda
  → S3 (uploaded matches) → SQS Process Queue (all 4 quarters)
  → Process Lambda (stats + AI) → S3 (story.json) → Frontend
```

#### Mode 3: Friend Comparison
```
User → Upload 2 journey JSONs → Frontend calculates similarity
  → Bedrock (comparison lore) → Interactive comparison view
```

### Components

1. **Frontend** ([`/frontend`](frontend/README.md))
   - **React 19** SPA with TypeScript
   - **Three modes**: API fetch, upload matches, friend comparison
   - Hosted on S3 as static website
   - Real-time status polling (3s intervals)
   - Interactive chapter navigation
   - Journey export/import
   - Friend comparison with AI lore
   - Recharts for data visualization
   - Framer Motion for animations

2. **Backend** ([`/infra`](infra/README.md))
   - **API Lambda** (`api.py`):
     - Journey creation (API fetch or upload)
     - Cache system (avoid duplicate jobs)
     - Status retrieval
   - **Fetch Lambda** (`fetch_quarter.py`):
     - Retrieves match data from Riot API
     - Concurrent fetching (configurable)
     - Rate limit handling
   - **Process Lambda** (`process_quarter.py`):
     - Stats calculation (`stats_inference.py`)
     - Dynamic region selection based on playstyle arc
     - AI lore generation (`bedrock_lore.py`)
     - Role-specific reflections
     - Advanced analytics (finale only)
   - **DynamoDB**: Tracks job status and quarter completion
   - **S3**: Stores match data and generated stories
   - **SQS**: Queue-based processing (Fetch → Process)

3. **AI Generation**
   - **Amazon Bedrock** with Mistral 7B Instruct
   - Contextual lore generation based on region
   - Story continuity across quarters
   - Role-specific performance reflections
   - Friend comparison narratives (Allies vs Rivals)
   - Advanced insights with priority ranking

## 🎨 Features in Detail


### Runeterra Regions

Regions are dynamically chosen based on your **dominant playstyle values** in each quarter:

| Region | Primary Values | Theme |
|--------|---------------|-------|
| **Demacia** | Conformity, Tradition | Justice, order, team synergy |
| **Noxus** | Power, Achievement | Strength, conquest, dominance |
| **Ionia** | Self-Direction, Universalism | Balance, independence, harmony |
| **Piltover** | Achievement, Stimulation | Progress, innovation, efficiency |
| **Zaun** | Stimulation, Hedonism | Chaos, risk-taking, experimentation |
| **Freljord** | Tradition, Security | Endurance, consistency, resilience |
| **Shurima** | Security, Conformity | Control, vision, ancient wisdom |
| **Bilgewater** | Hedonism, Stimulation | Adventure, bold plays, freedom |
| **Targon** | Conformity, Benevolence | Ascension, support, teamwork |
| **Shadow Isles** | (Negative values) | Dark themes, struggles |

**Region Selection Logic:**
- Q1: Dominant value (highest) → Starting region
- Q2: Biggest positive growth → Region of advancement  
- Q3: Biggest decline OR challenge → Region of trials
- Q4: Dominant value (mastery) → Resolution region

This creates a narrative arc: Start → Grow → Struggle → Master

### Playstyle Values

10 psychological values adapted from Schwartz's theory for League of Legends:

| Value | Measures | Key Stats |
|-------|----------|-----------|
| **Power** | Gold earned, damage dealt, dominance | Gold/min, damage to champions, damage share |
| **Achievement** | Kills, efficiency, performance | First bloods, killing sprees, damage %, multikills |
| **Hedonism** | Playmaking, risk-taking | Kill participation, damage taken, close calls |
| **Stimulation** | Variety, experimentation | Champion pool, early aggression, roaming |
| **Self-Direction** | Independence, CS mastery | CS/min, solo kills, gold efficiency |
| **Benevolence** | Supporting teammates | Assists, heal/shield power, ally saves |
| **Tradition** | Consistency, farming | CS consistency, early farm, game time |
| **Conformity** | Team synergy, structure | Teamfight participation, ping usage, ward synergy |
| **Security** | Vision, safety, control | Vision score, control wards, survival time |
| **Universalism** | Map presence, objectives | Objective damage, ward coverage, epic monsters |

**Value Calculation (Per Game):**
1. Extract 50+ behavioral metrics from Riot API
2. Apply weighted formula per value (see `stats_inference.py`)
3. Calculate raw score (e.g., Power = gold/min × 1.0 + damage × 0.5 + ...)

**Normalization (Per Quarter):**
- Raw scores are kept for display and cross-player comparison
- Internally, z-scores are used to rank values fairly
- Top 3 values = highest z-scores (most distinctive for you)

**Why raw scores for display?**
- Enables comparison between different players
- Intuitive: bigger number = more of that behavior
- Consistent across quarters

### Advanced Analytics (Finale)

After Q4 completion, the finale includes:

- **Performance Trends**: KDA, CS/min, gold/min, vision score tracked across all 4 quarters
- **Highlights**:
  - Best KDA game (champion, KDA value)
  - Most kills/damage in a single game
  - Perfect games (zero deaths)
  - Pentakills, quadrakills, first bloods
  - Comeback wins (3000+ gold deficit reversed)
  - Clutch baron/dragon steals
  - Highest CS and vision games
- **Champion Analysis**:
  - Top 5 most played champions with stats
  - Total unique champions played
  - Versatility score (0-100, measures champion pool diversity)
  - One-trick detection (>30% games on one champion)
- **AI-Generated Insights**:
  - High/medium/low priority observations
  - Category-based (Combat, Vision, Progress, Champion Pool, etc.)
  - Specific, actionable recommendations
- **Year Summary**:
  - Total games, averages (KDA, CS, vision)
  - Notable achievements (formatted with emojis)
  - Key strengths and growth areas
  - Overall trend assessment (improving/stable/declining)

### Friend Comparison

Compare two players' journeys to see how they relate:

**How it works:**
1. Upload two complete journey JSON files (must have `type: "complete-journey"`)
2. **Frontend calculates**:
   - Cosine similarity of normalized playstyle values (all 4 quarters averaged)
   - Shared top values (appear in both players' top 3)
   - Conflicting values (strong for one, weak for other)
3. **Relationship determination**:
   - **Allies** (similarity > 0.7): Similar playstyles, complementary strengths
   - **Rivals** (similarity ≤ 0.7): Contrasting styles, competitive dynamic
4. **Backend generates**:
   - AI-powered comparison lore (200-300 words) via Amazon Bedrock
   - Weaves in player names, top champions, shared/conflicting values
   - Creates narrative based on relationship type
5. **Display**:
   - Side-by-side player cards with stats
   - Interactive radar chart comparing playstyle values
   - Trend charts for each metric over quarters
   - Exportable comparison report

**What makes players allies vs rivals?**
- Similarity score based on behavioral patterns, not just stats
- Allies: Share core values (e.g., both high Benevolence + Security)
- Rivals: Opposite strengths (e.g., one Power-focused, one Tradition-focused)

### Cache System

Avoid duplicate processing:

- API checks for existing completed jobs (same riotId + platform)
- Returns cached jobId if found (saves API calls and processing time)
- **Bypass**: Check "Force refresh" to create new journey
- Useful after stats bug fixes or for updated narratives

## 🚀 Prerequisites

- **AWS Account** with permissions for:
  - Lambda, DynamoDB, S3, SQS, API Gateway
  - Bedrock (Mistral 7B model access)
- **Node.js** 18+ and npm
- **Python** 3.11+
- **AWS CLI** configured with credentials
- **SAM CLI** for backend deployment
- **Riot Games API Key** ([Get one here](https://developer.riotgames.com/))

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/rift-rewind.git
cd rift-rewind
```

### 2. Backend Setup

```bash
cd infra

# Install Python dependencies locally (for development)
pip install -r src/requirements.txt
```

Update your Riot API key in `infra/template.yaml`:

```yaml
Environment:
  Variables:
    RIOT_API_KEY: "RGAPI-your-key-here"
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Update API endpoint in `frontend/src/api.ts`:

```typescript
const API_BASE_URL = 'https://your-api-id.execute-api.region.amazonaws.com';
```

## 🎯 Deployment

### Backend Deployment

```bash
cd infra

# Build Lambda packages
sam build

# First deployment (interactive)
sam deploy --guided

# Subsequent deployments
sam deploy --no-confirm-changeset
```

**What gets deployed:**
- 3 Lambda functions (API, Fetch, Process)
- DynamoDB table for job tracking
- S3 bucket for match data and stories
- 2 SQS queues (Fetch, Process)
- API Gateway HTTP API
- IAM roles and policies

**Outputs** (save these):
- API Gateway URL (update in frontend/src/api.ts)
- S3 bucket name (update in frontend/src/api.ts)

### Frontend Deployment

```bash
cd frontend

# Build for production
npm run build

# Deploy to S3
aws s3 sync dist/ s3://your-frontend-bucket --delete --region your-region
```

Configure S3 static website hosting:
- Index document: `index.html`
- Error document: `index.html` (for SPA routing)

### S3 Bucket Policy

Apply public read policy for story files:

```bash
aws s3api put-bucket-policy \
  --bucket rift-rewind-data-{account}-{region} \
  --policy file://bucket-policy.json
```

## 🎮 Usage

### For End Users

1. **Visit the website**: Your S3 static website URL or CloudFront domain

2. **Choose a mode**:

   **Mode 1: Fetch from Riot API**
   - Enter summoner name (e.g., `Faker#KR1`)
   - Select region (EUW, NA, KR, etc.)
   - Choose archetype (Explorer, Warrior, Sage, Guardian)
   - Optional: Check "Force refresh" to bypass cache
   - Click "Begin Journey"

   **Mode 2: Upload Pre-fetched Matches**
   - Upload `journey-upload.json` (generated by `create_journey.py`)
   - Supports two formats:
     - Complete journey package (instant display)
     - Raw matches (Q1-Q4 arrays sent to backend)
   - Click "Begin Journey"

   **Mode 3: Compare with Friend**
   - Upload Player 1's journey JSON
   - Upload Player 2's journey JSON
   - View AI-generated comparison narrative
   - Explore interactive charts and stats

3. **Experience the journey**:
   - Watch quarters process sequentially (Q1 → Q2 → Q3 → Q4)
   - Navigate through chapters when ready
   - View region-specific narratives and stats
   - Reach finale with advanced analytics

4. **Export journey**:
   - Download your complete journey as JSON
   - Share with friends for comparison
   - Re-upload for instant viewing

### API Endpoints

**Base URL**: `https://{api-id}.execute-api.{region}.amazonaws.com`

#### Create Journey (Riot API)
```bash
POST /journey

{
  "platform": "euw1",
  "riotId": "PlayerName#TAG",
  "archetype": "explorer",
  "bypassCache": false
}
```

#### Create Journey (Upload)
```bash
POST /journey/upload

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

#### Check Status
```bash
GET /status/{jobId}
```

## 📊 Data Structure

### S3 Storage

```
{jobId}/
├── Q1/
│   ├── index.json            # Match IDs list
│   ├── {matchId}.json        # Individual matches (API mode)
│   ├── matches.json          # Bulk matches (upload mode)
│   └── story.json            # Generated narrative + stats
├── Q2/...
├── Q3/...
├── Q4/...
└── finale.json               # Season summary with analytics
```

### story.json Structure

```json
{
  "quarter": "Q1",
  "region": "Demacia",
  "lore": "AI-generated narrative...",
  "reflection": "Role-specific feedback...",
  "stats": {
    "games": 15,
    "kda_proxy": 3.2,
    "cs_per_min": 5.8,
    "gold_per_min": 340,
    "vision_score_per_min": 1.2,
    "primary_role": "SUPPORT",
    "obj_damage_per_min": 150,
    "kill_participation": 0.62,
    "control_wards_per_game": 2.3
  },
  "values": {
    "Power": 0.12,
    "Benevolence": 0.78,
    ...
  },
  "top_values": [
    ["Benevolence", 0.78],
    ["Achievement", 0.45],
    ["Security", 0.32]
  ],
  "top_champions": [
    {"name": "Thresh", "games": 5},
    {"name": "Nautilus", "games": 4}
  ]
}
```

### finale.json Structure

See [`infra/README.md`](infra/README.md) for complete schema (includes trends, highlights, champion analysis, comebacks, insights, year_summary).

## 🧪 Development

### Local Development

**Backend (Lambda functions)**:
```bash
cd infra

# Start API locally
sam local start-api --port 3001

# Invoke specific function
sam local invoke ProcessQuarterFunction --event events/process_quarter.json
```

**Frontend**:
```bash
cd frontend

# Start dev server
npm run dev  # Opens at http://localhost:5173

# Update API endpoint for local testing
```

### Testing

```bash
# Test with a real summoner
curl -X POST https://your-api-url.amazonaws.com/journey \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "euw1",
    "riotId": "TestPlayer#EUW",
    "archetype": "explorer"
  }'

# Check status
curl https://your-api-url.amazonaws.com/status/{jobId}
```

## 🐛 Troubleshooting

### Issue: Quarters stuck on "fetching" or "fetched"

**Cause**: Lambda execution failed or timeout

**Solution**:
1. Check CloudWatch logs: `/aws/lambda/rift-rewind-fetch` or `/aws/lambda/rift-rewind-process`
2. Verify Riot API key is valid
3. Check SQS queue for messages
4. Manually update DynamoDB if needed (see [`infra/README.md`](infra/README.md))

---

### Issue: Finale not loading (403 Forbidden)

**Cause**: S3 bucket policy doesn't allow public read

**Solution**:
```bash
aws s3api put-bucket-policy \
  --bucket rift-rewind-data-{account}-{region} \
  --policy file://bucket-policy.json
```

---

### Issue: API Key expired

**Cause**: Riot dev keys expire every 24 hours

**Solution**:
1. Get new key from [Riot Developer Portal](https://developer.riotgames.com/)
2. Update `infra/template.yaml`
3. Redeploy: `sam build && sam deploy --no-confirm-changeset`

---

### Issue: Stats look incorrect

**Cause**: Cached data from before bug fixes

**Solution**: Check "Force refresh (bypass cache)" when creating journey

---


## 📁 Project Structure

```
rift-rewind/
├── frontend/                 # React 19 SPA
│   ├── src/
│   │   ├── components/       # Journey, ChapterView, FinalDashboard, etc.
│   │   ├── constants/        # Region themes, value descriptions
│   │   ├── api.ts            # API client
│   │   └── App.tsx           # Entry point with mode selection
│   ├── package.json
│   └── README.md             # Frontend documentation
├── infra/                    # AWS SAM backend
│   ├── src/
│   │   ├── api.py            # API Lambda (journey creation, status)
│   │   ├── fetch_quarter.py  # Fetch Lambda (Riot API)
│   │   ├── process_quarter.py # Process Lambda (stats + AI)
│   │   ├── stats_inference.py # Stats calculation
│   │   ├── bedrock_lore.py   # AI generation
│   │   ├── advanced_analytics.py # Finale analytics
│   │   ├── common.py         # Shared utilities
│   │   └── requirements.txt
│   ├── template.yaml         # SAM template (all AWS resources)
│   ├── samconfig.toml        # SAM deployment config
│   └── README.md             # Backend documentation
├── friend1/                  # Sample journey (for testing comparison)
├── friend2/                  # Sample journey (for testing comparison)
├── bucket-policy.json        # S3 public read policy
├── create_journey.py         # Local journey generator (dev tool)
├── .gitignore
└── README.md                 # This file
```

## 🔬 How Lore Generation Works

### AI-Powered Storytelling with Amazon Bedrock

Rift Rewind uses **Mistral 7B Instruct** via Amazon Bedrock to generate all narrative content. Here's the complete process:

### Quarter Lore (Per Chapter)

**Input to Bedrock:**
```
- Quarter number (Q1-Q4)
- Selected region (e.g., "Demacia")  
- Top 3 playstyle values with scores
- Key stats (KDA, CS/min, vision score, etc.)
- Top champions played
- Previous quarter's lore (for continuity)
- Archetype (Explorer/Warrior/Sage/Guardian)
```

**Prompt structure:**
```
You are a bard narrating a League of Legends journey through Runeterra.

Quarter: Q2
Region: Ionia (focus on balance, independence, harmony)
Values: Self-Direction (108.5), Tradition (95.2), Benevolence (23.1)
Stats: 34 games, 3.2 KDA, 6.5 CS/min, Support role
Champions: Thresh (8), Nautilus (6), Leona (5)
Previous: [Q1 lore excerpt for continuity]

Write 200-300 words describing their journey in Ionia.
- Reference their values and how they manifest in gameplay
- Mention their champions as companions/tools
- Connect to previous quarter's story
- Use epic, immersive language inspired by Runeterra lore
- Make it feel personal and unique to their stats
```

**Model parameters:**
- Temperature: 0.7 (creative but coherent)
- Max tokens: 450 (ensures ~300 words)
- Model: `mistral.mistral-7b-instruct-v0:2`

### Performance Reflection (Per Quarter)

**Input:**
```
- Role (Support, Jungle, ADC, etc.)
- Quarter stats vs. averages
- Value changes vs. previous quarter
```

**Prompt structure:**
```
You are a League of Legends coach providing feedback.

Role: Support
Stats: 1.2 vision/min, 68% kill participation, 2.8 control wards/game
Changes: +15% vision vs Q1, -5% KDA

Give ONE specific, actionable tip (50-100 words) for improvement.
Examples:
- "Increase control ward purchases from 2.8 to 4/game in river bushes"
- "Improve CS/min by practicing wave management under tower"

Be direct, measurable, and role-specific.
```

**Model parameters:**
- Temperature: 0.5 (more focused, practical)
- Max tokens: 150

### Finale Lore (Season Summary)

**Input:**
```
- All 4 quarter lores (for story arc)
- Top value progressions
- Season-wide stats and trends
- Highlights (best games, achievements)
- Player name and archetype
```

**Prompt:**
```
Write a 300-400 word epilogue for {playerName}'s journey.

Their journey:
Q1 (Piltover): [excerpt]
Q2 (Demacia): [excerpt]  
Q3 (Ionia): [excerpt]
Q4 (Freljord): [excerpt]

Progression:
- Power: 78 → 92 → 105 → 115
- KDA: 2.1 → 2.8 → 3.2 → 3.5
- Vision: 0.9 → 1.1 → 1.3 → 1.5

Highlights:
- 10 first bloods, 2 pentakills
- Best KDA: 23.0 on Yasuo

Conclude their story:
- Reflect on growth across all regions
- Tie together the narrative arc
- Celebrate achievements
- Hint at future potential
- Use their name in the final paragraph
```

**Model parameters:**
- Temperature: 0.7
- Max tokens: 600

### Friend Comparison Lore

**Input:**
```
- Player 1: name, top champion, top values, archetype
- Player 2: name, top champion, top values, archetype
- Relationship: allies (0.7+) or rivals (<0.7)
- Shared values: [values both rank top 3]
- Conflicting values: [values opposite for each]
- Similarity score: 0.0-1.0
```

**Prompt:**
```
You are a League of Legends bard narrating two players' relationship.

Player 1: {name} ({champion}, values: {top_values})
Player 2: {name} ({champion}, values: {top_values})
Relationship: {allies/rivals} (similarity: {score})
Shared: {shared_values}
Conflicts: {conflicting_values}

Write 120-150 words describing their dynamic:
- How they complement or contrast each other
- Reference shared and conflicting values
- Use their champions as metaphors
- Epic Runeterra-style language
- Make it feel like a unique duo/rivalry story
```

**Model parameters:**
- Temperature: 0.7
- Max tokens: 220

### Fallback Handling

If Bedrock fails (timeout, rate limit, etc.), system returns sensible fallback:
- **Quarter lore**: Generic region-themed text
- **Reflection**: Basic stat-based tip
- **Comparison**: Simple relationship statement

All lore is **cached in S3** (`story.json` per quarter, `finale.json` for season), so regeneration isn't needed on page refresh.

## 🔬 How Playstyle Values are Calculated

Rift Rewind computes 10 "playstyle values" to summarize your behavioral tendencies each quarter. Based on Schwartz's theory of basic human values, adapted for League of Legends.

### The Calculation Pipeline

#### 1. **Feature Extraction** (Per Game)
From each match JSON, extract 50+ behavioral metrics:
- **Combat**: Kills, assists, deaths, damage dealt/taken, crowd control score
- **Economy**: Gold earned/spent per minute, gold efficiency
- **Vision**: Wards placed/destroyed, vision score, control wards
- **Objectives**: Turret/inhibitor damage, baron/dragon takedowns
- **Farming**: CS/min, early CS/min (0-10 min), CS differential
- **Macro**: Kill participation, time alive %, damage share
- **Challenge stats**: From Riot's challenges API (multi-kills, skill shots, etc.)

#### 2. **Weighted Value Scoring** (Per Game)
Each of the 10 values has a unique formula with weighted features.

**Example: Power**
```python
Power = gold_per_min * 1.0 
      + damage_to_champions * 0.5
      + damage_taken_mitigated * 0.2
```

**Example: Benevolence**
```python
Benevolence = kill_participation * 1.0
            + assists * 0.8  
            + heal_and_shield_power * 0.6
            + vision_score_per_min * 0.4
```

**Example: Security**
```python
Security = vision_score_per_min * 0.8
         + control_wards_purchased * 0.5
         + wards_destroyed * 0.4
         + survival_time_pct * 0.3
```

See [`infra/src/stats_inference.py`](infra/src/stats_inference.py) lines 209-262 for complete `WEIGHTS` mapping.

**Result per game**: 10 raw value scores (e.g., Power=4200, Benevolence=15, Tradition=180)

#### 3. **Z-Score Normalization** (Per Value, Across All Games in Quarter)

**Why normalize?**
- Problem: Raw values have wildly different scales
  - Power naturally ranges 2000-5000 (gold-based)
  - Conformity ranges -5 to +5 (small counts)
  - Without normalization, Power would always dominate rankings
  
- Solution: Z-scores express "how unusual is this value FOR YOU?"

**Formula:**
```python
For each value independently:
  z_score = (raw_score - mean_across_quarter) / std_across_quarter
```

**Interpretation:**
- Z > 0: Above your personal average for that value
- Z < 0: Below your personal average  
- All values now comparable on same scale (-3 to +3 typically)

#### 4. **Ranking & Display**

**Internal ranking**: Values ranked by z-score (determines top 3)
- Ensures all 10 values have equal chance to be "top"
- Highlights your *relative* behavioral patterns

**External display**: Raw scores shown to users
- Enables cross-player comparison
- Intuitive: higher number = more of that behavior
- Friends can compare their Power=4500 vs Power=3200

### Example Walkthrough

**Player's Q1 Games (3 games):**
```
Game 1: Power=4200, Benevolence=15, Security=180
Game 2: Power=3800, Benevolence=28, Security=175  
Game 3: Power=5100, Benevolence=12, Security=182
```

**Step 1: Calculate means & stds**
```
Power: mean=4367, std=565
Benevolence: mean=18.3, std=7.0  
Security: mean=179, std=3.0
```

**Step 2: Compute z-scores**
```
Power: z = (4367-4367)/565 = 0.0 (average)
Benevolence: z = (18.3-18.3)/7.0 = 0.0 (average)
Security: z = (179-179)/3.0 = 0.0 (average)
```

*(In reality, individual game z-scores vary, then averaged)*

**Step 3: Rank by z-score**
```
If Benevolence had higher z-score variance:
  Top 3 = Benevolence (z=0.8), Security (z=0.3), Power (z=0.1)
```

**Step 4: Display raw scores**
```
Frontend shows:
  Benevolence: 18.3
  Security: 179
  Power: 4367
```

### Edge Cases Handled

- **No games**: All values default to 0
- **Single game**: Z-score becomes 0 (no variance), raw score used
- **Zero std**: Treated as z=0 to avoid division by zero
- **Outliers**: Extreme values clipped (±1e9) before z-scoring

### Implementation Details

- **Value weights**: [`infra/src/stats_inference.py`](infra/src/stats_inference.py) lines 209-262
- **Z-score function**: [`infra/src/stats_inference.py`](infra/src/stats_inference.py) lines 284-300
- **Process flow**: [`infra/src/process_quarter.py`](infra/src/process_quarter.py) lines 230-250
- **Frontend display**: [`frontend/src/components/ChapterView.tsx`](frontend/src/components/ChapterView.tsx)
- **Value descriptions**: [`frontend/src/constants/valueDescriptions.ts`](frontend/src/constants/valueDescriptions.ts)

### Why This Approach?

**Rank by z-score** (internal):
- Fair comparison within your own gameplay
- All 10 values have equal opportunity to be "top 3"
- Highlights your distinctive behavioral patterns

**Display raw scores** (external):  
- Cross-player comparison (upload journeys and compare!)
- Intuitive interpretation (bigger = more)
- Consistency across quarters



### Development Guidelines

- Maintain TypeScript types in `frontend/src/api.ts`
- Follow existing component patterns
- Test all three modes (API, Upload, Compare)
- Update relevant README when adding features
- Ensure mobile responsiveness
- Add CloudWatch logging for debugging


## 📚 Documentation

- **Frontend Details**: [`frontend/README.md`](frontend/README.md)
- **Backend Details**: [`infra/README.md`](infra/README.md)
- **Riot API**: [Riot Developer Portal](https://developer.riotgames.com/)
- **AWS SAM**: [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- **Amazon Bedrock**: [Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)


