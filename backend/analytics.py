from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Any, Iterable, Sequence


VALUE_NAMES = (
    "Power",
    "Achievement",
    "Hedonism",
    "Stimulation",
    "Self-Direction",
    "Benevolence",
    "Tradition",
    "Conformity",
    "Security",
    "Universalism",
)

REGION_PROFILES: dict[str, dict[str, Any]] = {
    "Noxus": {"values": ("Power", "Achievement"), "theme": "ambition, pressure, and earned strength", "x": 18, "y": 67},
    "Demacia": {"values": ("Conformity", "Benevolence"), "theme": "discipline, duty, and protection", "x": 28, "y": 37},
    "Freljord": {"values": ("Tradition", "Security"), "theme": "endurance through an unforgiving trial", "x": 39, "y": 15},
    "Piltover": {"values": ("Achievement", "Self-Direction"), "theme": "precision, invention, and refinement", "x": 50, "y": 48},
    "Zaun": {"values": ("Stimulation", "Hedonism"), "theme": "risk, adaptation, and volatile experiments", "x": 52, "y": 61},
    "Ionia": {"values": ("Self-Direction", "Tradition"), "theme": "balance, mastery, and an independent path", "x": 76, "y": 42},
    "Bilgewater": {"values": ("Hedonism", "Stimulation"), "theme": "bold gambles and opportunistic fights", "x": 68, "y": 74},
    "Shurima": {"values": ("Security", "Achievement"), "theme": "rebuilding, control, and a return to greatness", "x": 48, "y": 83},
    "Targon": {"values": ("Universalism", "Benevolence"), "theme": "perspective, service, and ascent", "x": 34, "y": 78},
    "Shadow Isles": {"values": (), "theme": "loss, uncertainty, and the lesson hidden inside defeat", "x": 82, "y": 68},
}


def _number(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return default


def _nested(source: dict[str, Any], *path: str, default: Any = 0.0) -> Any:
    current: Any = source
    for key in path:
        if not isinstance(current, dict):
            return default
        current = current.get(key, default)
    return current


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _scale(value: float, low: float, high: float) -> float:
    if high <= low:
        return 0.0
    return _clamp((value - low) * 100.0 / (high - low))


def _average(values: Iterable[float]) -> float:
    prepared = list(values)
    return mean(prepared) if prepared else 0.0


def _date(timestamp_ms: int) -> str:
    if not timestamp_ms:
        return "Unknown"
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).strftime("%b %d, %Y")


@dataclass(slots=True)
class GameSnapshot:
    match_id: str
    timestamp_ms: int
    duration_min: float
    win: bool
    champion: str
    role: str
    kills: float
    deaths: float
    assists: float
    kda: float
    cs_per_min: float
    early_cs_per_min: float
    gold_per_min: float
    vision_per_min: float
    kill_participation: float
    damage_per_min: float
    damage_taken_per_min: float
    objective_damage_per_min: float
    control_wards: float
    wards_placed: float
    wards_killed: float
    solo_kills: float
    first_blood: float
    multikills: float
    objective_steals: float
    crowd_control: float
    pings_per_min: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _infer_role(role: str, cs_per_min: float, vision_per_min: float) -> str:
    role = (role or "UNKNOWN").upper()
    if role in {"UTILITY", "SUPPORT"}:
        return "SUPPORT"
    if role == "BOTTOM" and cs_per_min < 2.5 and vision_per_min > 1.1:
        return "SUPPORT"
    return {"MIDDLE": "MID", "BOTTOM": "ADC"}.get(role, role)


