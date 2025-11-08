# 🚀 Quick Start Guide

## Prerequisites Checklist
- [ ] AWS Account with admin access
- [ ] AWS CLI installed and configured
- [ ] AWS SAM CLI installed
- [ ] Node.js 18+ installed
- [ ] Python 3.11+ installed
- [ ] Riot Games API Key
- [ ] GitHub account (for cloning)

## 5-Minute Setup

### 1. Clone and Install
```bash
git clone git@github.com:shreyan2020/rift-rewind.git
cd rift-rewind
```

### 2. Backend Deployment
```bash
cd infra

# Update your Riot API key in template.yaml (line 17)
# Or use: aws secretsmanager create-secret --name RiotApiKey --secret-string "YOUR-KEY"

# Deploy
sam build
sam deploy --guided
```

**Important**: Note the API Gateway URL from the deployment outputs!

### 3. Enable Bedrock
1. Go to AWS Console → Amazon Bedrock → Model access
2. Click "Manage model access"
3. Enable **Mistral 7B Instruct**
4. Wait for approval (usually instant)

### 4. Frontend Setup
```bash
cd ../frontend

# Update API URL in src/api.ts
# Change line 4-5 to your API Gateway URL

npm install
npm run build
```

### 5. Deploy Frontend
```bash
# Create bucket
aws s3 mb s3://rift-rewind-frontend-YOUR-ACCOUNT-ID

# Enable website hosting
aws s3 website s3://rift-rewind-frontend-YOUR-ACCOUNT-ID \
  --index-document index.html \
  --error-document index.html

# Set public policy
aws s3api put-bucket-policy \
  --bucket rift-rewind-frontend-YOUR-ACCOUNT-ID \
  --policy file://<(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::rift-rewind-frontend-YOUR-ACCOUNT-ID/*"
  }]
}
EOF
)

# Disable public access block
aws s3api delete-public-access-block \
  --bucket rift-rewind-frontend-YOUR-ACCOUNT-ID

# Deploy
aws s3 sync dist/ s3://rift-rewind-frontend-YOUR-ACCOUNT-ID --delete
```

### 6. Access Your App
```
http://rift-rewind-frontend-YOUR-ACCOUNT-ID.s3-website-REGION.amazonaws.com
```

## Testing

### Test Backend API
```bash
curl -X POST https://YOUR-API-GATEWAY-URL/journey \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "euw1",
    "riotId": "YourName#TAG",
    "archetype": "explorer"
  }'
```

### Test Bedrock Integration
```bash
cd ..
python test_bedrock.py
```

## Troubleshooting

### Backend Issues
- **API returns 500**: Check CloudWatch Logs for Lambda errors
- **No matches found**: Verify Riot API key is valid
- **Bedrock errors**: Ensure model access is granted

### Frontend Issues
- **Can't reach site**: Try HTTP not HTTPS
- **API errors**: Update API URL in `frontend/src/api.ts`
- **Blank page**: Check browser console for errors

### Common Fixes
```bash
# Rebuild backend
cd infra
sam build
sam deploy

# Rebuild frontend
cd frontend
npm run build
aws s3 sync dist/ s3://YOUR-BUCKET --delete
```

## Next Steps
1. ✅ Test with your own Riot ID
2. ✅ Customize region themes in `ChapterView.tsx`
3. ✅ Adjust AI prompts in `bedrock_lore.py`
4. ✅ Share with friends!

## Cost Management
- **Free Tier**: ~1000 requests/month free
- **Typical Cost**: $0.02 per user journey
- **Set Budget Alerts**: AWS Console → Billing → Budgets

## Support
- Issues: https://github.com/shreyan2020/rift-rewind/issues
- Email: [Your email]

---
⚡ Happy coding! ⚡
