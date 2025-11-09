# Rift Rewind Backend (AWS SAM)

This directory contains the AWS SAM (Serverless Application Model) backend infrastructure for Rift Rewind v2.

## Architecture

### Lambda Functions

1. **ApiFunction** (`src/api.py`)
   - **Trigger**: API Gateway HTTP requests
   - **Purpose**: Handle journey creation and status retrieval
   - **Endpoints**:
     - `POST /journey` - Create new journey, enqueue Q1
     - `GET /journey/{jobId}` - Get job status and quarter statuses

2. **FetchQuarterFunction** (`src/fetch_quarter.py`)
   - **Trigger**: SQS FetchQueue messages
   - **Purpose**: Fetch match data from Riot API
   - **Process**:
     - Retrieve matches for specified quarter
     - Store raw match data in S3
     - Enqueue ProcessQueue message
     - Update DynamoDB status to "fetched"

3. **ProcessQuarterFunction** (`src/process_quarter.py`)
   - **Trigger**: SQS ProcessQueue messages
   - **Purpose**: Generate stats, lore, and reflections
   - **Process**:
     - Calculate player stats from matches
     - Determine region based on top values
     - Generate AI lore via Bedrock
     - Generate role-specific reflection
     - Create story.json
     - Update DynamoDB status to "ready"
     - Enqueue next quarter (if not Q4)
     - Generate finale.json (after Q4)

### Supporting Modules

- **`stats_inference.py`**: Calculate performance metrics
  - KDA proxy, CS/min, vision/min, gold/min
  - Role detection (from teamPosition)
  - Role-specific stats (objective damage, kill participation, control wards)
  - Playstyle values extraction

- **`bedrock_lore.py`**: AI generation via Amazon Bedrock
  - Mistral 7B Instruct model
  - Region-specific lore generation
  - Role-based performance reflections
  - Story continuity tracking

- **`common.py`**: Shared utilities
  - S3 operations
  - DynamoDB operations
  - Riot API client
  - Region mapping

## Data Flow

```
1. POST /journey
   └─> ApiFunction creates job in DynamoDB
       └─> Enqueues Q1 to FetchQueue

2. FetchQueue → FetchQuarterFunction
   └─> Fetches matches from Riot API
       └─> Saves to S3: jobId/Q1/*.json
           └─> Enqueues ProcessQueue
               └─> Updates DynamoDB: Q1 = "fetched"

3. ProcessQueue → ProcessQuarterFunction
   └─> Loads matches from S3
       └─> Calculates stats (stats_inference.py)
           └─> Generates lore (bedrock_lore.py)
               └─> Saves story.json to S3: jobId/Q1/story.json
                   └─> Updates DynamoDB: Q1 = "ready"
                       └─> Enqueues Q2 to FetchQueue (repeat 2-3)

4. After Q4 completes
   └─> ProcessQuarterFunction generates finale.json
       └─> Saves to S3: jobId/finale.json
```

## Configuration

### Key Files

- **`template.yaml`**: SAM template defining all resources
- **`samconfig.toml`**: SAM deployment configuration
- **`key.json`**: Public configuration (regions, time ranges)
- **`secret.json`**: Riot API key (gitignored, created manually)

### Creating secret.json

```bash
cd infra
cat > secret.json << EOF
{
  "RIOT_API_KEY": "RGAPI-your-key-here"
}
EOF
```

### Environment Variables

Set in `template.yaml` for each Lambda:
- `RIOT_API_KEY_SECRET`: Name of AWS Secrets Manager secret
- `DYNAMO_TABLE`: DynamoDB table name
- `S3_BUCKET`: S3 bucket for match data
- `FETCH_QUEUE_URL`: SQS queue URL for fetching
- `PROCESS_QUEUE_URL`: SQS queue URL for processing

## Deployment

### Prerequisites

- AWS CLI configured
- SAM CLI installed
- Python 3.11+
- Riot API key in `secret.json`

### Build and Deploy

```bash
cd infra

# Build Lambda packages
sam build

# First deployment (interactive)
sam deploy --guided

# Subsequent deployments
sam deploy --no-confirm-changeset
```

