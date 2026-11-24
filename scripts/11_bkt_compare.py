"""4.3.4: comparison of the BKT models (table and figures for the paper).

Collects the leave-one-participant-out results of 07-10 into one table, and draws:
  fig_4_3_confusion_handset.png   confusion matrix, BKT as the system ran it (threshold 0.50)
  fig_4_3_confusion_bktirt.png    confusion matrix, BKT + IRT difficulty (all questions)
  fig_4_3_calibration_compare.png predicted vs observed correct rate, both models

Outputs (results/): 4_3_bkt_comparison.csv and the three figures.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from common import RESULTS

pick = lambda f, m: pd.read_csv(RESULTS / f).query("source == 'all' and model == @m").iloc[0]
ROWS = [
    ("Always predict the overall correct rate (baseline)", "4_3_pfa_metrics.csv", "baseline: overall correct rate"),
    ("BKT, hand-set parameters (as used in the study)", "4_3_pfa_metrics.csv", "BKT hand-set"),
    ("BKT, parameters fitted to the data", "4_3_bktirt_metrics.csv", "BKT (pre-test as a block)"),
    ("Performance Factors Analysis (PFA)", "4_3_pfa_metrics.csv", "PFA"),
    ("Question difficulty only (no learner history)", "4_3_pfa_metrics.csv", "Item difficulty only"),
    ("BKT + IRT difficulty, 60 test items only", "4_3_bktirt_metrics.csv", "BKT + IRT b (test items only)"),
    ("BKT + learned easiness per question", "4_3_bktitems_metrics.csv", "BKT + item easiness"),
    ("BKT + IRT difficulty, all questions", "4_3_bktirt_metrics.csv", "BKT + IRT b (all questions)"),
]
T = pd.DataFrame([{"model": name, **pick(f, m)[["auc", "brier", "balanced_accuracy", "specificity", "mcc",
                                                 "TP", "FP", "FN", "TN"]].to_dict()} for name, f, m in ROWS])
T["rmse"] = np.sqrt(T.brier)
T.round(4).to_csv(RESULTS / "4_3_bkt_comparison.csv", index=False)
print(T.round(3).to_string(index=False))


def confusion(r, path):
    m = np.array([[r.TP, r.FN], [r.FP, r.TN]], dtype=int)
    fig, ax = plt.subplots(figsize=(4.6, 3.9), dpi=200)
    ax.imshow(m, cmap="Blues")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f"{m[i, j]:,}\n({m[i, j] / m.sum():.1%})", ha="center", va="center", fontsize=11,
                    color="white" if m[i, j] > m.max() * .55 else "#222222")
    ax.set_xticks([0, 1], ["Predicted\ncorrect", "Predicted\nwrong"], fontsize=10)
    ax.set_yticks([0, 1], ["Actually\ncorrect", "Actually\nwrong"], fontsize=10)
    fig.tight_layout()
    fig.savefig(RESULTS / path)
    plt.close(fig)


confusion(T.iloc[1], "fig_4_3_confusion_handset.png")
confusion(T.iloc[-1], "fig_4_3_confusion_bktirt.png")

# calibration: the hand-set BKT bins come from 05_bkt.py; the BKT + IRT model is binned the same way
hand = pd.read_csv(RESULTS / "4_3_bkt_calibration.csv")
pr = pd.read_csv(RESULTS / "4_3_bktirt_predictions.csv")
s, y = pr["BKT + IRT b (all questions)"].values, pr.y.values
k = np.minimum((s * 10).astype(int), 9)
irt = pd.DataFrame([{"n": (k == j).sum(), "pred": s[k == j].mean(), "obs": y[k == j].mean()}
                    for j in range(10) if (k == j).sum() >= 20])
fig, ax = plt.subplots(figsize=(5.6, 5), dpi=200)
ax.plot([0, 1], [0, 1], ls="--", color="#999999", lw=1, label="Perfect calibration")
ax.plot(hand.mean_predicted, hand.observed, marker="o", color="#C8102E", lw=2,
        label="BKT, hand-set (ECE 0.100)")
ax.plot(irt.pred, irt.obs, marker="s", color="#223864", lw=2, label="BKT + IRT difficulty (ECE 0.046)")
ax.set_xlim(0, 1); ax.set_ylim(0, 1)
ax.set_xlabel("Predicted chance of a correct answer", fontsize=10)
ax.set_ylabel("Observed correct rate", fontsize=10)
ax.grid(color="#eeeeee")
ax.legend(frameon=False, loc="upper left", fontsize=9)
for sp in ("top", "right"):
    ax.spines[sp].set_visible(False)
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_3_calibration_compare.png")
