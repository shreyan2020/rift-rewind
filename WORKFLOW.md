# Rift Rewind - Simplified Workflow

## 🎯 ONE Script to Rule Them All

Use **`create_journey.py`** to convert your local match data into a frontend-ready journey package.

## 🚀 Quick Start

### Step 1: Prepare Your Data
Put all your match JSON files in a folder (e.g., `./dataset/`)

### Step 2: Run the Script
```bash
python create_journey.py ./dataset --player-name "YourName#TAG"
```

### Step 3: Upload to Frontend
```bash
cd frontend
npm run dev
# Open http://localhost:5173
# Click "Upload Journey Package"
# Select journey-output-upload.json
```

That's it! 🎉

## 📋 Full Command Options

```bash
python create_journey.py <folder> --player-name "Name#TAG" [OPTIONS]

Required:
  <folder>              Path to folder with match JSON files
  --player-name         Your player name (e.g., "bst#0123")

Optional:
  --output NAME         Output folder name (default: journey-output)
  --archetype TYPE      Player archetype: explorer, guardian, dominator, 
                        strategist, supporter (default: explorer)
```

## 📂 What Gets Created

```
journey-output/
├── Q1/story.json          # Quarter 1 story with lore & stats
├── Q2/story.json          # Quarter 2 story
├── Q3/story.json          # Quarter 3 story
├── Q4/story.json          # Quarter 4 story
├── finale.json            # Year-end analytics & insights
└── metadata.json          # Player info & summary

journey-output-upload.json  # 👈 THIS IS THE FILE YOU UPLOAD!
```

## 🎮 Examples

### Basic Usage
```bash
python create_journey.py ./dataset --player-name "bst#0123"
```

### Custom Output Folder
```bash
python create_journey.py ./my_matches --player-name "Player#TAG" --output my-journey
```

### Different Archetype
```bash
python create_journey.py ./dataset --player-name "bst#0123" --archetype guardian
```

## 📊 What the Script Does

1. **Loads matches** from your folder (969 files → loaded into memory)
2. **Sorts chronologically** by timestamp
3. **Divides into 4 quarters** (Q1, Q2, Q3, Q4)
4. **Calculates Schwartz values** (Security, Power, Achievement, etc.)
5. **Generates lore** via AWS Bedrock API (stores responses)
6. **Creates analytics** (trends, insights, champion analysis)
7. **Packages everything** into ONE JSON file

## ⚙️ Requirements

### Python Environment
```bash
# Activate your venv
cd rift-rewind-v2
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows
```

### AWS Credentials
The script needs AWS Bedrock access for lore generation:
```bash
aws configure
# Enter your AWS credentials
```

### Data Format
Your match files should be in **pre-processed format** with these fields:
- `timestamp` - Game timestamp
- `achiev` - Achievement metrics
- `power` - Power/damage metrics
- `selfD` - Self-direction metrics
- `secs` - Security metrics
- `trad` - Tradition/CS metrics
- `bene` - Benevolence metrics
- `hed` - Hedonism metrics
- `stim` - Stimulation metrics
- `univ` - Universalism metrics

## 🗑️ Old Scripts (Can Be Deleted)

The following scripts are **no longer needed**:
- ❌ `process_local_matches.py` - For raw Riot API format (different use case)
- ❌ `package_for_upload.py` - Functionality now in `create_journey.py`
- ❌ `aggregate_matches.py` - Doesn't generate lore/analytics

**Keep only:**
- ✅ `create_journey.py` - THE MAIN SCRIPT
- ✅ `fetch_quarter_matches.py` - For fetching new matches from Riot API (if needed)

## 🐛 Troubleshooting

### "No matches found"
- Check that your folder contains JSON files
- Verify files are in pre-processed format

### "AWS Bedrock error"
- Check AWS credentials: `aws configure`
- Verify you have Bedrock access in your AWS account

### "Import error from stats_inference"
- Make sure you're running from `rift-rewind-v2` directory
- Check that `infra/src/` folder exists

### Stats showing zeros
- Verify your match files have the required fields (`achiev`, `power`, `secs`, etc.)
- Check one match file manually with `cat dataset/bst_EUW1_*.json`

## 📞 Need Help?

Check the generated files:
```bash
# View metadata
cat journey-output/metadata.json

# View Q1 stats
cat journey-output/Q1/story.json | grep -A 10 '"stats"'

# View finale trends
cat journey-output/finale.json | grep -A 20 '"trends"'
```

## 🎯 Summary

**Old workflow (complicated):**
1. Run `aggregate_matches.py`
2. Run `generate_journey_package.py`
3. Run `package_for_upload.py`
4. Upload result

**New workflow (simple):**
1. Run `create_journey.py ./dataset --player-name "bst#0123"`
2. Upload `journey-output-upload.json`

Done! 🎉
