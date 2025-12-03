#!/usr/bin/env python3
"""
Rift Rewind - Match Data Fetcher

Fetches match data from Riot API and converts it to pre-processed format
compatible with create_journey.py.

USAGE:
    python fetch_matches.py --riot-id "YourName#TAG" --platform euw1 --api-key YOUR_KEY

EXAMPLE:
    python fetch_matches.py --riot-id "bst#0123" --platform euw1 --api-key RGAPI-xxx
    python fetch_matches.py --riot-id "Player#TAG" --platform na1 --api-key RGAPI-xxx --max-matches 200

OUTPUT:
    - Creates dataset-<riot_id>/ folder with match JSON files
    - Each file contains one match in pre-processed format
    - Ready to use with: python create_journey.py dataset-<riot_id>/ --player-name "YourName#TAG"

REQUIREMENTS:
    - Valid Riot API key (get from https://developer.riotgames.com/)
    - Python 3.8+ with requests library
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import requests

# Import from infra/src for bundle extraction
sys.path.insert(0, str(Path(__file__).parent / "infra" / "src"))

try:
    from stats_inference import bundles_from_participant
except ImportError as e:
    print(f"❌ Error importing backend modules: {e}")
    print("\n💡 To fix this, install backend dependencies:")
    print("   pip install -r infra/src/requirements.txt")
    print("\nOr install just the essentials:")
    print("   pip install boto3 requests")
    sys.exit(1)

# Platform to regional routing mapping
PLATFORM_TO_REGION = {
    "br1": "americas",
    "eun1": "europe",
    "euw1": "europe",
    "jp1": "asia",
    "kr": "asia",
    "la1": "americas",
    "la2": "americas",
    "na1": "americas",
    "oc1": "sea",
    "ph2": "sea",
    "ru": "europe",
    "sg2": "sea",
    "th2": "sea",
    "tr1": "europe",
    "tw2": "sea",
    "vn2": "sea",
}

class RiotAPIClient:
    """Client for fetching data from Riot API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({"X-Riot-Token": api_key})
        self.rate_limit_delay = 1.2  # Seconds between requests
        
    def _request(self, url: str, retries: int = 3) -> Optional[Dict]:
        """Make HTTP request with retry logic"""
        for attempt in range(retries):
            try:
                response = self.session.get(url, timeout=10)
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:
                    # Rate limited
                    retry_after = int(response.headers.get("Retry-After", 10))
                    print(f"   ⚠️  Rate limited, waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue
                elif response.status_code == 404:
                    return None
                else:
                    print(f"   ⚠️  HTTP {response.status_code}: {response.text}")
                    return None
                    
            except Exception as e:
                print(f"   ⚠️  Request error: {e}")
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return None
        
        return None
    
    def get_puuid(self, region: str, game_name: str, tag_line: str) -> Optional[str]:
        """Get PUUID from Riot ID"""
        url = f"https://{region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        data = self._request(url)
        return data.get("puuid") if data else None
    
    def get_match_ids(self, region: str, puuid: str, start: int = 0, count: int = 100, 
                      queue: int = 420, start_time: Optional[int] = None) -> List[str]:
        """Get list of match IDs for a player"""
        url = f"https://{region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params = {
            "start": start,
            "count": count,
            "queue": queue,  # 420 = Ranked Solo/Duo
        }
        if start_time:
            params["startTime"] = start_time
        
        response = self.session.get(url, params=params, timeout=10)
        if response.status_code == 200:
            time.sleep(self.rate_limit_delay)
            return response.json()
        elif response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 10))
            print(f"   ⚠️  Rate limited, waiting {retry_after}s...")
            time.sleep(retry_after)
            return self.get_match_ids(region, puuid, start, count, queue, start_time)
        else:
            return []
    
    def get_match_details(self, region: str, match_id: str) -> Optional[Dict]:
        """Get detailed match data"""
        url = f"https://{region}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        data = self._request(url)
        time.sleep(self.rate_limit_delay)
        return data