def snapshot_from_preprocessed(match: dict[str, Any]) -> GameSnapshot:
    power = match.get("power") or {}
    achievement = match.get("achiev") or {}
    tradition = match.get("trad") or {}
    security = match.get("secs") or {}
    benevolence = match.get("bene") or {}
    stimulation = match.get("stim") or {}
    self_direction = match.get("selfD") or {}

    duration_seconds = _number(match.get("gameDuration") or tradition.get("gameLength"), 1800.0)
    duration_min = max(1.0, duration_seconds / 60.0)
    damage = _number(power.get("totalDamageDealtToChampions"))
    if not damage:
        damage = _number(power.get("magicDamageDealtToChampions")) + _number(power.get("physicalDamageDealtToChampions"))
    taken = _number(power.get("magicDamageTaken")) + _number(power.get("physicalDamageTaken"))
    kills = _number(tradition.get("kills"))
    deaths = _number(tradition.get("deaths"), _number(security.get("deaths")))
    assists = _number(tradition.get("assists"))
    takedowns = _number(benevolence.get("takedowns"), kills + assists)
    kda = _number(tradition.get("kda"), takedowns / max(1.0, deaths))
    cs_per_min = _number(tradition.get("csPerMin"))
    vision_per_min = _number(security.get("visionScorePerMinute"))
    lane = str(achievement.get("lane") or (match.get("role") or "UNKNOWN"))
    ping_rates = power.get("pingsPerMin") or {}

    return GameSnapshot(
        match_id=str(match.get("matchID") or match.get("matchId") or "unknown"),
        timestamp_ms=int(_number(match.get("timestamp"))),
        duration_min=duration_min,
        win=bool(match.get("win", False)),
        champion=str(self_direction.get("championName") or "Unknown"),
        role=_infer_role(lane, cs_per_min, vision_per_min),
        kills=kills,
        deaths=deaths,
        assists=assists,
        kda=kda,
        cs_per_min=cs_per_min,
        early_cs_per_min=_number(_nested(achievement, "earlyStats", "earlyCSperMin"), _number(tradition.get("csPerMinPre10"))),
        gold_per_min=_number(power.get("goldEarnedperMin"), _number(self_direction.get("goldEarnedperMin"))),
        vision_per_min=vision_per_min,
        kill_participation=_number(benevolence.get("killParticipation"), _number(achievement.get("killParticipation"))),
        damage_per_min=damage / duration_min,
        damage_taken_per_min=taken / duration_min,
        objective_damage_per_min=_number(benevolence.get("damageDealtToObjectives")) / duration_min,
        control_wards=_number(benevolence.get("controlWardsPlaced")),
        wards_placed=_number(benevolence.get("stealthWardsPlaced")),
        wards_killed=_number(security.get("wardTakedowns")),
        solo_kills=_number(self_direction.get("soloKills"), _number(achievement.get("soloKills"))),
        first_blood=_number(achievement.get("firstBloodKill")),
        multikills=_number(achievement.get("doubleKills")) + _number(achievement.get("killingSprees")) * 0.25,
        objective_steals=_number(stimulation.get("epicMonsterSteals")),
        crowd_control=_number(benevolence.get("enemyChampionImmobilizations")),
        pings_per_min=sum(_number(value) for value in ping_rates.values()),
    )


