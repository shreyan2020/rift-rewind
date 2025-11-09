import os, json, boto3, botocore
import logging
from botocore.exceptions import ClientError

from concurrent.futures import ThreadPoolExecutor, as_completed
from common import to_regional, parse_riot_id, get_puuid, fetch_match, regional_for_match

# Setup logging
# Force update: 2025-01-08 17:42 UTC - Added 50 match limit for testing
LOG = logging.getLogger()
LOG.setLevel(logging.INFO)

# Get config from env
REGION = os.environ.get("REGION_HINT", "eu-west-1")
DDB_ENDPOINT = os.environ.get("DDB_ENDPOINT")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT")
SQS_ENDPOINT = os.environ.get("SQS_ENDPOINT")

# Initialize clients with region and optional endpoints
_ddb_kwargs = {"region_name": REGION}
if DDB_ENDPOINT:
    _ddb_kwargs["endpoint_url"] = DDB_ENDPOINT
_ddb = boto3.resource("dynamodb", **_ddb_kwargs)
DDB = _ddb.Table(os.environ["TABLE_NAME"])

_s3_kwargs = {"region_name": REGION}
if S3_ENDPOINT:
    _s3_kwargs["endpoint_url"] = S3_ENDPOINT
S3 = boto3.client("s3", **_s3_kwargs)

_sqs_kwargs = {"region_name": REGION}
if SQS_ENDPOINT:
    _sqs_kwargs["endpoint_url"] = SQS_ENDPOINT
SQS = boto3.client("sqs", **_sqs_kwargs)

BUCKET = os.environ["BUCKET_NAME"]
FETCH_QUEUE_URL = os.environ.get("FETCH_QUEUE_URL", "")
PROCESS_QUEUE_URL = os.environ.get("PROCESS_QUEUE_URL", "")
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY","8"))

def _extract_messages(event):
    # SQS batch
    if isinstance(event, dict) and "Records" in event:
        for rec in event["Records"]:
            yield json.loads(rec.get("body") or "{}")
        return
    # direct invoke
    if isinstance(event, dict):
        yield event
        return
    # raw string
    if isinstance(event, str):
        yield json.loads(event)


def s3_exists(key: str) -> bool:
    try:
        S3.head_object(Bucket=BUCKET, Key=key)
        return True
    except ClientError as e:
        if e.response.get("ResponseMetadata",{}).get("HTTPStatusCode") == 404:
            return False
        raise

def s3_list_prefix(prefix: str):
    ctoken = None
    out = []
    try:
        while True:
            kw = {"Bucket": BUCKET, "Prefix": prefix}
            if ctoken: kw["ContinuationToken"] = ctoken
            r = S3.list_objects_v2(**kw)
            for obj in r.get("Contents", []):
                out.append(obj["Key"])
            if not r.get("IsTruncated"): break
            ctoken = r.get("NextContinuationToken")
    except ClientError as e:
        # Bucket doesn't exist yet (first run)
        if e.response.get("Error", {}).get("Code") == "NoSuchBucket":
            return []
        raise
    return out

def s3_read_json(key: str):
    obj = S3.get_object(Bucket=BUCKET, Key=key)
    return json.loads(obj["Body"].read().decode("utf-8"))

def s3_ensure_bucket_exists():
    """Create bucket if it doesn't exist"""
    try:
        S3.head_bucket(Bucket=BUCKET)
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") in ["404", "NoSuchBucket"]:
            S3.create_bucket(Bucket=BUCKET)
        else:
            raise

def s3_write_json(key: str, obj):
    # Ensure bucket exists before writing
    try:
        s3_ensure_bucket_exists()
    except Exception:
        pass  # If creation fails, proceed and let PutObject fail with clearer error
    
    body = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
    S3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")

def update_job(jobId, **fields):
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields.keys())
    names = {f"#{k}": k for k in fields.keys()}
    vals  = {f":{k}": v for k,v in fields.items()}
    DDB.update_item(Key={"jobId": jobId}, UpdateExpression=expr,
                    ExpressionAttributeNames=names, ExpressionAttributeValues=vals)

