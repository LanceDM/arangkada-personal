"""4.1.3: how the shared Q-learning table learned during the study.

Reads the study table's update log (q_tables/study/updates): one `visit` entry
per decision and one `learn` entry per reward. The table was shared by all
participants and started empty, so the log is the full learning history.

Outputs (results/):
  4_1_q_summary.txt
  4_1_q_final_table.csv        final Q, updates and visits per state and action
  4_1_q_decisions.csv          decisions per state: forced / explore / exploit
  4_1_q_leader_history.csv     per state: leader changes and when the last one happened
  4_1_q_vs_rule.csv            learned leader vs the hand-written fallback rule
  fig_4_1_q_convergence.png    Q of each action over its state's updates
"""
from collections import Counter, defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from common import RESULTS, load, q_updates

ORDER = [f"M{m}-{r}" for m in (1, 2, 3, 4) for r in ("passed", "failed")]
ACTIONS = ["none", "practice", "review"]

log = sorted(q_updates("study"), key=lambda u: u["globalSeq"])
visits = [u for u in log if u["kind"] == "visit"]
learns = [u for u in log if u["kind"] == "learn"]
study_doc = next(t for t in load("q_tables") if t["_id"] == "study")
final = study_doc["table"]
tags = study_doc.get("states", {})

# --- final table ----------------------------------------------------------
ft = []
for s in ORDER:
    for a in ACTIONS:
        c = final.get(s, {}).get(a)
        if c:
            ft.append({"state": s, "action": a, "Q": c["q"], "updates": c["n"], "visits": c["visits"]})
ft = pd.DataFrame(ft)
leaders = ft.loc[ft.groupby("state").Q.idxmax()].set_index("state").action
ft["leader"] = ft.apply(lambda r: r.action == leaders.get(r.state), axis=1)
ft.round(4).to_csv(RESULTS / "4_1_q_final_table.csv", index=False)

# --- decisions per state ---------------------------------------------------
dec = pd.DataFrame([{"state": u["stateKey"], "action": u["action"],
                     "selection": u["decision"]["selection"], "phase": u["decision"]["warmUpPhase"],
                     "legal": "/".join(u["decision"]["legal"])} for u in visits])
ds = dec.pivot_table(index="state", columns="selection", values="action", aggfunc="size", fill_value=0)
ds["decisions"] = ds.sum(axis=1)
ds["legal_actions"] = dec.groupby("state").legal.first()
ds["final_tag"] = pd.Series({s: tags.get(s, {}).get("tag") for s in ds.index})
ds = ds.reindex([s for s in ORDER if s in ds.index])
ds.to_csv(RESULTS / "4_1_q_decisions.csv")

# --- leader history (replayed from the learn entries) ------------------------
q = defaultdict(dict)                       # state -> action -> Q
series = defaultdict(lambda: defaultdict(list))  # state -> action -> [(state update #, Q)]
leader_now, changes, last_change, n_state = {}, Counter(), {}, Counter()
for u in learns:
    s, a = u["stateKey"], u["action"]
    q[s][a] = u["learning"]["qAfter"]
    n_state[s] += 1
    for act, val in q[s].items():
        series[s][act].append((n_state[s], val))
    lead = max(q[s], key=q[s].get) if len(q[s]) > 1 else None
    if lead and lead != leader_now.get(s):
        if s in leader_now:
            changes[s] += 1
        leader_now[s] = lead
        last_change[s] = (n_state[s], u["globalSeq"])
lh = pd.DataFrame([{"state": s, "updates": n_state[s], "final_leader": leader_now.get(s, "(only one action)"),
                    "leader_changes": changes[s],
                    "last_change_at_update": last_change.get(s, (None,))[0],
                    "last_change_global_seq": last_change.get(s, (None, None))[1]}
                   for s in ORDER if n_state[s]])
lh["stable_share"] = 1 - lh.last_change_at_update.fillna(0) / lh.updates
lh.round(3).to_csv(RESULTS / "4_1_q_leader_history.csv", index=False)

# --- learned leader vs the hand-written fallback rule ---------------------
# fallback: after a pass, practice below mastery 0.80 else none;
#           after a fail, practice on the first failure, review on a repeat.
def rule_for(state):
    m, r = int(state[1]), state.split("-")[1]
    if r == "passed":
        return "practice" if m < 3 else "none"   # levels 1-2 are below 0.80; 3 (0.80-0.94) and 4 are not
    return "practice or review"
vr = pd.DataFrame([{"state": s, "legal": ds.legal_actions.get(s),
                    "learned_leader": leaders.get(s, "-"), "rule": rule_for(s)} for s in ORDER])
vr["agrees"] = vr.apply(lambda r: r.learned_leader in r.rule.split(" or "), axis=1)
vr.to_csv(RESULTS / "4_1_q_vs_rule.csv", index=False)

# --- figure: Q over updates for states with a choice ------------------------
states = [s for s in ORDER if len(series[s]) > 1]
fig, axes = plt.subplots(2, (len(states) + 1) // 2, figsize=(13, 6.2), dpi=200, sharey=True)
colors = {"none": "#223864", "practice": "#C8102E", "review": "#E0A800"}
for ax, s in zip(axes.flat, states):
    for a, pts in series[s].items():
        xs, ys = zip(*pts)
        ax.plot(xs, ys, label=a, color=colors[a], lw=1.6)
    ax.set_title(f"{s} ({n_state[s]} updates)", fontsize=10)
    ax.set_ylim(0, 1.05)
    ax.grid(color="#dddddd", lw=0.6)
    ax.tick_params(labelsize=8)
for ax in list(axes.flat)[len(states):]:
    ax.axis("off")
from matplotlib.lines import Line2D
fig.legend([Line2D([], [], color=colors[a], lw=2) for a in ACTIONS], ACTIONS,
           loc="lower right", ncol=3, frameon=False)
fig.supxlabel("Update number within the state")
fig.supylabel("Q-value")
fig.tight_layout(rect=(0, 0.03, 1, 1))
fig.savefig(RESULTS / "fig_4_1_q_convergence.png")

sel = Counter(u["decision"]["selection"] for u in visits)
meas = Counter(u["learning"]["measuredBy"] for u in learns)
lines = [
    f"Q-table log entries: {len(log)} ({len(visits)} decisions, {len(learns)} rewards) from "
    f"{len({u['participantCode'] for u in log})} participants",
    f"Decisions: forced (one legal action) {sel['forced']}, exploit (took the leader) {sel['exploit']}, "
    f"explore {sel['explore']}",
    f"Rewards measured by: drive {meas['drive']}, final exam {meas['final']}, quiz {meas['quiz']}",
    f"States visited: {sum(1 for s in ORDER if n_state[s] or s in set(dec.state))} of 8; "
    f"most visited: {dec.state.value_counts().idxmax()} ({dec.state.value_counts().max()} decisions)",
    "Final leader per state: " + ", ".join(f"{s}={leaders.get(s, '-')}" for s in ORDER),
    f"Learned leader agrees with the fallback rule in {int(vr.agrees.sum())} of {len(vr)} states",
]
(RESULTS / "4_1_q_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\n", ft.round(3).to_string(index=False))
print("\n", ds.to_string())
print("\n", lh.round(3).to_string(index=False))
print("\n", vr.to_string(index=False))