### What Gets Created

- **DynamoDB Table**: `RiftRewindJobs`
- **S3 Bucket**: `rift-rewind-data-{AccountId}-{Region}`
- **SQS Queues**:
  - `RiftRewindFetchQueue` (1800s visibility timeout)
  - `RiftRewindProcessQueue` (300s visibility timeout)
- **Lambda Functions**:
  - `RiftRewind-ApiFunction`
  - `RiftRewind-FetchQuarterFunction`
  - `RiftRewind-ProcessQuarterFunction`
- **API Gateway**: HTTP API with `/journey` routes
- **IAM Roles**: Least-privilege roles for each Lambda
- **Secrets Manager**: Riot API key secret

## Monitoring

### CloudWatch Logs

- **API Lambda**: `/aws/lambda/RiftRewind-ApiFunction`
- **Fetch Lambda**: `/aws/lambda/RiftRewind-FetchQuarterFunction`
- **Process Lambda**: `/aws/lambda/RiftRewind-ProcessQuarterFunction`

### Common Issues

1. **"Rate limit exceeded"**: Riot API throttling
   - Reduce concurrent executions
   - Add exponential backoff

2. **"Quarters stuck on fetched"**: Process Lambda failed
   - Check CloudWatch logs for errors
   - Verify Bedrock permissions

3. **"Finale not generating"**: Story continuity issue
   - Ensure all 4 quarters completed
   - Check S3 for Q1-Q4 story.json files

## API Key Rotation

When Riot API key expires:

```bash
# 1. Update secret.json
cd infra
vim secret.json  # Update RIOT_API_KEY

# 2. Redeploy
sam build
sam deploy --no-confirm-changeset
```

The new key is automatically uploaded to Secrets Manager and available to all Lambdas.

## Local Development

### Running Locally

```bash
# Start API locally
sam local start-api --port 3001

# Invoke function directly
sam local invoke ApiFunction --event events/create-journey.json

# Test with environment variables
sam local invoke ProcessQuarterFunction \
  --event events/process-quarter.json \
  --env-vars env.json
```

### Testing Individual Functions

```bash
# Test stats calculation
cd src
python -c "from stats_inference import chapter_stats; print(chapter_stats([...]))"

# Test Bedrock integration
python -c "from bedrock_lore import generate_quarter_lore; print(generate_quarter_lore(...))"
```

## Cost Optimization

- **Lambda**: Free tier covers most usage (1M requests/month)
- **DynamoDB**: On-demand pricing, minimal cost
- **S3**: Negligible storage cost (<1 GB per 100 jobs)
- **SQS**: First 1M requests free
- **Bedrock**: Pay per token (~$0.001 per request)

**Estimated cost for 1000 journeys/month**: ~$5-10

## Security

- ✅ API key in Secrets Manager (encrypted at rest)
- ✅ Least-privilege IAM roles
- ✅ No hardcoded credentials
- ✅ CORS configured for frontend only
- ✅ S3 bucket policy restricts public access to story files only

## Troubleshooting

### Debug Checklist

1. **Check CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/RiftRewind-ProcessQuarterFunction --follow
   ```

2. **Verify DynamoDB Status**:
   ```bash
   aws dynamodb get-item \
     --table-name RiftRewindJobs \
     --key '{"jobId": {"S": "your-job-id"}}'
   ```

3. **Check S3 Files**:
   ```bash
   aws s3 ls s3://rift-rewind-data-{account}-{region}/{jobId}/ --recursive
   ```

4. **Monitor SQS Queues**:
   ```bash
   aws sqs get-queue-attributes \
     --queue-url {queue-url} \
     --attribute-names ApproximateNumberOfMessages
   ```

## Future Enhancements

- [ ] Add caching layer (ElastiCache) for Riot API responses
- [ ] Implement batch processing for multiple users
- [ ] Add WebSocket support for real-time updates
- [ ] Create admin dashboard for monitoring
- [ ] Add retry logic with exponential backoff
- [ ] Implement circuit breaker for Riot API calls

---

For more information, see the main [README.md](../README.md).
