# api.py
import json
import os
import time
import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

# -------- logging --------
LOG = logging.getLogger()
LOG.setLevel(os.getenv("LOG_LEVEL", "INFO"))

# -------- env --------
TABLE_NAME         = os.getenv("TABLE_NAME", "jobs")
DDB_ENDPOINT       = os.getenv("DDB_ENDPOINT")  # e.g. http://host.docker.internal:8000 for sam local
SQS_ENDPOINT       = os.getenv("SQS_ENDPOINT")  # e.g. http://localstack:4566 for sam local
FETCH_QUEUE_URL    = os.getenv("FETCH_QUEUE_URL", "")
RIOT_API_KEY       = os.getenv("RIOT_API_KEY", "")
REGION_HINT        = os.getenv("REGION_HINT", "eu-west-1")

# -------- aws clients --------
_boto_cfg = Config(region_name=REGION_HINT, retries={"max_attempts": 3, "mode": "standard"})

# Only pass endpoint_url if it's actually set (for local testing)
_ddb_kwargs = {"config": _boto_cfg}
if DDB_ENDPOINT:
    _ddb_kwargs["endpoint_url"] = DDB_ENDPOINT

_sqs_kwargs = {"config": _boto_cfg}
if SQS_ENDPOINT:
    _sqs_kwargs["endpoint_url"] = SQS_ENDPOINT

DDB = boto3.resource("dynamodb", **_ddb_kwargs)
TABLE = DDB.Table(TABLE_NAME)
SQS = boto3.client("sqs", **_sqs_kwargs)

# -------- utils --------
def _resp(code: int, body: dict):
    # Custom JSON encoder to handle DynamoDB Decimal type
    def decimal_default(obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
    
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps(body, default=decimal_default),
    }

def _to_epoch_secs(x) -> int:
    if isinstance(x, (int, float)):
        return int(x)
    if isinstance(x, datetime):
        if x.tzinfo is None:
            x = x.replace(tzinfo=timezone.utc)
        else:
            x = x.astimezone(timezone.utc)
        return int(x.timestamp())
    raise TypeError(f"Unsupported time type: {type(x)}")

def _year_quarters_utc(year: int):
    # returns list of (label, start_dt, end_dt) in UTC
    def dt(y, m, d):
        return datetime(y, m, d, 0, 0, 0, tzinfo=timezone.utc)

    q1 = ("Q1", dt(year, 1, 1),  dt(year, 4, 1))
    q2 = ("Q2", dt(year, 4, 1),  dt(year, 7, 1))
    q3 = ("Q3", dt(year, 7, 1),  dt(year, 10, 1))
    q4 = ("Q4", dt(year, 10, 1), dt(year + 1, 1, 1))
    return [q1, q2, q3, q4]

def q_ranges_for_year(now_utc: datetime):
    year = now_utc.astimezone(timezone.utc).year
    return [(label, _to_epoch_secs(st), _to_epoch_secs(et)) for label, st, et in _year_quarters_utc(year)]

def _is_local_mode() -> bool:
    # Local if no SQS URL or a placeholder value
    return (not FETCH_QUEUE_URL) or ("<acct>" in FETCH_QUEUE_URL) or FETCH_QUEUE_URL.startswith("local-")

def _safe_ddb_put(item: dict):
    try:
        TABLE.put_item(Item=item)
    except ClientError as e:
        LOG.error("DynamoDB put_item failed: %s", e, exc_info=True)
        raise

def _safe_sqs_send(url: str, msg_body: dict):
    try:
        SQS.send_message(QueueUrl=url, MessageBody=json.dumps(msg_body))
    except ClientError as e:
        LOG.error("SQS send_message failed: %s", e, exc_info=True)
        raise

