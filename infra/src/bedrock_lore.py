"""
Bedrock integration for generating lore and reflections
"""
import json
import boto3
import os
from typing import Dict, List, Any

REGION = os.environ.get("REGION_HINT", "eu-west-1")
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# Using Mistral 7B Instruct (working model)
MODEL_ID = "mistral.mistral-7b-instruct-v0:2"

def generate_quarter_lore(quarter: str, stats: Dict[str, float], top_values: List[tuple], 
                         region_arc: str, previous_lore = None) -> str:
    """
    Generate lore for a single quarter based on stats and values, with continuity from previous quarter
    """
    values_text = ", ".join([f"{name} ({val:.2f})" for name, val in top_values])
    
    # Build continuity context
    continuity_context = ""
    if previous_lore:
        continuity_context = f"""
Previous Chapter Summary: {previous_lore}

IMPORTANT: Continue the story from the previous chapter. Reference the previous journey and show progression/transition to the new region."""
    else:
        continuity_context = "This is the beginning of the summoner's journey."
    
    prompt = f"""You are a storytelling bard in the world of League of Legends, narrating a summoner's journey through Runeterra.

{continuity_context}

Current Quarter: {quarter}
Current Region: {region_arc}
Top Playstyle Values: {values_text}
Stats: {stats.get('games', 0)} games, {stats.get('kda_proxy', 0):.2f} KDA, {stats.get('vision_score_per_min', 0):.2f} vision/min

Write a brief, atmospheric lore paragraph (2-3 sentences) that:
- {"Continues from the previous chapter and shows the transition to " + region_arc if previous_lore else "Begins the journey in " + region_arc}
- Connects the summoner's actions to the {region_arc} region of Runeterra
- Reflects their playstyle values in a narrative way
- Uses League of Legends lore and atmosphere
- Feels like a continuous story, not isolated chapters

Keep it under 100 words. Make it feel connected to the previous events."""

    body = {
        "prompt": prompt,
        "max_tokens": 200,
        "temperature": 0.7
    }

    try:
        response = bedrock_runtime.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['outputs'][0]['text'].strip()
    except Exception as e:
        print(f"Bedrock error generating lore: {e}")
        return f"{quarter}: Your journey through {region_arc} has shaped your path. The Rift remembers."


def generate_quarter_reflection(quarter: str, stats: dict, 
                                top_values: List[tuple]) -> str:
    """
    Generate actionable reflection/tips for a quarter
    """
    # Get actual role from match data
    role = stats.get('primary_role', 'UNKNOWN')
    
    # Build role-specific stats display
    base_stats = f"""Games: {stats.get('games', 0)}
KDA: {stats.get('kda_proxy', 0):.2f}
Kill Participation: {stats.get('kill_participation', 0):.1f}%
Vision/min: {stats.get('vision_score_per_min', 0):.2f}
Gold/min: {stats.get('gold_per_min', 0):.0f}"""
    
    # Add role-specific context and stats
    if role in ["UTILITY", "SUPPORT"]:
        role_context = "\n\nRole: SUPPORT"
        role_stats = f"""Control Wards/game: {stats.get('control_wards_per_game', 0):.1f}
CS/min: {stats.get('cs_per_min', 0):.2f} (low CS is normal for supports)"""
        focus_areas = "Focus on vision control, roaming timing, engage/disengage mechanics, and peel for carries."
    elif role == "JUNGLE":
        role_context = "\n\nRole: JUNGLE"
        role_stats = f"""Objective Damage/min: {stats.get('obj_damage_per_min', 0):.0f}
CS/min: {stats.get('cs_per_min', 0):.2f} (includes jungle camps)"""
        focus_areas = "Focus on clear speed, gank timing, objective control, and jungle tracking."
    elif role == "TOP":
        role_context = "\n\nRole: TOP"
        role_stats = f"""CS/min: {stats.get('cs_per_min', 0):.2f}
Objective Damage/min: {stats.get('obj_damage_per_min', 0):.0f}"""
        focus_areas = "Focus on wave management, split pushing, TP usage, and teamfight positioning."
    elif role == "MIDDLE":
        role_context = "\n\nRole: MID"
        role_stats = f"""CS/min: {stats.get('cs_per_min', 0):.2f}
Objective Damage/min: {stats.get('obj_damage_per_min', 0):.0f}"""
        focus_areas = "Focus on roaming, wave priority, jungle coordination, and teamfight impact."
    elif role == "BOTTOM":
        role_context = "\n\nRole: ADC"
        role_stats = f"""CS/min: {stats.get('cs_per_min', 0):.2f}
Objective Damage/min: {stats.get('obj_damage_per_min', 0):.0f}"""
        focus_areas = "Focus on CS, positioning, objective damage, and teamfight output."
    else:
        role_context = f"\n\nRole: {role}"
        role_stats = f"""CS/min: {stats.get('cs_per_min', 0):.2f}"""
        focus_areas = "Focus on improving fundamentals and role-specific mechanics."
    
    prompt = f"""You are a League of Legends coach analyzing a player's performance.

Quarter: {quarter}{role_context}

Performance Stats:
{base_stats}
{role_stats}

{focus_areas}

Provide ONE specific, actionable tip to improve their gameplay (1 sentence, under 25 words).
Focus on the weakest stat or biggest opportunity for improvement. Be direct and specific with numbers."""

    body = {
        "prompt": prompt,
        "max_tokens": 100,
        "temperature": 0.5
    }

    try:
        response = bedrock_runtime.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['outputs'][0]['text'].strip()
    except Exception as e:
        print(f"Bedrock error generating reflection: {e}")
        return "Continue improving your macro play and map awareness."