def convert_match_to_preprocessed(match_data: Dict, puuid: str) -> Optional[Dict]:
    """
    Convert Riot API match format to pre-processed format.
    
    Pre-processed format has: achiev, power, selfD, secs, trad, bene, hed, stim, univ, timestamp
    """
    try:
        info = match_data.get("info", {})
        participants = info.get("participants", [])
        
        # Find player's participant data
        player_data = None
        for p in participants:
            if p.get("puuid") == puuid:
                player_data = p
                break
        
        if not player_data:
            return None
        
        # Extract bundles using the backend function
        bundles = bundles_from_participant(player_data)
        
        # Create pre-processed match structure
        # The bundles already have the correct field names (achiev, power, selfD, etc.)
        preprocessed = {
            "matchID": match_data.get("metadata", {}).get("matchId", ""),
            "timestamp": info.get("gameCreation", 0),
            "gameDuration": info.get("gameDuration", 0),
            "gameMode": info.get("gameMode", ""),
            "win": player_data.get("win", False),
            
            # Bundle data - these ARE the bundles
            "achiev": bundles.get("achiev", {}),
            "power": bundles.get("power", {}),
            "selfD": bundles.get("selfD", {}),
            "secs": bundles.get("secs", {}),
            "trad": bundles.get("trad", {}),
            "bene": bundles.get("bene", {}),
            "hed": bundles.get("hed", {}),
            "stim": bundles.get("stim", {}),
            "univ": bundles.get("univ", {}),
            "conf": bundles.get("conf", {})
        }
        
        return preprocessed
        
    except Exception as e:
        print(f"   ⚠️  Error converting match: {e}")
        return None


def fetch_matches(riot_id: str, platform: str, api_key: str, max_matches: int = 1000, 
                  year: int = 2025, output_folder: Optional[str] = None) -> int:
    """
    Fetch matches from Riot API and save to disk.
    
    Returns: Number of matches successfully fetched
    """
    # Parse riot ID
    if "#" not in riot_id:
        print("❌ Invalid Riot ID format. Use 'GameName#TAG'")
        return 0
    
    game_name, tag_line = riot_id.split("#", 1)
    platform = platform.lower()
    
    # Get regional routing
    regional = PLATFORM_TO_REGION.get(platform)
    if not regional:
        print(f"❌ Unknown platform: {platform}")
        print(f"Valid platforms: {', '.join(PLATFORM_TO_REGION.keys())}")
        return 0
    
    # Create output folder
    if output_folder is None:
        safe_name = riot_id.replace("#", "-").replace(" ", "_")
        output_folder = f"dataset-{safe_name}"
    
    output_path = Path(output_folder)
    output_path.mkdir(exist_ok=True)
    
    print("\n" + "="*60)
    print("🎮 RIFT REWIND - MATCH DATA FETCHER")
    print("="*60)
    print(f"👤 Player: {riot_id}")
    print(f"🌍 Platform: {platform} (Region: {regional})")
    print(f"📅 Year: {year}")
    print(f"📦 Max matches: {max_matches}")
    print(f"💾 Output: {output_folder}/")
    print("="*60 + "\n")
    
    # Initialize API client
    client = RiotAPIClient(api_key)
    
    # Get PUUID
    print("🔍 Looking up player...")
    puuid = client.get_puuid(regional, game_name, tag_line)
    
    if not puuid:
        print(f"❌ Player not found: {riot_id}")
        return 0
    
    print(f"   ✓ Found PUUID: {puuid[:8]}...")
    
    # Calculate year start timestamp (for filtering)
    year_start = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp())
    
    # Fetch match IDs in batches
    print(f"\n📋 Fetching match IDs (year {year})...")
    all_match_ids = []
    start_idx = 0
    batch_size = 100
    
    while len(all_match_ids) < max_matches:
        match_ids = client.get_match_ids(
            regional, 
            puuid, 
            start=start_idx, 
            count=batch_size,
            queue=420,  # Ranked Solo/Duo
            start_time=year_start
        )
        
        if not match_ids:
            break
        
        all_match_ids.extend(match_ids)
        print(f"   Fetched {len(all_match_ids)} match IDs...")
        
        if len(match_ids) < batch_size:
            # No more matches available
            break
        
        start_idx += batch_size
        
        if len(all_match_ids) >= max_matches:
            all_match_ids = all_match_ids[:max_matches]
            break
    
    if not all_match_ids:
        print("❌ No matches found for this year")
        return 0
    
    print(f"   ✓ Found {len(all_match_ids)} matches")
    
    # Fetch match details
    print(f"\n📥 Downloading match details...")
    successful = 0
    failed = 0
    
    for i, match_id in enumerate(all_match_ids, 1):
        print(f"   [{i}/{len(all_match_ids)}] {match_id}...", end=" ")
        
        # Check if already downloaded
        match_file = output_path / f"{match_id}.json"
        if match_file.exists():
            print("⏭️  (cached)")
            successful += 1
            continue
        
        # Fetch match data
        match_data = client.get_match_details(regional, match_id)
        
        if not match_data:
            print("❌ (failed)")
            failed += 1
            continue
        
        # Convert to pre-processed format
        preprocessed = convert_match_to_preprocessed(match_data, puuid)
        
        if not preprocessed:
            print("❌ (conversion failed)")
            failed += 1
            continue
        
        # Save to file
        with open(match_file, 'w', encoding='utf-8') as f:
            json.dump(preprocessed, f, indent=2, ensure_ascii=False)
        
        print("✅")
        successful += 1
    
    print(f"\n{'='*60}")
    print(f"✅ Download complete!")
    print(f"   Success: {successful} matches")
    print(f"   Failed: {failed} matches")
    print(f"   Saved to: {output_folder}/")
    print(f"{'='*60}")
    
    if successful > 0:
        print(f"\n📦 Next steps:")
        print(f"1. Generate journey:")
        print(f"   python create_journey.py {output_folder} --player-name \"{riot_id}\"")
        print(f"\n2. Or use custom output name:")
        print(f"   python create_journey.py {output_folder} --player-name \"{riot_id}\" --output my-journey")
    
    return successful