def handler(event, context):
    for rec in event["Records"]:
        msg = json.loads(rec["body"])
        
        # Check if previous quarters are ready before processing
        job_id = msg.get("jobId")
        label = msg.get("quarter")
        
        if job_id and label:
            item = DDB.get_item(Key={"jobId": job_id}).get("Item")
            if item:
                qmap = item.get("quarters", {})
                quarter_order = ["Q1", "Q2", "Q3", "Q4"]
                
                if label in quarter_order:
                    current_idx = quarter_order.index(label)
                    # Check if all previous quarters are complete
                    can_process = True
                    for i in range(current_idx):
                        prev_quarter = quarter_order[i]
                        prev_status = qmap.get(prev_quarter, "pending")
                        if prev_status not in ["fetched", "ready"]:
                            LOG.info(f"Skipping {label} for job {job_id} - waiting for {prev_quarter} (status: {prev_status})")
                            can_process = False
                            break
                    
                    if not can_process:
                        # Don't process yet - message will become visible again after timeout
                        continue
        
        process_fetch(msg)

def process_fetch(msg):
    job_id  = msg["jobId"]
    force   = bool(msg.get("force", False))
    
    # Check if this is a special "discover_and_divide" task
    task = msg.get("task")
    if task == "discover_and_divide":
        LOG.info(f"Processing discover_and_divide for jobId={job_id}")
        item = DDB.get_item(Key={"jobId": job_id}).get("Item")
        if not item:
            LOG.warning(f"Job not found: {job_id}")
            return
        platform = item["platform"]
        riot_id = item["riotId"]
        s3_base = item["s3Base"]
        process_fetch_all(job_id, platform, riot_id, s3_base, force)
        return
    
    # Normal quarter processing
    label   = msg["quarter"]
    LOG.info(f"Processing fetch for jobId={job_id}, quarter={label}")
    
    item = DDB.get_item(Key={"jobId": job_id}).get("Item")
    if not item:
        LOG.warning(f"Job not found: {job_id}")
        return
    
    platform = item["platform"]
    riot_id = item["riotId"]
    s3_base = item["s3Base"]
    
    # Handle normal quarter fetching (Q1, Q2, Q3, Q4)
    qmap = item.get("quarters", {"Q1":"pending","Q2":"pending","Q3":"pending","Q4":"pending"})
    qmap[label] = "fetching"
    update_job(job_id, quarters=qmap, status="running")
    
    regional = to_regional(platform)
    game, tag = parse_riot_id(riot_id)
    
    LOG.info(f"Getting PUUID for {game}#{tag} in {regional}")
    puuid = get_puuid(regional, game, tag)
    if not puuid:
        LOG.error(f"Failed to get PUUID for {game}#{tag} - marking quarter as error")
        qmap[label] = "error"
        update_job(job_id, quarters=qmap)
        return
    
    # Get the match IDs for this quarter from the quarterMatches map
    quarter_matches = item.get("quarterMatches", {})
    match_ids_for_quarter = quarter_matches.get(label, [])
    
    if not match_ids_for_quarter:
        LOG.warning(f"No matches found for {label} in quarterMatches map")
        qmap[label] = "error"
        update_job(job_id, quarters=qmap)
        return
    
    LOG.info(f"Fetching {len(match_ids_for_quarter)} matches for {label}")
    
    # Cache-first: if index.json exists and not forceReload, skip network
    index_key = f"{s3_base}{label}/index.json"
    if s3_exists(index_key) and not force:
        # still enqueue processing
        if PROCESS_QUEUE_URL:
            SQS.send_message(QueueUrl=PROCESS_QUEUE_URL, MessageBody=json.dumps({
                "jobId": job_id, "quarter": label
            }))
        qmap[label] = "fetched"
        update_job(job_id, quarters=qmap)
        return
    
    # Fetch all matches for this quarter
    existing_keys = set(s3_list_prefix(f"{s3_base}{label}/"))
    existing_ids = set()
    for k in existing_keys:
        if k.endswith(".json") and "_EU" in k or "_NA" in k or "_KR" in k:
            mid = k.rsplit("/",1)[-1].split("_",1)[-1].removesuffix(".json")
            existing_ids.add(mid)
    
    missing = [mid for mid in match_ids_for_quarter if mid not in existing_ids]
    
    LOG.info(f"Need to fetch {len(missing)} new matches for {label}")
    
    results = {}
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENCY) as pool:
        futs = {pool.submit(fetch_match, regional_for_match(mid), mid): mid for mid in missing}
        for fut in as_completed(futs):
            mid = futs[fut]
            data = fut.result()
            if data is None:
                continue
            key = f"{s3_base}{label}/{riot_id.split('#',1)[0]}_{mid}.json"
            if not s3_exists(key):
                s3_write_json(key, data)
            results[mid] = key
    
    # Build index
    merged_items = []
    if s3_exists(index_key):
        try:
            old = s3_read_json(index_key)
            merged_items.extend(old.get("items", []))
        except Exception:
            pass
    
    old_ids = {it.get("matchId") for it in merged_items}
    for m, k in results.items():
        if m not in old_ids:
            merged_items.append({"matchId": m, "s3Key": k})
    
    for k in existing_keys:
        if k.endswith(".json") and "/index.json" not in k and "/story.json" not in k:
            mid = k.rsplit("/",1)[-1].split("_",1)[-1].removesuffix(".json")
            if mid not in {it["matchId"] for it in merged_items}:
                merged_items.append({"matchId": mid, "s3Key": k})
    
    s3_write_json(index_key, {"count": len(merged_items), "items": merged_items})
    
    # enqueue processing
    if PROCESS_QUEUE_URL:
        SQS.send_message(QueueUrl=PROCESS_QUEUE_URL, MessageBody=json.dumps({
            "jobId": job_id, "quarter": label
        }))
    qmap[label] = "fetched"
    update_job(job_id, quarters=qmap)


