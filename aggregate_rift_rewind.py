#!/usr/bin/env python3
"""
Rift Rewind - Offline aggregator + story-prep (archetype TONE ONLY)

- Values/regions/stats logic unchanged.
- Archetype affects ONLY the LLM's storytelling tone (voice, diction, metaphors).
- Continuity: each chapter prompt gets prior chapter summary.

Usage:
python aggregate_rift_rewind.py \
  --data-dir ./data/json_matches \
  --out ./story.json \
  --player-name "SummonerName#TAG" \
  --archetype warrior \
  --ollama-model "llama3.1"
"""
import os, json, glob, time, argparse, statistics, re, datetime as dt
from typing import Dict, Any, List, Optional, Tuple

# ---------------------------
# Value recipe (unchanged)
# ---------------------------
RECIPE = {
    "Power": {"features": [
        ["power","goldEarnedperMin",1.0],
        ["power","magicDamageDealtToChampions",0.5],
        ["power","physicalDamageDealtToChampions",0.5],
        ["stim","damageSelfMitigated",0.2],
    ]},
    "Achievement": {"features": [
        ["achiev","firstBloodKill",0.8],
        ["achiev","killingSprees",0.6],
        ["achiev","teamDamagePercentage",0.8],
        ["achiev","highkda",0.6],
    ]},
    "Hedonism": {"features": [
        ["hed","takedownsInEnemyFountain",1.0],
        ["hed","twentyMinionsIn3SecondsCount",0.5],
        ["hed","blastConeOppositeOpponentCount",0.3],
    ]},
    "Stimulation": {"features": [
        ["stim","bountyGold",0.6],
        ["stim","epicMonsterSteals",0.8],
        ["stim","killsNearEnemyTurret",0.5],
        ["stim","deaths",0.2],
    ]},
    "Self-Direction": {"features": [
        ["selfD","soloKills",0.8],
        ["selfD","knockEnemyIntoTeamAndKill",0.5],
        ["selfD","goldSpentperMin",0.3],
        ["selfD","legendaryItemUsed",0.3,"len"],
    ]},
    "Benevolence": {"features": [
        ["bene","killParticipation",1.0],
        ["secs","visionScorePerMinute",0.8],
        ["secs","wardTakedowns",0.5],
        ["bene","controlWardsPlaced",0.5],
        ["bene","immobilizeAndKillWithAlly",0.5],
    ]},
    "Tradition": {"features": [
        ["trad","csPerMin",0.8],
        ["trad","csPerMinPre10",0.8],
        ["secs","longestTimeSpentLiving",0.2],
    ]},
    "Conformity": {"features": [
        ["secs","deaths",-0.6],
        ["bene","stealthWardsPlaced",0.3],
        ["secs","wardsGuarded",0.3],
    ]},
    "Security": {"features": [
        ["secs","visionScorePerMinute",0.8],
        ["secs","wardTakedowns",0.5],
        ["secs","damageSelfMitigated",0.4],
        ["secs","killsUnderOwnTurret",0.3],
    ]},
    "Universalism": {
        "features": [["univ","championId",0.0]],
        "diversity_bonus": True
    },
}


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

def map_value_to_region(value_name: str) -> str:
    return REGION_ARC_MAP.get(value_name, f"Arc of {value_name}")

def choose_region_arc(chapter_idx: int,
                      curr_values: Dict[str, float],
                      prev_values: Optional[Dict[str, float]]) -> Optional[str]:
    if not curr_values:
        return None

    # Chapter 1: dominant current value
    if chapter_idx == 1:
        top = max(curr_values.items(), key=lambda kv: kv[1])[0]
        return map_value_to_region(top)

    # Need deltas for 2/3
    deltas = {k: curr_values.get(k, 0.0) - (prev_values or {}).get(k, 0.0)
              for k in set(curr_values.keys()).union(prev_values.keys() if prev_values else [])}

    if chapter_idx == 2:
        # biggest absolute change
        val = max(deltas.items(), key=lambda kv: abs(kv[1]))[0]
        return map_value_to_region(val)
    if chapter_idx == 3:
        # biggest negative change (challenge)
        val = min(deltas.items(), key=lambda kv: kv[1])[0]
        return map_value_to_region(val)
    # Chapter 4: back to dominant value (resolution/mastery)
    top = max(curr_values.items(), key=lambda kv: kv[1])[0]
    return map_value_to_region(top)

