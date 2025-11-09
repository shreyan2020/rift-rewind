# Rift Rewind v2 🎮

**A League of Legends journey through Runeterra** - An AI-powered narrative experience that transforms your 2025 ranked season into an epic saga across the regions of Runeterra.

![Rift Rewind Banner](https://img.shields.io/badge/League%20of%20Legends-Season%202025-gold?style=for-the-badge)
![AWS](https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazonaws)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)

## 🌟 Overview

Rift Rewind v2 analyzes your League of Legends ranked matches from 2025 and creates a personalized narrative journey through Runeterra. Each quarter of the year corresponds to a different region, dynamically selected based on your playstyle and performance.

### Key Features

- **🤖 AI-Generated Narratives**: Powered by Amazon Bedrock (Mistral 7B Instruct)
- **📊 Quarterly Analysis**: Automatic segmentation into Q1, Q2, Q3, Q4
- **🗺️ Dynamic Region Mapping**: Runeterra regions chosen based on your top stats
- **🎯 Role-Specific Insights**: Tailored feedback for each position (Support, Jungle, ADC, etc.)
- **📈 Performance Tracking**: Visual progression of key metrics across quarters
- **⚡ Serverless Architecture**: AWS Lambda, DynamoDB, S3, SQS

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │  React + Vite + TypeScript
│   (S3 Static)   │  Tailwind CSS + Framer Motion
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   API Gateway   │  HTTP API with CORS
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  API Lambda     │────▶│  DynamoDB    │
│  (Journey CRUD) │     │  (Job Status)│
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  SQS Queues     │────▶│  S3 Bucket   │
│  Fetch/Process  │     │  (Matches)   │
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ Worker Lambdas  │────▶│   Bedrock    │
│ Fetch/Process   │     │  (Mistral)   │
└─────────────────┘     └──────────────┘
```

### Components

1. **Frontend** (`/frontend`)
   - React 18 SPA with TypeScript
   - Hosted on S3 as static website
   - Real-time polling for job status
   - Interactive chapter navigation

2. **Backend** (`/infra`)
   - **API Lambda**: Handles journey creation, status checks
   - **Fetch Lambda**: Retrieves match data from Riot API
   - **Process Lambda**: Generates stats, AI lore, and reflections
   - **DynamoDB**: Tracks job status and quarter completion
   - **S3**: Stores match data and generated stories
   - **SQS**: Queue-based processing (Fetch → Process)

3. **AI Generation**
   - Amazon Bedrock with Mistral 7B Instruct
   - Contextual lore generation based on region
   - Role-specific performance reflections
   - Story continuity across quarters

## 🚀 Prerequisites

- **AWS Account** with appropriate permissions
- **Node.js** 18+ and npm
- **Python** 3.11+
- **AWS CLI** configured
- **SAM CLI** for backend deployment
- **Riot Games API Key** ([Get one here](https://developer.riotgames.com/))

## 📦 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rift-rewind-v2
```

### 2. Backend Setup

```bash
cd infra

# Install Python dependencies locally (for development)
pip install -r src/requirements.txt

# Configure your Riot API key (see API Key Management below)
# Edit infra/secret.json with your API key
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

## 🔑 API Key Management

### Updating Riot API Key

Riot API keys expire periodically. To update:

1. **Get a new key** from [Riot Developer Portal](https://developer.riotgames.com/)

2. **Update the secret file**:

```bash
cd infra

# Edit secret.json
cat > secret.json << EOF
{
  "RIOT_API_KEY": "RGAPI-your-new-key-here"
}
EOF
```

3. **Redeploy the backend**:

```bash
sam build
sam deploy --no-confirm-changeset
```

The key is stored in AWS Secrets Manager and automatically injected into Lambda functions.

### Security Notes

- ✅ `secret.json` is gitignored
- ✅ API key stored in AWS Secrets Manager
- ✅ Lambda functions fetch key at runtime
- ⚠️ Never commit API keys to version control

## 🎯 Deployment

### Backend Deployment

```bash
cd infra

# Build Lambda functions
sam build

# Deploy to AWS (first time - creates resources)
sam deploy --guided

# Subsequent deployments
sam deploy --no-confirm-changeset
```

**What gets deployed:**
- 3 Lambda functions (API, FetchQuarter, ProcessQuarter)
- DynamoDB table for job tracking
- S3 bucket for match data and stories
- 2 SQS queues (FetchQueue, ProcessQueue)
- API Gateway HTTP API
- IAM roles and policies

### Frontend Deployment

```bash
cd frontend

# Build for production
npm run build

# Deploy to S3 (replace bucket name with yours)
aws s3 sync dist/ s3://rift-rewind-frontend-<your-account-id> --delete --region <your-region>
```

**Note:** Update `src/api.ts` with your actual API Gateway URL before building.

### S3 Bucket Policy

Ensure the data bucket allows public read for story files:

```bash
cd rift-rewind-v2

# Apply the bucket policy
aws s3api put-bucket-policy \
  --bucket rift-rewind-data-<your-account-id>-<your-region> \
  --region <your-region> \
  --policy file://bucket-policy.json
