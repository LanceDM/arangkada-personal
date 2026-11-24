"""4.1.2: graded driving decisions by the action the rule expected.

Every graded decision in a drive or final exam carries the action its rule
expected (brake, stop, accelerate, turn_left, turn_right). Accuracy per
expected action, and per competency x expected action.

Outputs (results/):
  4_1_decisions_by_action.csv
  4_1_decisions_by_competency_action.csv
"""
import pandas as pd

from common import RESULTS, study_participants

rows = []
for p in study_participants():
    if p["withdrawn"]:
        continue
    for a in p["sub"].get("attempts", []):
        for l in a.get("logs", []):
            if l.get("result") in ("correct", "violation"):
                rows.append({"code": p["code"], "competency": l.get("competency"),
                             "expected": l.get("expectedAction"), "correct": l["result"] == "correct"})
D = pd.DataFrame(rows)


def table(keys):
    t = D.groupby(keys).agg(decisions=("correct", "size"), correct=("correct", "sum"),
                            participants=("code", "nunique"))
    t["violations"] = t.decisions - t.correct
    t["accuracy"] = t.correct / t.decisions
    return t


by_action = table("expected").sort_values("decisions", ascending=False)
by_action.round(4).to_csv(RESULTS / "4_1_decisions_by_action.csv")
table(["competency", "expected"]).round(4).to_csv(RESULTS / "4_1_decisions_by_competency_action.csv")
print(f"Graded decisions: {len(D)}")
print(by_action.round(3).to_string())
