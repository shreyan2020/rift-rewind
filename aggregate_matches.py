#!/usr/bin/env python3
"""
Rift Rewind - Match Data Aggregator

This script aggregates individual match JSON files into a single upload-ready file.
Automatically splits matches into Q1, Q2, Q3, Q4 based on game timestamps.

Usage:
    python aggregate_matches.py <folder_path> [--output matches-upload.json] [--year 2025]

Example:
    python aggregate_matches.py ./datafiles
    python aggregate_matches.py ./my_matches --output my-data.json --year 2024
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
import argparse


def get_match_timestamp(match: Dict[str, Any]) -> int:
    """Extract timestamp from match data"""
    # Try direct timestamp field first (for pre-processed matches)
    if 'timestamp' in match:
        return match['timestamp']
    # Try Riot API format
    if 'info' in match and 'gameCreation' in match['info']:
        return match['info']['gameCreation']
    elif 'metadata' in match and 'gameCreation' in match['metadata']:
        return match['metadata']['gameCreation']
    return 0


def get_match_year(match: Dict[str, Any]) -> int:
    """Get year from match timestamp"""
    timestamp_ms = get_match_timestamp(match)
    if timestamp_ms:
        return datetime.fromtimestamp(timestamp_ms / 1000).year
    return 0


def split_into_quarters(matches: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Split matches into 4 equal quarters chronologically.
    Sorts all matches by timestamp and divides into 4 equal groups.
    Q1: First quarter of matches, Q2: Second quarter, Q3: Third quarter, Q4: Fourth quarter
    """
    # Sort matches by timestamp
    sorted_matches = sorted(matches, key=get_match_timestamp)
    
    # Calculate quarter size
    total = len(sorted_matches)
    quarter_size = total // 4
    remainder = total % 4
    
    quarters = {'Q1': [], 'Q2': [], 'Q3': [], 'Q4': []}
    
    # Distribute matches evenly across quarters
    # If there's a remainder, distribute extra matches to first quarters
    start_idx = 0
    for i, quarter_key in enumerate(['Q1', 'Q2', 'Q3', 'Q4']):
        # Add extra match to first 'remainder' quarters
        size = quarter_size + (1 if i < remainder else 0)
        end_idx = start_idx + size
        quarters[quarter_key] = sorted_matches[start_idx:end_idx]
        start_idx = end_idx
    
    return quarters


def load_matches_from_folder(folder_path: str, target_year: int = None) -> List[Dict[str, Any]]:
    """Load all JSON match files from folder"""
    matches = []
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"❌ Error: Folder '{folder_path}' does not exist")
        sys.exit(1)
    
    json_files = list(folder.glob('*.json'))
    
    if not json_files:
        print(f"❌ Error: No JSON files found in '{folder_path}'")
        sys.exit(1)
    
    print(f"📂 Found {len(json_files)} JSON files in '{folder_path}'")
    if target_year:
        print(f"🔍 Filtering matches from year {target_year}...")
    else:
        print(f"🔍 Loading all matches (no year filter)...")
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                match = json.load(f)
                
                # Filter by year if specified
                if target_year:
                    match_year = get_match_year(match)
                    if match_year == target_year:
                        matches.append(match)
                else:
                    matches.append(match)
        except json.JSONDecodeError:
            print(f"⚠️  Skipping invalid JSON: {json_file.name}")
        except Exception as e:
            print(f"⚠️  Error reading {json_file.name}: {e}")
    
    if not matches:
        if target_year:
            print(f"❌ Error: No matches found from {target_year}")
            print(f"💡 Tip: Check if your matches are from {target_year} or omit --year flag")
        else:
            print(f"❌ Error: No valid match files found")
        sys.exit(1)
    
    # Sort by timestamp
    matches.sort(key=get_match_timestamp)
    
    return matches


def main():
    parser = argparse.ArgumentParser(
        description='Aggregate match files for Rift Rewind upload',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python aggregate_matches.py ./datafiles
  python aggregate_matches.py ./my_matches --output my-data.json
  python aggregate_matches.py ./datafiles --year 2024 --max-per-quarter 50
        """
    )
    
    parser.add_argument('folder', help='Folder containing match JSON files')
    parser.add_argument('--output', '-o', default='matches-upload.json',
                        help='Output file name (default: matches-upload.json)')
    parser.add_argument('--year', '-y', type=int, default=None,
                        help='Filter matches by year (default: None - use all matches)')
    parser.add_argument('--max-per-quarter', '-m', type=int, default=1000,
                        help='Maximum matches per quarter (default: 50)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🎮 Rift Rewind - Match Data Aggregator")
    print("=" * 60)
    
    # Load matches
    matches = load_matches_from_folder(args.folder, args.year)
    if args.year:
        print(f"✅ Loaded {len(matches)} matches from {args.year}")
    else:
        print(f"✅ Loaded {len(matches)} matches")
    
    # Split into quarters
    quarters = split_into_quarters(matches)
    
    print("\n📊 Quarter Distribution (Chronological):")
    
    # Show date range for each quarter
    for i, quarter in enumerate(['Q1', 'Q2', 'Q3', 'Q4'], 1):
        q_matches = quarters[quarter]
        if q_matches:
            first_ts = get_match_timestamp(q_matches[0])
            last_ts = get_match_timestamp(q_matches[-1])
            first_date = datetime.fromtimestamp(first_ts / 1000).strftime('%Y-%m-%d')
            last_date = datetime.fromtimestamp(last_ts / 1000).strftime('%Y-%m-%d')
            print(f"  {quarter}: {len(q_matches)} matches ({first_date} to {last_date})")
        else:
            print(f"  {quarter}: 0 matches")
    
    # Limit to max per quarter
    for quarter in ['Q1', 'Q2', 'Q3', 'Q4']:
        if len(quarters[quarter]) > args.max_per_quarter:
            print(f"⚠️  {quarter} has {len(quarters[quarter])} matches, limiting to {args.max_per_quarter}")
            quarters[quarter] = quarters[quarter][:args.max_per_quarter]
    
    # Check if all quarters have matches
    empty_quarters = [q for q in ['Q1', 'Q2', 'Q3', 'Q4'] if not quarters[q]]
    if empty_quarters:
        print(f"\n⚠️  Warning: The following quarters have no matches: {', '.join(empty_quarters)}")
        print("💡 Tip: The system requires data from all 4 quarters")
        print("   You can still proceed, but those quarters will be empty")
        response = input("\nContinue anyway? (y/n): ")
        if response.lower() != 'y':
            print("❌ Aborted")
            sys.exit(0)
    
    # Save to file
    output_data = {
        'Q1': quarters['Q1'],
        'Q2': quarters['Q2'],
        'Q3': quarters['Q3'],
        'Q4': quarters['Q4']
    }
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # File size
    file_size = os.path.getsize(args.output) / (1024 * 1024)  # MB
    
    print(f"\n✅ Success! Created '{args.output}'")
    print(f"📦 File size: {file_size:.2f} MB")
    print(f"\n📤 Next steps:")
    print(f"  1. Open Rift Rewind in your browser")
    print(f"  2. Click 'Upload Data' tab")
    print(f"  3. Fill in your summoner name, region, and archetype")
    print(f"  4. Upload '{args.output}'")
    print(f"  5. Click 'Upload & Begin'")
    print(f"\n🎉 Your journey awaits!")
    print("=" * 60)


if __name__ == '__main__':
    main()