def snapshot_from_riot_match(match: dict[str, Any], puuid: str) -> GameSnapshot:
    info = match.get("info") or {}
    participant = next((item for item in info.get("participants", []) if item.get("puuid") == puuid), None)
    if participant is None:
        raise ValueError("The requested player was not present in this match")
    challenges = participant.get("challenges") or {}
    duration_seconds = _number(challenges.get("gameLength"), _number(info.get("gameDuration"), 1800.0))
    duration_min = max(1.0, duration_seconds / 60.0)
    cs = (
        _number(participant.get("totalMinionsKilled"))
        + _number(participant.get("neutralMinionsKilled"))
        + _number(participant.get("totalAllyJungleMinionsKilled"))
        + _number(participant.get("totalEnemyJungleMinionsKilled"))
    )
    kills = _number(participant.get("kills"))
    deaths = _number(participant.get("deaths"))
    assists = _number(participant.get("assists"))
    vision = _number(challenges.get("visionScorePerMinute"), _number(participant.get("visionScore")) / duration_min)
    role = str(participant.get("teamPosition") or participant.get("individualPosition") or participant.get("lane") or "UNKNOWN")
    ping_keys = [key for key in participant if key.endswith("Pings")]

    return GameSnapshot(
        match_id=str(_nested(match, "metadata", "matchId", default="unknown")),
        timestamp_ms=int(_number(info.get("gameCreation"))),
        duration_min=duration_min,
        win=bool(participant.get("win", False)),
        champion=str(participant.get("championName") or "Unknown"),
        role=_infer_role(role, cs / duration_min, vision),
        kills=kills,
        deaths=deaths,
        assists=assists,
        kda=_number(challenges.get("kda"), (kills + assists) / max(1.0, deaths)),
        cs_per_min=cs / duration_min,
        early_cs_per_min=_number(challenges.get("laneMinionsFirst10Minutes")) / 10.0,
        gold_per_min=_number(participant.get("goldEarned")) / duration_min,
        vision_per_min=vision,
        kill_participation=_number(challenges.get("killParticipation")),
        damage_per_min=_number(participant.get("totalDamageDealtToChampions")) / duration_min,
        damage_taken_per_min=_number(participant.get("totalDamageTaken")) / duration_min,
        objective_damage_per_min=_number(participant.get("damageDealtToObjectives")) / duration_min,
        control_wards=_number(challenges.get("controlWardsPlaced"), _number(participant.get("visionWardsBoughtInGame"))),
        wards_placed=_number(participant.get("wardsPlaced")),
        wards_killed=_number(participant.get("wardsKilled")),
        solo_kills=_number(challenges.get("soloKills")),
        first_blood=float(bool(participant.get("firstBloodKill"))),
        multikills=_number(participant.get("doubleKills")) + _number(participant.get("tripleKills")) * 2 + _number(participant.get("quadraKills")) * 3 + _number(participant.get("pentaKills")) * 5,
        objective_steals=_number(challenges.get("epicMonsterSteals")),
        crowd_control=_number(challenges.get("enemyChampionImmobilizations"), _number(participant.get("timeCCingOthers"))),
        pings_per_min=sum(_number(participant.get(key)) for key in ping_keys) / duration_min,
    )


def snapshots_from_payload(matches: Sequence[dict[str, Any]], puuid: str | None = None) -> list[GameSnapshot]:
    snapshots: list[GameSnapshot] = []
    for match in matches:
        try:
            if {"match_id", "duration_min", "champion", "gold_per_min"}.issubset(match):
                snapshots.append(GameSnapshot(**{field: match.get(field) for field in GameSnapshot.__dataclass_fields__}))
            elif "info" in match and "metadata" in match:
                if not puuid:
                    raise ValueError("A PUUID is required for raw Riot match files")
                snapshots.append(snapshot_from_riot_match(match, puuid))
            else:
                snapshots.append(snapshot_from_preprocessed(match))
        except (TypeError, ValueError, KeyError):
            continue
    return sorted(snapshots, key=lambda item: item.timestamp_ms)


def divide_into_periods(snapshots: Sequence[GameSnapshot], count: int = 4) -> list[list[GameSnapshot]]:
    ordered = sorted(snapshots, key=lambda item: item.timestamp_ms)
    if len(ordered) < count:
        raise ValueError(f"At least {count} valid matches are required to build a journey")
    base, remainder = divmod(len(ordered), count)
    periods: list[list[GameSnapshot]] = []
    cursor = 0
    for index in range(count):
        size = base + (1 if index < remainder else 0)
        periods.append(ordered[cursor:cursor + size])
        cursor += size
    return periods


def _role_consistency(games: Sequence[GameSnapshot]) -> float:
    counts = Counter(game.role for game in games)
    return counts.most_common(1)[0][1] / len(games) if games else 0.0


def _champion_consistency(games: Sequence[GameSnapshot]) -> float:
    counts = Counter(game.champion for game in games)
    return counts.most_common(1)[0][1] / len(games) if games else 0.0


