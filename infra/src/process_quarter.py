import os, json, boto3
from datetime import datetime, timezone
from common import to_regional, parse_riot_id, get_puuid
from stats_inference import (
    bundles_from_participant, score_values, aggregate_mean,
    universalism_bonus, chapter_stats
)
from bedrock_lore import (
    generate_quarter_lore, generate_quarter_reflection,
    generate_finale_lore, generate_finale_reflection
)

# Map values to Runeterra regions
REGION_ARC_MAP = {
    "Power": "Noxus",
    "Achievement": "Piltover",
    "Hedonism": "Bilgewater",
    "Stimulation": "Zaun",
    "Self-Direction": "Ionia",
    "Benevolence": "Demacia",
    "Tradition": "Freljord",
    "Conformity": "Targon",
    "Security": "Shurima",
    "Universalism": "Runeterra",
}

def choose_region_arc(quarter_num: int, curr_values: dict, prev_values = None) -> str:
    """
    Dynamically choose region based on player's value profile.
    Q1: Dominant current value
    Q2: Biggest absolute change
    Q3: Biggest negative change (challenge)
    Q4: Dominant value (resolution/mastery)
    """
    if not curr_values:
        return "Runeterra"
    
    # Q1: dominant current value
    if quarter_num == 1:
        top_value = max(curr_values.items(), key=lambda kv: kv[1])[0]
        return REGION_ARC_MAP.get(top_value, "Runeterra")
    
    # For Q2/Q3, need deltas
    if prev_values:
        deltas = {k: curr_values.get(k, 0.0) - prev_values.get(k, 0.0)
                  for k in set(curr_values.keys()).union(prev_values.keys())}
        
        if quarter_num == 2:
            # Q2: biggest absolute change
            val = max(deltas.items(), key=lambda kv: abs(kv[1]))[0]
            return REGION_ARC_MAP.get(val, "Runeterra")
        
        if quarter_num == 3:
            # Q3: biggest negative change (challenge)
            val = min(deltas.items(), key=lambda kv: kv[1])[0]
            return REGION_ARC_MAP.get(val, "Runeterra")
    
    # Q4 or fallback: dominant value
    top_value = max(curr_values.items(), key=lambda kv: kv[1])[0]
    return REGION_ARC_MAP.get(top_value, "Runeterra")

# Get config from env
REGION = os.environ.get("REGION_HINT", "eu-west-1")
DDB_ENDPOINT = os.environ.get("DDB_ENDPOINT")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT")

# Initialize clients with optional endpoints
_ddb_kwargs = {"region_name": REGION}
if DDB_ENDPOINT:
    _ddb_kwargs["endpoint_url"] = DDB_ENDPOINT
DDB = boto3.resource("dynamodb", **_ddb_kwargs).Table(os.environ["TABLE_NAME"])

_s3_kwargs = {"region_name": REGION}
if S3_ENDPOINT:
    _s3_kwargs["endpoint_url"] = S3_ENDPOINT
S3 = boto3.client("s3", **_s3_kwargs)

_sqs_kwargs = {"region_name": REGION}
SQS_ENDPOINT = os.environ.get("SQS_ENDPOINT")
if SQS_ENDPOINT:
    _sqs_kwargs["endpoint_url"] = SQS_ENDPOINT
SQS = boto3.client("sqs", **_sqs_kwargs)
FETCH_QUEUE_URL = os.environ.get("FETCH_QUEUE_URL", "")


BUCKET = os.environ["BUCKET_NAME"]

def _s3_read_json(key): 
    obj = S3.get_object(Bucket=BUCKET, Key=key)
    return json.loads(obj["Body"].read().decode("utf-8"))

def _s3_write_json(key, obj):
    S3.put_object(Bucket=BUCKET, Key=key, Body=json.dumps(obj).encode("utf-8"),
                  ContentType="application/json")

def _update_job(jobId, **fields):
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
    names = {f"#{k}": k for k in fields}
    vals  = {f":{k}": v for k,v in fields.items()}
    DDB.update_item(Key={"jobId": jobId}, UpdateExpression=expr,
                    ExpressionAttributeNames=names, ExpressionAttributeValues=vals)

