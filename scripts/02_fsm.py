"""4.1.1 / 4.1.4: how the driving FSM behaved in the study drives.

Reads every drive and final-exam attempt of the 21 active study participants:
- conformance: every logged transition checked against the FSM's transition
  table (scripts/fsm_edges.json, built from DrivingFSM.ts);
- graded decisions: correct vs violation, per level, per competency, per severity;
- remediation: competencies missed on a level's first drive vs the same
  competencies on that level's repeat drives.

Outputs (results/):
  4_1_fsm_summary.txt
  4_1_fsm_by_level.csv
  4_1_fsm_by_competency.csv
  4_1_fsm_first_vs_last.csv  (missed competencies: first drive vs last repeat)
  4_1_fsm_state_visits.csv
"""
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import pandas as pd
from scipy import stats

from common import RESULTS, study_participants

EDGES = {tuple(e) for e in json.loads((Path(__file__).parent / "fsm_edges.json").read_text())}

rows, decisions, transitions, visits = [], [], [], Counter()
for p in study_participants():
    if p["withdrawn"]:
        continue
    attempts = sorted(p["sub"].get("attempts", []), key=lambda a: a["_created"])
    for order, a in enumerate(attempts, start=1):
        kind = "final" if a["_id"].startswith("final_") else "drive"
        level = "Final" if kind == "final" else int(a["levelId"])
        logs = a.get("logs", [])
        correct = sum(1 for l in logs if l.get("result") == "correct")
        wrong = sum(1 for l in logs if l.get("result") == "violation")
        m = a.get("fsmMetrics") or {}
        visits.update(m.get("stateVisitCounts", {}))
        for t in a.get("_sub", {}).get("telemetry", []):
            transitions += [(tr["from"], tr["trigger"], tr["to"]) for tr in t.get("transitions", [])]
        rows.append({
            "code": p["code"], "order": order, "kind": kind, "level": level,
            "decisions": correct + wrong, "correct": correct, "violations": wrong,
            "accuracy": correct / (correct + wrong) if correct + wrong else None,
            "fsm_correct": m.get("correctVerdicts"), "fsm_incorrect": m.get("incorrectVerdicts"),
            "collision": bool(a.get("crashReason")), "timed_out": a.get("timedOut") is True,
            "score": a.get("finalScore"), "transitions": m.get("totalTransitions"),
        })
        for l in logs:
            decisions.append({"code": p["code"], "kind": kind, "level": level,
                              "competency": l.get("competency"), "severity": l.get("severity"),
                              "result": l.get("result")})

d = pd.DataFrame(rows)
dec = pd.DataFrame(decisions)

# --- conformance -------------------------------------------------------------
undefined = [t for t in transitions if t not in EDGES]
used = set(transitions)
fsm_verdicts = int(d.fsm_correct.sum() + d.fsm_incorrect.sum())

# --- by level ---------------------------------------------------------------
lvl = d.assign(level=d.level.astype(str)).groupby("level", sort=False).agg(
    attempts=("code", "size"), participants=("code", "nunique"),
    decisions=("decisions", "sum"), correct=("correct", "sum"), violations=("violations", "sum"),
    mean_accuracy=("accuracy", "mean"), collisions=("collision", "sum"))
lvl["accuracy"] = lvl.correct / lvl.decisions
order = [str(i) for i in range(7)] + ["Final"]
lvl = lvl.reindex([o for o in order if o in lvl.index])
lvl.round(4).to_csv(RESULTS / "4_1_fsm_by_level.csv")

# --- by competency ----------------------------------------------------------
comp = dec.groupby("competency").agg(decisions=("result", "size"),
                                     correct=("result", lambda r: (r == "correct").sum()))