# -------- handlers --------
def create_job(body: dict):
    platform  = (body.get("platform") or "").lower()
    riot_id   = body.get("riotId") or ""
    archetype = body.get("archetype") or "explorer"
    bypass_cache = body.get("bypassCache", False)  # Allow cache bypass

    if "#" not in riot_id or not platform:
        return _resp(400, {"error": "platform and riotId='Game#Tag' required"})

    # Check for existing completed job (cache lookup) - unless bypassed
    if not bypass_cache:
        try:
            # Query recent jobs for this riotId + platform
            # Scan with filter (since we don't have GSI yet)
            response = TABLE.scan(
                FilterExpression="riotId = :rid AND platform = :plat",
                ExpressionAttributeValues={":rid": riot_id, ":plat": platform},
                Limit=10
            )
            
            # Find most recent completed job (all quarters ready)
            for item in sorted(response.get("Items", []), key=lambda x: x.get("createdAt", 0), reverse=True):
                quarters = item.get("quarters", {})
                if all(quarters.get(q) == "ready" for q in ["Q1", "Q2", "Q3", "Q4"]):
                    # Found a completed job, return it
                    LOG.info(f"Cache hit: returning existing jobId={item['jobId']} for {riot_id}")
                    return _resp(200, {
                        "jobId": item["jobId"],
                        "queued": False,
                        "cached": True,
                        "note": "Using existing completed journey"
                    })
        except Exception as e:
            LOG.warning(f"Cache lookup failed: {e}")
            # Continue to create new job if cache lookup fails
    else:
        LOG.info(f"Cache bypassed for {riot_id}")

    job_id = str(uuid.uuid4())
    now = int(time.time())

    item = {
        "jobId": job_id,
        "platform": platform,
        "riotId": riot_id,
        "archetype": archetype,
        "createdAt": now,
        "status": "queued",
        "quarters": {"Q1": "pending", "Q2": "pending", "Q3": "pending", "Q4": "pending"},
        "s3Base": f"{job_id}/",
    }

    # Diagnostics for local DDB
    try:
        LOG.info("DDB_ENDPOINT=%s", DDB_ENDPOINT)
        LOG.info("TABLE_NAME=%s", TABLE_NAME)
        LOG.info("dynamodb list_tables => %s", DDB.meta.client.list_tables())
    except Exception as _:
        pass

    _safe_ddb_put(item)

    local_mode = _is_local_mode()
    if local_mode:
        # In local mode do not hit real SQS. Return the job id so you can poll /status locally or drive next steps manually.
        return _resp(200, {"jobId": job_id, "queued": False, "note": "local mode, SQS not used"})

    # Enqueue only Q1 initially - sequential processing
    quarters = q_ranges_for_year(datetime.now(timezone.utc))
    first_quarter = quarters[0]  # Q1
    label, st, et = first_quarter
    _safe_sqs_send(FETCH_QUEUE_URL, {
        "jobId": job_id,
        "platform": platform,
        "riotId": riot_id,
        "quarter": label,
        "start": int(st),
        "end": int(et),
    })

    return _resp(200, {"jobId": job_id, "queued": True})

def get_status(job_id: str):
    try:
        r = TABLE.get_item(Key={"jobId": job_id})
    except ClientError as e:
        LOG.error("DynamoDB get_item failed: %s", e, exc_info=True)
        return _resp(500, {"error": "ddb failure"})

    item = r.get("Item")
    if not item:
        return _resp(404, {"error": "not found"})
    return _resp(200, item)

# -------- router --------
def handler(event, _context):
    """
    Routes:
      OPTIONS /*            -> CORS preflight
      POST /journey         -> create_job
      GET  /status/{jobId}  -> get_status
    """
    try:
        path  = (event.get("rawPath") or event.get("path") or "/").lower()
        method = (event.get("requestContext", {}).get("http", {}).get("method")
                  or event.get("httpMethod") or "GET").upper()

        # Handle CORS preflight
        if method == "OPTIONS":
            return _resp(200, {"message": "OK"})

        # POST /journey
        if method == "POST" and path.rstrip("/").endswith("/journey"):
            body = json.loads(event.get("body") or "{}")
            return create_job(body)

        # GET /status/{jobId}
        if method == "GET" and "/status/" in path:
            job_id = path.split("/status/", 1)[1].strip("/")
            if not job_id:
                return _resp(400, {"error": "missing job id"})
            return get_status(job_id)

        return _resp(404, {"error": "route not found"})

    except Exception as e:
        LOG.exception("Unhandled error")
        return _resp(500, {"error": "internal", "detail": str(e)})
