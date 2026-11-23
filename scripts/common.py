"""Shared loaders for the Chapter 4 analysis scripts.

All scripts read the local Firestore export in data/export/ and only use the
study cohort (participant codes P-xxxx). Results written to results/ contain
participant codes only, never names, usernames, emails or Firebase user IDs.
"""
import json
from datetime import datetime, timezone, timedelta
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPORT = ROOT / "data" / "export"
RESULTS = ROOT / "results"
RESULTS.mkdir(exist_ok=True)
PH = timezone(timedelta(hours=8))  # Asia/Manila


@lru_cache(maxsize=None)
def load(name):
    with open(EXPORT / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def study_participants():
    """Study-cohort participants, sorted by code, each joined to its user doc."""
    users = {u["_id"]: u for u in load("users")}
    out = []
    for p in load("participants"):
        if p.get("cohort") != "study":
            continue
        u = users.get(p["uid"], {})
        out.append({
            "code": p["code"],
            "uid": p["uid"],
            "withdrawn": bool(p.get("withdrawal")),
            "enrolledAt": p.get("enrolledAt"),
            "sub": u.get("_sub", {}),
            "user": u,
        })
    return sorted(out, key=lambda r: r["code"])


def q_updates(cohort="study"):
    for t in load("q_tables"):
        if t["_id"] == cohort:
            return t.get("_sub", {}).get("updates", [])
    return []


def ms_to_dt(ms):
    if ms in (None, "", "None"):
        return None
    return datetime.fromtimestamp(float(ms) / 1000, tz=PH)