def calculate_values(games: Sequence[GameSnapshot]) -> dict[str, float]:
    if not games:
        return {name: 0.0 for name in VALUE_NAMES}
    avg = lambda field: _average(getattr(game, field) for game in games)
    champion_diversity = len({game.champion for game in games}) / min(10, len(games))
    role_diversity = len({game.role for game in games}) / min(4, len(games))
    role_consistency = _role_consistency(games)
    champion_consistency = _champion_consistency(games)
    win_rate = _average(float(game.win) for game in games)
    death_stability = 100.0 - _scale(avg("deaths"), 3.0, 9.0)
    cs_values = [game.cs_per_min for game in games]
    cs_consistency = 100.0 - _clamp((pstdev(cs_values) if len(cs_values) > 1 else 0.0) * 18.0)

    values = {
        "Power": 0.35 * _scale(avg("gold_per_min"), 250, 500) + 0.45 * _scale(avg("damage_per_min"), 200, 900) + 0.20 * _scale(avg("kills"), 1, 10),
        "Achievement": 0.30 * _scale(avg("kda"), 1.0, 5.0) + 0.25 * win_rate * 100 + 0.25 * _scale(avg("kills"), 1, 10) + 0.20 * _scale(avg("first_blood") + avg("multikills") * 0.25, 0, 1.5),
        "Hedonism": 0.35 * _scale(avg("kills") + avg("assists") * 0.35, 3, 14) + 0.30 * _scale(avg("damage_per_min"), 250, 850) + 0.20 * _scale(avg("deaths"), 2, 9) + 0.15 * _scale(avg("multikills"), 0, 2),
        "Stimulation": 0.30 * champion_diversity * 100 + 0.20 * role_diversity * 100 + 0.25 * _scale(avg("solo_kills") + avg("objective_steals"), 0, 2) + 0.25 * _scale(avg("pings_per_min"), 0.5, 4.0),
        "Self-Direction": 0.35 * _scale(avg("cs_per_min"), 1, 8) + 0.20 * _scale(avg("early_cs_per_min"), 1, 8) + 0.25 * _scale(avg("solo_kills"), 0, 2) + 0.20 * _scale(avg("gold_per_min"), 250, 500),
        "Benevolence": 0.30 * _scale(avg("kill_participation"), 0.35, 0.75) + 0.25 * _scale(avg("assists"), 3, 15) + 0.20 * _scale(avg("vision_per_min"), 0.5, 2.5) + 0.15 * _scale(avg("crowd_control"), 0, 20) + 0.10 * _scale(avg("control_wards"), 0, 4),
        "Tradition": 0.30 * champion_consistency * 100 + 0.25 * role_consistency * 100 + 0.25 * cs_consistency + 0.20 * death_stability,
        "Conformity": 0.30 * role_consistency * 100 + 0.30 * _scale(avg("kill_participation"), 0.35, 0.75) + 0.20 * _scale(avg("wards_placed") + avg("wards_killed"), 3, 25) + 0.20 * death_stability,
        "Security": 0.35 * _scale(avg("vision_per_min"), 0.4, 2.5) + 0.20 * _scale(avg("control_wards"), 0, 4) + 0.20 * _scale(avg("wards_killed"), 0, 8) + 0.25 * death_stability,
        "Universalism": 0.30 * champion_diversity * 100 + 0.20 * role_diversity * 100 + 0.25 * _scale(avg("objective_damage_per_min"), 20, 300) + 0.25 * _scale(avg("vision_per_min"), 0.4, 2.3),
    }
    return {name: round(_clamp(score), 1) for name, score in values.items()}


