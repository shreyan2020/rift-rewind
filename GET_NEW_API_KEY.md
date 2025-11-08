# 🔑 Generate Fresh Riot API Key

Your current API key has **EXPIRED**. Free Riot API keys only last 24 hours!

## Step 1: Generate a New Key (RIGHT NOW)

1. Go to: https://developer.riotgames.com/
2. Sign in with your Riot account
3. Click **"API Keys"** in left menu
4. Click the blue **"GENERATE API KEY"** button
5. **COPY the new key immediately** - it looks like: `RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## Step 2: Test It Locally First

Run this command in WSL (replace with your NEW key):

```bash
python3 << 'EOF'
import requests
import json

API_KEY = "YOUR_NEW_KEY_HERE"  # Paste your new key here!

url = "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/bst/0123"
headers = {"X-Riot-Token": API_KEY}

response = requests.get(url, headers=headers, timeout=10)
print(f"Status: {response.status_code}")
print(json.dumps(response.json(), indent=2))

if response.status_code == 200:
    print("\n✅ KEY IS VALID!")
elif response.status_code == 401:
    print("\n❌ KEY IS INVALID")
EOF
```

## Step 3: Update template.yaml

Once you confirm the key works locally, update it in the template:

Edit `infra/template.yaml` and change:

```yaml
RIOT_API_KEY: "YOUR_NEW_KEY_HERE"
```

Replace `YOUR_NEW_KEY_HERE` with your fresh key.

## Step 4: Redeploy

```bash
cd /mnt/c/Users/shrey/OneDrive/Documents/all-codes/rift-rewind-v2/infra
sam build
sam deploy
```

## Step 5: Test

```bash
curl -X POST https://vassfd5se4.execute-api.eu-west-1.amazonaws.com/journey \
  -H "Content-Type: application/json" \
  -d '{"platform":"euw1","riotId":"bst#0123","archetype":"explorer"}'
```

Check status and it should now work! ✅

---

## Important Reminders

⏰ **Free keys expire:** 24 hours (regenerate before they expire)  
🔒 **Never commit keys to Git:** Use environment variables or secrets manager  
📋 **Your current key:** Created > 24 hours ago, so it's expired  

**Get that fresh key and it'll work!** 🚀
