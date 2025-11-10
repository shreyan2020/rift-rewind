# advanced_analytics.py
"""
Advanced analytics for Rift Rewind - Enhanced insights for hackathon submission
Generates actionable insights, trends, highlights, and personalized recommendations
"""
from typing import List, Dict, Any, Tuple
from statistics import mean, stdev
from collections import Counter, defaultdict
import math
import json
import boto3

def _safe_num(x: Any, default: float = 0.0) -> float:
    """Safely convert to float"""
    if isinstance(x, (int, float)) and math.isfinite(x):
        return float(x)
    return default

def _safe_get(d: dict, *keys, default=0.0):
    """Safely navigate nested dict and return numeric value"""
    result = d
    for k in keys:
        if isinstance(result, dict):
            result = result.get(k, default)
        else:
            return default
    return _safe_num(result, default)

def _safe_get_str(d: dict, *keys, default="Unknown") -> str:
    """Safely navigate nested dict and return string value"""
    result = d
    for k in keys:
        if isinstance(result, dict):
            result = result.get(k, default)
        else:
            return default
    return str(result) if result is not None else default


# =========================
# TREND ANALYSIS
# =========================

def calculate_trends(quarters_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze improvement/decline trends across quarters
    Returns insights about skill progression
    """
    if len(quarters_data) < 2:
        return {"available": False}
    
    trends = {}
    
    # Track key metrics across quarters
    kdas = [_safe_get(q, "stats", "kda_proxy") for q in quarters_data]
    cs_per_min = [_safe_get(q, "stats", "cs_per_min") for q in quarters_data]
    gold_per_min = [_safe_get(q, "stats", "gold_per_min") for q in quarters_data]
    vision_scores = [_safe_get(q, "stats", "vision_score_per_min") for q in quarters_data]
    kp = [_safe_get(q, "stats", "kill_participation") for q in quarters_data]
    
    def trend_direction(values: List[float]) -> str:
        """Determine if trending up, down, or stable"""
        if len(values) < 2:
            return "stable"
        
        # Simple linear regression slope
        n = len(values)
        x = list(range(n))
        x_mean = sum(x) / n
        y_mean = sum(values) / n
        
        numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return "stable"
        
        slope = numerator / denominator
        
        # Calculate percentage change
        if values[0] != 0:
            pct_change = ((values[-1] - values[0]) / abs(values[0])) * 100
        else:
            pct_change = 0
        
        if abs(pct_change) < 5:
            return "stable"
        elif slope > 0:
            return "improving"
        else:
            return "declining"
    
    trends["kda"] = {
        "values": kdas,
        "direction": trend_direction(kdas),
        "change_pct": ((kdas[-1] - kdas[0]) / max(0.01, kdas[0])) * 100 if kdas[0] != 0 else 0,
        "best_quarter": quarters_data[kdas.index(max(kdas))]["quarter"] if kdas else "Q1"
    }
    
    trends["cs_per_min"] = {
        "values": cs_per_min,
        "direction": trend_direction(cs_per_min),
        "change_pct": ((cs_per_min[-1] - cs_per_min[0]) / max(0.01, cs_per_min[0])) * 100 if cs_per_min[0] != 0 else 0,
        "best_quarter": quarters_data[cs_per_min.index(max(cs_per_min))]["quarter"] if cs_per_min else "Q1"
    }
    
    trends["gold_per_min"] = {
        "values": gold_per_min,
        "direction": trend_direction(gold_per_min),
        "change_pct": ((gold_per_min[-1] - gold_per_min[0]) / max(0.01, gold_per_min[0])) * 100 if gold_per_min[0] != 0 else 0,
        "best_quarter": quarters_data[gold_per_min.index(max(gold_per_min))]["quarter"] if gold_per_min else "Q1"
    }
    
    trends["vision_score"] = {
        "values": vision_scores,
        "direction": trend_direction(vision_scores),
        "change_pct": ((vision_scores[-1] - vision_scores[0]) / max(0.01, vision_scores[0])) * 100 if vision_scores[0] != 0 else 0,
        "best_quarter": quarters_data[vision_scores.index(max(vision_scores))]["quarter"] if vision_scores else "Q1"
    }
    
    trends["kill_participation"] = {
        "values": kp,
        "direction": trend_direction(kp),
        "change_pct": ((kp[-1] - kp[0]) / max(0.01, kp[0])) * 100 if kp[0] != 0 else 0,
        "best_quarter": quarters_data[kp.index(max(kp))]["quarter"] if kp else "Q1"
    }
    
    # Overall progression summary
    improving_count = sum(1 for t in trends.values() if isinstance(t, dict) and t.get("direction") == "improving")
    declining_count = sum(1 for t in trends.values() if isinstance(t, dict) and t.get("direction") == "declining")
    
    trends["overall"] = {
        "improving_metrics": improving_count,
        "declining_metrics": declining_count,
        "summary": "improving" if improving_count > declining_count else ("declining" if declining_count > improving_count else "stable")
    }
    
    trends["available"] = True
    return trends


# =========================
# BEST MOMENTS / HIGHLIGHTS
# =========================

def extract_best_moments(quarters_data: List[Dict[str, Any]], participant_bundles: List[List[dict]]) -> Dict[str, Any]:
    """
    Find and highlight career-best performances
    """
    highlights = {
        "best_kda_game": None,
        "most_kills_game": None,
        "most_damage_game": None,
        "perfect_games": [],
        "first_bloods": 0,
        "pentakills": 0,
        "quadrakills": 0,
        "comeback_wins": [],
        "highest_cs_game": None,
        "most_gold_game": None,
        "best_vision_game": None,
        "clutch_steals": 0,
        "fountain_kills": 0,
    }
    
    all_games = []
    for bundles in participant_bundles:
        all_games.extend(bundles)
    
    if not all_games:
        return highlights
    
    # Best KDA game
    kdas = [(i, _safe_get(g, "trad", "kda")) for i, g in enumerate(all_games)]
    best_kda_idx = max(kdas, key=lambda x: x[1])[0] if kdas else 0
    highlights["best_kda_game"] = {
        "index": best_kda_idx,
        "champion": _safe_get_str(all_games[best_kda_idx], "selfD", "championName", default="Unknown"),
        "value": kdas[best_kda_idx][1] if kdas else 0
    }
    
    # Most kills
    kills = [(i, _safe_get(g, "trad", "kills")) for i, g in enumerate(all_games)]
    best_kills_idx = max(kills, key=lambda x: x[1])[0] if kills else 0
    highlights["most_kills_game"] = {
        "index": best_kills_idx,
        "champion": _safe_get_str(all_games[best_kills_idx], "selfD", "championName", default="Unknown"),
        "kills": kills[best_kills_idx][1] if kills else 0
    }
    
    # Most damage
    damages = [(i, _safe_get(g, "power", "totalDamageDealtToChampions")) for i, g in enumerate(all_games)]
    best_dmg_idx = max(damages, key=lambda x: x[1])[0] if damages else 0
    highlights["most_damage_game"] = {
        "index": best_dmg_idx,
        "champion": _safe_get_str(all_games[best_dmg_idx], "selfD", "championName", default="Unknown"),
        "damage": damages[best_dmg_idx][1] if damages else 0
    }
    
    # Perfect games
    for i, game in enumerate(all_games):
        if _safe_get(game, "trad", "perfectGame") > 0:
            highlights["perfect_games"].append({
                "index": i,
                "champion": _safe_get_str(game, "selfD", "championName", default="Unknown")
            })
    
    # Aggregates
    highlights["first_bloods"] = sum(_safe_get(g, "achiev", "firstBloodKill") for g in all_games)
    highlights["clutch_steals"] = sum(_safe_get(g, "stim", "epicMonsterSteals") for g in all_games)
    highlights["fountain_kills"] = sum(_safe_get(g, "hed", "takedownsInEnemyFountain") for g in all_games)
    
    # Highest CS game
    cs_games = [(i, _safe_get(g, "trad", "csPerMin")) for i, g in enumerate(all_games)]
    best_cs_idx = max(cs_games, key=lambda x: x[1])[0] if cs_games else 0
    highlights["highest_cs_game"] = {
        "index": best_cs_idx,
        "champion": _safe_get_str(all_games[best_cs_idx], "selfD", "championName", default="Unknown"),
        "cs_per_min": cs_games[best_cs_idx][1] if cs_games else 0
    }
    
    return highlights


# =========================
# CHAMPION MASTERY ANALYSIS
# =========================

def analyze_champion_pool(participant_bundles: List[List[dict]]) -> Dict[str, Any]:
    """
    Deep dive into champion pool and mastery
    """
    all_games = []
    for bundles in participant_bundles:
        all_games.extend(bundles)
    
    if not all_games:
        return {"available": False}
    
    champion_stats = defaultdict(lambda: {
        "games": 0,
        "total_damage": 0,
        "total_gold": 0,
        "total_kda": 0,
        "total_cs": 0,
        "total_vision": 0,
        "game_lengths": 0
    })
    
    for game in all_games:
        champ = _safe_get_str(game, "selfD", "championName", default="Unknown")
        game_length = max(1.0, _safe_get(game, "trad", "gameLength") / 60.0)
        
        champion_stats[champ]["games"] += 1
        champion_stats[champ]["total_damage"] += (_safe_get(game, "power", "physicalDamageDealtToChampions") + 
                                                    _safe_get(game, "power", "magicDamageDealtToChampions"))
        champion_stats[champ]["total_gold"] += _safe_get(game, "selfD", "goldEarnedperMin") * game_length
        champion_stats[champ]["total_cs"] += _safe_get(game, "trad", "csPerMin") * game_length
        champion_stats[champ]["total_vision"] += _safe_get(game, "secs", "visionScorePerMinute") * game_length
        champion_stats[champ]["game_lengths"] += game_length
    
    # Calculate averages and rank champions
    champion_analysis = []
    for champ, stats in champion_stats.items():
        if stats["games"] == 0:
            continue
        
        avg_game_length = stats["game_lengths"] / stats["games"]
        
        champion_analysis.append({
            "name": champ,
            "games": stats["games"],
            "avg_damage": stats["total_damage"] / stats["games"],
            "avg_gold_per_min": (stats["total_gold"] / stats["game_lengths"]) if stats["game_lengths"] > 0 else 0,
            "avg_cs_per_min": (stats["total_cs"] / stats["game_lengths"]) if stats["game_lengths"] > 0 else 0,
            "avg_vision_score": (stats["total_vision"] / stats["game_lengths"]) if stats["game_lengths"] > 0 else 0,
        })
    
    # Sort by games played
    champion_analysis.sort(key=lambda x: x["games"], reverse=True)
    
    return {
        "available": True,
        "total_unique_champions": len(champion_stats),
        "most_played": champion_analysis[:5],  # Top 5
        "one_tricks": [c for c in champion_analysis if c["games"] >= len(all_games) * 0.3],  # >30% play rate
        "versatility_score": len(champion_stats) / max(1, len(all_games)),  # Champions per game
        "all_champions": champion_analysis
    }


# =========================
# ACTIONABLE INSIGHTS
# =========================

def generate_insights(quarters_data: List[Dict[str, Any]], trends: Dict[str, Any], 
                     champion_analysis: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Generate AI-powered actionable insights and recommendations using AWS Bedrock
    """
    insights = []
    
    if not quarters_data:
        return insights
    
    try:
        # Prepare data summary for the LLM
        latest = quarters_data[-1] if quarters_data else {}
        latest_stats = latest.get("stats", {})
        
        # Build context data
        context = {
            "total_periods": len(quarters_data),
            "latest_stats": {
                "kda": round(_safe_get(latest_stats, "kda_proxy"), 2),
                "cs_per_min": round(_safe_get(latest_stats, "cs_per_min"), 2),
                "gold_per_min": round(_safe_get(latest_stats, "gold_per_min"), 1),
                "vision_score_per_min": round(_safe_get(latest_stats, "vision_score_per_min"), 2)
            },
            "trends": {},
            "champion_pool": {}
        }
        
        # Add trend information
        if trends.get("available"):
            for metric in ["kda", "cs_per_min", "vision_score", "gold_per_min"]:
                if metric in trends:
                    context["trends"][metric] = {
                        "direction": trends[metric].get("direction"),
                        "change_pct": round(trends[metric].get("change_pct", 0), 1),
                        "values": [round(v, 2) for v in trends[metric].get("values", [])]
                    }
        
        # Add champion pool information
        if champion_analysis.get("available"):
            context["champion_pool"] = {
                "total_unique": champion_analysis.get("total_unique_champions", 0),
                "versatility_score": round(champion_analysis.get("versatility_score", 0), 2),
                "most_played": [
                    {
                        "name": champ["name"],
                        "games": champ["games"],
                        "avg_damage": round(champ["avg_damage"], 1),
                        "avg_cs_per_min": round(champ["avg_cs_per_min"], 1)
                    }
                    for champ in champion_analysis.get("most_played", [])[:3]
                ]
            }
        
        # Create the prompt for Bedrock
        prompt = f"""You are an expert League of Legends coach analyzing a player's performance data. Generate 5-7 actionable insights based on the following data:

Player Performance Summary:
{json.dumps(context, indent=2)}

Generate insights that:
1. Are specific and actionable (tell the player exactly what to do)
2. Cover different aspects (KDA, farming, vision, champion pool, trends)
3. Balance constructive criticism with positive reinforcement
4. Are relevant to the player's actual performance level
5. Include both immediate actions and long-term goals

For each insight, provide:
- category: One of [Combat, Farming, Vision, Progress, Champion Pool, Champion Mastery, Positioning]
- priority: One of [high, medium, low, positive, info]
- insight: A clear observation about their performance (1-2 sentences)
- action: Specific actionable advice (1 sentence)

Return ONLY a valid JSON array of insights, no other text. Format:
[
  {{
    "category": "Combat",
    "priority": "high",
    "insight": "Your observation here",
    "action": "Your specific advice here"
  }}
]"""

        # Call Bedrock
        bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
        
        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "temperature": 0.7,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        response_body = json.loads(response['body'].read())
        ai_response = response_body['content'][0]['text']
        
        # Parse the JSON response
        # Extract JSON array from response (in case there's extra text)
        start_idx = ai_response.find('[')
        end_idx = ai_response.rfind(']') + 1
        if start_idx != -1 and end_idx > start_idx:
            json_str = ai_response[start_idx:end_idx]
            insights = json.loads(json_str)
        
        print(f"   ✓ Generated {len(insights)} AI-powered insights")
        
    except Exception as e:
        print(f"   ⚠ Error generating AI insights: {str(e)}")
        print(f"   → Falling back to rule-based insights")
        # Fallback to rule-based insights
        insights = _generate_fallback_insights(quarters_data, trends, champion_analysis)
    
    return insights


def _generate_fallback_insights(quarters_data: List[Dict[str, Any]], trends: Dict[str, Any], 
                                champion_analysis: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Fallback rule-based insights if AI generation fails
    """
    insights = []
    
    if not quarters_data:
        return insights
    
    latest = quarters_data[-1] if quarters_data else {}
    latest_stats = latest.get("stats", {})
    
    # KDA insights
    kda = _safe_get(latest_stats, "kda_proxy")
    if kda < 2.0:
        insights.append({
            "category": "Combat",
            "priority": "high",
            "insight": f"Your KDA of {kda:.2f} suggests frequent deaths. Focus on positioning and map awareness.",
            "action": "Try to identify your death patterns - are you dying in lane, during team fights, or while split pushing?"
        })
    elif kda > 4.0:
        insights.append({
            "category": "Combat",
            "priority": "positive",
            "insight": f"Excellent KDA of {kda:.2f}! You're playing very safely and efficiently.",
            "action": "Maintain this playstyle while looking for opportunities to carry harder."
        })
    
    # CS insights
    cs_pm = _safe_get(latest_stats, "cs_per_min")
    if cs_pm < 5.0:
        insights.append({
            "category": "Farming",
            "priority": "high",
            "insight": f"CS/min of {cs_pm:.1f} is below average. Improving farm will significantly increase your gold income.",
            "action": "Practice last-hitting in Practice Tool. Aim for 7+ CS/min in laning phase."
        })
    elif cs_pm > 7.5:
        insights.append({
            "category": "Farming",
            "priority": "positive",
            "insight": f"Strong CS/min of {cs_pm:.1f}! Your farming is a key strength.",
            "action": "Keep up the excellent farm while maintaining map presence."
        })
    
    # Vision insights
    vision = _safe_get(latest_stats, "vision_score_per_min")
    if vision < 1.0:
        insights.append({
            "category": "Vision",
            "priority": "medium",
            "insight": f"Vision score of {vision:.2f}/min is low. Better vision control wins games.",
            "action": "Buy and place more control wards. Aim for 1.5+ vision score per minute."
        })
    
    # Trend-based insights
    if trends.get("available"):
        kda_trend = trends.get("kda", {})
        if kda_trend.get("direction") == "improving":
            insights.append({
                "category": "Progress",
                "priority": "positive",
                "insight": f"Your KDA improved by {kda_trend.get('change_pct', 0):.1f}% over the year!",
                "action": "You're on the right track. Keep analyzing what's working."
            })
        elif kda_trend.get("direction") == "declining":
            insights.append({
                "category": "Progress",
                "priority": "medium",
                "insight": f"Your KDA declined by {abs(kda_trend.get('change_pct', 0)):.1f}% over the year.",
                "action": "Review your recent games to identify what changed. Consider taking a short break to reset."
            })
    
    # Champion pool insights
    if champion_analysis.get("available"):
        unique_champs = champion_analysis.get("total_unique_champions", 0)
        if unique_champs < 3:
            insights.append({
                "category": "Champion Pool",
                "priority": "low",
                "insight": f"You played only {unique_champs} unique champions. Consider expanding your pool.",
                "action": "Learn 1-2 more champions to adapt to different team compositions."
            })
        elif unique_champs > 20:
            insights.append({
                "category": "Champion Pool",
                "priority": "medium",
                "insight": f"You played {unique_champs} different champions. That's very diverse!",
                "action": "Consider focusing on 3-5 champions to build deeper mastery."
            })
        
        most_played = champion_analysis.get("most_played", [])
        if most_played:
            main_champ = most_played[0]
            insights.append({
                "category": "Champion Mastery",
                "priority": "info",
                "insight": f"{main_champ['name']} is your most played with {main_champ['games']} games.",
                "action": f"Your average stats on {main_champ['name']}: {main_champ['avg_damage']:.0f} dmg, {main_champ['avg_cs_per_min']:.1f} CS/min"
            })
    
    return insights


# =========================
# YEAR-END SUMMARY
# =========================

def generate_year_summary(quarters_data: List[Dict[str, Any]], trends: Dict[str, Any], 
                         highlights: Dict[str, Any], champion_analysis: Dict[str, Any],
                         insights: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Comprehensive year-end summary combining all analytics
    """
    total_games = sum(_safe_get(q, "stats", "games") for q in quarters_data)
    
    # Aggregate stats
    avg_kda = mean([_safe_get(q, "stats", "kda_proxy") for q in quarters_data]) if quarters_data else 0
    avg_cs = mean([_safe_get(q, "stats", "cs_per_min") for q in quarters_data]) if quarters_data else 0
    avg_vision = mean([_safe_get(q, "stats", "vision_score_per_min") for q in quarters_data]) if quarters_data else 0
    
    # Top achievements
    achievements = []
    if highlights.get("first_bloods", 0) > 5:
        achievements.append(f"🎯 {highlights['first_bloods']} First Bloods")
    if highlights.get("clutch_steals", 0) > 0:
        achievements.append(f"🐉 {highlights['clutch_steals']} Objective Steals")
    if len(highlights.get("perfect_games", [])) > 0:
        achievements.append(f"⭐ {len(highlights['perfect_games'])} Perfect Games")
    if highlights.get("fountain_kills", 0) > 0:
        achievements.append(f"💀 {highlights['fountain_kills']} Fountain Takedowns")
    
    # Growth areas (top 2 priorities)
    high_priority_insights = [i for i in insights if i.get("priority") == "high"]
    growth_areas = [i["insight"] for i in high_priority_insights[:2]]
    
    # Strengths (positive insights)
    strengths = [i["insight"] for i in insights if i.get("priority") == "positive"][:3]
    
    summary = {
        "total_games": total_games,
        "year_avg_kda": round(avg_kda, 2),
        "year_avg_cs_per_min": round(avg_cs, 1),
        "year_avg_vision_score": round(avg_vision, 2),
        "total_unique_champions": champion_analysis.get("total_unique_champions", 0),
        "most_played_champion": champion_analysis.get("most_played", [{}])[0].get("name", "Unknown") if champion_analysis.get("most_played") else "Unknown",
        "achievements": achievements,
        "strengths": strengths,
        "growth_areas": growth_areas,
        "overall_trend": trends.get("overall", {}).get("summary", "stable"),
        "best_quarter": max(quarters_data, key=lambda q: _safe_get(q, "stats", "kda_proxy")).get("quarter", "Q1") if quarters_data else "Q1"
    }
    
    return summary
