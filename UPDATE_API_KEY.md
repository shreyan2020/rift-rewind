# How to Update Your Riot API Key

## Step 1: Get a New API Key

1. Go to: https://developer.riotgames.com/
2. Sign in with your Riot account (or create one)
3. Click on "API Keys" in the left menu
4. You should see your current key - it might show as "EXPIRED" or with a red warning
5. Click the blue "GENERATE API KEY" button
6. Copy the new key (it will look like: `RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Step 2: Update the Key in AWS Secrets Manager

Run this command in WSL (replace YOUR_NEW_KEY with the key you just copied):

```bash
aws secretsmanager update-secret \
  --secret-id RiotApiKey \
  --secret-string '{"token":"YOUR_NEW_KEY"}' \
  --region eu-west-1
```

**Example:**
```bash
aws secretsmanager update-secret \
  --secret-id RiotApiKey \
  --secret-string '{"token":"RGAPI-82650f00-053c-4a87-9687-9fb719afc6fd"}' \
  --region eu-west-1
```

Expected output:
```json
{
    "ARN": "arn:aws:secretsmanager:eu-west-1:567020425899:secret:RiotApiKey-XXXXX",
    "Name": "RiotApiKey",
    "Version": "xxxxx-xxxxx-xxxxx-xxxxx"
}
```

## Step 3: Redeploy Your Lambda Functions

The Lambda functions will automatically pick up the new key from Secrets Manager on their next execution. They cache the secret for a few minutes, so:

**Option A (Faster):** Update and redeploy just the Lambda functions:
```bash
cd /mnt/c/Users/shrey/OneDrive/Documents/all-codes/rift-rewind-v2/infra
sam build
sam deploy
```

**Option B (Immediate):** Wait for the cache to expire (2-5 minutes) and try again

## Step 4: Test with a New Job

Create a fresh job to test with the new key:

```bash
curl -X POST https://vassfd5se4.execute-api.eu-west-1.amazonaws.com/journey \
  -H "Content-Type: application/json" \
  -d '{"platform":"euw1","riotId":"bst#0123","archetype":"explorer"}'
```

Then check the status:
```bash
curl https://vassfd5se4.execute-api.eu-west-1.amazonaws.com/status/{jobId}
```

You should now see Q1/Q2/Q3/Q4 changing from "pending" → "fetching" → "fetched" → "ready"

---

## Troubleshooting

### "Unknown apikey" error persists
- Make sure you copied the ENTIRE key correctly
- Your key might have expired again (free keys only last 24 hours)
- Get a fresh one from developer.riotgames.com

### Still getting 401 after updating
- Wait 2-5 minutes for the Lambda cache to refresh
- Or redeploy with `sam deploy`

### Getting "404 Not Found" or "Player not found"
- The player `bst#0123` might not exist or have no matches
- Try with your own account's player name
- Format must be: `GameName#Tag` (case doesn't matter for Tag)

---

## Important Notes

⏰ **Free Tier API Key Duration:** 24 hours only  
✅ **Production/Developer Tier:** Request longer duration at developer.riotgames.com

After updating your key, your system should work perfectly! 🎉
