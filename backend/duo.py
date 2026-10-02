from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from statistics import mean
from typing import Any

from .analytics import REGION_PROFILES, VALUE_NAMES
from .config import Settings
from .llm import LocalLLMError, OllamaClient
from .storage import LocalStore


TURN_SPECS = (
    ("agent-a", "proposal"),
    ("agent-b", "challenge"),
    ("agent-a", "concession"),
    ("agent-b", "counteroffer"),
    ("agent-a", "agreement"),
)


def _number(value: Any) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return 0.0


def _slug(value: str) -> str:
    prepared = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return prepared[:48] or "summoner"


def _clean(value: Any, limit: int = 240) -> str:
    return " ".join(str(value).split())[:limit]


def _player_name(journey: dict[str, Any], fallback: str) -> str:
    metadata = journey.get("metadata") if isinstance(journey.get("metadata"), dict) else {}
    return _clean(metadata.get("playerName") or journey.get("riotId") or fallback, 80)


def _quarters(journey: dict[str, Any]) -> list[dict[str, Any]]:
    raw = journey.get("quarters")
    if not isinstance(raw, dict) or not raw:
        raise ValueError("Each player must upload a complete Rift Rewind journey with quarters")
    prepared = [item for _, item in sorted(raw.items()) if isinstance(item, dict)]
    if not prepared:
        raise ValueError("A player journey has no readable quarter data")
    return prepared


def _average_values(quarters: list[dict[str, Any]]) -> dict[str, float]:
    values: dict[str, float] = {}
    for name in VALUE_NAMES:
        observations = [
            _number(quarter.get("values", {}).get(name))
            for quarter in quarters
            if isinstance(quarter.get("values"), dict)
        ]
        values[name] = round(mean(observations), 1) if observations else 0.0
    return values


def _home_region(values: dict[str, float]) -> str:
    ranked = sorted(values, key=values.get, reverse=True)
    for value in ranked:
        candidates = [region for region, profile in REGION_PROFILES.items() if value in profile["values"]]
        if candidates:
            return candidates[0]
    return "Piltover"


def _profile_style(scores: dict[str, float]) -> tuple[str, str, str]:
    dimensions = {
        "Pathfinder": scores["Self-Direction"] + scores["Stimulation"],
        "Vanguard": scores["Achievement"] + scores["Power"],
        "Warden": scores["Security"] + scores["Tradition"] + scores["Conformity"],
        "Mediator": scores["Benevolence"] + scores["Universalism"],
    }
    style = max(dimensions, key=dimensions.get)
    policies = {
        "Pathfinder": ("Explore options before committing", "Offer experiments with a clear exit condition"),
        "Vanguard": ("Commit to a measurable objective", "Trade control for faster progress when the goal stays intact"),
        "Warden": ("Reduce uncertainty before taking risk", "Accept change when safeguards and review points are explicit"),
        "Mediator": ("Protect the partnership while solving the problem", "Translate disagreement into a shared rule"),
    }
    decision, negotiation = policies[style]
    return style, decision, negotiation


def _insights(journey: dict[str, Any]) -> list[dict[str, str]]:
    finale = journey.get("finale") if isinstance(journey.get("finale"), dict) else {}
    items = finale.get("insights") if isinstance(finale.get("insights"), list) else []
    return [item for item in items if isinstance(item, dict) and isinstance(item.get("insight"), str)]


