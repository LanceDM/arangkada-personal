"""4.1.1: the routing FSM (course progression) checked against its transition table.

The routing FSM (src/domain/competencyRouting/course.ts in the team code) moves
each learner through the course:

  MODULE(0) -> DRIVE(0) (tutorial) -> MODULE(1)
  MODULE(L) -> QUIZ(L)
  QUIZ(L)   -> DRIVE(L)        every competency passed (2 of 3 each)
            -> QUIZ(L)         some failed, attempts left (max 3): only the failed ones again
            -> QUIZ_REVIEW(L)  third attempt failed -> module review -> DRIVE(L)
  DRIVE(L) / REPEAT(L) -> MODULE(L+1), or FINAL after the last level, when every competency is done
                       -> REPEAT(L), only the not-done competencies, otherwise
  FINAL     -> CERTIFIED       passed (at least 70% of the counted scenarios, not ended early)
            -> FINAL           failed

A competency is done in a level when Q-learning chose `none` for it, or after
its third attempt (the cap). The study course ran levels 1 to 6
(studyLastLevel = 6), then the final exam.

Each level's competencies are taken from the data (the competencies its first
quiz sitting asked, and those its first drive decided on), because the quiz
only asks competencies that have quiz items in that level.

The routing FSM does not log its own transitions, so they are rebuilt from the
activities that were logged (quiz sittings, drives, repeat drives, final exams)
and the decisions logged after each drive. Every step is replayed through the
table above; a step the table does not allow is counted as illegal.

Lesson reading is not logged, so MODULE(L) -> QUIZ(L) is taken as the step into
each level's first quiz, and the QUIZ_REVIEW(L) -> DRIVE(L) step as the move
from a third failed quiz to the drive.

Outputs (results/):
  4_1_routing_summary.txt
  4_1_routing_transitions.csv   each transition type and how often it was taken
  4_1_routing_participants.csv  per participant: steps, illegal steps, end state
"""
import math
import re
from collections import Counter, defaultdict

import pandas as pd

from common import RESULTS, study_participants

QUIZ_PASS, QUIZ_CAP, ATTEMPT_CAP, FINAL_SHARE = 2, 3, 3, 0.7

ID = re.compile(r"^(drive|final|quiz)_(DRIVE|REPEAT|FINAL|QUIZ)(?:-(\d+))?(?:-a(\d+))?_")


def events_of(p):
    """The participant's logged activities in time order: (time, kind, level, attempt, record)."""
    ev = []
    for a in p["sub"].get("attempts", []):
        m = ID.match(a["_id"])
        ev.append((a["timestamp"], m.group(2), int(m.group(3)) if m.group(3) else None, None, a))
    for s in p["sub"].get("courseQuizSittings", []):
        m = ID.match(s["_id"])
        ev.append((s["timestamp"], "QUIZ", int(m.group(3)), int(m.group(4)), s))
    return sorted(ev, key=lambda e: e[0])


