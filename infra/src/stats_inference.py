# src/stats_inference.py
from __future__ import annotations
import math
from statistics import mean
from typing import Dict, Any, List, Tuple

# =========================
# Robust helpers
# =========================
def _is_num(x: Any) -> bool:
    return isinstance(x, (int, float)) and math.isfinite(x)

def _num(x: Any, default: float = 0.0) -> float:
    return float(x) if _is_num(x) else default

def _get(d: dict, key: str, default=0.0):
    return d.get(key, default)

def _getc(d: dict, key: str, default=0.0):
    ch = d.get("challenges") or {}
    return ch.get(key, default)

def _mins(p: dict) -> float:
    """
    Robust minutes:
    - Prefer challenges.gameLength if present (always in seconds from Riot API).
    - Fallback to participant.timePlayed (seconds).
    - Clamp to >= 1.0 to avoid division by zero.
    """
    gl = _getc(p, "gameLength", 0.0)
    if _is_num(gl) and gl > 0:
        m = gl / 60.0  # gameLength is always in seconds
    else:
        m = _num(_get(p, "timePlayed", 0.0)) / 60.0
    return max(1.0, float(m) if _is_num(m) else 1.0)

def _per_min(val: Any, mins: float) -> float:
    return _num(val) / max(1.0, mins)

def _bool01(v: Any) -> float:
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if _is_num(v):
        return 1.0 if v > 0 else 0.0
    return 0.0

def _clip(x: float, lo: float, hi: float) -> float:
    if x < lo: return lo
    if x > hi: return hi
    return x

# =========================
# Bundle mappers (sanitized)
# =========================
PING_KEYS = [
    'allInPings','assistMePings','dangerPings','enemyMissingPings','enemyVisionPings',
    'getBackPings','holdPings','needVisionPings','onMyWayPings','pushPings',
    'retreatPings','visionClearedPings'
]

def power_mapping(p: dict) -> dict:
    m = _mins(p)
    out = {}
    # pings and ping rates
    ping_counts = {k: _num(_get(p, k, 0)) for k in PING_KEYS}
    out["pings"] = ping_counts
    out["pingsPerMin"] = {k: _per_min(v, m) for k, v in ping_counts.items()}
    # gold
    out["goldEarnedperMin"] = _per_min(_get(p, "goldEarned", 0), m)
    out["goldSpentperMin"]  = _per_min(_get(p, "goldSpent", 0),  m)
    # damage
    for k in [
        'magicDamageDealt','magicDamageDealtToChampions','magicDamageTaken',
        'physicalDamageDealt','physicalDamageDealtToChampions','physicalDamageTaken'
    ]:
        out[k] = _num(_get(p, k, 0))
    # mitigation surfaced for other bundles
    out["damageSelfMitigated"] = _num(_get(p, "damageSelfMitigated", 0))
    return out

def achievement_mapping(p: dict) -> dict:
    out = {}
    for k in [
        'firstTowerAssist','firstTowerKill','firstBloodAssist','firstBloodKill',
        'damageSelfMitigated','doubleKills'
    ]:
        out[k] = _num(_get(p, k, 0))
    tdp = _num(_getc(p, "teamDamagePercentage", 0.0))
    deaths = _num(_get(p, "deaths", 0.0))
    out["highDamagePerDeath"] = _bool01((deaths == 0 and tdp > 0.10) or (deaths and (tdp / max(1.0, deaths) > 0.05)))
    out["highkda"]            = _bool01(_getc(p, "kda", 0.0) > 15.0)
    out["lane"]               = str(_get(p, "lane", ""))
    if out["lane"] == "JUNGLE":
        for k in ['riftHeraldTakedowns','epicMonsterKillsNearEnemyJungler','epicMonsterKillsWithin30SecondsOfSpawn','soloBaronKills','teamBaronKills']:
            out[k] = _num(_getc(p, k, 0))
    # early snapshot
    out["earlyStats"] = {
        "earlyCSperMin": _num(_getc(p, 'laneMinionsFirst10Minutes', 0.0)) / 10.0,
        "earlyLaningPhaseGoldExpAdvantage": _num(_getc(p, 'earlyLaningPhaseGoldExpAdvantage', 0.0)),
        "takedownsFirstXMinutes": _num(_getc(p, 'takedownsFirstXMinutes', 0.0)),
        "turretPlatesTaken": _num(_getc(p, 'turretPlatesTaken', 0.0)),
        "kTurretsDestroyedBeforePlatesFall": _num(_getc(p, 'kTurretsDestroyedBeforePlatesFall', 0.0)),
        "landSkillShotsEarlyGame": _num(_getc(p, 'landSkillShotsEarlyGame', 0.0)),
    }
    for k in [
        'dodgeSkillShotsSmallWindow','acesBefore15Minutes','quickCleanse','quickFirstTurret','quickSoloKills',
        'skillshotsDodged','skillshotsHit','fullTeamTakedown','killingSprees','riftHeraldTakedowns',
        'killParticipation','multiKillOneSpell','deathsByEnemyChamps','maxCsAdvantageOnLaneOpponent',
        'maxLevelLeadLaneOpponent','teamDamagePercentage','soloKills'
    ]:
        out[k] = _num(_getc(p, k, 0))
    return out