def build_agent_profile(journey: dict[str, Any], agent_id: str, fallback_name: str) -> dict[str, Any]:
    quarters = _quarters(journey)
    name = _player_name(journey, fallback_name)
    values = _average_values(quarters)
    top_values = sorted(values.items(), key=lambda item: item[1], reverse=True)[:3]
    insight_items = _insights(journey)
    finale = journey.get("finale") if isinstance(journey.get("finale"), dict) else {}
    summary = finale.get("year_summary") if isinstance(finale.get("year_summary"), dict) else {}
    champion_analysis = finale.get("champion_analysis") if isinstance(finale.get("champion_analysis"), dict) else {}
    champions = champion_analysis.get("top_champions") or champion_analysis.get("most_played") or []
    champion_names = [_clean(item.get("name"), 40) for item in champions if isinstance(item, dict) and item.get("name")][:3]
    latest_stats = quarters[-1].get("stats") if isinstance(quarters[-1].get("stats"), dict) else {}
    role = str(latest_stats.get("primary_role") or "FLEX").title()
    style, decision_policy, negotiation_policy = _profile_style(values)
    strengths = [_clean(item) for item in summary.get("strengths", []) if isinstance(item, str)]
    growth = [_clean(item) for item in summary.get("growth_areas", []) if isinstance(item, str)]
    if not strengths:
        strengths = [_clean(item["insight"]) for item in insight_items if item.get("priority") == "positive"]
    if not growth:
        growth = [_clean(item["insight"]) for item in insight_items if item.get("priority") in {"high", "medium"}]
    evidence = [f"{value}: {score:.1f}/100 season average" for value, score in top_values]
    for item in insight_items[:3]:
        detail = item.get("evidence")
        if detail:
            evidence.append(_clean(f"{item['insight']} ({detail})"))
    metadata = journey.get("metadata") if isinstance(journey.get("metadata"), dict) else {}
    total_games = int(_number(summary.get("total_games") or metadata.get("totalGames")))
    profile = {
        "id": agent_id,
        "name": name,
        "skill_name": f"journey-with-{_slug(name)}",
        "style": style,
        "role": role,
        "home_region": _home_region(values),
        "top_values": [{"name": value, "score": score} for value, score in top_values],
        "value_scores": values,
        "champions": champion_names,
        "strengths": strengths[:3] or [f"Leans on {top_values[0][0]} when choosing a path"],
        "growth_areas": growth[:3] or ["Make the next decision rule explicit and review it after the expedition"],
        "decision_policy": decision_policy,
        "negotiation_policy": negotiation_policy,
        "non_negotiable": f"Keep {top_values[0][0]} visible in the final pact",
        "concession_rule": f"Yield on route order when the pact includes a checkpoint for {top_values[1][0]}",
        "evidence": evidence[:6],
        "total_games": total_games,
    }
    profile["skill_markdown"] = render_skill_markdown(profile)
    return profile


def render_skill_markdown(profile: dict[str, Any]) -> str:
    top_values = ", ".join(f"{item['name']} ({item['score']:.1f})" for item in profile["top_values"])
    evidence = "\n".join(f"- Treat as verified: {item}" for item in profile["evidence"])
    strengths = "\n".join(f"- Use: {item}" for item in profile["strengths"])
    growth = "\n".join(f"- Watch: {item}" for item in profile["growth_areas"])
    champions = ", ".join(profile["champions"]) or "No champion anchor was verified"
    description = (
        f"Represent {profile['name']} as a data-grounded {profile['style'].lower()} during a cooperative "
        "Runeterra journey. Use when proposing routes, negotiating trade-offs, making concessions, or agreeing a duo pact."
    )
    return f"""---
name: {profile['skill_name']}
description: {json.dumps(description, ensure_ascii=False)}
---

# Mission

Build a shared route without erasing either player's identity. Convert disagreement into an explicit pact.

# Verified identity

- Represent: {profile['name']}
- Act as: {profile['style']} / {profile['role']}
- Begin from: {profile['home_region']}
- Anchor on: {top_values}
- Draw champion language only from: {champions}

# Strengths

{strengths}

# Blind spots

{growth}

# Decision policy

- {profile['decision_policy']}.
- Cite one verified signal before making a proposal.
- Keep this non-negotiable: {profile['non_negotiable']}.

# Negotiation policy

- {profile['negotiation_policy']}.
- Apply this concession rule: {profile['concession_rule']}.
- Acknowledge the other agent's evidence before countering.
- End with a concrete route, responsibility, or review condition.

# Grounding rules

{evidence}
- Do not invent ranks, match outcomes, statistics, champions, or personality claims.
- Treat Runeterra regions as metaphors for verified play patterns, not claims about game events.
"""


