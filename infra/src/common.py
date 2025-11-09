import os, time, json, urllib.parse, requests, logging
from datetime import datetime, timezone

LOG = logging.getLogger()
LOG.setLevel(logging.INFO)

TABLE_NAME = os.environ["TABLE_NAME"]
BUCKET = os.environ["BUCKET_NAME"]
RIOT_API_KEY = os.environ["RIOT_API_KEY"]
LOG.info(f"RIOT_API_KEY loaded: {RIOT_API_KEY[:20]}...")
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY", "8"))
MAX_MATCHES_PER_QUARTER = int(os.getenv("MAX_MATCHES_PER_QUARTER", "50"))

# Debug: log the API key being used
LOG.info(f"Using RIOT_API_KEY: {RIOT_API_KEY[:30]}... (length: {len(RIOT_API_KEY)})")

PLATFORM_TO_REGION = {
    "euw1":"europe","eun1":"europe","tr1":"europe","ru":"europe",
    "na1":"americas","br1":"americas","la1":"americas","la2":"americas","oc1":"americas",
    "kr":"asia","jp1":"asia",
}

def to_regional(platform: str) -> str:
    return PLATFORM_TO_REGION[platform.lower()]

def parse_riot_id(riot_id: str):
    game, tag = riot_id.split("#",1)
    return game.strip(), tag.strip()

def riot_get(url, params=None, max_retries=6):
    headers = {"X-Riot-Token": RIOT_API_KEY}
    backoff = 1.0
    for _ in range(max_retries):
        r = requests.get(url, headers=headers, params=params, timeout=20)
        if r.status_code == 429:
            wait = float(r.headers.get("Retry-After", backoff))
            time.sleep(wait); backoff = min(16.0, backoff*2)
            continue
        if 500 <= r.status_code < 600:
            time.sleep(backoff); backoff = min(16.0, backoff*2)
            continue
        return r
    return r

def get_puuid(regional, game, tag):
    url = f"https://{regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(game)}/{urllib.parse.quote(tag)}"
    LOG.debug(f"Fetching PUUID from Riot API: {url}")
    r = riot_get(url)
    if r.ok:
        return r.json().get("puuid")
    else:
        LOG.error(f"Riot API error getting PUUID for {game}#{tag}: {r.status_code} {r.text[:200]}")
        return None

def get_ids_window(regional, puuid, start_ts, end_ts):
    """Fetch match IDs within time window."""
    base = f"https://{regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/{urllib.parse.quote(puuid)}/ids"
    ids, start = [], 0
    while True:
        params = {"start": start, "count": 100, "startTime": start_ts, "endTime": end_ts}
        r = riot_get(base, params=params)
        if not r.ok: break
        batch = r.json()
        if not batch: break
        ids.extend(batch)
        if len(batch) < 100: break
        start += 100
    return ids

def get_all_ids_2025(regional, puuid):
    """Fetch ALL match IDs from 2025 (no time filter, let Riot return them all)."""
    base = f"https://{regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/{urllib.parse.quote(puuid)}/ids"
    
    # 2025 time window (Jan 1 to Dec 31)
    start_ts = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp())
    end_ts = int(datetime(2025, 12, 31, 23, 59, 59, tzinfo=timezone.utc).timestamp())
    
    ids, start_idx = [], 0
    LOG.info(f"Fetching all 2025 matches for PUUID...")
    
    while True:
        params = {"start": start_idx, "count": 100, "startTime": start_ts, "endTime": end_ts}
        r = riot_get(base, params=params)
        if not r.ok: 
            LOG.warning(f"Failed to fetch match IDs at start={start_idx}: {r.status_code}")
            break
        batch = r.json()
        if not batch: break
        ids.extend(batch)
        LOG.info(f"Fetched {len(batch)} match IDs (total: {len(ids)})")
        if len(batch) < 100: break
        start_idx += 100
    
    LOG.info(f"Total matches found in 2025: {len(ids)}")
    return ids

def divide_matches_into_quarters(all_match_ids, max_per_quarter=50):
    """
    Divide matches into 4 equal quarters by position (not time).
    This ensures every quarter has games even if player took breaks.
    
    Args:
        all_match_ids: List of match IDs (newest first)
        max_per_quarter: Maximum matches per quarter (default 50)
    
    Returns: dict with Q1, Q2, Q3, Q4 as keys, lists of match IDs as values.
    """
    total = len(all_match_ids)
    
    if total == 0:
        return {"Q1": [], "Q2": [], "Q3": [], "Q4": []}
    
    # Calculate chunk size, capped at max_per_quarter
    ideal_chunk_size = total // 4
    chunk_size = min(ideal_chunk_size, max_per_quarter)
    remainder = min(total % 4, max_per_quarter * 4 - total) if total < max_per_quarter * 4 else 0
    
    quarters = {}
    start_idx = 0
    
    for i, q in enumerate(["Q1", "Q2", "Q3", "Q4"]):
        # Distribute remainder across first quarters
        size = chunk_size + (1 if i < remainder else 0)
        # Cap at max_per_quarter
        size = min(size, max_per_quarter)
        # Don't go beyond total matches
        end_idx = min(start_idx + size, total)
        
        quarters[q] = all_match_ids[start_idx:end_idx]
        start_idx = end_idx
        
        # Stop if we've used all matches
        if start_idx >= total:
            # Fill remaining quarters with empty lists
            for remaining_q in ["Q1", "Q2", "Q3", "Q4"][i+1:]:
                quarters[remaining_q] = []
            break
    
    LOG.info(f"Divided {total} matches (max {max_per_quarter}/quarter): Q1={len(quarters['Q1'])}, Q2={len(quarters['Q2'])}, Q3={len(quarters['Q3'])}, Q4={len(quarters['Q4'])}")
    
    return quarters

def fetch_match(regional, match_id):
    url = f"https://{regional}.api.riotgames.com/lol/match/v5/matches/{urllib.parse.quote(match_id)}"
    r = riot_get(url); 
    return r.json() if r.ok else None

def regional_for_match(match_id: str) -> str:
    shard = match_id.split("_",1)[0].lower()
    return PLATFORM_TO_REGION.get(shard, "europe")

def q_ranges_for_year(now_utc: datetime):
    y = now_utc.year
    q1 = datetime(y,1,1,tzinfo=timezone.utc)
    q2 = datetime(y,4,1,tzinfo=timezone.utc)
    q3 = datetime(y,7,1,tzinfo=timezone.utc)
    q4 = datetime(y,10,1,tzinfo=timezone.utc)
    return [
        ("Q1", int(q1.timestamp()), int(q2.timestamp())),
        ("Q2", int(q2.timestamp()), int(q3.timestamp())),
        ("Q3", int(q3.timestamp()), int(q4.timestamp())),
        ("Q4", int(q4.timestamp()), int(now_utc.timestamp())),
    ]