def handler(event, context):
    for rec in event["Records"]:
        msg = json.loads(rec["body"])
        job_id  = msg["jobId"]; label = msg["quarter"]
        item = DDB.get_item(Key={"jobId": job_id}).get("Item")
        if not item: 
            continue
        
        # Check if previous quarters are ready before processing
        qmap = item.get("quarters", {"Q1":"pending","Q2":"pending","Q3":"pending","Q4":"pending"})
        quarter_order = ["Q1", "Q2", "Q3", "Q4"]
        
        if label in quarter_order:
            current_idx = quarter_order.index(label)
            # Check if all previous quarters are complete ("ready")
            can_process = True
            for i in range(current_idx):
                prev_quarter = quarter_order[i]
                prev_status = qmap.get(prev_quarter, "pending")
                if prev_status != "ready":
                    print(f"Skipping {label} for job {job_id} - waiting for {prev_quarter} (status: {prev_status})")
                    can_process = False
                    break
            
            if not can_process:
                # Don't process yet - message will become visible again after timeout
                continue
        
        platform = item["platform"]; riot_id = item["riotId"]; s3_base = item["s3Base"]

        regional = to_regional(platform)
        game, tag = parse_riot_id(riot_id)
        puuid = get_puuid(regional, game, tag)
        if not puuid:
            qmap = item.get("quarters", {"Q1":"pending","Q2":"pending","Q3":"pending","Q4":"pending"})
            qmap[label] = "error"; _update_job(job_id, quarters=qmap); 
            continue

        index_key = f"{s3_base}{label}/index.json"
        index = _s3_read_json(index_key)
        matches = [_s3_read_json(it["s3Key"]) for it in index.get("items", [])]

        bundles = []
        for mj in matches:
            parts = (mj.get("info") or {}).get("participants") or []
            you = next((p for p in parts if p.get("puuid")==puuid), None)
            if you: bundles.append(bundles_from_participant(you))

        # Calculate raw scores and average them (don't z-score within single player)
        raw = score_values(bundles)
        values = aggregate_mean(raw)
        
        # Add universalism bonus
        values["Universalism"] = values.get("Universalism", 0.0) + universalism_bonus(bundles)
        
        # Scale to 0-100 range for readability
        # Find global min/max across all values
        all_vals = list(values.values())
        min_val = min(all_vals) if all_vals else 0
        max_val = max(all_vals) if all_vals else 1
        val_range = max_val - min_val
        
        # Normalize to 0-100 scale
        if val_range > 0.001:  # Only scale if there's meaningful variation
            values = {k: ((v - min_val) / val_range) * 100 for k, v in values.items()}
        else:
            # If all values are similar, distribute evenly around 50
            values = {k: 50.0 for k in values.keys()}
        
        stats = chapter_stats(bundles)

        top_values = sorted(values.items(), key=lambda kv: kv[1], reverse=True)[:5]
        
        # Dynamically determine region arc based on values and quarter progression
        quarter_num = int(label[1])  # Extract number from "Q1", "Q2", etc.
        prev_values = None
        
        # Try to load previous quarter's values and lore for comparison (Q2, Q3, Q4)
        prev_lore = None
        if quarter_num > 1:
            prev_label = f"Q{quarter_num - 1}"
            try:
                prev_story = _s3_read_json(f"{s3_base}{prev_label}/story.json")
                if prev_story:
                    prev_values = prev_story.get("values", {})
                    prev_lore = prev_story.get("lore", "")
            except Exception:
                pass
        
        region_arc = choose_region_arc(quarter_num, values, prev_values)
        
        # Generate AI-powered lore with continuity from previous quarter
        lore = generate_quarter_lore(label, stats, top_values, region_arc, prev_lore)
        reflection = generate_quarter_reflection(label, stats, top_values)

        story = {"quarter": label, "values": values, "top_values": top_values, "stats": stats,
                 "lore": lore, "reflection": reflection, "region_arc": region_arc}
        _s3_write_json(f"{s3_base}{label}/story.json", story)

        qmap = item.get("quarters", {"Q1":"pending","Q2":"pending","Q3":"pending","Q4":"pending"})

        # Trigger next quarter sequentially
        quarter_order = ["Q1", "Q2", "Q3", "Q4"]
        if label in quarter_order:
            current_idx = quarter_order.index(label)
            if current_idx < 3:  # Not Q4
                next_quarter = quarter_order[current_idx + 1]
                # Check if next quarter is still pending
                if qmap.get(next_quarter) == "pending":
                    # Calculate time ranges for next quarter
                    year = datetime.now(timezone.utc).year
                    def dt(y, m, d):
                        return datetime(y, m, d, 0, 0, 0, tzinfo=timezone.utc)
                    quarter_dates = {
                        "Q1": (dt(year, 1, 1), dt(year, 4, 1)),
                        "Q2": (dt(year, 4, 1), dt(year, 7, 1)),
                        "Q3": (dt(year, 7, 1), dt(year, 10, 1)),
                        "Q4": (dt(year, 10, 1), dt(year + 1, 1, 1)),
                    }
                    st, et = quarter_dates[next_quarter]
                    # Queue next quarter for fetching
                    try:
                        SQS.send_message(
                            QueueUrl=FETCH_QUEUE_URL,
                            MessageBody=json.dumps({
                                "jobId": job_id,
                                "platform": platform,
                                "riotId": riot_id,
                                "quarter": next_quarter,
                                "start": int(st.timestamp()),
                                "end": int(et.timestamp()),
                            })
                        )
                    except Exception as e:
                        print(f"Failed to queue {next_quarter}: {e}")

        qmap[label] = "ready"
        _update_job(job_id, quarters=qmap)
        
        # Generate finale if Q4 just completed
        if label == "Q4" and all(qmap.get(q) == "ready" for q in ["Q1", "Q2", "Q3", "Q4"]):
            try:
                # Collect all quarter data
                all_quarters_data = []
                for q in ["Q1", "Q2", "Q3", "Q4"]:
                    quarter_story = _s3_read_json(f"{s3_base}{q}/story.json")
                    if quarter_story:
                        all_quarters_data.append(quarter_story)
                
                # Calculate total games across all quarters
                total_games = sum(q["stats"].get("games", 0) for q in all_quarters_data)
                
                # Generate finale lore and reflection
                player_name = riot_id.split("#")[0] if "#" in riot_id else riot_id
                finale_lore = generate_finale_lore(all_quarters_data, player_name, total_games)
                finale_reflection = generate_finale_reflection(all_quarters_data)
                
                # Save finale
                finale = {
                    "lore": finale_lore,
                    "final_reflection": finale_reflection,
                    "total_games": total_games,
                    "quarters": all_quarters_data
                }
                _s3_write_json(f"{s3_base}finale.json", finale)
                print(f"Generated finale for {job_id}")
            except Exception as e:
                print(f"Failed to generate finale: {e}")