def _champion_summary(games: Sequence[GameSnapshot]) -> list[dict[str, Any]]:
    grouped: dict[str, list[GameSnapshot]] = defaultdict(list)
    for game in games:
        grouped[game.champion].append(game)
    result = []
    for champion, champion_games in grouped.items():
        result.append({
            "name": champion,
            "games": len(champion_games),
            "win_rate": round(_average(float(game.win) for game in champion_games) * 100, 1),
            "avg_kda": round(_average(game.kda for game in champion_games), 2),
        })
    return sorted(result, key=lambda item: (-item["games"], -item["win_rate"], item["name"]))


def _value_evidence(value: str, stats: dict[str, Any]) -> str:
    templates = {
        "Power": f"{stats['gold_per_min']:.0f} gold/min and {stats['damage_per_min']:.0f} champion damage/min",
        "Achievement": f"{stats['win_rate']:.0f}% win rate with a {stats['kda_proxy']:.2f} KDA",
        "Hedonism": f"{stats['kills_per_game']:.1f} kills and {stats['deaths_per_game']:.1f} deaths per game",
        "Stimulation": f"{stats['unique_champions']} champions used across {stats['games']} games",
        "Self-Direction": f"{stats['cs_per_min']:.1f} CS/min and {stats['solo_kills']} solo kills",
        "Benevolence": f"{stats['kill_participation']:.0f}% kill participation and {stats['assists_per_game']:.1f} assists/game",
        "Tradition": f"{stats['primary_role_share']:.0f}% of games in the primary role",
        "Conformity": f"{stats['kill_participation']:.0f}% team kill participation with {stats['vision_score_per_min']:.2f} vision/min",
        "Security": f"{stats['vision_score_per_min']:.2f} vision/min and {stats['control_wards_per_game']:.1f} control wards/game",
        "Universalism": f"{stats['unique_champions']} champions and {stats['objective_damage_per_min']:.0f} objective damage/min",
    }
    return templates[value]


def analyze_period(games: Sequence[GameSnapshot], label: str) -> dict[str, Any]:
    avg = lambda field: _average(getattr(game, field) for game in games)
    wins = sum(1 for game in games if game.win)
    roles = Counter(game.role for game in games)
    primary_role, primary_count = roles.most_common(1)[0]
    champions = _champion_summary(games)
    values = calculate_values(games)
    top_values = sorted(values.items(), key=lambda item: item[1], reverse=True)[:3]
    stats = {
        "games": len(games),
        "wins": wins,
        "win_rate": round(wins * 100 / len(games), 1),
        "kda_proxy": round(_average(game.kda for game in games), 2),
        "kills_per_game": round(avg("kills"), 2),
        "deaths_per_game": round(avg("deaths"), 2),
        "assists_per_game": round(avg("assists"), 2),
        "cs_per_min": round(avg("cs_per_min"), 2),
        "gold_per_min": round(avg("gold_per_min"), 1),
        "vision_score_per_min": round(avg("vision_per_min"), 2),
        "damage_per_min": round(avg("damage_per_min"), 1),
        "objective_damage_per_min": round(avg("objective_damage_per_min"), 1),
        "kill_participation": round(avg("kill_participation") * 100, 1),
        "control_wards_per_game": round(avg("control_wards"), 2),
        "primary_role": primary_role,
        "primary_role_share": round(primary_count * 100 / len(games), 1),
        "unique_champions": len(champions),
        "solo_kills": int(sum(game.solo_kills for game in games)),
    }
    best = max(games, key=lambda game: game.kda)
    return {
        "quarter": label,
        "date_range": f"{_date(games[0].timestamp_ms)} – {_date(games[-1].timestamp_ms)}",
        "values": values,
        "top_values": [[name, score] for name, score in top_values],
        "evidence": [_value_evidence(name, stats) for name, _ in top_values],
        "stats": stats,
        "top_champions": champions[:3],
        "highlights": {
            "best_game": {"champion": best.champion, "kda": round(best.kda, 2), "won": best.win},
            "first_bloods": int(sum(game.first_blood for game in games)),
            "objective_steals": int(sum(game.objective_steals for game in games)),
        },
    }


