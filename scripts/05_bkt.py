"""4.3.2 - 4.3.4: how well BKT predicted answers, and where mastery ended.

Every BKT update logged, before the answer was applied, the probability that the
answer would be correct (predictedCorrect). Comparing those with the actual
answers measures BKT's predictive accuracy without refitting anything.

Outputs (results/):
  4_3_bkt_summary.txt
  4_3_bkt_prediction.csv        accuracy / AUC / Brier / log loss, overall and per source and competency
  4_3_bkt_calibration.csv       predicted vs observed, in 10 bins
  4_3_bkt_mastery.csv           final mastery level per participant and competency
  4_3_bkt_mastery_counts.csv    participants per mastery level, per competency
  fig_4_3_calibration.png
  fig_4_3_mastery.png
"""
from collections import defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

from common import RESULTS, load, study_participants

LEVELS = {1: "Beginning", 2: "Developing", 3: "Nearly mastered", 4: "Mastered"}

rows, mastery = [], []
for p in study_participants():
    if p["withdrawn"]:
        continue
    ups = sorted(p["sub"].get("bktUpdates", []), key=lambda b: (int(b.get("userSeq") or 0), b["_id"]))
    history = defaultdict(list)  # competency -> earlier answers, for the running-mean baseline
    for b in ups:
        c = b["competency"]
        prev = history[c]
        rows.append({"code": p["code"], "competency": c, "source": b["source"],
                     "pred": float(b["predictedCorrect"]), "y": int(bool(b["correct"])),
                     "running_mean": np.mean(prev) if prev else np.nan,
                     "pBefore": float(b["pBefore"]), "params": str(b.get("params"))})
        prev.append(int(bool(b["correct"])))
    prof = (p["sub"].get("bkt") or [{}])[0].get("competencies", {})
    for c, v in prof.items():
        mastery.append({"code": p["code"], "competency": c, "level": v.get("level"),
                        "p": v.get("p"), "startP": v.get("startP"), "capped": v.get("capped")})

D = pd.DataFrame(rows)
M = pd.DataFrame(mastery)


def auc(y, s):
    y, s = np.asarray(y), np.asarray(s)
    pos, neg = s[y == 1], s[y == 0]
    if not len(pos) or not len(neg):
        return np.nan
    u = stats.mannwhitneyu(pos, neg, alternative="two-sided").statistic
    return u / (len(pos) * len(neg))


def metrics(df, col="pred"):
    y, s = df.y.values, np.clip(df[col].values, 1e-6, 1 - 1e-6)
    return {"n": len(df), "observed_correct": y.mean(),
            "accuracy": ((s >= .5).astype(int) == y).mean(),
            "auc": auc(y, s), "brier": np.mean((s - y) ** 2),
            "log_loss": -np.mean(y * np.log(s) + (1 - y) * np.log(1 - s))}


overall = metrics(D)
base_rate = D.y.mean()
baseline_const = metrics(D.assign(b=base_rate), "b")
rm = D.dropna(subset=["running_mean"])
bkt_on_rm = metrics(rm)
baseline_rm = metrics(rm, "running_mean")

pred_rows = [{"group": "all", **overall}, {"group": "baseline: overall correct rate", **baseline_const},
             {"group": "all (answers with an earlier answer in the competency)", **bkt_on_rm},
             {"group": "baseline: participant's running mean in the competency", **baseline_rm}]
pred_rows += [{"group": f"source: {s}", **metrics(g)} for s, g in D.groupby("source")]
pred_rows += [{"group": f"competency: {c}", **metrics(g)} for c, g in D.groupby("competency")]
pred = pd.DataFrame(pred_rows)
pred.round(4).to_csv(RESULTS / "4_3_bkt_prediction.csv", index=False)

# --- calibration -------------------------------------------------------------
D["bin"] = pd.cut(D.pred, bins=np.linspace(0, 1, 11), include_lowest=True)
cal = D.groupby("bin", observed=True).agg(n=("y", "size"), mean_predicted=("pred", "mean"), observed=("y", "mean"))
cal["gap"] = cal.observed - cal.mean_predicted
ece = (cal.n * cal.gap.abs()).sum() / cal.n.sum()
cal.round(4).to_csv(RESULTS / "4_3_bkt_calibration.csv")

