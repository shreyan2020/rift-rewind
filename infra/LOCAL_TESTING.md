# Local Testing Guide for Rift Rewind Lambda Functions

## ✅ Setup (Copy-Paste Commands)

### 1. Start LocalStack (all AWS services in one container)
```powershell
docker run -d -p 4566:4566 --name localstack localstack/localstack:latest
```

### 2. Wait and create AWS resources
```powershell
# Give LocalStack 5 seconds to start
Start-Sleep -Seconds 5

# Create DynamoDB table
aws dynamodb create-table `
  --table-name local-jobs-table `
  --attribute-definitions AttributeName=jobId,AttributeType=S `
  --key-schema AttributeName=jobId,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --endpoint-url http://localhost:4566 `
  --region us-east-1

# Create S3 bucket
aws s3 mb s3://rift-rewind-data-local `
  --endpoint-url http://localhost:4566 `
  --region us-east-1

# Create SQS fetch queue
aws sqs create-queue `
  --queue-name rift-rewind-fetch-local `
  --endpoint-url http://localhost:4566 `
  --region us-east-1

# Create SQS process queue
aws sqs create-queue `
  --queue-name rift-rewind-process-local `
  --endpoint-url http://localhost:4566 `
  --region us-east-1
```

### 3. Insert test job into DynamoDB
```powershell
cd infra

# Create test item file
$item = @"
{
  "jobId": {"S": "test-job-123"},
  "platform": {"S": "euw1"},
  "riotId": {"S": "Player#1234"},
  "s3Base": {"S": "test-job-123/"},
  "status": {"S": "queued"},
  "quarters": {"M": {
    "Q1": {"S": "pending"},
    "Q2": {"S": "pending"},
    "Q3": {"S": "pending"},
    "Q4": {"S": "pending"}
  }}
}
"@
$item | Out-File test-item.json

# Insert into DynamoDB
aws dynamodb put-item `
  --table-name local-jobs-table `
  --item file://test-item.json `
  --endpoint-url http://localhost:4566 `
  --region us-east-1
```

### 4. Build SAM
```powershell
cd infra
sam build
```

---

## ✅ Test Functions Locally

### Test 1: ApiFunction (Create Job)
```powershell
sam local invoke ApiFunction `
  -e events/post_journey.json `
  --env-vars env.json
```

**Expected Output (statusCode 200):**
```json
{
  "statusCode": 200,
  "body": {
    "jobId": "e0fa8215-7c6d-42b8-bf8d-c7d8616f353e",
    "queued": false,
    "note": "local mode, SQS not used"
  }
}
```

### Test 2: ApiFunction (Get Job)
```powershell
# First, create a job and note the jobId, then replace in event file
$job_id = "replace-with-actual-jobId"
# Edit infra\events\get_job.json and replace rawPath with /journey/$job_id

sam local invoke ApiFunction `
  -e events/get_job.json `
  --env-vars env.json
```

### Test 3: FetchQuarterFunction (Fetch Match Data)
```powershell
sam local invoke FetchQuarterFunction `
  -e events/fetch_q1.json `
  --env-vars env.json
```

**Expected:** Function runs successfully. It will try to fetch from Riot API (will fail with 403 if the API key is fake, but the DynamoDB/S3 code paths work). The important thing is **no connection errors**.

---

## ⚙️ What's Configured in `env.json`

All three Lambda functions are configured to use LocalStack:
- **DDB_ENDPOINT**: `http://host.docker.internal:4566` (DynamoDB)
- **S3_ENDPOINT**: `http://host.docker.internal:4566` (S3)
- **SQS_ENDPOINT**: `http://host.docker.internal:4566` (SQS)
- **REGION_HINT**: `us-east-1`
- **FETCH_QUEUE_URL** & **PROCESS_QUEUE_URL**: Empty for ApiFunction (skips SQS during test)

---

## 🧹 Cleanup

### Stop and remove LocalStack
```powershell
docker stop localstack
docker rm localstack
```

### Remove test files
```powershell
cd infra
rm test-item.json
```

---

## 📋 Code Fixes Applied

✅ **api.py**:
- Fixed datetime import (was using `__import__` incorrectly)
- Added S3_ENDPOINT and SQS_ENDPOINT support
- Made SQS sends conditional (skipped when queue URL is empty)

✅ **fetch_quarter.py**:
- Added `botocore` import  
- Fixed `get_ids_window()` call (removed non-existent `count_limit` and `queue_filter` args)
- Added S3_ENDPOINT, SQS_ENDPOINT, and REGION_HINT support
- Made boto3 clients region-aware

✅ **Event Files**:
- `events/post_journey.json`: POST /journey request to create a job
- `events/get_job.json`: GET /journey/{id} request to fetch job status
- `events/fetch_q1.json`: SQS message to trigger FetchQuarterFunction

✅ **env.json**: Configured all functions to use LocalStack at `host.docker.internal:4566`

---

## 🚀 Next: Deploy to AWS

Once local testing passes:

```powershell
cd infra
sam build
sam deploy --guided
```

**During guided deploy, enter:**
1. **Stack name**: `rift-rewind-v2`
2. **AWS Region**: `eu-west-1` (or your preferred region)
3. **Confirm IAM role creation**: `y`
4. **Allow CloudFormation to create roles**: `y`

**After deployment, test against real AWS:**

```powershell
# Get your API endpoint
aws cloudformation describe-stacks `
  --stack-name rift-rewind-v2 `
  --query 'Stacks[0].Outputs' `
  --region eu-west-1

# Call API (replace with your endpoint)
curl -X POST https://<API-ID>.execute-api.eu-west-1.amazonaws.com/journey `
  -H "Content-Type: application/json" `
  -d '{"platform": "euw1", "riotId": "Player#YourTag"}'
```

---

## 🐛 Troubleshooting

### "Cannot do operations on a non-existent table"
```powershell
# Verify table was created:
aws dynamodb list-tables --endpoint-url http://localhost:4566 --region us-east-1

# Verify LocalStack is running:
docker ps | findstr localstack
```

### "Failed to resolve 'localstack'" or connection timeouts
- Make sure you're using `host.docker.internal:4566` in env.json (not just `localstack:4566`)
- On Linux, use the Docker gateway IP instead: `172.17.0.1:4566`

### Lambda timeout during test
- S3/network operations can be slow locally
- Increase timeout: `sam local invoke --timeout 120`

### SQS queue not found
- Queues created before SAM build might not be visible to the Lambda
- Recreate them after `sam build`
- Or set `PROCESS_QUEUE_URL=""` in env.json to skip SQS during testing
