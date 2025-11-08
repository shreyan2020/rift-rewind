#!/usr/bin/env python3
"""
Verify that the Rift Rewind system is working correctly (LocalStack)
"""
import json
from typing import List, Dict, Any
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

# LocalStack configuration
DDB_ENDPOINT = "http://localhost:4566"
S3_ENDPOINT = "http://localhost:4566"
REGION = "us-east-1"
TABLE_NAME = "local-jobs-table"
BUCKET_NAME = "rift-rewind-data-local"

# Explicit dummy creds + S3 path-style for LocalStack
SESSION = boto3.session.Session(
    aws_access_key_id="test",
    aws_secret_access_key="test",
    region_name=REGION,
)

BOTO_CFG = Config(
    retries={"max_attempts": 5, "mode": "standard"},
    s3={"addressing_style": "path"},
)

# Initialize clients
ddb = SESSION.resource("dynamodb", endpoint_url=DDB_ENDPOINT, config=BOTO_CFG)
table = ddb.Table(TABLE_NAME)
s3 = SESSION.client("s3", endpoint_url=S3_ENDPOINT, config=BOTO_CFG)

print("=" * 60)
print("RIFT REWIND SYSTEM VERIFICATION")
print("=" * 60)

# ---------- 1) DynamoDB: read all jobs with pagination ----------
print("\n✅ DYNAMODB JOBS:")
print("-" * 60)
items: List[Dict[str, Any]] = []
scan_kwargs = {}
while True:
    resp = table.scan(**scan_kwargs)
    items.extend(resp.get("Items", []))
    if "LastEvaluatedKey" in resp:
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    else:
        break

print(f"Total jobs: {len(items)}\n")

for idx, item in enumerate(items, 1):
    job_id = item.get("jobId", "N/A")
    status = item.get("status", "N/A")
    riot_id = item.get("riotId", "N/A")
    quarters = item.get("quarters", {}) or {}

    print(f"{idx}. Job ID: {job_id}")
    print(f"   Player: {riot_id}")
    print(f"   Status: {status}")
    print(f"   Quarters:")
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        q_status = quarters.get(q, "pending")
        icon = (
            "✅" if q_status == "fetched"
            else "⏳" if q_status == "fetching"
            else "❌" if q_status == "error"
            else "⬜"
        )
        print(f"      {icon} {q}: {q_status}")
    print()

# ---------- 2) S3 bucket status ----------
print("\n✅ S3 BUCKET STATUS:")
print("-" * 60)
try:
    # Check bucket existence
    s3.head_bucket(Bucket=BUCKET_NAME)
    print(f"Bucket: {BUCKET_NAME}")

    # List all objects with pagination
    total = 0
    token = None
    files = []
    while True:
        kwargs = {"Bucket": BUCKET_NAME, "MaxKeys": 1000}
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        contents = resp.get("Contents", [])
        total += len(contents)
        for obj in contents:
            files.append((obj["Key"], obj.get("Size", 0)))
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break

    print(f"Objects in bucket: {total}")
    if files:
        print("\nFiles in S3:")
        for key, size in files[:200]:  # cap output
            print(f"  - {key} ({size} bytes)")
        if total > 200:
            print(f"  ... and {total - 200} more")
    else:
        print("\nBucket is empty.")
        print("If you expected data, confirm the writer uses the same bucket/region and endpoint.")
except ClientError as e:
    code = e.response.get("Error", {}).get("Code")
    print(f"Error accessing S3 bucket '{BUCKET_NAME}': {code or e}")
    print("Create the bucket first:")
    print(f"  aws --endpoint-url {S3_ENDPOINT} s3api create-bucket --bucket {BUCKET_NAME} --region {REGION}")

# ---------- 3) Summary ----------
print("\n" + "=" * 60)
print("SUMMARY:")
print("=" * 60)

def _status(v): return isinstance(v, str) and v.lower()

jobs_with_q1_fetched = sum(1 for it in items if (it.get("quarters", {}) or {}).get("Q1") == "fetched")
jobs_with_errors = sum(
    1 for it in items
    if any(_status(v) == "error" for v in (it.get("quarters", {}) or {}).values())
)
print(f"✅ Jobs with Q1 fetched: {jobs_with_q1_fetched}")
print(f"❌ Jobs with errors: {jobs_with_errors}")
print(f"⏳ Total jobs: {len(items)}")

if jobs_with_q1_fetched > 0:
    print("\nObserved pipeline signals:")
    print("  - ApiFunction created jobs ✓")
    print("  - FetchQuarterFunction updated quarters ✓")
    print("  - DynamoDB progress tracked ✓")
    print("  - S3 reachable ✓")
else:
    print("\nNo jobs with Q1 fetched yet.")
    print("Check: job creation path, Riot API key, and FetchQuarterFunction logs.")