# ---------------------------
# Archetype tone profiles (TONE ONLY)
# ---------------------------
ARCHETYPE_TONE: Dict[str, Dict[str, Any]] = {
    "warrior": {
        "voice": "Bold, honorable, trial-by-fire cadence.",
        "diction": ["steel", "banner", "trial", "vanguard", "glory", "oath"],
        "metaphors": ["tower as bastion", "objective as siege", "roam as charge"],
        "cadence": "Short, declarative sentences with rising momentum."
    },
    "strategist": {
        "voice": "Calm, analytical, methodical; emphasizes information and timing.",
        "diction": ["angle", "tempo", "priority", "window", "setup", "conversion"],
        "metaphors": ["map as ledger", "vision as currency", "fight as equation"],
        "cadence": "Measured clauses, precise conclusions."
    },
    "guardian": {
        "voice": "Protective, grounded, empathetic; focuses on anchors and shields.",
        "diction": ["bulwark", "harbor", "sanctuary", "warding", "keep", "line"],
        "metaphors": ["tower as lighthouse", "peel as embrace", "macro as weather"],
        "cadence": "Warm, steady rhythm; reassuring closure."
    },
    "assassin": {
        "voice": "Quiet, sharp, surgical; danger in restraint.",
        "diction": ["veil", "edge", "shadow", "breach", "silence", "mark"],
        "metaphors": ["brush as curtain", "pick as incision", "reset as breath"],
        "cadence": "Tight lines, sudden pivots."
    },
    "mage": {
        "voice": "Curious, mystical, pattern-seeking; space and tempo as spells.",
        "diction": ["arcane", "weave", "resonance", "ritual", "focus", "sigil"],
        "metaphors": ["wave as tide", "combo as incantation", "zone as circle"],
        "cadence": "Lyrical but concise; two vivid images per paragraph."
    },
    "explorer": {
        "voice": "Adventurous, playful, discovery-led; celebrates experiment.",
        "diction": ["trail", "map", "spark", "find", "camp", "track"],
        "metaphors": ["build as toolkit", "pathing as trail", "skirmish as campfire tale"],
        "cadence": "Light, forward-leaning; end with a wink of curiosity."
    },
}

# ---------------------------
# Utils
# ---------------------------
def read_json(path: str) -> Optional[dict]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

def list_json_files(data_dir: str) -> List[str]:
    return sorted(glob.glob(os.path.join(data_dir, "*.json")))

def ensure_ms(ts: int) -> int:
    return ts*1000 if ts < 10_000_000_000 else ts

def safe_get(d, *keys, default=0.0):
    cur = d
    for k in keys:
        if cur is None:
            return default
        cur = cur.get(k)
    return default if cur is None else cur

def compute_raw_value_scores(match: dict, recipe: dict) -> Dict[str, float]:
    out = {}
    for name, cfg in recipe.items():
        s = 0.0
        for feat in cfg.get("features", []):
            bundle, key, w = feat[0], feat[1], float(feat[2])
            how = feat[3] if len(feat) > 3 else None
            src = match.get(bundle, {}) or {}
            if how == "len":
                v = float(len(src.get(key, []) or []))
            else:
                v = float(src.get(key, 0.0) or 0.0)
            s += w * v
        out[name] = s
    return out

def zscore_series(xs: List[float]) -> List[float]:
    if not xs: return []
    if len(xs) == 1: return [0.0]
    mean = sum(xs)/len(xs)
    var = sum((x-mean)**2 for x in xs)/len(xs)
    sd = (var ** 0.5) or 1.0
    return [(x - mean) / sd for x in xs]

def add_universalism_diversity(matches: List[dict], values_per_match: List[Dict[str,float]]):
    champs = [str(safe_get(m, "selfD", "championId", default=0)) for m in matches]
    lanes  = [str(safe_get(m, "univ", "lane", default="")) for m in matches]
    champ_div = len(set(champs)) / max(1, len(champs))
    lane_div  = len(set(lanes)) / max(1, len(lanes))
    bonus = 0.5*champ_div + 0.5*lane_div
    for v in values_per_match:
        v["Universalism"] = v.get("Universalism", 0.0) + bonus

def aggregate(vecs: List[Dict[str,float]]) -> Dict[str,float]:
    if not vecs: return {}
    keys = sorted({k for v in vecs for k in v.keys()})
    sums = {k: 0.0 for k in keys}
    for v in vecs:
        for k in keys:
            sums[k] += v.get(k, 0.0)
    n = len(vecs) or 1
    return {k: (sums[k]/n) for k in keys}

