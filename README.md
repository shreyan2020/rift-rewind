# Rift Rewind v2 🎮

**A League of Legends journey through Runeterra** - An AI-powered narrative experience that transforms your 2025 ranked season into an epic saga across the regions of Runeterra.

![Rift Rewind Banner](https://img.shields.io/badge/League%20of%20Legends-Season%202025-gold?style=for-the-badge)
![AWS](https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazonaws)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)

## 🌟 Overview

Rift Rewind v2 analyzes your League of Legends ranked matches from 2025 and creates a personalized narrative journey through Runeterra. Each quarter of the year corresponds to a different region, dynamically selected based on your playstyle and performance.

### Key Features

- **🤖 AI-Generated Narratives**: Powered by Amazon Bedrock (Mistral 7B Instruct)
- **📊 Quarterly Analysis**: Automatic segmentation into Q1, Q2, Q3, Q4
- **🗺️ Dynamic Region Mapping**: Runeterra regions chosen based on your playstyle values
- **🎯 Role-Specific Insights**: Tailored feedback for each position (Support, Jungle, ADC, etc.)
- **📈 Performance Tracking**: Visual progression of key metrics across quarters
- **🤝 Friend Comparison**: Upload two journeys and get AI-generated relationship analysis
- **💾 Journey Export**: Download complete journeys for sharing or backup
- **⚡ Serverless Architecture**: AWS Lambda, DynamoDB, S3, SQS, Bedrock
- **🔄 Cache System**: Avoid re-fetching identical journeys (with bypass option)
- **📤 Upload Mode**: Process pre-fetched matches locally

## 📖 How It Works

### Your Season, Divided into Chapters

Rift Rewind transforms your 2025 ranked season into a story by dividing it into **four chapters** (quarters):

| Chapter | Time Period | Narrative Role |
|---------|-------------|----------------|
| **Q1** | January - March | Your journey begins |
| **Q2** | April - June | Growth and adaptation |
| **Q3** | July - September | Challenges and trials |
| **Q4** | October - December | Mastery and resolution |

Each 3-month period becomes one chapter of your Runeterra adventure, complete with:
- 🗺️ A **unique region** (Demacia, Noxus, Ionia, etc.) chosen based on your playstyle
- 📜 **AI-generated lore** telling your story in that region
- 📊 **Performance stats** showing your growth
- 🎯 **Role-specific feedback** tailored to your position
- ⭐ **Top 3 playstyle values** that defined your gameplay

After all four chapters, you get a **Finale** with your complete season story, trends, highlights, and insights.

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

### Quarterly Journey

Each quarter of your 2025 season becomes a chapter in your Runeterra journey:

- **Q1 (Jan-Mar)**: Your starting region based on dominant playstyle value
- **Q2 (Apr-Jun)**: Region of growth (biggest value change)
- **Q3 (Jul-Sep)**: Region of challenge (biggest decline)
- **Q4 (Oct-Dec)**: Region of resolution (dominant value, mastery)

### Runeterra Regions

Each region represents a playstyle value:

| Region | Value | Theme |
|--------|-------|-------|
| **Demacia** | Benevolence | Justice, order, teamwork |
| **Noxus** | Power | Strength, conquest, dominance |
| **Ionia** | Self-Direction | Balance, independence, creativity |
| **Piltover** | Achievement | Progress, efficiency, innovation |
| **Zaun** | Stimulation | Chaos, risk-taking, experimentation |
| **Freljord** | Tradition | Endurance, consistency, resilience |
| **Shurima** | Security | Safety, vision, control |
| **Bilgewater** | Hedonism | Adventure, playmaking, boldness |
| **Targon** | Conformity | Structure, team synergy |
| **Shadow Isles** | (Dark themes) | Haunting, comeback stories |

### Playstyle Values

Inspired by Schwartz's theory of basic human values, adapted for League of Legends:

- **Power**: Kills, damage, dominance
- **Achievement**: CS, gold, efficiency
- **Hedonism**: Playmaking, bold plays
- **Stimulation**: Champion variety, novelty
- **Self-Direction**: Independence, creativity
- **Benevolence**: Assists, healing, supportive play
- **Tradition**: Consistency, reliability
- **Conformity**: Team synergy, structure
- **Security**: Vision, control wards, safety
- **Universalism**: Global objectives, map presence

**Normalization**: Per-value z-score normalization ensures fair ranking (prevents scale bias where some values naturally have larger magnitudes).

### Advanced Analytics (Finale)

After Q4 completion, the finale includes:

