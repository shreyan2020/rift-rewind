#!/usr/bin/env python3
"""
Rift Rewind - Journey Package Generator

This script processes pre-downloaded match files and generates a complete
journey package ready for upload, including:
- Q1/story.json, Q2/story.json, Q3/story.json, Q4/story.json
- finale.json
- All with lore, reflections, stats, and analytics

Usage:
    python generate_journey_package.py ./matches_folder --output journey-package --player-name "Player#TAG"

Requirements:
    - AWS credentials configured (for Bedrock API access)
    - boto3 installed
    - Match files in the pre-processed format (with achiev, power, hed, stim fields)
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
import argparse

# Import from infra/src
sys.path.insert(0, str(Path(__file__).parent / "infra" / "src"))

try:
    from stats_inference import (
        score_values, aggregate_mean, universalism_bonus, chapter_stats
    )
    from bedrock_lore import (
        generate_quarter_lore, generate_quarter_reflection,
        generate_finale_lore, generate_finale_reflection
    )
    from advanced_analytics import (
        calculate_trends, extract_best_moments, analyze_champion_pool,
        generate_insights, analyze_comebacks, generate_year_summary
    )
except ImportError as e:
    print(f"❌ Error: Failed to import required modules from infra/src")
    print(f"   Make sure you're running from the project root directory")
    print(f"   Details: {e}")
    sys.exit(1)


# Region mapping (same as backend)
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


def extract_bundles_from_processed_match(match: dict) -> dict:
    """
    Extract value bundles from pre-processed match data.
    Pre-processed matches already have value fields calculated.
    We just need to extract them in a format compatible with the backend.
    """
    bundle = {}
    
    # Achievement bundle - from achiev field
    if "achiev" in match:
        bundle["achiev"] = match["achiev"]
    else:
        bundle["achiev"] = {}
    
    # Power bundle - from power field  
    if "power" in match:
        bundle["power"] = match["power"]
    else:
        bundle["power"] = {}
    
    # Hedonism bundle - from hed field
    if "hed" in match:
        bundle["hed"] = match["hed"]
    else:
        bundle["hed"] = {}
    
    # Stimulation bundle - from stim field
    if "stim" in match:
        bundle["stim"] = match["stim"]
    else:
        bundle["stim"] = {}
    
    # Self-Direction bundle - from selfD field
    if "selfD" in match:
        bundle["selfD"] = match["selfD"]
    else:
        bundle["selfD"] = {}
    
    # Benevolence bundle - from bene field
    if "bene" in match:
        bundle["bene"] = match["bene"]
    else:
        bundle["bene"] = {}
    
    # Tradition bundle - from trad field
    if "trad" in match:
        bundle["trad"] = match["trad"]
    else:
        bundle["trad"] = {}
    
    # Security bundle - from secs field
    if "secs" in match:
        bundle["secs"] = match["secs"]
    else:
        bundle["secs"] = {}
    
    # Conformity - not present in pre-processed data, use empty
    bundle["conf"] = {}
    
    # Universalism bundle - from univ field
    if "univ" in match:
        bundle["univ"] = match["univ"]
    else:
        bundle["univ"] = {}
    
    return bundle


def calculate_stats_from_preprocessed(matches: List[dict]) -> dict:
    """Calculate chapter stats directly from pre-processed match format"""
    if not matches:
        return {
            "games": 0,
            "kda_proxy": 0.0,
            "cs_per_min": 0.0,
            "gold_per_min": 0.0,
            "vision_score_per_min": 0.0,
            "ping_rate_per_min": 0.0,
            "primary_role": "UNKNOWN",
            "obj_damage_per_min": 0.0,
            "kill_participation": 0.0,
            "control_wards_per_game": 0.0
        }
    
    total_deaths = 0
    cs_per_mins = []
    gold_per_mins = []
    vision_per_mins = []
    kill_participations = []
    
    for match in matches:
        # Deaths from secs field
        deaths = match.get("secs", {}).get("deaths", 0)
        total_deaths += deaths
        
        # CS/min from trad field
        cs_pm = match.get("trad", {}).get("csPerMin", 0.0)
        cs_per_mins.append(cs_pm)
        
        # Gold/min from power field
        gold_pm = match.get("power", {}).get("goldEarnedperMin", 0.0)
        gold_per_mins.append(gold_pm)
        
        # Vision/min from secs field
        vision_pm = match.get("secs", {}).get("visionScorePerMinute", 0.0)
        vision_per_mins.append(vision_pm)
        
        # Kill participation from achiev field
        kp = match.get("achiev", {}).get("killParticipation", 0.0)
        kill_participations.append(kp)
    
    # Calculate KDA proxy (using kill participation as a rough estimate)
    # Assuming average team kills is ~20, we can estimate: takedowns = kp * 20
    avg_kp = sum(kill_participations) / len(kill_participations) if kill_participations else 0
    estimated_takedowns = avg_kp * 20 * len(matches)  # Total takedowns across all games
    kda_proxy = estimated_takedowns / max(1, total_deaths)
    
    return {
        "games": len(matches),
        "kda_proxy": kda_proxy,
        "cs_per_min": sum(cs_per_mins) / len(cs_per_mins) if cs_per_mins else 0.0,
        "gold_per_min": sum(gold_per_mins) / len(gold_per_mins) if gold_per_mins else 0.0,
        "vision_score_per_min": sum(vision_per_mins) / len(vision_per_mins) if vision_per_mins else 0.0,
        "ping_rate_per_min": 0.0,  # Not available in pre-processed data
        "primary_role": "UNKNOWN",  # Could extract from most common lane
        "obj_damage_per_min": 0.0,  # Not easily available
        "kill_participation": (sum(kill_participations) / len(kill_participations) * 100) if kill_participations else 0.0,
        "control_wards_per_game": 0.0  # Not available in pre-processed data
    }


def choose_region_arc(quarter_num: int, curr_values: dict, prev_values=None) -> str:
    """Choose region based on player's value profile"""
    if not curr_values:
        return "Runeterra"
    
    # Helper to get top non-Universalism value
    def get_top_value_excluding_universalism():
        sorted_values = sorted(curr_values.items(), key=lambda kv: kv[1], reverse=True)
        for value_name, _ in sorted_values:
            if value_name != "Universalism":
                return value_name
        # If only Universalism exists, use it
        return sorted_values[0][0] if sorted_values else "Universalism"
    
    # Q1: dominant current value (prefer non-Universalism for more interesting regions)
    if quarter_num == 1:
        top_value = get_top_value_excluding_universalism()
        return REGION_ARC_MAP.get(top_value, "Runeterra")
    
    # For Q2/Q3, need deltas
    if prev_values:
        deltas = {k: curr_values.get(k, 0.0) - prev_values.get(k, 0.0)
                  for k in set(curr_values.keys()).union(prev_values.keys())}
        
        # Q2: biggest absolute change (exclude Universalism for more variety)
        if quarter_num == 2:
            deltas_no_univ = {k: v for k, v in deltas.items() if k != "Universalism"}
            if deltas_no_univ:
                max_change = max(deltas_no_univ.items(), key=lambda kv: abs(kv[1]))[0]
            else:
                max_change = max(deltas.items(), key=lambda kv: abs(kv[1]))[0]
            return REGION_ARC_MAP.get(max_change, "Runeterra")
        
        # Q3: biggest negative change (challenge) - can include Universalism here
        if quarter_num == 3:
            neg = {k: v for k, v in deltas.items() if v < 0}
            if neg:
                max_neg = min(neg.items(), key=lambda kv: kv[1])[0]
                return REGION_ARC_MAP.get(max_neg, "Runeterra")
    
    # Q4: dominant value (resolution) - prefer non-Universalism
    top_value = get_top_value_excluding_universalism()
    return REGION_ARC_MAP.get(top_value, "Runeterra")