def split_into_chapters(matches_sorted: List[dict]) -> List[Tuple[int,int]]:
    n = len(matches_sorted)
    if n == 0:
        return [(0,0)]*4
    q = max(1, n // 4)
    return [(0,min(n,q)), (min(n,q),min(n,2*q)), (min(n,2*q),min(n,3*q)), (min(n,3*q),n)]

def summarize_champs(matches: List[dict], top_k: int=3) -> List[dict]:
    from collections import Counter
    cnt, agg = Counter(), {}
    for m in matches:
        name = safe_get(m, "selfD", "championName", default="Unknown")
        cnt[name] += 1
        agg.setdefault(name, {"games": 0, "takedowns": 0.0, "deaths": 0.0})
        agg[name]["games"] += 1
        agg[name]["takedowns"] += float(safe_get(m, "bene", "takedowns", default=0.0))
        d = float(safe_get(m, "bene", "deaths", default=safe_get(m, "secs", "deaths", default=0.0)))
        agg[name]["deaths"] += d
    out = []
    for name, games in cnt.most_common(top_k):
        td = agg[name]["takedowns"]; dd = max(1.0, agg[name]["deaths"])
        out.append({"name": name, "games": games, "kda_proxy": round(td/dd, 2)})
    return out

def topk(d: Dict[str,float], k:int=3) -> List[Tuple[str,float]]:
    return sorted(d.items(), key=lambda kv: kv[1], reverse=True)[:k]

# ---- Robust JSON extractor for messy LLM outputs ----
# ---- Robust JSON extractor for messy LLM outputs ----
import re, json

_CODE_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.S | re.I)
_FIRST_OBJECT = re.compile(r"\{.*?\}", re.S)  # non-greedy now

def _brace_scan_first_object(s: str) -> str | None:
    """Return the first balanced { ... } object ignoring braces in strings."""
    depth = 0
    in_str = False
    esc = False
    start = None
    for i, ch in enumerate(s):
        if in_str:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                return s[start:i+1]
    return None

def extract_json_from_text(text: str) -> dict | None:
    if not text:
        return None
    # 1) direct
    try:
        return json.loads(text)
    except Exception:
        pass
    # 2) code-fence
    m = _CODE_FENCE.search(text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # 3) balanced-brace scan
    cand = _brace_scan_first_object(text)
    if cand:
        try:
            return json.loads(cand)
        except Exception:
            pass
    # 4) try with smart quotes normalized
    squote = text.replace("“", '"').replace("”", '"').replace("’", "'")
    cand2 = _brace_scan_first_object(squote)
    if cand2:
        try:
            return json.loads(cand2)
        except Exception:
            pass
    return None

# ---------------------------
# Chapter stats and previous vs current comparison
# ---------------------------
def _safe_div(a: float, b: float) -> float:
    return (a / b) if (b and b != 0) else 0.0

def compute_chapter_stats(matches: List[dict]) -> Dict[str, float]:
    import statistics as S
    if not matches:
        return {"games": 0, "kda_proxy": 0.0, "cs_per_min": 0.0, "cs_per_min_pre10": 0.0,
                "gold_per_min": 0.0, "vision_score_per_min": 0.0, "ward_takedowns": 0.0,
                "dmg_mitigated": 0.0, "kill_participation": 0.0}

    deaths = [float(m.get("bene",{}).get("deaths", m.get("secs",{}).get("deaths",0))) for m in matches]
    takedowns = [float(m.get("bene",{}).get("takedowns",0)) for m in matches]
    kda_proxy = _safe_div(sum(takedowns), max(1.0, sum(deaths)))

    def _avg(seq): return S.mean(seq) if seq else 0.0

    cs_pm   = [float(m.get("trad",{}).get("csPerMin",0.0)) for m in matches]
    cs_pm10 = [float(m.get("trad",{}).get("csPerMinPre10",0.0)) for m in matches]
    gpm     = [float(m.get("power",{}).get("goldEarnedperMin",0.0)) for m in matches]
    vspm    = [float(m.get("secs",{}).get("visionScorePerMinute",0.0)) for m in matches]
    wtk     = [float(m.get("secs",{}).get("wardTakedowns",0.0)) for m in matches]
    dmgm    = [float(m.get("secs",{}).get("damageSelfMitigated",0.0)) for m in matches]
    kp      = [float(m.get("bene",{}).get("killParticipation",0.0)) for m in matches]

    return {
        "games": len(matches),
        "kda_proxy": kda_proxy,
        "cs_per_min": _avg(cs_pm),
        "cs_per_min_pre10": _avg(cs_pm10),
        "gold_per_min": _avg(gpm),
        "vision_score_per_min": _avg(vspm),
        "ward_takedowns": _avg(wtk),
        "dmg_mitigated": _avg(dmgm),
        "kill_participation": _avg(kp),
    }

def compare_chapter_stats(prev: Dict[str,float], curr: Dict[str,float]) -> Dict[str, Any]:
    def pct(a, d):
        return (d / a * 100.0) if a not in (0, 0.0, None) else (100.0 if d > 0 else (-100.0 if d < 0 else 0.0))

    keys = sorted(set(prev.keys()) & set(curr.keys()))
    metrics = {}
    for k in keys:
        d = curr[k] - prev[k]
        metrics[k] = {
            "prev": prev[k],
            "curr": curr[k],
            "delta": d,
            "pct": pct(prev[k], d),
            "dir": "up" if d > 0 else ("down" if d < 0 else "flat"),
        }

    priority = [
        "kda_proxy","kill_participation","vision_score_per_min",
        "cs_per_min","cs_per_min_pre10","gold_per_min","ward_takedowns","dmg_mitigated"
    ]
    scored = [(k, abs(metrics[k]["pct"])) for k in priority if k in metrics]
    scored.sort(key=lambda t: t[1], reverse=True)
    signals = []
    for k,_ in scored[:3]:
        dword = {"up":"increased", "down":"decreased", "flat":"held steady"}[metrics[k]["dir"]]
        signals.append(f"{k.replace('_',' ')} {dword} ({metrics[k]['pct']:+.1f}%)")

    return {"metrics": metrics, "signals": signals}


# ---------------------------
# LLM Calls
# ---------------------------
def call_ollama(prompt: str, model: str) -> Optional[str]:
    if not model: return None
    try:
        import requests
        r = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": model, "prompt": prompt, "stream": False, "think": False, "temperature": 0.85},
            timeout=90
        )
        if r.ok:
            return (r.json().get("response") or "").strip()
    except Exception:
        return None
    return None

