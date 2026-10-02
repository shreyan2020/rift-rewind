from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, Callable

from .analytics import REGION_PROFILES
from .llm import LocalLLMError, OllamaClient


ProgressCallback = Callable[[int, str], None]


class NarrativeEngine:
    """Turns verified analytics into prose; it never calculates player performance."""

    def __init__(self, llm: OllamaClient):
        self.llm = llm

    @staticmethod
    def _chapter_action(period: dict[str, Any]) -> str:
        stats = period["stats"]
        role = stats.get("primary_role", "UNKNOWN")
        if role == "SUPPORT":
            if stats.get("vision_score_per_min", 0) < 1.8:
                return f"Build on {stats.get('vision_score_per_min', 0):.2f} vision/min by resetting vision one minute before major objectives."
            if stats.get("deaths_per_game", 0) > 6:
                return f"Reduce the {stats.get('deaths_per_game', 0):.1f} deaths/game by preserving a safe exit after each warding route."
            return "Keep the vision volume, then review whether each ward was placed before the information was needed."
        if stats.get("cs_per_min", 0) < 6:
            return f"Raise the current {stats.get('cs_per_min', 0):.1f} CS/min through a focused ten-minute last-hit routine."
        if stats.get("deaths_per_game", 0) > 6:
            return f"Review the setup behind each of the {stats.get('deaths_per_game', 0):.1f} deaths/game and define the missing information."
        return "Review one win and one loss from this act to preserve the successful pattern without repeating its blind spot."

    @staticmethod
    def _fallback_chapter(player_name: str, period: dict[str, Any], waypoint: dict[str, Any]) -> dict[str, str]:
        stats = period["stats"]
        value = waypoint["dominant_value"]["name"]
        region = waypoint["region"]
        lore = (
            f"{player_name} entered {region} during {waypoint['act'].lower()}, carrying a style shaped by {value}. "
            f"Across {stats['games']} battles, {waypoint['trigger'][0].lower() + waypoint['trigger'][1:]} "
            f"The road through {region} became a lesson in {waypoint['theme']}, and every match left a clearer mark on the route ahead."
        )
        return {
            "story_beat": waypoint["trigger"],
            "lore": lore,
            "reflection": NarrativeEngine._chapter_action(period),
        }

    def chapter(
        self,
        player_name: str,
        archetype: str,
        period: dict[str, Any],
        waypoint: dict[str, Any],
        previous_beat: str | None,
        use_llm: bool,
    ) -> tuple[dict[str, str], bool]:
        fallback = self._fallback_chapter(player_name, period, waypoint)
        if not use_llm:
            return fallback, False
        compact = {
            "player": player_name,
            "archetype": archetype,
            "act": waypoint["act"],
            "region": waypoint["region"],
            "region_theme": REGION_PROFILES[waypoint["region"]]["theme"],
            "route_trigger": waypoint["trigger"],
            "date_range": period["date_range"],
            "top_values": period["top_values"],
            "evidence": period["evidence"],
            "stats": period["stats"],
            "champions": period["top_champions"],
            "best_game": period["highlights"]["best_game"],
            "previous_beat": previous_beat,
        }
        prompt = f"""You are the narrative layer for Rift Rewind, a data-grounded journey through Runeterra.

VERIFIED FACTS (never contradict or add statistics):
{json.dumps(compact, ensure_ascii=False, indent=2)}

Write this act as a personal journey waypoint. Use the region as a metaphor for the verified behavioral change. Mention at most one champion. Do not invent matches, ranks, enemies, locations, victories, or achievements. Continue from previous_beat when present. The tone is evocative but concise, not imitation of any named author.

Return only JSON:
{{"lore": "90-140 words of grounded Runeterra journey narrative"}}"""
        try:
            result = self.llm.generate_json(prompt)
            if not isinstance(result.get("lore"), str) or not result["lore"].strip():
                raise LocalLLMError("Incomplete chapter response")
            return {
                "story_beat": waypoint["trigger"],
                "lore": result["lore"].strip(),
                "reflection": self._chapter_action(period),
            }, True
        except LocalLLMError:
            return fallback, False

    @staticmethod
    def _fallback_finale(player_name: str, route: list[dict[str, Any]], finale: dict[str, Any]) -> dict[str, Any]:
        regions = " → ".join(item["region"] for item in route)
        trend = finale["year_summary"]["overall_trend"]
        return {
            "lore": f"{player_name}'s route crossed {regions}. What began as instinct became a tested identity, and the season closed with a {trend} trajectory rather than a finished tale. The map now records both the strength that carried the expedition and the lesson that must guide the next climb.",
            "final_reflection": [item["action"] for item in finale["insights"][:4]],
            "season_title": "The Path Written on the Rift",
        }

    def finale(self, player_name: str, route: list[dict[str, Any]], finale: dict[str, Any], use_llm: bool) -> tuple[dict[str, Any], bool]:
        fallback = self._fallback_finale(player_name, route, finale)
        if not use_llm:
            return fallback, False
        compact = {
            "player": player_name,
            "route": [{key: item[key] for key in ("act", "region", "trigger", "dominant_value")} for item in route],
            "summary": finale["year_summary"],
            "insights": finale["insights"],
            "highlights": finale["highlights"],
        }
        prompt = f"""Conclude a four-act, data-grounded journey through Runeterra.

VERIFIED FACTS:
{json.dumps(compact, ensure_ascii=False, indent=2)}

Connect all four regions into one character arc. Do not invent statistics, rank changes, matches, or lore events. End with a concrete sense of what the player carries into the next season.

Return only JSON:
{{
  "season_title": "a short original title",
  "lore": "130-190 word finale"
}}"""
        try:
            result = self.llm.generate_json(prompt)
            if not isinstance(result.get("lore"), str):
                raise LocalLLMError("Incomplete finale response")
            return {
                "season_title": str(result.get("season_title") or fallback["season_title"]).strip(),
                "lore": result["lore"].strip(),
                "final_reflection": fallback["final_reflection"],
            }, True
        except LocalLLMError:
            return fallback, False

    def enrich(
        self,
        analysis: dict[str, Any],
        player_name: str,
        archetype: str,
        use_llm: bool,
        progress: ProgressCallback | None = None,
    ) -> dict[str, Any]:
        result = deepcopy(analysis)
        route = result["finale"]["journey_map"]
        previous_beat: str | None = None
        llm_calls = 0
        for index, (period, waypoint) in enumerate(zip(result["periods"], route)):
            if progress:
                progress(48 + index * 9, f"Writing {waypoint['act']} in {waypoint['region']}")
            narrative, used = self.chapter(player_name, archetype, period, waypoint, previous_beat, use_llm)
            period.update(narrative)
            period["region_arc"] = waypoint["region"]
            period["act"] = waypoint["act"]
            period["journey_trigger"] = waypoint["trigger"]
            previous_beat = waypoint["trigger"]
            llm_calls += int(used)

        if progress:
            progress(88, "Closing the four-act journey")
        finale_narrative, used = self.finale(player_name, route, result["finale"], use_llm)
        result["finale"].update(finale_narrative)
        llm_calls += int(used)
        result["narrative"] = {
            "provider": "ollama" if llm_calls else "deterministic-fallback",
            "model": self.llm.model if llm_calls else None,
            "generated_sections": llm_calls,
        }
        return result
