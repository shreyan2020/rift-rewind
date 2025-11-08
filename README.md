# 🎮 Rift Rewind

**A League of Legends Journey Through Runeterra**

Rift Rewind is a personalized League of Legends analytics platform that transforms your gameplay data into an epic narrative journey through the regions of Runeterra. Track your quarterly progress, discover your playstyle values, and watch your story unfold with AI-generated lore.

![Rift Rewind Banner](https://img.shields.io/badge/League%20of%20Legends-Analytics-blue)
![AWS](https://img.shields.io/badge/AWS-Lambda%20%7C%20S3%20%7C%20DynamoDB-orange)
![React](https://img.shields.io/badge/React-18-61dafb)
![Python](https://img.shields.io/badge/Python-3.11-3776ab)

## ✨ Features

### 📊 Quarterly Analytics
- **Q1-Q4 Breakdown**: Analyze your performance across each quarter of the year
- **Value-Based Insights**: Discover your playstyle through 10 Schwartz Values (Benevolence, Power, Achievement, etc.)
- **Dynamic Stats**: Track KDA, CS/min, vision score, gold efficiency, and more
- **Champion Mastery**: See your most-played champions each quarter

### 🗺️ Journey Through Runeterra
- **Region-Based Narrative**: Each quarter maps to a different region based on your dominant values
  - Demacia (Benevolence) → Honor and teamwork
  - Noxus (Power) → Strength and dominance
  - Ionia (Self-Direction) → Balance and independence
  - Piltover (Achievement) → Progress and innovation
  - And 6 more regions!
- **Dynamic Backgrounds**: Each chapter features region-specific themes and colors
- **Continuous Story**: Your journey flows seamlessly from one region to the next

### 🤖 AI-Generated Lore
- **Powered by Amazon Bedrock (Mistral 7B)**: Every quarter gets personalized narrative lore
- **Story Continuity**: Each chapter builds on the previous one
- **Epic Finale**: A grand conclusion that ties all 4 quarters together
- **Actionable Insights**: AI-generated coaching tips for improvement

### 📈 Interactive Visualizations
- **Timeline Charts**: Track value progression across quarters (powered by Recharts)
- **Value Comparison**: See how your playstyle evolves over time
- **Real-time Updates**: Watch your journey process quarter by quarter

## 🏗️ Architecture

### Backend (AWS SAM)
```
┌─────────────┐
│   API GW    │ ← POST /journey, GET /status/{jobId}
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│  Lambda API │─────▶│  DynamoDB    │ (Job tracking)
└──────┬──────┘      └──────────────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│ SQS: Fetch  │─────▶│ Lambda Fetch │ (Riot API calls)
└─────────────┘      └──────┬───────┘
                            │
                            ▼
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│SQS: Process │─────▶│Lambda Process│─────▶│   Bedrock    │ (AI lore)
└─────────────┘      └──────┬───────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   S3 Bucket  │ (Match data + stories)
                     └──────────────┘
```

### Frontend (React + Vite)
```
Frontend (S3 Static Website)
├── Journey Submission Form
├── Real-time Status Tracking
├── Chapter View (Q1-Q4)
│   ├── Dynamic Region Backgrounds
│   ├── AI-Generated Lore
│   └── Stats & Values Display
└── Final Dashboard
    ├── Timeline Chart (Recharts)
    ├── Finale Lore
    └── Season Reflections
```

## 🚀 Getting Started

### Prerequisites
- **AWS Account** with appropriate permissions
- **AWS CLI** configured
- **AWS SAM CLI** installed
- **Node.js** 18+ and npm
- **Python** 3.11+
- **Riot Games API Key** ([Get one here](https://developer.riotgames.com/))

### Backend Deployment

1. **Clone the repository**
   ```bash
   git clone git@github.com:shreyan2020/rift-rewind.git
   cd rift-rewind
   ```

2. **Set up Riot API Key**
   ```bash
   cd infra
   # Update template.yaml with your Riot API key (line 17)
   # Or store in AWS Secrets Manager
   ```

3. **Enable Amazon Bedrock Access**
   - Go to AWS Console → Amazon Bedrock → Model access
   - Request access to **Mistral 7B Instruct**
   - Wait for approval (usually instant)

4. **Deploy with SAM**
   ```bash
   sam build
   sam deploy --guided
   ```
   - Follow prompts to configure stack name, region, etc.
   - Note the API endpoint URL from outputs

### Frontend Deployment

1. **Build the frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Create S3 bucket**
   ```bash
   aws s3 mb s3://rift-rewind-frontend-YOUR-ACCOUNT-ID
   ```

3. **Configure static website hosting**
   ```bash
   aws s3 website s3://rift-rewind-frontend-YOUR-ACCOUNT-ID \
     --index-document index.html \
     --error-document index.html
   ```

4. **Set bucket policy for public access**
   ```bash
   aws s3api put-bucket-policy --bucket rift-rewind-frontend-YOUR-ACCOUNT-ID \
     --policy '{
       "Version": "2012-10-17",
       "Statement": [{
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::rift-rewind-frontend-YOUR-ACCOUNT-ID/*"
       }]
     }'
   ```

5. **Disable public access block**
   ```bash
   aws s3api delete-public-access-block --bucket rift-rewind-frontend-YOUR-ACCOUNT-ID
   ```

6. **Deploy frontend**
   ```bash
   aws s3 sync dist/ s3://rift-rewind-frontend-YOUR-ACCOUNT-ID --delete
   ```

7. **Access your site**
   ```
   http://rift-rewind-frontend-YOUR-ACCOUNT-ID.s3-website-REGION.amazonaws.com
   ```

## 🎯 Usage

1. **Enter your Riot ID** (e.g., `Summoner#EUW`)
2. **Select region** (e.g., EUW1, NA1, KR)
3. **Submit** and watch the magic happen!
4. **Track progress** as each quarter processes
5. **Explore your journey** through the chapters
6. **View finale** after Q4 completes

## 🔧 Configuration

### Environment Variables (Backend)
- `RIOT_API_KEY`: Your Riot Games API key
- `TABLE_NAME`: DynamoDB table for job tracking
- `BUCKET_NAME`: S3 bucket for data storage
- `FETCH_QUEUE_URL`: SQS queue for fetch operations
- `PROCESS_QUEUE_URL`: SQS queue for processing
- `MAX_CONCURRENCY`: Parallel match fetching (default: 8)

### Frontend Configuration
Update `frontend/src/api.ts`:
```typescript
const API_BASE_URL = import.meta.env.DEV 
  ? '/api' 
  : 'https://YOUR-API-GATEWAY-URL.amazonaws.com';
```

## 📁 Project Structure

```
rift-rewind-v2/
├── infra/                    # AWS SAM backend
│   ├── src/
│   │   ├── api.py           # API Gateway handler
│   │   ├── fetch_quarter.py # Riot API fetcher
│   │   ├── process_quarter.py # Stats processor
│   │   ├── bedrock_lore.py  # AI lore generator
│   │   ├── stats_inference.py # Value calculations
│   │   └── common.py        # Shared utilities
│   └── template.yaml        # SAM template
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Journey.tsx
│   │   │   ├── ChapterView.tsx
│   │   │   └── FinalDashboard.tsx
│   │   ├── api.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## 🎨 Customization

### Adding New Regions
Edit `infra/src/process_quarter.py`:
```python
REGION_ARC_MAP = {
    "YourValue": "YourRegion",
    # Add more mappings
}
```

### Adjusting AI Prompts
Edit `infra/src/bedrock_lore.py`:
```python
def generate_quarter_lore(...):
    prompt = f"""Your custom prompt here"""
```

### Changing Region Themes
Edit `frontend/src/components/ChapterView.tsx`:
```typescript
const REGION_THEMES = {
  'YourRegion': {
    bg: 'from-color-to-color',
    accent: 'from-accent-to-accent',
    // ...
  }
}
```

## 🧪 Testing

### Backend Tests
```bash
cd infra
python test_bedrock.py        # Test Bedrock connection
python test_bedrock_integration.py  # Full integration test
```

### Frontend Tests
```bash
cd frontend
npm run dev  # Local development server
```

## 💰 Cost Estimate

**Per User Journey (4 quarters):**
- Lambda executions: ~$0.01
- DynamoDB: ~$0.001
- S3 storage & requests: ~$0.001
- Bedrock (Mistral 7B): ~$0.005
- **Total: < $0.02 per user**

**Monthly (1000 users):**
- ~$20/month

## 🔒 Security

- ✅ API keys stored securely (AWS Secrets Manager recommended)
- ✅ CORS properly configured
- ✅ S3 bucket policies restrict access
- ✅ Lambda functions use least-privilege IAM roles
- ✅ No sensitive data in Git repository

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Riot Games** for the League of Legends API
- **Amazon Web Services** for infrastructure
- **Anthropic/Mistral** for AI capabilities
- **League of Legends** lore and universe

## 📞 Contact

**Shreyan** - [@shreyan2020](https://github.com/shreyan2020)

Project Link: [https://github.com/shreyan2020/rift-rewind](https://github.com/shreyan2020/rift-rewind)

---

⚡ **Built with AWS SAM, React, and AI** ⚡