# ---------------------------
# Tone-only prompts
# ---------------------------
def make_lore_prompt(
    player_name: str,
    chap_idx: int,
    matches: List[dict],
    values: Dict[str,float],
    top_champs: List[dict],
    archetype: str,
    previous_lore_summary: str,
    comparison: None,
    region_arc: str
) -> str:
    def ts(ms):
        return "Unknown" if not ms else dt.datetime.utcfromtimestamp(ms/1000).strftime("%b %d, %Y")
    t0 = min([int(m.get("timestamp", 0)) for m in matches] or [0])
    t1 = max([int(m.get("timestamp", 0)) for m in matches] or [0])

    tone = ARCHETYPE_TONE.get(archetype, ARCHETYPE_TONE["explorer"])
    ordered = sorted(values.items(), key=lambda kv: kv[1], reverse=True)
    champ_str = ", ".join([f"{c['name']} (games {c['games']}, KDA~{c['kda_proxy']})" for c in top_champs]) or "—"

    payload = {
        "meta": {
            "chapter": chap_idx,
            "range": [ts(t0), ts(t1)],
            "player": player_name,
            "archetype": archetype,
            "region_arc": region_arc,
        },
        "style_profile": {
            "voice": tone["voice"],
            "diction": tone["diction"],
            "metaphors": tone["metaphors"],
            "cadence": tone["cadence"],
            "note": "Archetype changes TONE ONLY; do not change facts or stats."
        },
        "context": {
            "previous_lore_summary": previous_lore_summary or "",
            "top_values_ordered": [k for k,_ in ordered[:5]],
            "top_champions": top_champs,
            "value_vector": {k: round(float(v),3) for k,v in values.items()}
        },
       "instructions": {
        "task": """
            Write a 120–160 word in-universe Runeterra lore. 
            The lore should translate the value vector into story elements without explicitly mentioning the value names. 
            It should mention the player's journey through the region arc.
            Use the archetype tone profile for voice, diction, metaphors, and cadence.""",
        "continuity": "If previous_lore_summary is provided, explicitly connect to it in one line.",
        "metaphors": "Use exactly 2 short metaphors from 'metaphors'.",
        "ending": "End with one actionable maxim (1 sentence).",
        "output": "Return ONLY JSON with keys 'lore' (string). Avoid generating any extra text."
    }

    }
    payload["context"]["comparison"] = comparison or {}
    payload["instructions"]["narration_hint"] = "Weave 1–2 of the strongest 'comparison.signals' into the lore."
    return json.dumps(payload)