rows, steps, problems, reasked = [], Counter(), [], []
for p in study_participants():
    if p["withdrawn"]:
        continue
    code = p["code"]
    log_by_attempt = {c.get("attemptId"): c for c in p["sub"].get("courseLog", []) if c.get("attemptId")}
    last = max(c.get("studyLastLevel", 6) for c in p["sub"].get("courseLog", [])) if p["sub"].get("courseLog") else 6
    end_phase = next(c["phase"]["kind"] for c in p["sub"]["course"] if c["_id"] == "cursor")

    state, quiz, stage = ("MODULE", 0), None, {}
    n_steps, illegal = 0, 0

    def step(frm, to, label):
        global_label = f"{frm[0]} -> {to[0]} ({label})"
        steps[global_label] += 1
        return to

    def bad(msg):
        problems.append(f"{code}: {msg}")

    for t, kind, level, attempt, rec in events_of(p):
        n_steps += 1
        if kind == "DRIVE" and level == 0:
            if state != ("MODULE", 0):
                illegal += 1; bad(f"tutorial drive in {state}")
            state = step(("MODULE", 0), ("DRIVE", 0), "lessons read")
            state = step(state, ("MODULE", 1), "tutorial ended")
        elif kind == "QUIZ":
            if attempt == 1:
                if state != ("MODULE", level):
                    illegal += 1; bad(f"QUIZ({level}) a1 in {state}")
                state = step(("MODULE", level), ("QUIZ", level), "lessons read")
                # the level's quiz competencies, as the first sitting asked them
                quiz = {"attempt": 1, "remaining": sorted({a["competency"] for a in rec["answers"]})}
            elif state != ("QUIZ", level) or quiz is None or quiz["attempt"] != attempt:
                illegal += 1; bad(f"QUIZ({level}) a{attempt} in {state}, quiz {quiz}")
            asked = {a["competency"] for a in rec["answers"]}
            if not asked <= set(quiz["remaining"]):
                # content, not a transition: the retake also asked competencies already passed
                reasked.append(f"{code}: QUIZ({level}) a{attempt} also asked {sorted(asked - set(quiz['remaining']))}")
            right = Counter(a["competency"] for a in rec["answers"] if a.get("result") == "correct")
            remaining = [c for c in quiz["remaining"] if right[c] < QUIZ_PASS]
            if not remaining:
                state = step(state, ("DRIVE", level), "every competency passed")
                stage, quiz = None, None
            elif attempt < QUIZ_CAP:
                state = step(state, ("QUIZ", level), "some failed, retake")
                quiz = {"attempt": attempt + 1, "remaining": remaining}
            else:
                state = step(state, ("QUIZ_REVIEW", level), "third attempt failed")
                state = step(state, ("DRIVE", level), "module reviewed")
                stage, quiz = None, None
        elif kind in ("DRIVE", "REPEAT"):
            if state != (kind, level):
                illegal += 1; bad(f"{kind}({level}) in {state}")
            log = log_by_attempt.get(rec["_id"], {})
            decided = {d["competency"]: d["action"] for d in log.get("decisions", [])}
            if kind == "DRIVE":
                stage = {}
            # a competency enters the stage the first time a drive decides on it; one a
            # drive did not ask (ended early, or no scenario fits the road) stays as it was
            closed = {c for c in decided if c in stage and stage[c]["done"]}
            if closed:
                illegal += 1; bad(f"{kind}({level}) decided on closed competencies {sorted(closed)}")
            for c, action in decided.items():
                s = stage.setdefault(c, {"attempts": 0, "done": False})
                s["attempts"] += 1
                s["done"] = action == "none" or s["attempts"] >= ATTEMPT_CAP
            if all(s["done"] for s in stage.values()):
                nxt = ("FINAL", None) if level >= last else ("MODULE", level + 1)
                state = step(state, nxt, "every competency done")
            else:
                state = step(state, ("REPEAT", level), "some competencies not done")
        elif kind == "FINAL":
            if state[0] != "FINAL":
                illegal += 1; bad(f"FINAL in {state}")
            v = log_by_attempt.get(rec["_id"], {}).get("verdicts", [])
            total, correct = sum(x["total"] for x in v), sum(x["correct"] for x in v)
            ended_early = bool(rec.get("crashReason")) or rec.get("timedOut") is True
            passed = not ended_early and total > 0 and correct >= math.ceil(total * FINAL_SHARE)
            state = step(state, ("CERTIFIED", None) if passed else ("FINAL", None),
                         "passed" if passed else "failed")
    if state[0] != end_phase:
        illegal += 1; bad(f"replay ends in {state}, the stored cursor is {end_phase}")
    rows.append({"code": code, "activities": n_steps, "illegal": illegal, "replayed_end": state[0],
                 "stored_end": end_phase})

P = pd.DataFrame(rows)
P.to_csv(RESULTS / "4_1_routing_participants.csv", index=False)
T = pd.DataFrame(sorted(steps.items(), key=lambda kv: -kv[1]), columns=["transition", "count"])
T.to_csv(RESULTS / "4_1_routing_transitions.csv", index=False)

total = int(T["count"].sum())
lines = [
    f"Participants: {len(P)}; logged activities replayed: {int(P.activities.sum())}",
    f"Routing transitions rebuilt: {total}; illegal: {int(P.illegal.sum())} "
    f"({int(P.illegal.sum()) / total:.2%} error rate)",
    f"Participants whose replay ends where their stored course ends: {int((P.replayed_end == P.stored_end).sum())} of {len(P)}",
    "End states: " + ", ".join(f"{k} {v}" for k, v in P.stored_end.value_counts().items()),
    "",
    "Transitions taken:",
] + [f"  {r.transition}: {r['count']}" for _, r in T.iterrows()]
lines += ["", f"Quiz retakes that also re-asked competencies already passed (content, not a transition): {len(reasked)}"]
lines += [f"  {x}" for x in reasked]
if problems:
    lines += ["", "Illegal steps:"] + [f"  {x}" for x in problems]
(RESULTS / "4_1_routing_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