def process_fetch_all(job_id, platform, riot_id, s3_base, force):
    """
    Fetch ALL 2025 matches, divide them into quarters by position,
    then enqueue Q1-Q4 fetch tasks.
    """
    LOG.info(f"Fetching all 2025 matches for {riot_id}")
    
    regional = to_regional(platform)
    game, tag = parse_riot_id(riot_id)
    
    puuid = get_puuid(regional, game, tag)
    if not puuid:
        LOG.error(f"Failed to get PUUID for {game}#{tag}")
        update_job(job_id, status="error")
        return
    
    # Import the new functions from common
    from common import get_all_ids_2025, divide_matches_into_quarters, MAX_MATCHES_PER_QUARTER
    
    # Fetch all match IDs from 2025
    all_match_ids = get_all_ids_2025(regional, puuid)
    
    if not all_match_ids:
        LOG.warning(f"No matches found for {riot_id} in 2025")
        update_job(job_id, status="error", quarters={
            "Q1": "error", "Q2": "error", "Q3": "error", "Q4": "error"
        })
        return
    
    # Divide into quarters (max 50 matches per quarter by default)
    quarters_map = divide_matches_into_quarters(all_match_ids, max_per_quarter=MAX_MATCHES_PER_QUARTER)
    
    # Store the quarter divisions in DynamoDB
    update_job(job_id, quarterMatches=quarters_map)
    
    # Enqueue Q1 first (sequential processing)
    if PROCESS_QUEUE_URL:
        SQS.send_message(QueueUrl=FETCH_QUEUE_URL, MessageBody=json.dumps({
            "jobId": job_id,
            "platform": platform,
            "riotId": riot_id,
            "quarter": "Q1",
            "force": force
        }))
    
    LOG.info(f"Enqueued Q1 for processing ({len(quarters_map['Q1'])} matches)")