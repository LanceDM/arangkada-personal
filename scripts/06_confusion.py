"""Extra model evaluation for 4.3: confusion matrices and classification metrics.

1. BKT next-answer prediction: each logged prediction (predictedCorrect) is
   read as "correct" at >= 0.50 and compared with the actual answer.
   Also at the threshold that maximises Youden's J, and an ROC curve.
2. Final mastery vs the post-test (external check): each post-test answer is
   predicted "correct" when the participant's competency was Mastered
   (BKT level 4) at the end of the course, and compared with the answer.

Outputs (results/):
  4_3_confusion_summary.txt
  4_3_confusion_metrics.csv
  fig_4_3_confusion.png
  fig_4_3_roc.png
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from common import RESULTS, study_participants


def confusion(y, yhat):
    y, yhat = np.asarray(y).astype(int), np.asarray(yhat).astype(int)
    tp = int(((y == 1) & (yhat == 1)).sum()); tn = int(((y == 0) & (yhat == 0)).sum())
    fp = int(((y == 0) & (yhat == 1)).sum()); fn = int(((y == 1) & (yhat == 0)).sum())
    return tp, fp, fn, tn


def scores(tp, fp, fn, tn):
    n = tp + fp + fn + tn
    prec = tp / (tp + fp) if tp + fp else np.nan
    rec = tp / (tp + fn) if tp + fn else np.nan
    spec = tn / (tn + fp) if tn + fp else np.nan
    npv = tn / (tn + fn) if tn + fn else np.nan
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else np.nan
    denom = np.sqrt(float((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)))
    mcc = (tp * tn - fp * fn) / denom if denom else 0.0
    po = (tp + tn) / n
    pe = ((tp + fp) * (tp + fn) + (fn + tn) * (fp + tn)) / n ** 2
    kappa = (po - pe) / (1 - pe) if pe < 1 else np.nan
    return {"n": n, "TP": tp, "FP": fp, "FN": fn, "TN": tn, "accuracy": po,
            "precision": prec, "recall": rec, "specificity": spec, "npv": npv, "f1": f1,
            "balanced_accuracy": (rec + spec) / 2, "mcc": mcc, "kappa": kappa}


bkt, final, post = [], {}, []
for p in study_participants():
    if p["withdrawn"]:
        continue
    for b in p["sub"].get("bktUpdates", []):
        bkt.append({"source": b["source"], "pred": float(b["predictedCorrect"]), "y": int(bool(b["correct"]))})
    prof = (p["sub"].get("bkt") or [{}])[0].get("competencies", {})
    for c, v in prof.items():
        final[(p["code"], c)] = v.get("level")
    for t in p["sub"].get("testSittings", []):
        if t["kind"] == "post":
            for r in t["responses"]:
                post.append({"code": p["code"], "competency": r.get("competency"),
                             "y": int(bool(r.get("correct")))})
B = pd.DataFrame(bkt)
P = pd.DataFrame(post)
P["level"] = [final.get((c, k)) for c, k in zip(P.code, P.competency)]
P = P.dropna(subset=["level"])

rows = []
# 1. BKT next-answer prediction at 0.50
rows.append({"model": "BKT next answer", "threshold": 0.5, "group": "all",
             **scores(*confusion(B.y, B.pred >= .5))})
for s, g in B.groupby("source"):
    rows.append({"model": "BKT next answer", "threshold": 0.5, "group": s, **scores(*confusion(g.y, g.pred >= .5))})
# ROC + Youden threshold
thr = np.unique(np.round(B.pred, 4))
roc = []
for t in np.r_[thr, 1.01]:
    tp, fp, fn, tn = confusion(B.y, B.pred >= t)
    roc.append((t, fp / (fp + tn), tp / (tp + fn)))
roc = pd.DataFrame(roc, columns=["t", "fpr", "tpr"]).sort_values(["fpr", "tpr"])
best = roc.assign(j=roc.tpr - roc.fpr).sort_values("j", ascending=False).iloc[0]
rows.append({"model": "BKT next answer", "threshold": round(float(best.t), 4), "group": "all (Youden-optimal threshold)",
             **scores(*confusion(B.y, B.pred >= best.t))})
auc = np.trapezoid(roc.tpr, roc.fpr) if hasattr(np, "trapezoid") else np.trapz(roc.tpr, roc.fpr)

# 2. Final mastery vs post-test answers
rows.append({"model": "Final mastery (Mastered) vs post-test answer", "threshold": "level 4", "group": "all",
             **scores(*confusion(P.y, P.level >= 4))})
M = pd.DataFrame(rows)
M.round(4).to_csv(RESULTS / "4_3_confusion_metrics.csv", index=False)

# --- figures -------------------------------------------------------------------
def draw(ax, r, title, pos="Correct", neg="Incorrect"):
    m = np.array([[r["TP"], r["FN"]], [r["FP"], r["TN"]]])
    ax.imshow(m, cmap="Blues")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f"{m[i, j]}\n({m[i, j] / m.sum():.0%})", ha="center", va="center",
                    color="white" if m[i, j] > m.max() * .55 else "#222222", fontsize=10)
    ax.set_xticks([0, 1], [f"Predicted\n{pos.lower()}", f"Predicted\n{neg.lower()}"], fontsize=8)
    ax.set_yticks([0, 1], [f"Actually\n{pos.lower()}", f"Actually\n{neg.lower()}"], fontsize=8)
    ax.set_title(title, fontsize=9)

fig, axes = plt.subplots(1, 2, figsize=(9, 4.2), dpi=200)
draw(axes[0], M.iloc[0], "BKT next-answer prediction (threshold 0.50)")
draw(axes[1], M.iloc[-1], "Final mastery vs post-test answers")
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_3_confusion.png")

fig, ax = plt.subplots(figsize=(5, 5), dpi=200)
ax.plot(roc.fpr, roc.tpr, color="#223864", lw=2, label=f"BKT (AUC = {auc:.3f})")
ax.plot([0, 1], [0, 1], ls="--", color="#999999", lw=1, label="Chance")
ax.scatter([best.fpr], [best.tpr], color="#C8102E", zorder=3, label=f"Best threshold {best.t:.2f}")
ax.set_xlabel("False positive rate (1 - specificity)")
ax.set_ylabel("True positive rate (recall)")
ax.legend(frameon=False, loc="lower right")
ax.grid(color="#eeeeee")
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_3_roc.png")

fmt = lambda r: (f"TP {r.TP}, FP {r.FP}, FN {r.FN}, TN {r.TN}; accuracy {r.accuracy:.3f}, precision {r.precision:.3f}, "
                 f"recall {r.recall:.3f}, specificity {r.specificity:.3f}, F1 {r.f1:.3f}, "
                 f"balanced accuracy {r.balanced_accuracy:.3f}, MCC {r.mcc:.3f}, kappa {r.kappa:.3f}")
lines = [f"{r.model} | {r.group} | threshold {r.threshold} | n {r.n}\n  {fmt(r)}" for r in M.itertuples()]
lines.append(f"ROC AUC (BKT next answer): {auc:.3f}")
(RESULTS / "4_3_confusion_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