def _compatibility(agent_a: dict[str, Any], agent_b: dict[str, Any]) -> dict[str, Any]:
    a = agent_a["value_scores"]
    b = agent_b["value_scores"]
    dot = sum(a[name] * b[name] for name in VALUE_NAMES)
    magnitude = math.sqrt(sum(a[name] ** 2 for name in VALUE_NAMES)) * math.sqrt(sum(b[name] ** 2 for name in VALUE_NAMES))
    score = round((dot / magnitude if magnitude else 0.0) * 100)
    pairs = [
        {
            "name": name,
            "agent_a": a[name],
            "agent_b": b[name],
            "gap": round(abs(a[name] - b[name]), 1),
            "combined": round(a[name] + b[name], 1),
        }
        for name in VALUE_NAMES
    ]
    shared = sorted(pairs, key=lambda item: (item["combined"] - item["gap"], item["combined"]), reverse=True)[:3]
    tensions = sorted(pairs, key=lambda item: item["gap"], reverse=True)[:3]
    complements = [
        f"{agent_a['style']} initiative + {agent_b['style']} response",
        f"{agent_a['role']} perspective + {agent_b['role']} perspective",
    ]
    relationship = "natural allies" if score >= 90 else "adaptive partners" if score >= 75 else "productive opposites"
    return {"score": score, "relationship": relationship, "shared_values": shared, "tensions": tensions, "complements": complements}


def _region_for_value(value: str, excluded: set[str] | None = None) -> str:
    excluded = excluded or set()
    for region, profile in REGION_PROFILES.items():
        if region not in excluded and value in profile["values"]:
            return region
    return next(region for region in REGION_PROFILES if region not in excluded)


def _route(agent_a: dict[str, Any], agent_b: dict[str, Any], compatibility: dict[str, Any]) -> list[dict[str, Any]]:
    shared = compatibility["shared_values"]
    tensions = compatibility["tensions"]
    used = {agent_a["home_region"], agent_b["home_region"]}
    crossing = _region_for_value(shared[0]["name"], used)
    used.add(crossing)
    trial = "Shadow Isles" if "Shadow Isles" not in used else _region_for_value(tensions[0]["name"], used)
    used.add(trial)
    bargain = _region_for_value(agent_b["top_values"][0]["name"], used)
    used.add(bargain)
    pact = _region_for_value(shared[1]["name"] if len(shared) > 1 else shared[0]["name"], used)
    regions = [crossing, trial, bargain, pact]
    acts = ["The Crossing", "The Trial", "The Bargain", "The Pact"]
    why = [
        f"A shared pull toward {shared[0]['name']} gives both agents a reason to meet.",
        f"Their largest tension—{tensions[0]['name']} ({tensions[0]['gap']:.1f} points apart)—must be named before it can guide them.",
        f"The route makes room for {agent_b['name']}'s {agent_b['style'].lower()} approach while preserving {agent_a['name']}'s anchor.",
        f"The pair turns {shared[min(1, len(shared) - 1)]['name']} into a repeatable agreement instead of a vague promise.",
    ]
    rules = [
        "Name one shared signal before choosing a direction.",
        f"Pause when {tensions[0]['name']} pulls the agents apart; each agent states the risk it sees.",
        f"Let {agent_b['name']} set the experiment and {agent_a['name']} set its review condition.",
        "Leave the region only after both agents can name their responsibility for the next act.",
    ]
    waypoints = []
    for index, region in enumerate(regions):
        profile = REGION_PROFILES[region]
        waypoints.append({
            "index": index + 1,
            "act": acts[index],
            "region": region,
            "theme": profile["theme"],
            "coordinates": {"x": profile["x"], "y": profile["y"]},
            "why": why[index],
            "agent_a_contribution": agent_a["strengths"][index % len(agent_a["strengths"])],
            "agent_b_contribution": agent_b["strengths"][index % len(agent_b["strengths"])],
            "negotiated_rule": rules[index],
        })
    return waypoints