def hedonism_mapping(p: dict) -> dict:
    out = {}
    for k in ['takedownsInEnemyFountain','alliedJungleMonsterKills','twentyMinionsIn3SecondsCount','blastConeOppositeOpponentCount']:
        out[k] = _num(_getc(p, k, 0))
    return out

def stimulation_mapping(p: dict) -> dict:
    out = {}
    for k in ['deaths','damageSelfMitigated']:
        out[k] = _num(_get(p, k, 0))
    for k in ['bountyGold','buffsStolen','elderDragonKillsWithOpposingSoul','junglerTakedownsNearDamagedEpicMonster',
              'epicMonsterKillsNearEnemyJungler','epicMonsterSteals','killsNearEnemyTurret',
              'survivedSingleDigitHpCount','survivedThreeImmobilizesInFight']:
        out[k] = _num(_getc(p, k, 0))
    return out

def self_direction_mapping(p: dict) -> dict:
    m = _mins(p)
    out = {
        "championName": str(_get(p, "championName", "Unknown")),
        "championId":   int(_get(p, "championId", 0)),
        "goldEarnedperMin": _per_min(_get(p, "goldEarned", 0), m),
        "goldSpentperMin":  _per_min(_get(p, "goldSpent", 0),  m),
    }
    for k in ['killAfterHiddenWithAlly','knockEnemyIntoTeamAndKill','killsWithHelpFromEpicMonster','legendaryItemUsed',
              'multiTurretRiftHeraldCount','takedownsAfterGainingLevelAdvantage','takedownsInAlcove','soloKills','unseenRecalls']:
        out[k] = _num(_getc(p, k, 0))
    return out

def benevolence_mapping(p: dict) -> dict:
    out = {}
    for k in ['deaths','damageDealtToBuildings','damageDealtToEpicMonsters','damageDealtToObjectives','damageDealtToTurrets']:
        out[k] = _num(_get(p, k, 0))
    for k in ['controlWardsPlaced','damageTakenOnTeamPercentage','teamDamagePercentage','dragonTakedowns','killParticipation',
              'teamBaronKills','teamElderDragonKills','teamRiftHeraldKills','takedowns','enemyChampionImmobilizations',
              'immobilizeAndKillWithAlly','pickKillWithAlly','stealthWardsPlaced','twoWardsOneSweeperCount']:
        out[k] = _num(_getc(p, k, 0))
    return out

def tradition_mapping(p: dict) -> dict:
    m = _mins(p)
    out = {
        "longestTimeSpentLiving": _num(_get(p, "longestTimeSpentLiving", 0)),
        "totalTimeSpentDead":    _num(_get(p, "totalTimeSpentDead", 0)),
        "perfectGame":           _bool01(_getc(p, "perfectGame", False)),
        "gameLength":            _num(_getc(p, "gameLength", 0)),
    }
    total_cs = _num(_get(p, 'totalAllyJungleMinionsKilled', 0)) + _num(_get(p, 'totalEnemyJungleMinionsKilled', 0)) + _num(_get(p, 'totalMinionsKilled', 0))
    out["csPerMin"]      = _per_min(total_cs, m)
    out["csPerMinPre10"] = _num(_getc(p, 'laneMinionsFirst10Minutes', 0.0)) / 10.0
    return out

