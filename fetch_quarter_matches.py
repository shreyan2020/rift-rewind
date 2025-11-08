#!/usr/bin/env python3
import os, sys, json, time
from datetime import datetime, timezone, date
import argparse
import urllib.parse
import requests

PLATFORM_TO_REGION = {
    "euw1": "europe", "eun1": "europe", "tr1": "europe", "ru": "europe",
    "na1": "americas", "br1": "americas", "la1": "americas", "la2": "americas", "oc1": "americas",
    "kr": "asia", "jp1": "asia",
}

def to_regional(platform: str) -> str:
    return PLATFORM_TO_REGION[platform.lower()]

def parse_riot_id(riot_id: str):
    game, tag = riot_id.split("#", 1)
    return game.strip(), tag.strip()

def riot_get(url, api_key, params=None):
    headers = {"X-Riot-Token": api_key}
    r = requests.get(url, headers=headers, params=params, timeout=15)
    if r.status_code == 429:
        time.sleep(float(r.headers.get("Retry-After", 1)))
        return riot_get(url, api_key, params)
    return r

def get_puuid(regional, game, tag, api_key):
    url = f"https://{regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(game)}/{urllib.parse.quote(tag)}"
    r = riot_get(url, api_key)
    return r.json().get("puuid") if r.ok else None

def get_ids_in_window(regional, puuid, api_key, start_ts, end_ts):
    base = f"https://{regional}.api.riotgames.com"
    path = f"/lol/match/v5/matches/by-puuid/{puuid}/ids"
    match_ids = []
    start = 0
    while True:
        params = {
            "start": start,
            "count": 100,
            "startTime": start_ts,
            "endTime": end_ts
        }
        r = riot_get(base + path, api_key, params)
        if not r.ok:
            break
        batch = r.json()
        if not batch:
            break
        match_ids.extend(batch)
        if len(batch) < 100:
            break
        start += 100
    return match_ids

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", required=True)
    ap.add_argument("--riot-id", required=True)
    ap.add_argument("--output", default="quarters.json")
    args = ap.parse_args()

    api_key = "RGAPI-29cef781-472a-4d3f-9769-d84e610a0170"
    if not api_key:
        print("Error: export RIOT_API_KEY=...", file=sys.stderr)
        sys.exit(1)

    regional = to_regional(args.platform)
    game, tag = parse_riot_id(args.riot_id)
    puuid = get_puuid(regional, game, tag, api_key)
    if not puuid:
        print("Could not resolve Riot ID.", file=sys.stderr)
        sys.exit(2)

    year = date.today().year
    Q1_start = datetime(year, 1, 1, tzinfo=timezone.utc)
    Q2_start = datetime(year, 4, 1, tzinfo=timezone.utc)
    Q3_start = datetime(year, 7, 1, tzinfo=timezone.utc)
    Q4_start = datetime(year, 10, 1, tzinfo=timezone.utc)
    today = datetime.now(timezone.utc)

    quarters = [
        ("Q1", Q1_start.timestamp(), Q2_start.timestamp()),
        ("Q2", Q2_start.timestamp(), Q3_start.timestamp()),
        ("Q3", Q3_start.timestamp(), Q4_start.timestamp()),
        ("Q4", Q4_start.timestamp(), today.timestamp()),
    ]

    out = {
        "riot_id": args.riot_id,
        "puuid": puuid,
        "year": year,
        "quarters": []
    }

    for label, st, et in quarters:
        ids = get_ids_in_window(regional, puuid, api_key, int(st), int(et))
        out["quarters"].append({
            "quarter": label,
            "start_unix": int(st),
            "end_unix": int(et),
            "count": len(ids),
            "match_ids": ids
        })

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    print(f"Done → {args.output}")

if __name__ == "__main__":
    main()