- **Trends**: Linear regression across quarters (KDA, CS, gold, vision)
- **Highlights**:
  - Best KDA game
  - Most kills/damage games
  - Perfect games (0 deaths)
  - Pentakills, first bloods
- **Champion Analysis**:
  - Top champions with KDA and win rate
  - One-tricks (>30% games on one champ)
  - Versatility score (Shannon entropy)
- **Comeback Analysis**:
  - Games won from 3000+ gold deficit
  - Resilience score
- **AI Insights**: High/medium/low priority observations
- **Year Summary**: Achievements, strengths, growth areas, overall trend

### Friend Comparison

Compare two players' journeys:

1. Upload two `journey-upload.json` files
2. System calculates similarity (cosine similarity of playstyle values)
3. Determines relationship type:
   - **Allies** (similarity > 0.7): Similar playstyles, complementary
   - **Rivals** (similarity ≤ 0.7): Contrasting styles, competitive
4. Generates AI-powered comparison lore
5. Side-by-side stats and interactive charts
6. Exportable comparison report

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

### Issue: Friend comparison not generating lore

**Cause**: Bedrock permissions or model availability

**Solution**:
1. Check CloudWatch logs for ProcessQuarterFunction
2. Verify Bedrock model access in your AWS region
3. Ensure IAM role has `bedrock:InvokeModel` permission

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

## 🔬 How Playstyle Values are Calculated

Rift Rewind computes psychological "playstyle values" per quarter to summarize behavioral tendencies.

### Calculation Process

1. **Per-game feature extraction**: Extract raw metrics (kills, assists, CS, vision, etc.)
2. **Per-game value scoring**: Map features to Schwartz values (e.g., kills → Power, assists → Benevolence)
3. **Per-value z-score normalization**: Normalize each value independently across games
   ```python
   z = (x - mean(value_over_games)) / std(value_over_games)
   ```
4. **Aggregate per quarter**: Average z-scores to get per-quarter value profile
5. **Rank and select top 3**: Sort by aggregate z-score (descending)

### Why Z-Score Normalization?

**Problem**: Raw values have different scales (e.g., Power naturally has higher magnitudes than Tradition)

**Solution**: Z-score normalization gives each value equal opportunity to rank highly based on relative prominence, not absolute magnitude.

### Where to Find the Logic

- **Backend**: [`infra/src/stats_inference.py`](infra/src/stats_inference.py) (z-score functions)
- **Frontend**: [`frontend/src/components/ChapterView.tsx`](frontend/src/components/ChapterView.tsx) (display)
- **Descriptions**: [`frontend/src/constants/valueDescriptions.ts`](frontend/src/constants/valueDescriptions.ts)

See main [`README.md`](README.md) section "How Playstyle Values are Calculated" for more details.

## 💰 Cost Estimate

**Monthly costs for 1000 complete journeys**:

- **Lambda**: ~$2 (mostly within free tier)
- **DynamoDB**: ~$0.50 (on-demand)
- **S3**: ~$0.10 (<1 GB storage)
- **SQS**: Free (first 1M requests)
- **Bedrock**: ~$5 (Mistral 7B @ $0.001/1K tokens)
- **API Gateway**: ~$1 (HTTP API)

**Total**: ~$8-10/month

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Maintain TypeScript types in `frontend/src/api.ts`
- Follow existing component patterns
- Test all three modes (API, Upload, Compare)
- Update relevant README when adding features
- Ensure mobile responsiveness
- Add CloudWatch logging for debugging

## 📄 License

This project is for educational purposes. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.

## 🙏 Acknowledgments

- **Riot Games** for the comprehensive API and amazing game
- **Amazon Bedrock** for powerful AI capabilities
- **Runeterra** lore and regions for narrative inspiration
- **React** and **Vite** for excellent developer experience
- **Schwartz's Theory of Basic Human Values** for the playstyle framework

## 📚 Documentation

- **Frontend Details**: [`frontend/README.md`](frontend/README.md)
- **Backend Details**: [`infra/README.md`](infra/README.md)
- **Riot API**: [Riot Developer Portal](https://developer.riotgames.com/)
- **AWS SAM**: [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- **Amazon Bedrock**: [Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)

## 📞 Support

For issues and questions:
- Check CloudWatch logs for Lambda errors
- Verify S3 bucket policies for story access
- Ensure Riot API key is valid and updated
- Review DynamoDB job status
- Consult individual READMEs for component-specific issues

---

**Built with ❤️ for League of Legends players**

*Transform your matches into an epic journey through Runeterra!*

🎮 **Ready to discover your story?** Deploy now and embark on your journey!