def _trend(values: Sequence[float]) -> dict[str, Any]:
    start, end = values[0], values[-1]
    change = end - start
    pct = change * 100 / abs(start) if start else 0.0
    direction = "stable" if abs(pct) < 5 else ("improving" if change > 0 else "declining")
    return {
        "values": [round(value, 2) for value in values],
        "direction": direction,
        "change_pct": round(pct, 1),
        "best_quarter": f"Q{values.index(max(values)) + 1}",
    }


def build_trends(periods: Sequence[dict[str, Any]]) -> dict[str, Any]:
    keys = {
        "kda": "kda_proxy",
        "cs_per_min": "cs_per_min",
        "gold_per_min": "gold_per_min",
        "vision_score": "vision_score_per_min",
        "kill_participation": "kill_participation",
        "win_rate": "win_rate",
    }
    result = {name: _trend([_number(period["stats"][key]) for period in periods]) for name, key in keys.items()}
    improving = sum(item["direction"] == "improving" for item in result.values())
    declining = sum(item["direction"] == "declining" for item in result.values())
    result["overall"] = {
        "improving_metrics": improving,
        "declining_metrics": declining,
        "summary": "improving" if improving > declining else "declining" if declining > improving else "stable",
    }
    result["available"] = True
    return result


def _role_actions(role: str) -> dict[str, str]:
    if role == "SUPPORT":
        return {
            "vision": "Track control wards and aim to refresh vision one minute before major objectives.",
            "deaths": "Review deaths before objectives and preserve your engage or peel cooldown for the next fight.",
            "economy": "Use roam windows after crashing or resetting the bot wave instead of chasing farm targets.",
        }
    if role == "JUNGLE":
        return {
            "vision": "Place deeper vision after successful clears and convert lane priority into objective information.",
            "deaths": "Before invading, identify which adjacent lanes can move first and leave when priority disappears.",
            "economy": "Plan the next two camps before each gank so failed plays do not stall your gold curve.",
        }
    return {
        "vision": "Place vision on the side you intend to play toward before committing to the next wave.",
        "deaths": "Review each isolated death and define the missing information that should have stopped the play.",
        "economy": "Use a ten-minute practice block to improve last hits, then protect farm through safer wave states.",
    }