```

## 🎮 Usage

### For End Users

1. **Visit the website**: Your S3 static website URL

2. **Enter your details**:
   - Summoner Name (e.g., `Faker#KR1`)
   - Region (EUW, NA, KR, etc.)
   - Archetype (Explorer, Warrior, Sage, Guardian)

3. **Start Journey**: Click "Begin Journey"

4. **Watch the magic happen**:
   - System fetches your 2025 ranked matches
   - Quarters are processed sequentially (Q1 → Q2 → Q3 → Q4)
   - Each quarter generates:
     - Region-specific lore
     - Performance stats
     - Role-specific reflection
     - Playstyle values

5. **Navigate chapters**: Progress through Q1, Q2, Q3, Q4, then view Final Summary

### API Endpoints

**Base URL**: `https://<api-id>.execute-api.<region>.amazonaws.com/`

#### Create Journey
```bash
POST /journey
Content-Type: application/json

{
  "platform": "euw1",
  "riotId": "PlayerName#TAG",
  "archetype": "explorer",
  "bypassCache": false
}

Response: { "jobId": "uuid" }
```

#### Check Status
```bash
GET /journey/{jobId}

Response:
{
  "jobId": "uuid",
  "riotId": "PlayerName#TAG",
  "platform": "euw1",
  "status": "processing",
  "s3Base": "jobId/",
  "quarters": {
    "Q1": "ready",
    "Q2": "processing",
    "Q3": "pending",
    "Q4": "pending"
  }
}
```

## 📊 Data Flow

1. **User submits journey request** → API Lambda creates job in DynamoDB
2. **API Lambda enqueues Q1** → SQS FetchQueue
3. **Fetch Lambda polls FetchQueue** → Retrieves matches from Riot API → Saves to S3 → Enqueues ProcessQueue
4. **Process Lambda polls ProcessQueue** → Calculates stats → Generates AI lore/reflection → Saves to S3 → Updates DynamoDB status → Enqueues next quarter
5. **Frontend polls status** → Loads story.json from S3 → Displays chapter
6. **After Q4 completes** → Process Lambda generates finale.json with consolidated reflection

## 🧪 Development

### Local Development

**Backend (Lambda functions)**:
```bash
cd infra

# Test locally with SAM
sam local start-api --port 3001

# Invoke specific function
sam local invoke ApiFunction --event events/test-event.json
```

**Frontend**:
```bash
cd frontend

# Start dev server
npm run dev

# Update API endpoint in src/api.ts for local testing
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
curl https://your-api-url.amazonaws.com/journey/{jobId}
```

## 🐛 Troubleshooting

### Issue: Quarters stuck on "fetching" or "fetched"

**Cause**: DynamoDB status not updating, or Lambda execution failed

**Solution**:
1. Check CloudWatch logs for FetchQuarter and ProcessQuarter Lambdas
2. Manually update DynamoDB status if needed:
```bash
aws dynamodb update-item \
  --table-name RiftRewindJobs \
  --key '{"jobId": {"S": "your-job-id"}}' \
  --update-expression "SET quarters.Q1 = :status" \
  --expression-attribute-values '{":status": {"S": "ready"}}' \
  --region <your-region>
```

### Issue: Finale shows hardcoded text

**Cause**: S3 bucket policy doesn't allow public read for finale.json

**Solution**: Apply the bucket policy (see Deployment section)

### Issue: API Key expired

**Cause**: Riot API keys expire every 24 hours (dev keys)

**Solution**: Update `infra/secret.json` and redeploy backend (see API Key Management)

### Issue: Stats look incorrect (CS/min too low)

**Cause**: Old cached job data (before bug fix)

**Solution**: Use "Force refresh (bypass cache)" checkbox when creating journey

## 📁 Project Structure

```
rift-rewind-v2/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── Journey.tsx   # Main journey orchestrator
│   │   │   ├── ChapterView.tsx   # Individual quarter view
│   │   │   └── FinalDashboard.tsx # Final summary
│   │   ├── api.ts           # API client
│   │   ├── constants/       # Region themes, value descriptions
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── infra/                    # SAM backend
│   ├── src/
│   │   ├── api.py           # API Lambda handler
│   │   ├── fetch_quarter.py # Fetch Lambda handler
│   │   ├── process_quarter.py # Process Lambda handler
│   │   ├── stats_inference.py # Stats calculation
│   │   ├── bedrock_lore.py  # AI generation
│   │   └── requirements.txt
│   ├── template.yaml        # SAM template
│   ├── samconfig.toml       # SAM config
│   ├── key.json             # Public config
│   └── secret.json          # API key (gitignored)
├── .github/
│   └── copilot-instructions.md
├── bucket-policy.json       # S3 policy for public read
├── .gitignore
└── README.md                # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is for educational purposes. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.

## 🙏 Acknowledgments

- **Riot Games** for the comprehensive API
- **Amazon Bedrock** for AI capabilities
- **Runeterra** lore and regions for narrative inspiration
- **React** and **Vite** for amazing developer experience

## 📞 Support

For issues and questions:
- Check CloudWatch logs for Lambda errors
- Verify S3 bucket policies
- Ensure API key is valid and updated
- Review DynamoDB job status

---

**Built with ❤️ for League of Legends players**

*Transform your matches into an epic journey through Runeterra!*
