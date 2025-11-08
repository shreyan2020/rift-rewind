# AWS Deployment Guide for Rift Rewind

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** with credentials configured locally
2. **Riot API Key** (from https://developer.riotgames.com/)
3. **AWS CLI** installed
4. **SAM CLI** installed

## Deployment Steps

### Step 1: Create Riot API Secret in AWS Secrets Manager

Run this command to store your API key in AWS Secrets Manager:

```powershell
# Replace YOUR_API_KEY with your actual Riot API key
aws secretsmanager create-secret `
  --name RiotApiKey `
  --secret-string "{\"token\":\"YOUR_API_KEY\"}" `
  --region eu-west-1
```

**Example:**
```powershell
aws secretsmanager create-secret `
  --name RiotApiKey `
  --secret-string "{\"token\":\"RGAPI-82650f00-053c-4a87-9687-9fb719afc6fd\"}" `
  --region eu-west-1
```

If the secret already exists and needs updating:

```powershell
aws secretsmanager update-secret `
  --secret-id RiotApiKey `
  --secret-string "{\"token\":\"YOUR_NEW_API_KEY\"}" `
  --region eu-west-1
```

### Step 2: Build the SAM Template

```powershell
cd C:\Users\shrey\OneDrive\Documents\all-codes\rift-rewind-v2\infra
sam build
```

This will:
- Package your Python code
- Validate the CloudFormation template
- Create `.aws-sam/build` directory with deployment artifacts

### Step 3: Deploy to AWS

Since you already have `samconfig.toml` configured, deployment is simple:

```powershell
sam deploy
```

This will:
- Create CloudFormation stack: `rift-rewind-v2`
- Provision all resources (Lambda, DynamoDB, S3, SQS)
- Output API endpoints and resource ARNs

**The deployment will:**
- ✅ Create S3 bucket: `rift-rewind-data-{account-id}-eu-west-1`
- ✅ Create DynamoDB table: `rift-rewind-jobs-{account-id}`
- ✅ Create SQS queues: `rift-rewind-fetch-{account-id}`, `rift-rewind-process-{account-id}`
- ✅ Deploy 3 Lambda functions with all dependencies
- ✅ Set up API Gateway for HTTP endpoints
- ✅ Configure triggers and permissions

### Step 4: Test the Deployed API

After deployment, you'll get output like:

```
Outputs:
  JourneyApi
    Description: API Gateway endpoint URL
    Value: https://abcd1234.execute-api.eu-west-1.amazonaws.com/Prod/journey/
```

#### Create a Job

```powershell
$apiUrl = "https://YOUR_API_ID.execute-api.eu-west-1.amazonaws.com/Prod/journey"

$body = @{
    platform = "euw1"
    riotId = "bst#0123"
    archetype = "explorer"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri $apiUrl `
  -Method POST `
  -Body $body `
  -ContentType "application/json"

$jobId = ($response.Content | ConvertFrom-Json).jobId
Write-Host "Created job: $jobId"
```

#### Check Job Status

```powershell
$apiUrl = "https://YOUR_API_ID.execute-api.eu-west-1.amazonaws.com/Prod/journey/$jobId"

$response = Invoke-WebRequest -Uri $apiUrl -Method GET
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Step 5: Monitor Lambda Execution

View logs in CloudWatch:

```powershell
# View API Lambda logs
aws logs tail /aws/lambda/rift-rewind-v2-ApiFunction-xxx --follow --region eu-west-1

# View Fetch Lambda logs  
aws logs tail /aws/lambda/rift-rewind-v2-FetchQuarterFunction-xxx --follow --region eu-west-1

# View Process Lambda logs
aws logs tail /aws/lambda/rift-rewind-v2-ProcessQuarterFunction-xxx --follow --region eu-west-1
```

### Step 6: Verify Data Storage

#### Check DynamoDB Jobs Table

```powershell
aws dynamodb scan --table-name rift-rewind-jobs-123456789 --region eu-west-1
```

#### Check S3 Match Data

```powershell
aws s3 ls s3://rift-rewind-data-123456789-eu-west-1/ --recursive --region eu-west-1
```

#### List SQS Messages

```powershell
aws sqs receive-message --queue-url https://sqs.eu-west-1.amazonaws.com/123456789/rift-rewind-fetch-123456789 --region eu-west-1
```

---

## Troubleshooting

### Error: "User: arn:aws:iam::... is not authorized to perform: secretsmanager:GetSecretValue"

**Cause:** IAM role doesn't have permission to access Secrets Manager

**Solution:** Add policy to Lambda execution role:
```powershell
aws iam attach-role-policy \
  --role-name rift-rewind-v2-ApiFunctionRole-xxx \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite \
  --region eu-west-1
```

### Error: "NoSuchSecretException: Secrets Manager can't find the specified secret"

**Cause:** RiotApiKey secret doesn't exist in Secrets Manager

**Solution:** Create the secret as shown in Step 1

### Error: "AccessDenied" on S3 operations

**Cause:** Lambda doesn't have S3 permissions

**Solution:** Template includes S3 permissions automatically. If it fails, manually add:
```powershell
aws iam attach-role-policy \
  --role-name rift-rewind-v2-FetchQuarterFunctionRole-xxx \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess \
  --region eu-west-1
```

### Error: Lambda timeout (> 120 seconds)

**Cause:** Riot API taking too long or network issues

**Solution:** Increase timeout in template.yaml:
```yaml
Globals:
  Function:
    Timeout: 300  # increased from 120
```

---

## What Happens After Deployment

1. **API Gateway** receives POST /journey request with player info
2. **ApiFunction** creates job record in DynamoDB
3. **ApiFunction** sends 4 SQS messages (one per quarter: Q1, Q2, Q3, Q4)
4. **FetchQuarterFunction** (triggered by SQS):
   - Gets player PUUID from Riot API
   - Fetches all match IDs for the quarter
   - Downloads match details from Riot API
   - Uploads match JSON files to S3
   - Updates job status to "fetched"
   - Sends message to ProcessQueue
5. **ProcessQuarterFunction** (triggered by SQS):
   - Loads match data from S3
   - Calculates K/D/A, gold, damage stats
   - Infers playstyle and archetype
   - Generates narrative summary
   - Saves story.json to S3
   - Updates job status to "ready"

---

## Estimated AWS Costs (per month, light usage)

- **DynamoDB:** ~$1 (pay-per-request)
- **Lambda:** ~$0.20 (free tier includes 1M invocations)
- **S3:** ~$0.23 (storage + requests)
- **SQS:** Free (free tier includes 1M requests)
- **Secrets Manager:** $0.40
- **Total:** ~$2.00/month (or free if within free tier)

---

## Rollback / Cleanup

To delete everything:

```powershell
# Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name rift-rewind-v2 --region eu-west-1

# Delete the secret
aws secretsmanager delete-secret --secret-id RiotApiKey --region eu-west-1

# Confirm deletion
aws cloudformation describe-stacks --stack-name rift-rewind-v2 --region eu-west-1
```

This will remove all deployed resources and charges will stop.