def main():
    parser = argparse.ArgumentParser(
        description="Fetch match data from Riot API for Rift Rewind",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Fetch matches for EUW player
  python fetch_matches.py --riot-id "bst#0123" --platform euw1 --api-key RGAPI-xxx
  
  # Fetch matches for NA player with limit
  python fetch_matches.py --riot-id "Player#TAG" --platform na1 --api-key RGAPI-xxx --max-matches 200
  
  # Fetch matches for 2024 instead of 2025
  python fetch_matches.py --riot-id "bst#0123" --platform euw1 --api-key RGAPI-xxx --year 2024
  
  # Custom output folder
  python fetch_matches.py --riot-id "bst#0123" --platform euw1 --api-key RGAPI-xxx --output my-dataset

Valid platforms: euw1, eun1, na1, kr, br1, jp1, la1, la2, oc1, ru, tr1, ph2, sg2, th2, tw2, vn2

Get API key: https://developer.riotgames.com/
        """
    )
    
    parser.add_argument(
        '--riot-id',
        required=True,
        help='Riot ID in format "GameName#TAG" (e.g., "bst#0123")'
    )
    parser.add_argument(
        '--platform',
        required=True,
        choices=list(PLATFORM_TO_REGION.keys()),
        help='Platform/server (e.g., euw1, na1, kr)'
    )
    parser.add_argument(
        '--api-key',
        required=True,
        help='Riot API key (get from https://developer.riotgames.com/)'
    )
    parser.add_argument(
        '--max-matches',
        type=int,
        default=1000,
        help='Maximum number of matches to fetch (default: 1000)'
    )
    parser.add_argument(
        '--year',
        type=int,
        default=2025,
        help='Year to fetch matches from (default: 2025)'
    )
    parser.add_argument(
        '--output',
        help='Output folder name (default: dataset-<riot_id>)'
    )
    
    args = parser.parse_args()
    
    # Validate API key format
    if not args.api_key.startswith("RGAPI-"):
        print("⚠️  Warning: API key should start with 'RGAPI-'")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return 1
    
    # Fetch matches
    count = fetch_matches(
        riot_id=args.riot_id,
        platform=args.platform,
        api_key=args.api_key,
        max_matches=args.max_matches,
        year=args.year,
        output_folder=args.output
    )
    
    return 0 if count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