comp["violations"] = comp.decisions - comp.correct
comp["accuracy"] = comp.correct / comp.decisions
sev = dec[dec.result == "violation"].groupby(["competency", "severity"]).size().unstack(fill_value=0)
comp = comp.join(sev.add_prefix("violations_"), how="left").fillna(0).sort_values("accuracy")
comp.round(4).to_csv(RESULTS / "4_1_fsm_by_competency.csv")

# --- remediation: competencies failed on a level's first drive -----------
# A repeat drive only replays the competencies the participant missed, so a
# whole-drive comparison mixes different content. Instead, for each competency
# missed (accuracy < 1) on a level's first drive, compare its accuracy there
# with its accuracy on the last repeat drive of the same level that tested it.
def comp_acc(attempt, competency):
    graded = [l for l in attempt.get("logs", []) if l.get("competency") == competency]
    return sum(l.get("result") == "correct" for l in graded) / len(graded) if graded else None

rem = []
for p in study_participants():
    if p["withdrawn"]:
        continue
    by_level = defaultdict(list)
    for a in sorted(p["sub"].get("attempts", []), key=lambda a: a["_created"]):
        if a["_id"].startswith("drive_"):
            by_level[int(a["levelId"])].append(a)
    for level, runs in by_level.items():
        if len(runs) < 2:
            continue
        for c in sorted({l.get("competency") for l in runs[0].get("logs", [])}):
            first = comp_acc(runs[0], c)
            later = [x for x in (comp_acc(r, c) for r in runs[1:]) if x is not None]
            if first is not None and first < 1 and later:
                rem.append({"code": p["code"], "level": level, "competency": c,
                            "repeats": len(later), "first_accuracy": first, "last_repeat_accuracy": later[-1]})
fl = pd.DataFrame(rem)
fl.round(4).to_csv(RESULTS / "4_1_fsm_first_vs_last.csv", index=False)
w = stats.wilcoxon(fl.last_repeat_accuracy, fl.first_accuracy) if len(fl) else None
repeat_runs = int((d.kind == "drive").sum()) - int(d[d.kind == "drive"].groupby(["code", "level"]).ngroups)

pd.Series(visits).sort_values(ascending=False).rename("visits").to_csv(RESULTS / "4_1_fsm_state_visits.csv")

lines = [
    f"Attempts analysed: {len(d)} ({(d.kind == 'drive').sum()} drives, {(d.kind == 'final').sum()} final-exam drives) from {d.code.nunique()} participants",
    f"Logged FSM transitions: {len(transitions)}; distinct edges used: {len(used)} of {len(EDGES)} defined",
    f"Transitions not in the FSM's table: {len(undefined)}",
    f"Graded through the FSM's verdict edges (answer_correct / answer_incorrect): {fsm_verdicts} "
    f"(correct {int(d.fsm_correct.sum())}, incorrect {int(d.fsm_incorrect.sum())}); "
    "the scoring log below also counts rule checks graded outside those edges (e.g. holding speed over a limit)",
    f"Graded decisions: {len(dec)}; correct {int((dec.result == 'correct').sum())} ({(dec.result == 'correct').mean():.1%}); violations {int((dec.result == 'violation').sum())}",
    f"Runs ended by a collision: {int(d.collision.sum())}; timed out: {int(d.timed_out.sum())}",
    f"Repeat drives: {repeat_runs}",
    f"Competencies missed on a level's first drive and tested again in a repeat: {len(fl)} "
    f"(from {fl.code.nunique() if len(fl) else 0} participants)",
]
if w is not None:
    lines.append(f"  accuracy on those competencies: first drive {fl.first_accuracy.mean():.3f} -> last repeat {fl.last_repeat_accuracy.mean():.3f}; "
                 f"fully correct on the last repeat: {(fl.last_repeat_accuracy == 1).mean():.1%}; Wilcoxon signed-rank p = {w.pvalue:.2g}")
(RESULTS / "4_1_fsm_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\nBy level:\n", lvl.round(3).to_string())
print("\nBy competency:\n", comp.round(3).to_string())