def build_insights(periods: Sequence[dict[str, Any]], all_games: Sequence[GameSnapshot], trends: dict[str, Any]) -> list[dict[str, str]]:
    latest = periods[-1]["stats"]
    role = latest["primary_role"]
    actions = _role_actions(role)
    insights: list[dict[str, str]] = []

    metric_labels = {
        "kda": "KDA",
        "vision_score": "vision score",
        "gold_per_min": "gold income",
        "kill_participation": "kill participation",
        "win_rate": "win rate",
    }
    ranked_changes = sorted(
        ((name, data) for name, data in trends.items() if name in metric_labels),
        key=lambda item: abs(_number(item[1].get("change_pct"))),
        reverse=True,
    )
    for name, data in ranked_changes[:2]:
        direction = data["direction"]
        if direction == "stable":
            continue
        positive = direction == "improving"
        insights.append({
            "category": "Progress",
            "priority": "positive" if positive else "high",
            "insight": f"{metric_labels[name]} {direction} by {abs(data['change_pct']):.1f}% from the first to final act.",
            "action": "Preserve the routines that created this gain and review one representative game from each act." if positive else actions["deaths" if name in {"kda", "win_rate"} else "economy"],
            "evidence": f"{data['values'][0]} in Q1 → {data['values'][-1]} in Q4",
        })

    if role == "SUPPORT":
        if latest["vision_score_per_min"] < 1.8:
            insights.append({"category": "Vision", "priority": "high", "insight": "Vision output is the clearest support growth opportunity.", "action": actions["vision"], "evidence": f"Q4 vision score: {latest['vision_score_per_min']:.2f}/min"})
        else:
            insights.append({"category": "Vision", "priority": "positive", "insight": "Vision remained a defining strength in the final act.", "action": "Keep the volume, then improve ward timing around objective spawn windows.", "evidence": f"Q4 vision score: {latest['vision_score_per_min']:.2f}/min"})
    elif latest["cs_per_min"] < 6.0:
        insights.append({"category": "Farming", "priority": "medium", "insight": "Farm is leaving reliable gold unclaimed in the final act.", "action": actions["economy"], "evidence": f"Q4 farm: {latest['cs_per_min']:.2f} CS/min"})

    champions = _champion_summary(all_games)
    main_share = champions[0]["games"] / len(all_games) if champions else 0.0
    if main_share >= 0.35:
        insights.append({"category": "Champion Mastery", "priority": "info", "insight": f"{champions[0]['name']} is the anchor of this season identity.", "action": "Keep the anchor pick and prepare two alternatives that cover its weakest drafts.", "evidence": f"{champions[0]['games']} of {len(all_games)} games ({main_share * 100:.0f}%)"})
    elif len(champions) > 15:
        insights.append({"category": "Champion Pool", "priority": "medium", "insight": "A wide champion pool created flexibility but diluted repeated practice.", "action": "Choose a three-champion core for the next block and measure results after twenty games.", "evidence": f"{len(champions)} unique champions across {len(all_games)} games"})

    value_changes = {
        name: periods[-1]["values"][name] - periods[0]["values"][name]
        for name in VALUE_NAMES
    }
    rising = max(value_changes, key=value_changes.get)
    falling = min(value_changes, key=value_changes.get)
    insights.append({
        "category": "Identity",
        "priority": "positive" if value_changes[rising] > 4 else "info",
        "insight": f"{rising} became the strongest developing trait across the journey.",
        "action": f"Lean into the behaviors behind {rising}, while checking that {falling} does not become a blind spot.",
        "evidence": f"{rising}: {periods[0]['values'][rising]:.1f} → {periods[-1]['values'][rising]:.1f}",
    })
    return insights[:6]


def _region_candidates(period: dict[str, Any]) -> list[str]:
    ranked_values = [name for name, _ in sorted(period["values"].items(), key=lambda item: item[1], reverse=True)]
    candidates: list[str] = []
    for value in ranked_values:
        for region, profile in REGION_PROFILES.items():
            if value in profile["values"] and region not in candidates:
                candidates.append(region)
    return candidates


def build_journey_map(periods: Sequence[dict[str, Any]], trends: dict[str, Any]) -> list[dict[str, Any]]:
    acts = ("The Calling", "The Ascent", "The Trial", "The Reckoning")
    used: set[str] = set()
    route: list[dict[str, Any]] = []
    for index, period in enumerate(periods):
        candidates = _region_candidates(period)
        trial_metric: tuple[str, float, float] | None = None
        if index == 2:
            negative_metrics = sum(
                1 for key in ("kda", "gold_per_min", "vision_score", "win_rate")
                if trends[key]["values"][2] < trends[key]["values"][1] * 0.92
            )
            if negative_metrics >= 2:
                candidates.insert(0, "Shadow Isles")
                metric_keys = {
                    "KDA": "kda_proxy",
                    "gold income": "gold_per_min",
                    "vision": "vision_score_per_min",
                    "win rate": "win_rate",
                }
                declines = [
                    (name, _number(periods[1]["stats"][key]), _number(period["stats"][key]))
                    for name, key in metric_keys.items()
                    if _number(period["stats"][key]) < _number(periods[1]["stats"][key])
                ]
                if declines:
                    trial_metric = min(declines, key=lambda item: (item[2] - item[1]) / max(abs(item[1]), 0.01))
        region = next((candidate for candidate in candidates if candidate not in used), candidates[0])
        used.add(region)
        profile = REGION_PROFILES[region]
        top_name, top_score = period["top_values"][0]
        if index == 0:
            trigger = f"The journey begins with {top_name} as the clearest instinct."
        elif trial_metric:
            metric, before, after = trial_metric
            trigger = f"{metric} fell from {before:.1f} to {after:.1f}, turning this act into the season's central trial."
        else:
            previous = periods[index - 1]
            deltas = {name: period["values"][name] - previous["values"][name] for name in VALUE_NAMES}
            changed = max(deltas, key=lambda name: abs(deltas[name]))
            verb = "rose" if deltas[changed] >= 0 else "fell"
            trigger = f"{changed} {verb} by {abs(deltas[changed]):.1f} points, changing the direction of the expedition."
        evidence = period["evidence"][:2]
        if trial_metric:
            evidence = [f"{trial_metric[0]}: {trial_metric[1]:.1f} in Q2 → {trial_metric[2]:.1f} in Q3", period["evidence"][0]]
        route.append({
            "quarter": period["quarter"],
            "act": acts[index],
            "region": region,
            "theme": profile["theme"],
            "coordinates": {"x": profile["x"], "y": profile["y"]},
            "trigger": trigger,
            "dominant_value": {"name": top_name, "score": top_score},
            "evidence": evidence,
        })
    return route