def make_finale_prompt(
    player_name: str,
    chapters: List[dict],
    overall: Dict[str,float],
    trajectories: Dict[str, dict],
    top_champs: List[dict],
    archetype: str,
    region_arc: str
) -> str:
    tone = ARCHETYPE_TONE.get(archetype, ARCHETYPE_TONE["explorer"])
    payload = {
        "meta": {"player": player_name, "chapters": len(chapters), "archetype": archetype, "region_arc": region_arc},
        "style_profile": tone,
        "chapters_summary": [
            {
                "index": ch["quarter"],
                "time_range": ch.get("time_range"),
                "top_values": [v for v,_ in ch.get("top_values",[])],
                "value_deltas": ch.get("value_deltas",{}),
                "top_champions": ch.get("top_champions",[]),
                "stats": ch.get("stats",{}),
                "lore_excerpt": (ch.get("lore","")[:160] if ch.get("lore") else "")
            } for ch in chapters
        ],
        "overall_values": {k: round(float(v),4) for k,v in overall.items()},
        "trajectories": trajectories,
        "top_champions_overall": top_champs,
        "instructions": {
            "task": """
                    Write the closing chapter (80–120 words) fusing lore and statistics.The lore should translate the value vector into story elements
                    without explicitly mentioning values or stats or metaphors. The lore should mention the journey through region,
                    information about the player's journey and growth.""",
            "must_include": [
                "Summarize the player journey across chapters and reach a conclusion to the journey.",
                "Highlight the most important value deltas and implications",
                "End with one concrete practice suggestion for the player to improve upon"
            ],
            "output": "Return ONLY JSON with keys 'final_lore' (string) and 'final_reflection' (string). No extra text."
        }
    }
    return json.dumps(payload)

# ---------------------------
# Trajectories
# ---------------------------
def compute_trajectories(chapters: List[dict]) -> Dict[str, dict]:
    if not chapters: return {}
    values_keys = sorted({k for ch in chapters for k in ch.get('values', {}).keys()})
    series = {k: [] for k in values_keys}
    for ch in chapters:
        for k in values_keys:
            series[k].append(float(ch.get('values', {}).get(k, 0.0)))
    trajectories = {}
    for k, vals in series.items():
        deltas = [vals[i]-vals[i-1] for i in range(1, len(vals))]
        trajectories[k] = {"series": vals, "deltas": deltas}
    return trajectories