def generate_finale_lore(all_quarters_data: List[Dict[str, Any]], 
                        player_name: str, total_games: int) -> str:
    """
    Generate finale lore that ties all 4 quarters together as a complete story
    """
    # Build story arc from all quarters
    story_progression = []
    for i, q in enumerate(all_quarters_data):
        region = q.get('region_arc', 'Unknown')
        lore_excerpt = q.get('lore', '')[:150]  # First 150 chars for context
        top_vals = ', '.join([v[0] for v in q.get('top_values', [])[:2]])
        story_progression.append(f"Q{i+1} - {region}: {lore_excerpt}... (Values: {top_vals})")
    
    story_text = "\n\n".join(story_progression)
    
    prompt = f"""You are a storytelling bard concluding an epic 4-chapter saga of a summoner's journey through Runeterra.

Summoner: {player_name}
Total Games: {total_games}

THE COMPLETE STORY SO FAR:
{story_text}

Write a powerful FINALE paragraph (3-4 sentences) that:
- Weaves together all 4 chapters into a cohesive conclusion
- Shows the character arc and transformation across the journey
- References key moments or themes from the quarters above
- Ends with a forward-looking statement about future challenges
- Uses epic League of Legends lore language

This is THE END of the saga. Make it feel climactic and complete. Keep it under 150 words."""

    body = {
        "prompt": prompt,
        "max_tokens": 300,
        "temperature": 0.8
    }

    try:
        response = bedrock_runtime.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['outputs'][0]['text'].strip()
    except Exception as e:
        print(f"Bedrock error generating finale lore: {e}")
        return f"Across four quarters and {total_games} battles, {player_name} has proven their worth on the Rift. The journey continues..."


def generate_finale_reflection(all_quarters_data: List[Dict[str, Any]]) -> List[str]:
    """
    Generate 3-4 key takeaways and forward-looking tips for the finale
    """
    stats_summary = []
    total_cs = 0
    total_vision = 0
    
    for i, q in enumerate(all_quarters_data):
        stats = q.get('stats', {})
        total_cs += stats.get('cs_per_min', 0)
        total_vision += stats.get('vision_score_per_min', 0)
        stats_summary.append(
            f"Q{i+1}: {stats.get('games', 0)} games, "
            f"{stats.get('kda_proxy', 0):.2f} KDA, "
            f"{stats.get('cs_per_min', 0):.2f} CS/min, "
            f"{stats.get('vision_score_per_min', 0):.2f} vision/min"
        )
    
    avg_cs = total_cs / 4
    avg_vision = total_vision / 4
    likely_support = avg_cs < 1.0 and avg_vision > 1.5
    role_context = " (Appears to be a Support player - focus on vision, roaming, and team utility)" if likely_support else ""
    
    prompt = f"""You are a League of Legends coach providing a season summary and future goals.{role_context}

Season Summary:
{chr(10).join(stats_summary)}

Provide 3-4 key bullet points that:
1. Highlight the biggest strength shown across the season
2. Identify the main area for improvement (considering their role)
3. Give 1-2 specific, measurable goals for next season (with numbers appropriate for their role)

Each bullet should be 1 sentence, under 20 words. Be specific and actionable.
Format as a simple list without bullet symbols or numbers."""

    body = {
        "prompt": prompt,
        "max_tokens": 250,
        "temperature": 0.6
    }

    try:
        response = bedrock_runtime.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )
        
        response_body = json.loads(response['body'].read())
        text = response_body['outputs'][0]['text'].strip()
        # Split into lines and clean up
        reflections = [line.strip() for line in text.split('\n') if line.strip()]
        return reflections[:4]  # Max 4 items
    except Exception as e:
        print(f"Bedrock error generating finale reflection: {e}")
        return [
            "Consistent gameplay across all quarters shows strong fundamentals",
            "Focus on improving vision control in the mid-late game",
            "Target 3.0+ vision score per minute next season"
        ]