def conformity_mapping(p: dict) -> dict:
    # Placeholder for future rules; keep stable shape.
    return {}

def security_mapping(p: dict) -> dict:
    out = {}
    for k in ['deaths','damageSelfMitigated','longestTimeSpentLiving','consumablesPurchased']:
        out[k] = _num(_get(p, k, 0))
    for k in ['deathsByEnemyChamps','hadOpenNexus','lostAnInhibitor','killsUnderOwnTurret','scuttleCrabKills',
              'visionScoreAdvantageLaneOpponent','visionScorePerMinute','wardTakedowns','wardsGuarded']:
        out[k] = _num(_getc(p, k, 0))
    return out

def universalism_mapping(p: dict) -> dict:
    return {
        "lane": str(_get(p, 'lane', "")),
        "championId": int(_get(p, 'championId', 0))
    }

def bundles_from_participant(p: dict) -> dict:
    return {
        "power": power_mapping(p),
        "achiev": achievement_mapping(p),
        "hed": hedonism_mapping(p),
        "stim": stimulation_mapping(p),
        "selfD": self_direction_mapping(p),
        "bene": benevolence_mapping(p),
        "trad": tradition_mapping(p),
        "conf": conformity_mapping(p),
        "secs": security_mapping(p),
        "univ": universalism_mapping(p),
        "role": p.get("teamPosition") or p.get("individualPosition") or "UNKNOWN",
    }

# =========================
# Value scoring
# =========================
WEIGHTS: Dict[str, List[Tuple[str, float]]] = {
    "Power": [
        ("power.goldEarnedperMin", 1.0),
        ("power.magicDamageDealtToChampions", 0.5),
        ("power.physicalDamageDealtToChampions", 0.5),
        ("power.damageSelfMitigated", 0.2),
    ],
    "Achievement": [
        ("achiev.firstBloodKill", 0.8),
        ("achiev.killingSprees", 0.6),
        ("achiev.teamDamagePercentage", 0.8),
        ("achiev.highkda", 0.6),
    ],
    "Hedonism": [
        ("hed.takedownsInEnemyFountain", 1.0),
        ("hed.twentyMinionsIn3SecondsCount", 0.5),
        ("hed.blastConeOppositeOpponentCount", 0.3),
    ],
    "Stimulation": [
        ("stim.bountyGold", 0.6),
        ("stim.epicMonsterSteals", 0.8),
        ("stim.killsNearEnemyTurret", 0.5),
        ("stim.deaths", 0.2),
    ],
    "Self-Direction": [
        ("selfD.soloKills", 0.8),
        ("selfD.knockEnemyIntoTeamAndKill", 0.5),
        ("selfD.goldSpentperMin", 0.3),
    ],
    "Benevolence": [
        ("bene.killParticipation", 1.0),
        ("secs.visionScorePerMinute", 0.8),
        ("secs.wardTakedowns", 0.5),
        ("bene.controlWardsPlaced", 0.5),
        ("bene.immobilizeAndKillWithAlly", 0.5),
    ],
    "Tradition": [
        ("trad.csPerMin", 0.8),
        ("trad.csPerMinPre10", 0.8),
        ("secs.longestTimeSpentLiving", 0.2),
    ],
    "Conformity": [
        ("bene.stealthWardsPlaced", 0.3),
        ("secs.wardsGuarded", 0.3),
        ("secs.deaths", -0.6),
    ],
    "Security": [
        ("secs.visionScorePerMinute", 0.8),
        ("secs.wardTakedowns", 0.5),
        ("secs.damageSelfMitigated", 0.4),
        ("secs.killsUnderOwnTurret", 0.3),
    ],
    "Universalism": []  # diversity bonus injected per quarter
}

def _path_get(bundles: dict, dotted: str) -> float:
    b, k = dotted.split(".", 1)
    v = bundles.get(b, {}).get(k, 0.0)
    if isinstance(v, (int, float)): 
        return float(v)
    return _bool01(v)

def score_values(bundles_list: List[dict]) -> List[Dict[str, float]]:
    out: List[Dict[str, float]] = []
    for b in bundles_list:
        scores = {}
        for name, feats in WEIGHTS.items():
            s = 0.0
            for path, w in feats:
                s += float(w) * _path_get(b, path)
            # mild clipping to resist giant outliers before z-score
            scores[name] = _clip(s, -1e9, 1e9)
        out.append(scores)
    return out