fig, ax = plt.subplots(figsize=(5.4, 5), dpi=200)
ax.plot([0, 1], [0, 1], ls="--", color="#999999", lw=1, label="Perfect calibration")
ax.plot(cal.mean_predicted, cal.observed, marker="o", color="#223864", lw=2, label="BKT")
for _, r in cal.iterrows():
    ax.annotate(f"n={int(r.n)}", (r.mean_predicted, r.observed), textcoords="offset points",
                xytext=(5, -10), fontsize=7, color="#555555")
ax.set_xlabel("Predicted probability of a correct answer")
ax.set_ylabel("Observed proportion correct")
ax.set_xlim(0, 1); ax.set_ylim(0, 1.02)
ax.grid(color="#eeeeee")
ax.legend(frameon=False, loc="upper left")
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_3_calibration.png")

# --- mastery -------------------------------------------------------------------
M["level_name"] = M.level.map(LEVELS)
M.round(4).to_csv(RESULTS / "4_3_bkt_mastery.csv", index=False)
mc = M.pivot_table(index="competency", columns="level", values="code", aggfunc="size", fill_value=0)
mc = mc.reindex(columns=[1, 2, 3, 4], fill_value=0)
mc.columns = [LEVELS[c] for c in mc.columns]
mc = mc.sort_values("Mastered")
mc.to_csv(RESULTS / "4_3_bkt_mastery_counts.csv")

fig, ax = plt.subplots(figsize=(8, 4.8), dpi=200)
left = np.zeros(len(mc))
palette = ["#C8102E", "#E0A800", "#7FA7D9", "#223864"]
for col, colr in zip(mc.columns, palette):
    ax.barh(mc.index.str.replace("_", " "), mc[col], left=left, color=colr, label=col)
    left += mc[col].values
ax.set_xlabel("Participants")
ax.legend(frameon=False, ncol=4, loc="lower center", bbox_to_anchor=(.45, 1.0), fontsize=8)
for s in ("top", "right"):
    ax.spines[s].set_visible(False)
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_3_mastery.png")

# mastery vs post-test
post = {}
for p in study_participants():
    for t in p["sub"].get("testSittings", []):
        if t["kind"] == "post" and not p["withdrawn"]:
            r = t["responses"]
            post[p["code"]] = np.mean([bool(x.get("correct")) for x in r])
mm = M.groupby("code").p.mean().rename("mean_mastery").to_frame().join(pd.Series(post, name="post"), how="inner")
rho = stats.spearmanr(mm.mean_mastery, mm.post)

params = D.params.value_counts()
lines = [
    f"BKT updates analysed: {len(D)} from {D.code.nunique()} participants; parameters: {', '.join(params.index)}",
    f"Observed correct rate: {base_rate:.3f}",
    f"BKT predictions: accuracy {overall['accuracy']:.3f}, AUC {overall['auc']:.3f}, Brier {overall['brier']:.3f}, log loss {overall['log_loss']:.3f}",
    f"Baseline (always predict the overall rate): accuracy {baseline_const['accuracy']:.3f}, AUC 0.5, Brier {baseline_const['brier']:.3f}",
    f"On answers with earlier evidence in the competency (n = {len(rm)}): BKT AUC {bkt_on_rm['auc']:.3f}, Brier {bkt_on_rm['brier']:.3f}; "
    f"running-mean baseline AUC {baseline_rm['auc']:.3f}, Brier {baseline_rm['brier']:.3f}",
    f"Calibration: expected calibration error (10 bins) = {ece:.3f}",
    "",
    f"Final mastery ({M.code.nunique()} participants x {M.competency.nunique()} competencies = {len(M)}): "
    + "; ".join(f"{LEVELS[l]} {int((M.level == l).sum())} ({(M.level == l).mean():.0%})" for l in (1, 2, 3, 4)),
    f"Capped at Nearly mastered for too little drive evidence: {int(M.capped.fillna(False).astype(bool).sum())}",
    f"Mean final mastery vs post-test score: Spearman rho = {rho.statistic:.3f}, p = {rho.pvalue:.3f} (n = {len(mm)})",
]
(RESULTS / "4_3_bkt_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\n", pred.round(3).to_string(index=False))
print("\n", cal.round(3).to_string())
print("\n", mc.to_string())