def build_season_analysis(snapshots: Sequence[GameSnapshot]) -> dict[str, Any]:
    periods = [analyze_period(games, f"Q{index + 1}") for index, games in enumerate(divide_into_periods(snapshots))]
    trends = build_trends(periods)
    insights = build_insights(periods, snapshots, trends)
    journey_map = build_journey_map(periods, trends)
    champions = _champion_summary(snapshots)
    best_game = max(snapshots, key=lambda game: game.kda)
    total_wins = sum(game.win for game in snapshots)
    achievements: list[str] = []
    first_bloods = int(sum(game.first_blood for game in snapshots))
    steals = int(sum(game.objective_steals for game in snapshots))
    perfect_games = sum(game.deaths == 0 for game in snapshots)
    if first_bloods:
        achievements.append(f"{first_bloods} first bloods")
    if steals:
        achievements.append(f"{steals} objective steals")
    if perfect_games:
        achievements.append(f"{perfect_games} deathless games")

    finale = {
        "total_games": len(snapshots),
        "trends": trends,
        "insights": insights,
        "journey_map": journey_map,
        "highlights": {
            "best_kda_game": {"champion": best_game.champion, "value": round(best_game.kda, 2), "won": best_game.win},
            "first_bloods": first_bloods,
            "objective_steals": steals,
            "perfect_games": perfect_games,
        },
        "champion_analysis": {
            "available": True,
            "total_unique_champions": len(champions),
            "most_played": champions[:5],
            "top_champions": champions[:5],
            "one_tricks": [champion for champion in champions if champion["games"] / len(snapshots) >= 0.30],
            "versatility_score": round(min(100.0, len(champions) / min(len(snapshots), 30) * 100), 1),
        },
        "year_summary": {
            "total_games": len(snapshots),
            "wins": total_wins,
            "win_rate": round(total_wins * 100 / len(snapshots), 1),
            "year_avg_kda": round(_average(game.kda for game in snapshots), 2),
            "year_avg_cs_per_min": round(_average(game.cs_per_min for game in snapshots), 2),
            "year_avg_vision_score": round(_average(game.vision_per_min for game in snapshots), 2),
            "total_unique_champions": len(champions),
            "most_played_champion": champions[0]["name"] if champions else "Unknown",
            "achievements": achievements,
            "strengths": [item["insight"] for item in insights if item["priority"] == "positive"],
            "growth_areas": [item["insight"] for item in insights if item["priority"] in {"high", "medium"}],
            "overall_trend": trends["overall"]["summary"],
            "best_quarter": max(periods, key=lambda period: period["stats"]["win_rate"] + period["stats"]["kda_proxy"] * 5)["quarter"],
        },
    }
    return {"periods": periods, "finale": finale}
