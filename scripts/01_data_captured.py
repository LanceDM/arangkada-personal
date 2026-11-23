"""4.3.1 Data Captured: what was recorded for each study participant.

Output: results/4_3_1_data_captured.csv (one row per participant code)
        results/4_3_1_summary.txt
"""
import csv
from collections import Counter

from datetime import datetime

from common import PH, RESULTS, q_updates, study_participants

def answered(sitting):
    if not sitting:
        return 0
    return sum(1 for r in sitting.get("responses", []) if r.get("chosen") not in (None, -1))


qup = Counter(u["participantCode"] for u in q_updates("study"))
rows = []
for p in study_participants():
    s = p["sub"]
    attempts = s.get("attempts", [])
    drives = [a for a in attempts if a["_id"].startswith("drive_")]
    finals = [a for a in attempts if a["_id"].startswith("final_")]
    sittings = {t.get("kind"): t for t in s.get("testSittings", [])}
    bku = s.get("bktUpdates", [])
    bsrc = Counter(b.get("source") for b in bku)
    study = {d["_id"]: d for d in s.get("study", [])}
    # Server write times (client timestamps are not reliable across devices).
    times = [datetime.fromisoformat(d["_created"]).astimezone(PH)
             for d in attempts + s.get("courseQuizSittings", []) if d.get("_created")]
    rows.append({
        "code": p["code"],
        "withdrawn": p["withdrawn"],
        "ageBand": study.get("consent", {}).get("ageBand"),
        "device": study.get("background", {}).get("device"),
        "gaming": study.get("background", {}).get("gaming"),
        "pre_answered": answered(sittings.get("pre")),
        "pre_items": len(sittings.get("pre", {}).get("responses", [])),
        "pre_closed_by": sittings.get("pre", {}).get("closedBy", ""),
        "post_answered": answered(sittings.get("post")),
        "post_items": len(sittings.get("post", {}).get("responses", [])),
        "post_closed_by": sittings.get("post", {}).get("closedBy", ""),
        "drive_attempts": len(drives),
        "drive_levels": len({a.get("levelId") for a in drives}),
        "final_attempts": len(finals),
        "timed_out": sum(1 for a in attempts if a.get("timedOut") is True),
        "collisions": sum(1 for a in attempts if a.get("crashReason")),
        "quiz_sittings": len(s.get("courseQuizSittings", [])),
        "quiz_levels": len({q.get("levelId") for q in s.get("courseQuizSittings", [])}),
        "bkt_updates": len(bku),
        "bkt_from_drive": bsrc.get("drive", 0),
        "bkt_from_quiz": bsrc.get("quiz", 0),
        "bkt_from_pretest": bsrc.get("pre_test", 0),
        "q_updates": qup.get(p["code"], 0),
        "first_activity": min(times).strftime("%Y-%m-%d %H:%M") if times else "",
        "last_activity": max(times).strftime("%Y-%m-%d %H:%M") if times else "",
        "active_days": len({t.date() for t in times}),
    })

out = RESULTS / "4_3_1_data_captured.csv"
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)

n = len(rows)
full = lambda r, k: r[f"{k}_items"] and r[f"{k}_answered"] == r[f"{k}_items"]
complete = [r for r in rows if full(r, "pre") and full(r, "post") and not r["withdrawn"]]
tot = lambda k: sum(r[k] for r in rows)
lines = [
    f"Study participants enrolled: {n}",
    f"Withdrawn: {sum(r['withdrawn'] for r in rows)} ({', '.join(r['code'] for r in rows if r['withdrawn']) or '-'})",
    f"Pre-test fully answered: {sum(bool(full(r, 'pre')) for r in rows)}; post-test fully answered: {sum(bool(full(r, 'post')) for r in rows)}",
    "Pre-test closed by the deadline: " + ", ".join(f"{r['code']} ({r['pre_answered']}/{r['pre_items']} answered)" for r in rows if r["pre_closed_by"] == "deadline"),
    f"Complete (pre + post fully answered, not withdrawn): {len(complete)}",
    f"Drive attempts: {tot('drive_attempts')}; final-exam drives: {tot('final_attempts')}",
    f"Course quiz sittings: {tot('quiz_sittings')}",
    f"BKT updates: {tot('bkt_updates')} (drive {tot('bkt_from_drive')}, quiz {tot('bkt_from_quiz')}, pre-test {tot('bkt_from_pretest')})",
    f"Q-learning updates: {tot('q_updates')}",
    f"Timed-out attempts: {tot('timed_out')}; runs ended by a collision: {tot('collisions')}",
]
(RESULTS / "4_3_1_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print(f"\nWrote {out.name}")
