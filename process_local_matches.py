#!/usr/bin/env python3
"""
Rift Rewind - Offline Match Processor

This script processes pre-downloaded match history JSON files from a local folder
and generates the same quarterly format (Q1-Q4 + finale.json) that the AWS backend produces.

Usage:
    python process_local_matches.py <matches_folder> <output_folder> [--player-name NAME]

Example:
    python process_local_matches.py ./dataset ./output --player-name "bst#0123"
"""

import json
import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from collections import defaultdict

# Import the processing functions from infra
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'infra', 'src'))

try:
    from stats_inference import (
        bundles_from_participant, score_values, aggregate_mean, 
        universalism_bonus, chapter_stats
    )
    from bedrock_lore import (
        generate_quarter_lore, generate_quarter_reflection,
        generate_finale_lore, generate_finale_reflection
    )
    from advanced_analytics import (
        calculate_trends, extract_best_moments, analyze_champion_pool,
        analyze_comebacks, generate_insights, generate_year_summary
    )
    from process_quarter import choose_region_arc
    print("✅ Backend modules loaded successfully")
except ImportError as e:
    print(f"❌ Error: Could not import processing modules.")
    print(f"   Make sure you're running from the project root.")
    print(f"   Details: {e}")
    sys.exit(1)


def load_match_files(folder_path: str) -> List[Dict[str, Any]]:
    """Load all JSON match files from the specified folder."""
    matches = []
    folder = Path(folder_path)
    
    if not folder.exists():
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    
    json_files = list(folder.glob("*.json"))
    print(f"Found {len(json_files)} JSON files in {folder_path}")
    
    for json_file in sorted(json_files):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                match_data = json.load(f)
                matches.append(match_data)
        except Exception as e:
            print(f"Warning: Failed to load {json_file.name}: {e}")
    
    print(f"Successfully loaded {len(matches)} matches")
    return matches


def identify_player_puuid(matches: List[Dict], player_name: str = None) -> str:
    """Identify the player's PUUID from matches."""
    if not matches:
        raise ValueError("No matches provided")
    
    # If player name provided, try to find their PUUID
    if player_name:
        for match in matches:
            participants = match.get('metadata', {}).get('participants', [])
            for participant in participants:
                # Try to match by riot ID (name#tag)
                if player_name.lower() in participant.lower():
                    return participant
        print(f"Warning: Could not find PUUID for {player_name}, using first participant")
    
    # Default: use first participant (assumes all matches are for same player)
    first_match = matches[0]
    participants = first_match.get('metadata', {}).get('participants', [])
    
    if not participants:
        raise ValueError("No participants found in match data")
    
    return participants[0]


def sort_matches_by_date(matches: List[Dict]) -> List[Dict]:
    """Sort matches by game creation timestamp."""
    def get_timestamp(match):
        return match.get('info', {}).get('gameCreation', 0)
    
    return sorted(matches, key=get_timestamp)


def divide_into_quarters(matches: List[Dict]) -> Dict[str, List[Dict]]:
    """Divide matches into 4 equal quarters."""
    total_matches = len(matches)
    quarter_size = total_matches // 4
    remainder = total_matches % 4
    
    quarters = {}
    start_idx = 0
    
    for i in range(1, 5):
        # Distribute remainder matches to first quarters
        extra = 1 if i <= remainder else 0
        end_idx = start_idx + quarter_size + extra
        
        quarter_matches = matches[start_idx:end_idx]
        quarters[f"Q{i}"] = quarter_matches
        
        print(f"Q{i}: {len(quarter_matches)} matches (games {start_idx + 1}-{end_idx})")
        start_idx = end_idx
    
    return quarters