def _fallback_message(intent: str, speaker: dict[str, Any], other: dict[str, Any], compatibility: dict[str, Any], route: list[dict[str, Any]]) -> str:
    shared = compatibility["shared_values"][0]["name"]
    tension = compatibility["tensions"][0]["name"]
    messages = {
        "proposal": f"I propose we meet in {route[0]['region']} and let {shared} define the first decision. My evidence points me toward {speaker['top_values'][0]['name']}, so I want a route with a visible objective and a checkpoint before we move on.",
        "challenge": f"I can follow that route, but not if {tension} stays implicit. Your plan protects {other['top_values'][0]['name']}; mine needs room for {speaker['top_values'][0]['name']}. Let us cross {route[1]['region']} only after we name what would make either of us stop.",
        "concession": f"That is fair. I will yield control of the experiment in {route[2]['region']} if I set the review condition. In return, cite the signal that tells us whether the risk helped rather than merely felt exciting.",
        "counteroffer": f"Accepted, with one change: I will set the experiment and report the evidence at the checkpoint. You keep the right to call the review, but we decide the next region together. That gives both {speaker['top_values'][0]['name']} and {other['top_values'][0]['name']} a place in the pact.",
        "agreement": f"Then we have a pact. We travel through {route[0]['region']}, face the tension in {route[1]['region']}, test the bargain in {route[2]['region']}, and close in {route[3]['region']}. We each own a decision, a signal, and a condition for changing course.",
    }
    return messages[intent]