def process_quarter_matches(matches: List[dict], quarter_num: int, archetype: str, prev_values=None) -> dict:
    """Process a quarter's matches and generate story.json content"""
    
    print(f"  Processing {len(matches)} matches...")
    
    # Get date range for this quarter
    timestamps = [m.get("timestamp", 0) for m in matches if m.get("timestamp")]
    if timestamps:
        from datetime import datetime
        start_date = datetime.fromtimestamp(min(timestamps) / 1000).strftime("%b %d, %Y")
        end_date = datetime.fromtimestamp(max(timestamps) / 1000).strftime("%b %d, %Y")
        date_range = f"{start_date} - {end_date}"
    else:
        date_range = "Unknown"
    
    # Extract bundles from pre-processed matches
    bundles = []
    for match in matches:
        bundle = extract_bundles_from_processed_match(match)
        if bundle:
            bundles.append(bundle)
    
    if not bundles:
        print(f"  ⚠️  Warning: No valid bundles extracted from matches")
        return None
    
    # Calculate raw scores and average them
    raw = score_values(bundles)
    values = aggregate_mean(raw)
    
    # Add universalism bonus
    values["Universalism"] = values.get("Universalism", 0.0) + universalism_bonus(bundles)
    
    # Scale to 0-100 range
    if values:
        min_val = min(values.values())
        max_val = max(values.values())
        if max_val > min_val:
            values = {k: ((v - min_val) / (max_val - min_val)) * 100 for k, v in values.items()}
    
    # Get top 3 values
    top_values = sorted(values.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # Calculate stats directly from pre-processed matches
    stats = calculate_stats_from_preprocessed(matches)
    
    # Choose region
    region_arc = choose_region_arc(quarter_num, values, prev_values)
    quarter_label = f"Q{quarter_num}"
    
    print(f"  Generating lore for {region_arc}...")
    
    # Generate lore using Bedrock
    try:
        lore = generate_quarter_lore(
            quarter=quarter_label,
            stats=stats,
            top_values=top_values,
            region_arc=region_arc,
            previous_lore=None  # TODO: pass previous lore for continuity
        )
        
        reflection = generate_quarter_reflection(
            quarter=quarter_label,
            stats=stats,
            top_values=top_values
        )
    except Exception as e:
        print(f"  ⚠️  Warning: Failed to generate lore: {e}")
        lore = f"Your journey through {region_arc} was marked by {top_values[0][0]} ({top_values[0][1]:.1f})."
        reflection = f"In {quarter_label}, you demonstrated strong {top_values[0][0]} with {stats['games']} games played."
    
    # Build story.json
    story = {
        "quarter": quarter_label,
        "date_range": date_range,  # Add date range for display
        "values": values,
        "top_values": top_values,
        "stats": stats,
        "lore": lore,
        "reflection": reflection,
        "region_arc": region_arc,
        "bundles": bundles  # Store bundles for finale analytics
    }
    
    return story


def generate_finale(all_quarters: List[dict], all_matches: List[dict], player_name: str) -> dict:
    """Generate finale.json with advanced analytics"""
    
    print("  Generating advanced analytics...")
    
    # Extract bundles from all quarters for analytics
    all_bundles = []
    for quarter in all_quarters:
        if 'bundles' in quarter:
            all_bundles.append(quarter['bundles'])
    
    # Calculate trends
    trends = calculate_trends(all_quarters)
    
    # Extract best moments with bundles
    highlights = extract_best_moments(all_quarters, all_bundles)
    
    # Analyze champion pool (needs bundles, not matches)
    champion_analysis = analyze_champion_pool(all_bundles)
    
    # Analyze comebacks (needs bundles, not matches)
    comebacks = analyze_comebacks(all_bundles)
    
    # Generate insights (only takes 3 parameters)
    insights = generate_insights(all_quarters, trends, champion_analysis)
    
    # Generate year summary (needs all 6 parameters including insights)
    year_summary = generate_year_summary(all_quarters, trends, highlights, champion_analysis, comebacks, insights)
    
    # Generate finale lore
    print("  Generating finale lore...")
    
    total_games = sum(q["stats"]["games"] for q in all_quarters)
    
    try:
        finale_lore = generate_finale_lore(
            all_quarters_data=all_quarters,
            player_name=player_name,
            total_games=total_games
        )
        
        finale_reflections = generate_finale_reflection(
            all_quarters_data=all_quarters
        )
    except Exception as e:
        print(f"  ⚠️  Warning: Failed to generate finale lore: {e}")
        finale_lore = f"Your journey through Runeterra is complete."
        finale_reflections = ["A year of growth and challenges."]
    
    # Build finale.json
    finale = {
        "lore": finale_lore,
        "final_reflection": finale_reflections if isinstance(finale_reflections, list) else [finale_reflections],
        "total_games": sum(q["stats"]["games"] for q in all_quarters),
        "quarters": all_quarters,
        "trends": trends,
        "highlights": highlights,
        "champion_analysis": champion_analysis,
        "comebacks": comebacks,
        "insights": insights,
        "year_summary": year_summary
    }
    
    return finale


def main():
    parser = argparse.ArgumentParser(
        description='Generate complete Rift Rewind journey package',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_journey_package.py ./matches --output journey-package
  python generate_journey_package.py ../rift-rewind/datafiles/datafiles --player-name "bst#0123" --archetype warrior
        """
    )
    
    parser.add_argument('folder', help='Folder containing match JSON files')
    parser.add_argument('--output', '-o', default='journey-package',
                        help='Output folder for journey package (default: journey-package)')
    parser.add_argument('--player-name', '-p', required=True,
                        help='Player name (e.g., "Player#TAG")')
    parser.add_argument('--archetype', '-a', default='explorer',
                        choices=['explorer', 'warrior', 'sage', 'guardian'],
                        help='Narrative archetype (default: explorer)')
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("🎮 Rift Rewind - Journey Package Generator")
    print("=" * 70)
    
    # First, use aggregate_matches logic to split into quarters
    print("\n📂 Loading and splitting matches into quarters...")
    
    # Import and reuse aggregate_matches functions
    from aggregate_matches import load_matches_from_folder, split_into_quarters
    
    matches = load_matches_from_folder(args.folder, target_year=None)
    quarters_data = split_into_quarters(matches)
    
    print(f"✅ Loaded {len(matches)} matches")
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        print(f"   {q}: {len(quarters_data[q])} matches")
    
    # Process each quarter
    print("\n📊 Processing quarters and generating stories...")
    all_stories = []
    prev_values = None
    
    for i, quarter in enumerate(["Q1", "Q2", "Q3", "Q4"], 1):
        print(f"\n{quarter}:")
        story = process_quarter_matches(
            quarters_data[quarter],
            quarter_num=i,
            archetype=args.archetype,
            prev_values=prev_values
        )
        
        if story:
            all_stories.append(story)
            prev_values = story["values"]
    
    if len(all_stories) < 4:
        print(f"\n⚠️  Warning: Only generated {len(all_stories)} quarters")
    
    # Generate finale
    print("\n🎆 Generating finale...")
    finale = generate_finale(all_stories, matches, args.player_name)
    
    # Create output directory structure
    output_path = Path(args.output)
    output_path.mkdir(exist_ok=True)
    
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        (output_path / q).mkdir(exist_ok=True)
    
    # Save story.json files
    print(f"\n💾 Saving journey package to {args.output}/")
    
    for i, story in enumerate(all_stories, 1):
        quarter = f"Q{i}"
        story_path = output_path / quarter / "story.json"
        with open(story_path, 'w', encoding='utf-8') as f:
            json.dump(story, f, indent=2, ensure_ascii=False)
        print(f"   ✓ {quarter}/story.json")
    
    # Save finale.json
    finale_path = output_path / "finale.json"
    with open(finale_path, 'w', encoding='utf-8') as f:
        json.dump(finale, f, indent=2, ensure_ascii=False)
    print(f"   ✓ finale.json")
    
    # Save metadata
    metadata = {
        "playerName": args.player_name,
        "archetype": args.archetype,
        "totalGames": len(matches),
        "generatedAt": datetime.now().isoformat(),
        "quarters": {f"Q{i+1}": len(quarters_data[f"Q{i+1}"]) for i in range(4)}
    }
    
    metadata_path = output_path / "metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"   ✓ metadata.json")
    
    print(f"\n✅ Journey package complete!")
    print(f"\n📦 Package contents:")
    print(f"   {args.output}/")
    print(f"   ├── Q1/story.json")
    print(f"   ├── Q2/story.json")
    print(f"   ├── Q3/story.json")
    print(f"   ├── Q4/story.json")
    print(f"   ├── finale.json")
    print(f"   └── metadata.json")
    
    # Auto-package for frontend upload
    print(f"\n� Creating upload package...")
    upload_file = f"{args.output}-upload.json"
    package_for_upload(args.output, upload_file)
    
    print("=" * 70)


def package_for_upload(journey_folder: str, output_file: str):
    """Package journey into a single JSON file for frontend upload"""
    from pathlib import Path
    
    journey_path = Path(journey_folder)
    
    # Load metadata
    with open(journey_path / "metadata.json", 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    
    # Load quarters
    quarters = {}
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        with open(journey_path / q / "story.json", 'r', encoding='utf-8') as f:
            quarters[q] = json.load(f)
    
    # Load finale
    with open(journey_path / "finale.json", 'r', encoding='utf-8') as f:
        finale = json.load(f)
    
    # Create complete package
    package = {
        "metadata": metadata,
        "quarters": quarters,
        "finale": finale,
        "version": "1.0",
        "type": "complete-journey"
    }
    
    # Write output
    output_path = Path(output_file)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(package, f, indent=2, ensure_ascii=False)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    
    print(f"\n✅ Upload package created!")
    print(f"   📄 File: {output_file}")
    print(f"   📊 Size: {file_size_mb:.2f} MB")
    
    print(f"\n📤 Next steps:")
    print(f"   1. Start frontend: cd frontend && npm run dev")
    print(f"   2. Open http://localhost:5173")
    print(f"   3. Click 'Upload Journey Package' tab")
    print(f"   4. Upload: {output_file}")
    print(f"   5. Click 'Begin Journey' to view your stats!")


if __name__ == '__main__':
    main()