# ---------------------------
# Main
# ---------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--player-name", default="Player#TAG")
    ap.add_argument("--archetype", default="explorer",
                    choices=["warrior","strategist","guardian","assassin","mage","explorer"])
    ap.add_argument("--ollama-model", default=None)
    args = ap.parse_args()

    files = list_json_files(args.data_dir)
    matches = [m for m in (read_json(p) for p in files) if m]

    for m in matches:
        if "timestamp" in m:
            m["timestamp"] = ensure_ms(int(m["timestamp"]))
    matches.sort(key=lambda x: x.get("timestamp", 0))

    if not matches:
        out = {"meta": {"player": args.player_name, "archetype": args.archetype, "files": files, "matches": 0},
               "overall": {}, "chapters": [], "finale": {}, "trajectories": {}}
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2)
        print(f"Wrote {args.out} (no matches found)")
        return

    # raw -> normalized
    raw_values = [compute_raw_value_scores(m, RECIPE) for m in matches]
    if RECIPE["Universalism"].get("diversity_bonus"):
        add_universalism_diversity(matches, raw_values)
    keys = sorted({k for v in raw_values for k in v.keys()})
    by_key = {k: [vv.get(k, 0.0) for vv in raw_values] for k in keys}
    z_by_key = {k: zscore_series(vs) for k,vs in by_key.items()}
    norm_values = [{k: z_by_key[k][i] for k in keys} for i in range(len(raw_values))]

    # chapters
    def cuts(ms):  # 4 equal-ish slices
        n = len(ms); q = max(1, n//4)
        return [(0,min(n,q)), (min(n,q),min(n,2*q)), (min(n,2*q),min(n,3*q)), (min(n,3*q),n)]
    ranges = cuts(matches)

    chapters = []
    prev_summary = ""
    prev_values = None
    summary_history: List[str] = []

    for idx,(a,b) in enumerate(ranges, start=1):
        ms = matches[a:b]; vs = norm_values[a:b]
        v_agg = aggregate(vs)
        champs = summarize_champs(ms, top_k=3)
        top_vals = topk(v_agg, 4)
        chapter_stats = compute_chapter_stats(ms)
        comparison = None
        if chapters and chapters[-1].get("stats"):
            comparison = compare_chapter_stats(chapters[-1]["stats"], chapter_stats)
        # Deltras vs previous
        if prev_values is not None:
            deltas = {k: round(float(v_agg.get(k,0.0) - prev_values.get(k,0.0)), 4)
                      for k in set(v_agg.keys()).union(prev_values.keys())}
        else:
            deltas = {k: 0.0 for k in v_agg.keys()}
        region_arc = choose_region_arc(idx, v_agg, prev_values)
        # LLM lore prompt (tone-only)
        lore_prompt = make_lore_prompt(args.player_name, idx, ms, v_agg, champs, args.archetype, previous_lore_summary=prev_summary, comparison=comparison, region_arc=region_arc)
        print(f"Chapter {idx} prompt:", lore_prompt)
        raw = call_ollama(lore_prompt, args.ollama_model) if args.ollama_model else None
        # print(f"Chapter {idx} raw:", raw)
        lore_text, reflections_list = None, None
        if raw:
            maybe = extract_json_from_text(raw)
            if maybe and isinstance(maybe, dict):
                # chap_summary = maybe.get("summary") or ""
                # if chap_summary:
                # summary_history.append(chap_summary)
                lore_text = maybe.get("lore")
                # reflections_list = maybe.get("reflections")
            prev_summary = "Chapter {} summary: ".format(idx) + lore_text[:300] if lore_text else prev_summary

        # If LLM didn’t comply, fallback to tiny neutral reflection generator
        if not reflections_list:
            reflections_list = []

        # time range
        if ms:
            t0 = min(int(m.get("timestamp", 0)) for m in ms)
            t1 = max(int(m.get("timestamp", 0)) for m in ms)
        else:
            t0=t1=0
        
        chapters.append({
            "quarter": idx,
            "time_range": [t0, t1],
            "values": v_agg,
            "top_values": top_vals,
            "top_champions": champs,
            "general_stats": {
                "games": len(ms),
                "avg_deaths": (statistics.mean([float(m.get("bene",{}).get("deaths", m.get("secs",{}).get("deaths",0))) for m in ms]) if ms else 0.0),
                "avg_takedowns": (statistics.mean([float(m.get("bene",{}).get("takedowns", 0)) for m in ms]) if ms else 0.0),
            },
            "extensive_stats": chapter_stats,
            "lore_prompt": lore_prompt,
            "lore": lore_text,
            # "reflections": reflections_list,
            "value_deltas": deltas,
            "region_arc": region_arc,
        })

        prev_values = v_agg
        prev_summary = (lore_text or prev_summary)[:300]

    trajectories = compute_trajectories(chapters)
    overall = aggregate(norm_values)
    overall_top = topk(overall, 5)
    top_champs_overall = summarize_champs(matches, top_k=5)

    finale_prompt = make_finale_prompt(
        args.player_name, chapters, overall, trajectories, top_champs_overall, args.archetype, region_arc
    )
    finale_raw = call_ollama(finale_prompt, args.ollama_model) if args.ollama_model else None
    print("final raw", finale_raw)
    finale_lore, final_reflection = None, None
    if finale_raw:
        maybe = extract_json_from_text(finale_raw)
        if isinstance(maybe, dict):
            finale_lore = maybe.get("final_lore") or maybe.get("lore")
            final_reflection = maybe.get("final_reflection") or maybe.get("reflection")

    if not final_reflection:
        final_reflection = ()

    out = {
        "meta": {
            "player": args.player_name,
            "archetype": args.archetype, 
            "matches": len(matches),
            "generated_at": int(time.time()),
        },
        "overall": {
            "values": overall,
            "top_values": overall_top,
            "top_champions": top_champs_overall,
        },
        "chapters": chapters,
        "trajectories": trajectories,
        "finale": {
            "prompt": finale_prompt,
            "lore": finale_lore,
            "final_reflection": final_reflection,
        },
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {args.out} with {len(matches)} matches.")
    if args.ollama_model:
        print("Ollama used:", args.ollama_model)
    else:
        print("No Ollama model specified; prompts included for later.")

if __name__ == "__main__":
    main()