def process_quarter(quarter_name: str, matches: List[Dict], player_puuid: str, output_folder: Path) -> Dict[str, Any]:
    """Process a single quarter and save to folder."""
    quarter_folder = output_folder / quarter_name
    quarter_folder.mkdir(parents=True, exist_ok=True)
    
    print(f"\nProcessing {quarter_name}...")
    
    # Save individual match files
    match_files = []
    for idx, match in enumerate(matches, 1):
        match_id = match.get('metadata', {}).get('matchId', f'match_{idx}')
        filename = f"{match_id}.json"
        match_path = quarter_folder / filename
        
        with open(match_path, 'w', encoding='utf-8') as f:
            json.dump(match, f, indent=2)
        
        match_files.append(filename)
    
    # Generate quarterly summary using the same logic as AWS backend
    try:
        summary = generate_quarterly_summary(matches, player_puuid, quarter_name)
        
        # Save story.json
        story_path = quarter_folder / "story.json"
        with open(story_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)
        
        print(f"  ✓ Generated story.json with {len(matches)} matches")
        
        # Save index.json (list of match files)
        index = {
            "quarter": quarter_name,
            "matches": match_files,
            "total": len(match_files)
        }
        
        index_path = quarter_folder / "index.json"
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2)
        
        return summary
        
    except Exception as e:
        print(f"  ✗ Error generating summary for {quarter_name}: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(
        description='Process local match history files into Rift Rewind format',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process matches from dataset folder
  python process_local_matches.py ./dataset ./output
  
  # Specify player name for PUUID identification
  python process_local_matches.py ./dataset ./output --player-name "bst#0123"
  
  # Process and specify region
  python process_local_matches.py ./dataset ./output --region EUW1
        """
    )
    
    parser.add_argument('matches_folder', help='Folder containing match JSON files')
    parser.add_argument('output_folder', help='Output folder for processed data')
    parser.add_argument('--player-name', help='Player Riot ID (name#tag) to identify PUUID')
    parser.add_argument('--region', default='EUW1', help='Region code (default: EUW1)')
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("Rift Rewind - Offline Match Processor")
    print("=" * 70)
    print()
    
    try:
        # Load all match files
        matches = load_match_files(args.matches_folder)
        
        if len(matches) < 4:
            print("Error: Need at least 4 matches to create quarters")
            return 1
        
        # Identify player
        player_puuid = identify_player_puuid(matches, args.player_name)
        print(f"Player PUUID: {player_puuid}")
        print()
        
        # Sort by date
        matches = sort_matches_by_date(matches)
        print(f"Matches span from {datetime.fromtimestamp(matches[0]['info']['gameCreation']/1000).strftime('%Y-%m-%d')} "
              f"to {datetime.fromtimestamp(matches[-1]['info']['gameCreation']/1000).strftime('%Y-%m-%d')}")
        print()
        
        # Divide into quarters
        quarters = divide_into_quarters(matches)
        
        # Create output folder
        output_folder = Path(args.output_folder)
        output_folder.mkdir(parents=True, exist_ok=True)
        
        # Process each quarter
        quarterly_summaries = []
        for quarter_name in ['Q1', 'Q2', 'Q3', 'Q4']:
            quarter_matches = quarters[quarter_name]
            summary = process_quarter(quarter_name, quarter_matches, player_puuid, output_folder)
            quarterly_summaries.append(summary)
        
        print("\n" + "=" * 70)
        print("Generating Finale...")
        print("=" * 70)
        
        # Generate finale.json with advanced analytics
        try:
            # Collect all matches for finale
            all_matches = []
            for quarter_name in ['Q1', 'Q2', 'Q3', 'Q4']:
                all_matches.extend(quarters[quarter_name])
            
            # Generate finale using backend logic
            finale = generate_finale(quarterly_summaries, all_matches, player_puuid)
            
            # Generate advanced insights
            insights = infer_insights(finale)
            finale['insights'] = insights
            
            # Save finale.json
            finale_path = output_folder / "finale.json"
            with open(finale_path, 'w', encoding='utf-8') as f:
                json.dump(finale, f, indent=2)
            
            print(f"✓ Generated finale.json")
            print(f"  - {finale.get('yearSummary', {}).get('totalGames', 0)} total games")
            print(f"  - {len(finale.get('championPool', {}).get('mostPlayed', []))} champions played")
            print(f"  - {len(insights)} insights generated")
            
        except Exception as e:
            print(f"✗ Error generating finale: {e}")
            import traceback
            traceback.print_exc()
            return 1
        
        print("\n" + "=" * 70)
        print("✓ Processing Complete!")
        print("=" * 70)
        print(f"\nOutput saved to: {output_folder.absolute()}")
        print("\nFolder structure:")
        print(f"  {output_folder}/")
        print(f"    ├── Q1/")
        print(f"    │   ├── story.json")
        print(f"    │   ├── index.json")
        print(f"    │   └── *.json (match files)")
        print(f"    ├── Q2/ ...")
        print(f"    ├── Q3/ ...")
        print(f"    ├── Q4/ ...")
        print(f"    └── finale.json")
        print("\nYou can now upload finale.json through the frontend!")
        
        return 0
        
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