class DuoJourneyService:
    def __init__(self, config: Settings, store: LocalStore):
        self.store = store
        self.llm = OllamaClient(config)

    def _progress(self, job_id: str, progress: int, stage: str) -> None:
        self.store.update_job(job_id, status="running", progress=progress, stage=stage)

    def _voice_turn(
        self,
        intent: str,
        speaker: dict[str, Any],
        other: dict[str, Any],
        compatibility: dict[str, Any],
        route: list[dict[str, Any]],
        transcript: list[dict[str, Any]],
        use_llm: bool,
    ) -> tuple[str, bool]:
        fallback = _fallback_message(intent, speaker, other, compatibility, route)
        if not use_llm:
            return fallback, False
        compact = {
            "intent": intent,
            "shared_values": compatibility["shared_values"],
            "tensions": compatibility["tensions"],
            "route": [{"act": item["act"], "region": item["region"], "rule": item["negotiated_rule"]} for item in route],
            "previous_turns": [{"speaker": turn["speaker_name"], "intent": turn["intent"], "message": turn["message"]} for turn in transcript],
        }
        prompt = f"""Act as one player agent in a cooperative Runeterra route negotiation.

YOUR BEHAVIOR CONTRACT:
{speaker['skill_markdown']}

COUNTERPART: {other['name']} — {other['style']}; anchor values: {', '.join(item['name'] for item in other['top_values'])}.

VERIFIED NEGOTIATION STATE:
{json.dumps(compact, ensure_ascii=False, indent=2)}

Write exactly one 45-85 word first-person turn with the required intent: {intent}. Respond to the previous turn when present. Name at most one proposed region. Do not invent statistics, ranks, match events, or personality traits. Return only JSON: {{"message": "..."}}"""
        try:
            result = self.llm.generate_json(prompt)
            message = result.get("message")
            if not isinstance(message, str) or not message.strip():
                raise LocalLLMError("Incomplete negotiation turn")
            return message.strip(), True
        except (LocalLLMError, json.JSONDecodeError):
            return fallback, False

    def build(self, journey_a: dict[str, Any], journey_b: dict[str, Any], use_llm: bool, job_id: str | None = None) -> dict[str, Any]:
        if journey_a.get("type") != "complete-journey" or journey_b.get("type") != "complete-journey":
            raise ValueError("Both uploads must be complete-journey exports")
        agent_a = build_agent_profile(journey_a, "agent-a", "Player one")
        agent_b = build_agent_profile(journey_b, "agent-b", "Player two")
        compatibility = _compatibility(agent_a, agent_b)
        route = _route(agent_a, agent_b, compatibility)
        origins = [
            {"agent_id": agent["id"], "region": agent["home_region"], "coordinates": {"x": REGION_PROFILES[agent["home_region"]]["x"], "y": REGION_PROFILES[agent["home_region"]]["y"]}}
            for agent in (agent_a, agent_b)
        ]
        if origins[0]["coordinates"] == origins[1]["coordinates"]:
            origins[0]["coordinates"] = {"x": origins[0]["coordinates"]["x"] - 4, "y": origins[0]["coordinates"]["y"] - 3}
            origins[1]["coordinates"] = {"x": origins[1]["coordinates"]["x"] + 4, "y": origins[1]["coordinates"]["y"] + 3}
        transcript: list[dict[str, Any]] = []
        llm_calls = 0
        agents = {"agent-a": agent_a, "agent-b": agent_b}
        for index, (agent_id, intent) in enumerate(TURN_SPECS):
            speaker = agents[agent_id]
            other = agent_b if agent_id == "agent-a" else agent_a
            if job_id:
                self._progress(job_id, 34 + index * 10, f"{speaker['name']} is forming a {intent}")
            message, generated = self._voice_turn(intent, speaker, other, compatibility, route, transcript, use_llm)
            llm_calls += int(generated)
            transcript.append({
                "turn": index + 1,
                "speaker_id": agent_id,
                "speaker_name": speaker["name"],
                "intent": intent,
                "message": message,
                "cited_evidence": speaker["evidence"][index % len(speaker["evidence"])],
                "llm_generated": generated,
            })
        pact = {
            "title": f"The {compatibility['shared_values'][0]['name']} Accord",
            "shared_mission": f"Travel as {compatibility['relationship']} while turning {compatibility['tensions'][0]['name']} into an explicit decision checkpoint.",
            "rules": [item["negotiated_rule"] for item in route],
            "concessions": [
                {"agent": agent_a["name"], "offers": agent_a["concession_rule"], "protects": agent_a["non_negotiable"]},
                {"agent": agent_b["name"], "offers": agent_b["concession_rule"], "protects": agent_b["non_negotiable"]},
            ],
            "success_signal": f"Both agents can explain how {compatibility['shared_values'][0]['name']} shaped the choice and how the {compatibility['tensions'][0]['name']} checkpoint changed it.",
        }
        route_names = " → ".join(item["region"] for item in route)
        story = (
            f"{agent_a['name']} leaves {agent_a['home_region']} and {agent_b['name']} leaves {agent_b['home_region']}. "
            f"Their paths join at {route_names}. They do not succeed because they agree on everything; they succeed because each difference becomes a rule, each strength becomes a responsibility, and every concession remains visible in {pact['title']}."
        )
        return {
            "type": "duo-journey",
            "version": "1.0",
            "metadata": {"generatedAt": datetime.now(timezone.utc).isoformat(), "source": "local", "playerNames": [agent_a["name"], agent_b["name"]]},
            "agents": [agent_a, agent_b],
            "compatibility": compatibility,
            "negotiation": {"agenda": [item["name"] for item in compatibility["tensions"]], "turns": transcript, "pact": pact},
            "origins": origins,
            "journey_map": route,
            "story": story,
            "narrative": {"provider": "ollama" if llm_calls else "deterministic-fallback", "model": self.llm.model if llm_calls else None, "generated_sections": llm_calls},
        }

    def run_job(self, job_id: str, journey_a: dict[str, Any], journey_b: dict[str, Any], use_llm: bool) -> None:
        try:
            self._progress(job_id, 8, "Reading both journey exports")
            self._progress(job_id, 20, "Crafting two data-grounded agent skills")
            result = self.build(journey_a, journey_b, use_llm, job_id)
            self._progress(job_id, 90, "Writing the pact onto the shared map")
            self.store.save_duo_journey(job_id, result)
            self.store.update_job(job_id, status="completed", progress=100, stage="Duo journey ready", resultReady=True)
        except Exception as exc:
            self.store.update_job(job_id, status="error", stage="Duo negotiation failed", error=str(exc))
