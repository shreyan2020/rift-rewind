#!/usr/bin/env python3
"""
Rift Rewind - Journey Creator (SIMPLIFIED WORKFLOW)

This is the ONE script you need to convert local match data into a frontend-ready journey package.

USAGE:
    python create_journey.py <dataset_folder> --player-name "YourName#TAG"

EXAMPLE:
    python create_journey.py ./dataset --player-name "bst#0123"

OUTPUT:
    - Creates journey-output/ folder with Q1-Q4 stories and finale
    - Creates journey-output-upload.json (SINGLE FILE TO UPLOAD TO FRONTEND)

WHAT IT DOES:
    1. Reads all match JSON files from dataset folder
    2. Sorts chronologically and divides into 4 quarters
    3. Calculates Schwartz values for each quarter
    4. Generates lore via AWS Bedrock (stores in output folder)
    5. Creates analytics, trends, insights
    6. Packages everything into ONE JSON file for frontend

REQUIREMENTS:
    - AWS credentials configured (for Bedrock lore generation)
    - Match files in pre-processed format (achiev, power, selfD, secs fields)
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
        generate_insights, generate_year_summary
    )
except ImportError as e:
    print(f"❌ Error importing backend modules: {e}")
    print("Make sure you're running from the rift-rewind-v2 directory")
    sys.exit(1)


def load_matches_from_folder(folder_path: str) -> List[dict]:
    """Load all match JSON files from a folder"""
    matches = []
    folder = Path(folder_path)
    
    if not folder.exists():
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    
    json_files = list(folder.glob("*.json"))
    print(f"📂 Found {len(json_files)} match files in {folder_path}")
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                match_data = json.load(f)
                matches.append(match_data)
        except Exception as e:
            print(f"⚠️  Warning: Could not load {json_file.name}: {e}")
            continue
    
    print(f"✅ Successfully loaded {len(matches)} matches")
    return matches


def extract_bundles_from_processed_match(match: dict) -> dict:
    """
    Convert pre-processed match format to backend-compatible bundle format.
    
    Pre-processed matches have fields like: achiev, power, selfD, secs, trad, bene, hed, stim, univ
    Backend expects: bundles with these same fields
    """
    bundle = {
        "achiev": match.get("achiev", {}),
        "power": match.get("power", {}),
        "selfD": match.get("selfD", {}),  # Note: "selfD" not "sd"
        "secs": match.get("secs", {}),    # Note: "secs" not "sec"
        "trad": match.get("trad", {}),
        "bene": match.get("bene", {}),
        "hed": match.get("hed", {}),
        "stim": match.get("stim", {}),
        "univ": match.get("univ", {}),
        "conf": {}  # Conformity not in pre-processed data
    }
    return bundle


def calculate_stats_from_preprocessed(matches: List[dict]) -> dict:
    """
    Calculate chapter stats directly from pre-processed match format.
    
    Pre-processed data doesn't have all fields that chapter_stats() expects,
    so we calculate stats directly from available fields.
    """
    if not matches:
        return {
            "games": 0,
            "kda_proxy": 0.0,
            "cs_per_min": 0.0,
            "gold_per_min": 0.0,
            "vision_per_min": 0.0,
            "avg_kill_participation": 0.0,
            "ping_rate_per_min": 0.0
        }
    
    total_deaths = 0
    total_cs_pm = 0.0
    total_gold_pm = 0.0
    total_vision_pm = 0.0
    kill_participations = []
    
    for match in matches:
        # Extract from pre-processed fields
        deaths = match.get("secs", {}).get("deaths", 0)
        cs_pm = match.get("trad", {}).get("csPerMin", 0.0)
        gold_pm = match.get("power", {}).get("goldEarnedperMin", 0.0)
        vision_pm = match.get("secs", {}).get("visionScorePerMinute", 0.0)
        kp = match.get("achiev", {}).get("killParticipation", 0.0)
        
        total_deaths += deaths
        total_cs_pm += cs_pm
        total_gold_pm += gold_pm
        total_vision_pm += vision_pm
        kill_participations.append(kp)
    
    num_games = len(matches)
    avg_cs = total_cs_pm / num_games
    avg_gold = total_gold_pm / num_games
    avg_vision = total_vision_pm / num_games
    avg_kp = sum(kill_participations) / len(kill_participations) if kill_participations else 0.0
    
    # Estimate KDA using kill participation
    # Assumes average team gets ~20 kills per game
    # KDA = (Kills + Assists) / Deaths
    # Approximate: kp * 20 * games / deaths
    estimated_takedowns = avg_kp * 20 * num_games
    kda_proxy = estimated_takedowns / max(1, total_deaths)
    
    return {
        "games": num_games,
        "kda_proxy": round(kda_proxy, 2),
        "cs_per_min": round(avg_cs, 2),
        "gold_per_min": round(avg_gold, 1),
        "vision_score_per_min": round(avg_vision, 2),  # Match frontend field name
        "avg_kill_participation": round(avg_kp, 3),
        "ping_rate_per_min": 0.0  # Not available in pre-processed data
    }


def choose_region_arc(values: dict, quarter_num: int) -> str:
    """
    Choose the region arc based on dominant Schwartz values.
    
    Excludes Universalism for Q1, Q2, Q4 to ensure variety.
    """
    # Define region mapping
    region_map = {
        "Security": "Demacia",
        "Conformity": "Demacia",
        "Tradition": "Ionia",
        "Benevolence": "Ionia",
        "Universalism": "Targon",
        "Self-Direction": "Piltover",
        "Stimulation": "Bilgewater",
        "Hedonism": "Zaun",
        "Achievement": "Noxus",
        "Power": "Noxus"
    }
    
    # For variety, exclude Universalism for most quarters
    # Only allow it in Q3 (to ensure we see different regions)
    exclude_universalism = quarter_num in [1, 2, 4]
    
    # Get top 3 values
    sorted_values = sorted(values.items(), key=lambda x: x[1], reverse=True)
    
    # Filter out Universalism if needed
    if exclude_universalism:
        sorted_values = [(k, v) for k, v in sorted_values if k != "Universalism"]
    
    # Pick the highest value
    if sorted_values:
        top_value = sorted_values[0][0]
        return region_map.get(top_value, "Runeterra")
    
    return "Runeterra"


def process_quarter_matches(matches: List[dict], quarter_num: int, archetype: str, prev_values=None) -> dict:
    """Process matches for one quarter and generate story"""
    quarter_label = f"Q{quarter_num}"
    print(f"\n{'='*60}")
    print(f"🎮 Processing {quarter_label}: {len(matches)} matches")
    print(f"{'='*60}")
    
    # Extract date range
    timestamps = [m.get("timestamp", 0) for m in matches if m.get("timestamp")]
    date_range = "Unknown"
    if timestamps:
        start_date = datetime.fromtimestamp(min(timestamps) / 1000).strftime("%b %d, %Y")
        end_date = datetime.fromtimestamp(max(timestamps) / 1000).strftime("%b %d, %Y")
        date_range = f"{start_date} - {end_date}"
        print(f"📅 Date range: {date_range}")
    
    # Extract bundles from pre-processed matches
    print(f"📊 Extracting bundles...")
    bundles = [extract_bundles_from_processed_match(m) for m in matches]
    
    # Calculate Schwartz values
    print(f"🎯 Calculating Schwartz values...")
    raw = score_values(bundles)
    values = aggregate_mean(raw)
    
    # Add universalism bonus
    values["Universalism"] = values.get("Universalism", 0.0) + universalism_bonus(bundles)
    
    # Scale to 0-100 range
    max_val = max(values.values()) if values else 1
    values = {k: round((v / max_val) * 100, 1) for k, v in values.items()}
    
    print(f"   Values: {dict(list(values.items())[:3])}")
    
    # Calculate stats
    print(f"📈 Calculating stats...")
    stats = calculate_stats_from_preprocessed(matches)
    print(f"   KDA: {stats['kda_proxy']}, CS/min: {stats['cs_per_min']}, Gold/min: {stats['gold_per_min']}")
    
    # Choose region based on values
    region_arc = choose_region_arc(values, quarter_num)
    print(f"🗺️  Region: {region_arc}")
    
    # Get top 3 values for lore generation
    top_values_dict = dict(sorted(values.items(), key=lambda x: x[1], reverse=True)[:3])
    top_values_list = list(top_values_dict.items())  # Convert to list of tuples for lore function
    
    # Generate lore
    print(f"📖 Generating lore via AWS Bedrock...")
    quarter_info = {
        "number": quarter_num,
        "label": quarter_label,
        "matches": len(matches),
        "region": region_arc
    }
    
    try:
        lore = generate_quarter_lore(quarter_label, stats, top_values_list, region_arc)
        print(f"   ✓ Lore generated ({len(lore)} chars)")
    except Exception as e:
        print(f"   ⚠️  Lore generation failed: {e}")
        lore = f"In {region_arc}, during {quarter_label}, the journey continued through {len(matches)} battles..."
    
    try:
        reflection = generate_quarter_reflection(quarter_label, stats, top_values_list)
        print(f"   ✓ Reflection generated ({len(reflection)} chars)")
    except Exception as e:
        print(f"   ⚠️  Reflection generation failed: {e}")
        reflection = "The journey continues..."
    
    # Build story object
    story = {
        "quarter": quarter_label,
        "date_range": date_range,
        "values": values,
        "stats": stats,
        "lore": lore,
        "reflection": reflection,
        "region_arc": region_arc,
        "top_values": top_values_list  # Store as list of tuples for frontend
    }
    
    return story


def extract_best_moments_from_preprocessed(matches: List[dict]) -> dict:
    """
    Extract best moments directly from pre-processed match data.
    
    Pre-processed matches have different structure than bundles,
    so we need custom extraction logic.
    """
    highlights = {
        "best_kda_game": {"index": 0, "champion": "Unknown", "value": 0.0},
        "most_kills_game": {"index": 0, "champion": "Unknown", "kills": 0.0},
        "most_damage_game": {"index": 0, "champion": "Unknown", "damage": 0.0},
        "perfect_games": [],
        "first_bloods": 0.0,
        "pentakills": 0,
        "quadrakills": 0,
        "comeback_wins": [],
        "highest_cs_game": {"index": 0, "champion": "Unknown", "cs_per_min": 0.0},
        "most_gold_game": None,
        "best_vision_game": None,
        "clutch_steals": 0.0,
        "fountain_kills": 0.0,
    }
    
    if not matches:
        return highlights
    
    # Track best moments
    best_kda = 0.0
    best_kda_idx = 0
    most_kills = 0
    most_kills_idx = 0
    most_damage = 0.0
    most_damage_idx = 0
    highest_cs = 0.0
    highest_cs_idx = 0
    first_blood_count = 0
    penta_count = 0
    quadra_count = 0
    steals_count = 0
    fountain_count = 0
    
    for i, match in enumerate(matches):
        # Extract data from pre-processed fields
        deaths = match.get("secs", {}).get("deaths", 0)
        kp = match.get("achiev", {}).get("killParticipation", 0.0)
        solo_kills = match.get("achiev", {}).get("soloKills", 0)
        
        # Estimate kills from kill participation (assuming 20 team kills avg)
        estimated_kills = int(kp * 20) if kp > 0 else solo_kills
        
        # Calculate KDA proxy
        estimated_takedowns = estimated_kills + int(kp * 15)  # Add assists
        kda = estimated_takedowns / max(1, deaths)
        
        if kda > best_kda:
            best_kda = kda
            best_kda_idx = i
        
        if estimated_kills > most_kills:
            most_kills = estimated_kills
            most_kills_idx = i
        
        # Total damage
        magic_dmg = match.get("power", {}).get("magicDamageDealtToChampions", 0)
        phys_dmg = match.get("power", {}).get("physicalDamageDealtToChampions", 0)
        total_damage = magic_dmg + phys_dmg
        
        if total_damage > most_damage:
            most_damage = total_damage
            most_damage_idx = i
        
        # CS/min
        cs_pm = match.get("trad", {}).get("csPerMin", 0.0)
        if cs_pm > highest_cs:
            highest_cs = cs_pm
            highest_cs_idx = i
        
        # Count special moments
        if match.get("achiev", {}).get("firstBloodKill", False):
            first_blood_count += 1
        
        penta_count += match.get("achiev", {}).get("pentaKills", 0)
        quadra_count += match.get("achiev", {}).get("quadraKills", 0)
        steals_count += match.get("stim", {}).get("epicMonsterSteals", 0)
        fountain_count += match.get("hed", {}).get("takedownsInEnemyFountain", 0)
    
    # Build highlights
    highlights["best_kda_game"] = {
        "index": best_kda_idx,
        "champion": matches[best_kda_idx].get("selfD", {}).get("championName", "Unknown"),
        "value": round(best_kda, 2)
    }
    
    highlights["most_kills_game"] = {
        "index": most_kills_idx,
        "champion": matches[most_kills_idx].get("selfD", {}).get("championName", "Unknown"),
        "kills": most_kills
    }
    
    highlights["most_damage_game"] = {
        "index": most_damage_idx,
        "champion": matches[most_damage_idx].get("selfD", {}).get("championName", "Unknown"),
        "damage": round(most_damage / 1000, 1)  # Convert to k
    }
    
    highlights["highest_cs_game"] = {
        "index": highest_cs_idx,
        "champion": matches[highest_cs_idx].get("selfD", {}).get("championName", "Unknown"),
        "cs_per_min": round(highest_cs, 2)
    }
    
    highlights["first_bloods"] = first_blood_count
    highlights["pentakills"] = penta_count
    highlights["quadrakills"] = quadra_count
    highlights["clutch_steals"] = steals_count
    highlights["fountain_kills"] = fountain_count
    
    return highlights


def analyze_champion_pool_from_preprocessed(matches: List[dict]) -> dict:
    """
    Analyze champion pool directly from pre-processed match data.
    """
    if not matches:
        return {
            "available": True,
            "total_unique_champions": 0,
            "most_played": [],
            "one_tricks": [],
            "versatility_score": 0.0,
            "all_champions": []
        }
    
    # Track champion stats
    champion_stats = {}
    
    for match in matches:
        champ_name = match.get("selfD", {}).get("championName", "Unknown")
        
        if champ_name not in champion_stats:
            champion_stats[champ_name] = {
                "name": champ_name,
                "games": 0,
                "total_damage": 0.0,
                "total_gold_pm": 0.0,
                "total_cs_pm": 0.0,
                "total_vision": 0.0
            }
        
        stats = champion_stats[champ_name]
        stats["games"] += 1
        
        # Aggregate stats
        magic_dmg = match.get("power", {}).get("magicDamageDealtToChampions", 0)
        phys_dmg = match.get("power", {}).get("physicalDamageDealtToChampions", 0)
        stats["total_damage"] += magic_dmg + phys_dmg
        stats["total_gold_pm"] += match.get("power", {}).get("goldEarnedperMin", 0.0)
        stats["total_cs_pm"] += match.get("trad", {}).get("csPerMin", 0.0)
        stats["total_vision"] += match.get("secs", {}).get("visionScorePerMinute", 0.0)
    
    # Calculate averages and format
    champion_list = []
    for champ_name, stats in champion_stats.items():
        games = stats["games"]
        champion_list.append({
            "name": champ_name,
            "games": games,
            "avg_damage": round(stats["total_damage"] / games / 1000, 1),  # Convert to k
            "avg_gold_per_min": round(stats["total_gold_pm"] / games, 1),
            "avg_cs_per_min": round(stats["total_cs_pm"] / games, 1),
            "avg_vision_score": round(stats["total_vision"] / games, 2)
        })
    
    # Sort by games played
    champion_list.sort(key=lambda x: x["games"], reverse=True)
    
    # Calculate versatility score (Shannon entropy)
    total_games = sum(c["games"] for c in champion_list)
    probabilities = [c["games"] / total_games for c in champion_list]
    import math
    entropy = -sum(p * math.log2(p) for p in probabilities if p > 0)
    max_entropy = math.log2(len(champion_list)) if len(champion_list) > 0 else 1
    versatility_score = (entropy / max_entropy) * 100 if max_entropy > 0 else 0
    
    # Identify one-tricks (>30% of games on one champ)
    one_tricks = [c for c in champion_list if (c["games"] / total_games) > 0.3]
    
    return {
        "available": True,
        "total_unique_champions": len(champion_list),
        "most_played": champion_list[:5],
        "one_tricks": one_tricks,
        "versatility_score": round(versatility_score, 1),
        "all_champions": champion_list
    }


def generate_finale(quarters_data: dict, all_matches: List[dict], all_bundles: List[dict], player_name: str) -> dict:
    """Generate finale with analytics and year summary"""
    print(f"\n{'='*60}")
    print(f"🎆 Generating Finale & Analytics")
    print(f"{'='*60}")
    
    # Convert quarters dict to list for analytics functions
    quarters_list = [quarters_data[f"Q{i}"] for i in range(1, 5)]
    
    # Calculate trends
    print(f"📊 Calculating trends...")
    trends = calculate_trends(quarters_list)
    print(f"   ✓ Trends calculated")
    
    # Extract best moments
    print(f"🏆 Extracting best moments...")
    try:
        # Use custom extraction for pre-processed data
        highlights = extract_best_moments_from_preprocessed(all_matches)
        print(f"   ✓ Best moments extracted")
    except Exception as e:
        print(f"   ⚠️  Best moments extraction failed: {e}")
        highlights = {"best_kda": {}, "most_kills": {}, "most_damage": {}}
    
    # Analyze champion pool
    print(f"🎮 Analyzing champion pool...")
    try:
        champion_analysis = analyze_champion_pool_from_preprocessed(all_matches)
        print(f"   ✓ Champion analysis complete ({champion_analysis['total_unique_champions']} champions)")
    except Exception as e:
        print(f"   ⚠️  Champion analysis failed: {e}")
        champion_analysis = {"most_played": [], "diversity_score": 0}
    
    # Generate insights
    print(f"💡 Generating insights...")
    try:
        insights = generate_insights(quarters_list, trends, champion_analysis)
        print(f"   ✓ {len(insights)} insights generated")
    except Exception as e:
        print(f"   ⚠️  Insights generation failed: {e}")
        insights = []
    
    # Generate year summary
    print(f"📜 Generating year summary...")
    try:
        year_summary = generate_year_summary(quarters_list, trends, highlights, champion_analysis, insights)
        print(f"   ✓ Year summary generated")
    except Exception as e:
        print(f"   ⚠️  Year summary generation failed: {e}")
        import traceback
        traceback.print_exc()
        year_summary = {"total_games": len(all_matches)}
    
    # Generate finale lore
    print(f"📖 Generating finale lore via AWS Bedrock...")
    try:
        finale_lore = generate_finale_lore(
            quarters_list, 
            player_name=player_name, 
            total_games=year_summary.get('total_games', len(all_matches))
        )
        print(f"   ✓ Finale lore generated ({len(finale_lore)} chars)")
    except Exception as e:
        print(f"   ⚠️  Finale lore generation failed: {e}")
        finale_lore = "The journey through Runeterra concludes..."
    
    try:
        finale_reflection = generate_finale_reflection(quarters_list)
        print(f"   ✓ Finale reflection generated ({len(finale_reflection) if isinstance(finale_reflection, str) else sum(len(r) for r in finale_reflection)} chars)")
    except Exception as e:
        print(f"   ⚠️  Finale reflection generation failed: {e}")
        finale_reflection = "A year of growth and discovery."
    
    finale = {
        "lore": finale_lore,
        "reflection": finale_reflection,
        "trends": trends,
        "highlights": highlights,
        "champion_analysis": champion_analysis,
        "insights": insights,
        "year_summary": year_summary
    }
    
    return finale


def package_for_upload(journey_folder: str, output_file: str):
    """
    Package all journey files into a single JSON for frontend upload.
    
    Args:
        journey_folder: Path to folder containing Q1-Q4/story.json, finale.json, metadata.json
        output_file: Output file path (e.g., "journey-upload.json")
    """
    journey_path = Path(journey_folder)
    
    if not journey_path.exists():
        raise FileNotFoundError(f"Journey folder not found: {journey_folder}")
    
    # Load metadata
    metadata_path = journey_path / "metadata.json"
    if not metadata_path.exists():
        raise FileNotFoundError(f"metadata.json not found in {journey_folder}")
    
    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    
    # Load quarters
    quarters = {}
    for i in range(1, 5):
        quarter_name = f"Q{i}"
        story_path = journey_path / quarter_name / "story.json"
        
        if not story_path.exists():
            raise FileNotFoundError(f"Story file not found: {story_path}")
        
        with open(story_path, 'r', encoding='utf-8') as f:
            quarters[quarter_name] = json.load(f)
    
    # Load finale
    finale_path = journey_path / "finale.json"
    if not finale_path.exists():
        raise FileNotFoundError(f"finale.json not found in {journey_folder}")
    
    with open(finale_path, 'r', encoding='utf-8') as f:
        finale = json.load(f)
    
    # Combine into upload package
    upload_package = {
        "metadata": metadata,
        "quarters": quarters,
        "finale": finale,
        "version": "1.0",
        "type": "complete-journey"
    }
    
    # Write to output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(upload_package, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Upload package created: {output_file}")
    print(f"📤 Ready to upload to frontend!")
    print(f"\nTo use:")
    print(f"1. Start frontend: cd frontend && npm run dev")
    print(f"2. Open http://localhost:5173")
    print(f"3. Click 'Upload Journey Package'")
    print(f"4. Select {output_file}")
    print(f"5. Enjoy your journey! 🎮")


def main():
    parser = argparse.ArgumentParser(
        description="Create a complete Rift Rewind journey from local match data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_journey.py ./dataset --player-name "bst#0123"
  python create_journey.py ./my_matches --player-name "Player#TAG" --output my-journey
  python create_journey.py ./dataset --player-name "bst#0123" --archetype guardian

Archetypes: explorer, guardian, dominator, strategist, supporter
        """
    )
    
    parser.add_argument(
        'folder',
        help='Path to folder containing match JSON files'
    )
    parser.add_argument(
        '--player-name',
        required=True,
        help='Player name (e.g., "bst#0123")'
    )
    parser.add_argument(
        '--output',
        default='journey-output',
        help='Output folder name (default: journey-output)'
    )
    parser.add_argument(
        '--archetype',
        default='explorer',
        choices=['explorer', 'guardian', 'dominator', 'strategist', 'supporter'],
        help='Player archetype (default: explorer)'
    )
    
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("🎮 RIFT REWIND - JOURNEY CREATOR")
    print("="*60)
    print(f"📂 Dataset: {args.folder}")
    print(f"👤 Player: {args.player_name}")
    print(f"🎯 Archetype: {args.archetype}")
    print(f"📦 Output: {args.output}/")
    print("="*60 + "\n")
    
    # Load matches
    matches = load_matches_from_folder(args.folder)
    
    if not matches:
        print("❌ No matches found!")
        return 1
    
    # Sort by timestamp
    print(f"\n📅 Sorting matches chronologically...")
    matches.sort(key=lambda m: m.get("timestamp", 0))
    
    # Divide into quarters
    total = len(matches)
    quarter_size = total // 4
    remainder = total % 4
    
    # Distribute remainder across first quarters
    sizes = [quarter_size + (1 if i < remainder else 0) for i in range(4)]
    
    quarters_matches = {}
    start_idx = 0
    for i, size in enumerate(sizes):
        quarter_name = f"Q{i+1}"
        quarters_matches[quarter_name] = matches[start_idx:start_idx + size]
        start_idx += size
        print(f"   {quarter_name}: {size} matches")
    
    # Create output directory
    output_path = Path(args.output)
    output_path.mkdir(exist_ok=True)
    
    # Process each quarter
    quarters_data = {}
    prev_values = None
    
    for i in range(1, 5):
        quarter_name = f"Q{i}"
        quarter_matches = quarters_matches[quarter_name]
        
        story = process_quarter_matches(
            quarter_matches,
            i,
            args.archetype,
            prev_values
        )
        
        quarters_data[quarter_name] = story
        prev_values = story["values"]
        
        # Save quarter story
        quarter_path = output_path / quarter_name
        quarter_path.mkdir(exist_ok=True)
        story_file = quarter_path / "story.json"
        
        with open(story_file, 'w', encoding='utf-8') as f:
            json.dump(story, f, indent=2, ensure_ascii=False)
        print(f"   ✓ Saved to {story_file}")
    
    # Extract all bundles for analytics
    print(f"\n📊 Preparing data for analytics...")
    all_bundles = [extract_bundles_from_processed_match(m) for m in matches]
    
    # Generate finale
    finale = generate_finale(quarters_data, matches, all_bundles, args.player_name)
    
    # Save finale
    finale_path = output_path / "finale.json"
    with open(finale_path, 'w', encoding='utf-8') as f:
        json.dump(finale, f, indent=2, ensure_ascii=False)
    print(f"   ✓ Saved to {finale_path}")
    
    # Save metadata
    metadata = {
        "playerName": args.player_name,
        "archetype": args.archetype,
        "totalGames": len(matches),
        "generatedAt": datetime.now().isoformat(),
        "quarters": {f"Q{i+1}": len(quarters_matches[f"Q{i+1}"]) for i in range(4)}
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
    print(f"\n📦 Creating upload package...")
    upload_file = f"{args.output}-upload.json"
    package_for_upload(args.output, upload_file)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
