"""4.1.3 details: learning curve, |dQ| convergence, state-action coverage, reward by state and action.

Reads the shared `study` Q-table log (visits = decisions, learns = rewarded updates).

- Learning curve: reward per rewarded update, first quarter vs last quarter of
  the study (in update order), Mann-Whitney U.
- Convergence: |Q after - Q before| of every update, by update order; the mean
  per quarter, and per state for the last five updates of each state-action.
- Coverage: the legal state-action pairs (15) and how many were tried, and
  the share of decisions that took the table's current leader (exploit).
- Value by state and action: mean update target (r + gamma * max Q(s'), the
  quantity each Q-value averages) with a 95% confidence interval (t distribution).

Outputs (results/):
  4_1_q_details_summary.txt
  4_1_q_reward_by_pair.csv
  4_1_q_dq_by_quarter.csv
  fig_4_1_q_dq.png
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

from common import RESULTS, q_updates

ORDER = [f"M{m}-{r}" for m in (1, 2, 3, 4) for r in ("passed", "failed")]


def legal(state):
    m, r = int(state[1]), state.split("-")[1]
    acts = []
    if r == "passed" and m >= 2:
        acts.append("none")
    acts.append("practice")
    if r == "failed":
        acts.append("review")
    return acts


PAIRS = [(s, a) for s in ORDER for a in legal(s)]

log = sorted(q_updates("study"), key=lambda u: u["globalSeq"])
visits = [u for u in log if u["kind"] == "visit"]
learns = [u for u in log if u["kind"] == "learn"]

L = pd.DataFrame([{"seq": i + 1, "state": u["stateKey"], "action": u["action"],
                   "reward": u["learning"]["reward"], "kind": u["learning"]["rewardKind"], "target": u["learning"]["target"], "q_before": u["learning"]["qBefore"],
                   "q_after": u["learning"]["qAfter"], "n_after": u["learning"]["nAfter"]}
                  for i, u in enumerate(learns)])
L["dq"] = (L.q_after - L.q_before).abs()
L["quarter"] = pd.qcut(L.seq, 4, labels=["Q1", "Q2", "Q3", "Q4"])

# --- learning curve -----------------------------------------------------------
q1, q4 = L[L.quarter == "Q1"].reward, L[L.quarter == "Q4"].reward
mw = stats.mannwhitneyu(q4, q1, alternative="two-sided")
# A step reward is only the cost of the extra scenarios (-0.02 each), so the raw
# reward also moves with how many steps were taken. Terminal rewards carry the
# outcome (accuracy at the competency's next measurement).
term = L[L.kind == "terminal"]
t1, t4 = term[term.quarter == "Q1"].reward, term[term.quarter == "Q4"].reward
mw_t = stats.mannwhitneyu(t4, t1, alternative="two-sided")
step_share = L.assign(step=L.kind == "step").groupby("quarter", observed=True).step.mean()

# --- convergence -------------------------------------------------------------
dq = L.groupby("quarter", observed=True).dq.agg(["count", "mean", "median"]).round(4)
dq.to_csv(RESULTS / "4_1_q_dq_by_quarter.csv")
last5 = (L.sort_values("seq").groupby(["state", "action"]).tail(5)
         .groupby(["state", "action"]).dq.mean())

# --- coverage ----------------------------------------------------------------
tried = {(u["stateKey"], u["action"]) for u in visits}
sel = pd.Series([u["decision"]["selection"] for u in visits]).value_counts()

# --- reward by state and action --------------------------------------------------
rows = []
for s, a in PAIRS:
    # the update target r + gamma * max Q(s'): a step's reward is only its cost
    # (-0.02 per added decision), so the target is what the Q-value averages
    r = L[(L.state == s) & (L.action == a)].target
    n = len(r)
    if n >= 2:
        h = stats.t.ppf(.975, n - 1) * r.std(ddof=1) / np.sqrt(n)
        lo, hi = r.mean() - h, r.mean() + h
    else:
        lo = hi = np.nan
    rows.append({"state": s, "action": a, "decisions": sum(1 for u in visits if (u["stateKey"], u["action"]) == (s, a)),
                 "updates": n, "mean_target": r.mean() if n else np.nan, "ci95_low": lo, "ci95_high": hi,
                 "final_Q": L[(L.state == s) & (L.action == a)].q_after.iloc[-1] if n else np.nan,
                 "last5_mean_abs_dq": last5.get((s, a), np.nan)})
R = pd.DataFrame(rows)
R.round(3).to_csv(RESULTS / "4_1_q_reward_by_pair.csv", index=False)

# --- figure: |dQ| over updates -----------------------------------------------------
fig, ax = plt.subplots(figsize=(7, 3.6), dpi=200)
ax.scatter(L.seq, L.dq, s=6, color="#9aa7c0", alpha=.6, label="|ΔQ| of one update")
roll = L.dq.rolling(50, min_periods=10).mean()
ax.plot(L.seq, roll, color="#223864", lw=2, label="Moving mean (50 updates)")
ax.set_xlabel("Update number (study order)")
ax.set_ylabel("|ΔQ|")
ax.legend(frameon=False)
for sp in ("top", "right"):
    ax.spines[sp].set_visible(False)
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_1_q_dq.png")

lines = [
    f"Rewarded updates: {len(L)}; decisions: {len(visits)}",
    f"Learning curve: mean reward first quarter {q1.mean():.3f} (n {len(q1)}) -> last quarter {q4.mean():.3f} "
    f"(n {len(q4)}); Mann-Whitney U = {mw.statistic:.0f}, p = {mw.pvalue:.3f}",
    f"  terminal rewards only (the outcome): {t1.mean():.3f} (n {len(t1)}) -> {t4.mean():.3f} (n {len(t4)}); "
    f"Mann-Whitney p = {mw_t.pvalue:.3f}",
    "  share of step updates by quarter: " + ", ".join(f"{k} {v:.1%}" for k, v in step_share.items()),
    "Mean |dQ| by quarter: " + ", ".join(f"{k} {v:.3f}" for k, v in dq["mean"].items()),
    f"Legal state-action pairs: {len(PAIRS)}; tried at least once: {len(tried & set(PAIRS))}; "
    f"never tried: {sorted(set(PAIRS) - tried) or 'none'}",
    "Decisions by selection: " + ", ".join(f"{k} {v} ({v / len(visits):.1%})" for k, v in sel.items()),
    "",
    R.round(3).to_string(index=False),
]
(RESULTS / "4_1_q_details_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