def _z(xs: List[float]) -> List[float]:
    n = len(xs)
    if n == 0: return []
    mu = sum(xs) / n
    var = sum((x - mu) ** 2 for x in xs) / n
    sd = math.sqrt(var) or 1.0
    return [(x - mu) / sd for x in xs]

def zscore_rows(rows: List[Dict[str, float]]) -> List[Dict[str, float]]:
    if not rows: return []
    keys = sorted({k for r in rows for k in r})
    cols = {k: [float(r.get(k, 0.0)) for r in rows] for k in keys}
    zs = {k: _z(vals) for k, vals in cols.items()}
    out = []
    for i in range(len(rows)):
        out.append({k: zs[k][i] for k in keys})
    return out

def aggregate_mean(vecs: List[Dict[str, float]]) -> Dict[str, float]:
    if not vecs: return {}
    keys = sorted({k for v in vecs for k in v})
    return {k: sum(v.get(k, 0.0) for v in vecs) / len(vecs) for k in keys}

def universalism_bonus(participant_bundles: List[dict]) -> float:
    champs = [str(b.get("univ", {}).get("championId", "")) for b in participant_bundles]
    lanes  = [str(b.get("univ", {}).get("lane", "")) for b in participant_bundles]
    cd = len(set(champs)) / max(1, len(champs))
    ld = len(set(lanes))  / max(1, len(lanes))
    return 0.5 * cd + 0.5 * ld

# =========================
# Chapter-level stats
# =========================
def chapter_stats(participant_bundles: List[dict]) -> dict:
    if not participant_bundles:
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
    deaths = [_num(_get(b.get("bene", {}), "deaths", _get(b.get("secs", {}), "deaths", 0.0))) for b in participant_bundles]
    tdowns = [_num(_get(b.get("bene", {}), "takedowns", 0.0)) for b in participant_bundles]
    kda = (sum(tdowns) / max(1.0, sum(deaths)))
    cs_pm = [_num(_get(b.get("trad", {}), "csPerMin", 0.0)) for b in participant_bundles]
    gpm   = [_num(_get(b.get("power", {}), "goldEarnedperMin", 0.0)) for b in participant_bundles]
    vspm  = [_num(_get(b.get("secs", {}), "visionScorePerMinute", 0.0)) for b in participant_bundles]
    
    # Role-specific stats
    obj_dmg = [_num(_get(b.get("bene", {}), "damageDealtToObjectives", 0.0)) for b in participant_bundles]
    kp = [_num(_get(b.get("bene", {}), "killParticipation", 0.0)) for b in participant_bundles]
    control_wards = [_num(_get(b.get("bene", {}), "controlWardsPlaced", 0.0)) for b in participant_bundles]
    
    # Calculate per-minute objective damage
    game_lengths = [_num(_get(b.get("trad", {}), "gameLength", 1800.0)) / 60.0 for b in participant_bundles]
    obj_dmg_per_min = [dmg / max(1.0, length) for dmg, length in zip(obj_dmg, game_lengths)]
    
    # aggregate ping rate: sum of all ping types per minute
    pr_all = []
    for b in participant_bundles:
        pr = b.get("power", {}).get("pingsPerMin", {}) or {}
        pr_all.append(sum(_num(v, 0.0) for v in pr.values()))
    
    # Find most played role
    from collections import Counter
    roles = [b.get("role", "UNKNOWN") for b in participant_bundles]
    role_counts = Counter(roles)
    primary_role = role_counts.most_common(1)[0][0] if role_counts else "UNKNOWN"
    
    _avg = lambda xs: (mean(xs) if xs else 0.0)
    return {
        "games": len(participant_bundles),
        "kda_proxy": kda,
        "cs_per_min": _avg(cs_pm),
        "gold_per_min": _avg(gpm),
        "vision_score_per_min": _avg(vspm),
        "ping_rate_per_min": _avg(pr_all),
        "primary_role": primary_role,
        "obj_damage_per_min": _avg(obj_dmg_per_min),
        "kill_participation": _avg(kp) * 100,  # Convert to percentage
        "control_wards_per_game": _avg(control_wards)
    }
