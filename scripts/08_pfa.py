"""Performance Factors Analysis (PFA) compared with BKT on the same answers.

PFA (Pavlik, Cen & Koedinger, 2009) is a logistic model: the chance of a correct
answer depends on the competency (its easiness), and on how many correct and
wrong answers the participant has already given in that competency, each with
its own weight per competency. Variants:

  PFA            competency easiness + weights for prior successes and failures
                 per competency + a shift per source (pre-test, quiz, drive)
  Item difficulty only   a shift per source + an easiness term per question;
                 no learner history (a check on how much the items alone explain)
  PFA + items    the PFA terms, plus an easiness term for each question / drive check
                 (learned from the training participants; unseen items get 0)

Same 4,650 answers, same order and same leave-one-participant-out evaluation
as 07_bkt_fit.py. Models are L2-regularised logistic regressions (scikit-learn).

Item ids: quiz answers carry their item id; drive answers are identified by
scenario + expected action (the logged rule id names the action the driver
took, so it would give the answer away). Pre-test answers in the BKT log are grouped per competency
(correct ones first), so their item ids are matched from the pre-test sitting
within each competency and correctness group.

Outputs (results/):
  4_3_pfa_summary.txt
  4_3_pfa_metrics.csv
  4_3_pfa_folds.csv
"""
from collections import defaultdict

import numpy as np
import pandas as pd
from scipy import sparse, stats
from sklearn.linear_model import LogisticRegression

from common import RESULTS, study_participants

SOURCES = ["pre_test", "quiz", "drive"]
C_REG = 1.0

rows = []
for p in study_participants():
    if p["withdrawn"]:
        continue
    pre_items = defaultdict(list)  # (competency, correct) -> item ids from the pre-test sitting
    for t in p["sub"].get("testSittings", []):
        if t["kind"] == "pre":
            for r in sorted(t["responses"], key=lambda r: r["itemId"]):
                if r.get("chosen") is not None:
                    pre_items[(r["competency"], bool(r["correct"]))].append(r["itemId"])
    succ, fail = defaultdict(int), defaultdict(int)
    for b in sorted(p["sub"].get("bktUpdates", []), key=lambda b: int(b.get("userSeq") or 0)):
        c, y, src = b["competency"], int(bool(b["correct"])), b["source"]
        if src == "pre_test":
            pool = pre_items[(c, bool(y))]
            item = "T:" + pool.pop(0) if pool else "T:?"
        elif src == "quiz":
            item = "Q:" + str(b.get("itemId"))
        else:
            # scenario + the expected action; not the rule id, which names the action taken
            item = f"D:{b.get('scenarioId')}|{b.get('expectedAction')}"
        # The pre-test is answered as one block, and the BKT log lists its answers
        # grouped per competency with the correct ones first. Counting earlier
        # pre-test answers would leak that order (a wrong answer always follows the
        # right ones), so every pre-test answer is predicted from nothing before it.
        pre_block = src == "pre_test"
        rows.append({"code": p["code"], "competency": c, "source": src, "item": item, "y": y,
                     "succ": 0 if pre_block else succ[c], "fail": 0 if pre_block else fail[c],
                     "bkt_hand": float(b["predictedCorrect"])})
        succ[c] += y
        fail[c] += 1 - y

D = pd.DataFrame(rows)
COMPS = sorted(D.competency.unique())
ITEMS = sorted(D["item"].unique())
ci = {c: i for i, c in enumerate(COMPS)}
ii = {t: i for i, t in enumerate(ITEMS)}


def design(df, mode):
    n, k = len(df), len(COMPS)
    r = np.arange(n)
    comp = df.competency.map(ci).values
    blocks = [sparse.csr_matrix((np.ones(n), (r, df.source.map(SOURCES.index).values)), shape=(n, 3))]
    if mode != "items only":
        blocks += [
            sparse.csr_matrix((np.ones(n), (r, comp)), shape=(n, k)),                     # easiness
            sparse.csr_matrix((df.succ.values.astype(float), (r, comp)), shape=(n, k)),     # gamma
            sparse.csr_matrix((df.fail.values.astype(float), (r, comp)), shape=(n, k)),     # rho
        ]
    if mode != "pfa":
        blocks.append(sparse.csr_matrix((np.ones(n), (r, df["item"].map(ii).values)), shape=(n, len(ITEMS))))
    return sparse.hstack(blocks).tocsr()


MODELS = {"Item difficulty only": "items only", "PFA": "pfa", "PFA + items": "pfa+items"}
pred = {m: np.zeros(len(D)) for m in MODELS}
for code in sorted(D.code.unique()):
    tr, te = D.code != code, D.code == code
    for m, items in MODELS.items():
        lr = LogisticRegression(C=C_REG, max_iter=5000)
        lr.fit(design(D[tr], items), D.y[tr])
        pred[m][te.values] = lr.predict_proba(design(D[te], items))[:, 1]
for m in MODELS:
    D[m] = pred[m]


def auc(y, s):
    pos, neg = s[y == 1], s[y == 0]
    return stats.mannwhitneyu(pos, neg).statistic / (len(pos) * len(neg))


def evaluate(y, s, thr=0.5):
    s = np.clip(np.asarray(s, float), 1e-9, 1 - 1e-9); y = np.asarray(y)
    yh = (s >= thr).astype(int)
    tp = int(((y == 1) & (yh == 1)).sum()); tn = int(((y == 0) & (yh == 0)).sum())
    fp = int(((y == 0) & (yh == 1)).sum()); fn = int(((y == 1) & (yh == 0)).sum())
    rec, spec = tp / (tp + fn), tn / (tn + fp)
    denom = np.sqrt(float((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)))
    return {"n": len(y), "auc": auc(y, s), "brier": np.mean((s - y) ** 2),
            "log_loss": -np.mean(y * np.log(s) + (1 - y) * np.log(1 - s)),
            "accuracy": (yh == y).mean(), "recall": rec, "specificity": spec,
            "balanced_accuracy": (rec + spec) / 2, "mcc": (tp * tn - fp * fn) / denom if denom else 0.0,
            "TP": tp, "FP": fp, "FN": fn, "TN": tn}


out = [{"model": "baseline: overall correct rate", "source": "all", **evaluate(D.y, np.full(len(D), D.y.mean()))}]
for m in ["bkt_hand"] + list(MODELS):
    name = "BKT hand-set" if m == "bkt_hand" else m
    out.append({"model": name, "source": "all", **evaluate(D.y, D[m])})
    for s in SOURCES:
        g = D[D.source == s]
        out.append({"model": name, "source": s, **evaluate(g.y, g[m])})
met = pd.DataFrame(out)
met.round(4).to_csv(RESULTS / "4_3_pfa_metrics.csv", index=False)

ll = lambda g, m: -np.mean(g.y * np.log(np.clip(g[m], 1e-9, 1)) + (1 - g.y) * np.log(np.clip(1 - g[m], 1e-9, 1)))
folds = pd.DataFrame([{"code": c, "answers": len(g), **{f"logloss_{m}": ll(g, m) for m in ["bkt_hand"] + list(MODELS)},
                       **{f"auc_{m}": auc(g.y.values, g[m].values) if g.y.nunique() > 1 else np.nan
                          for m in ["bkt_hand"] + list(MODELS)}}
                      for c, g in D.groupby("code")])
folds.round(4).to_csv(RESULTS / "4_3_pfa_folds.csv", index=False)

fitted = pd.read_csv(RESULTS / "4_3_bktfit_metrics.csv") if (RESULTS / "4_3_bktfit_metrics.csv").exists() else None
allm = met[met.source == "all"].set_index("model")
lines = [f"Answers: {len(D)}, {D.code.nunique()} participants, {len(ITEMS)} distinct items / drive checks; "
         f"leave-one-participant-out; L2 C = {C_REG}", ""]
for m, r in allm.iterrows():
    lines.append(f"{m:32s} AUC {r.auc:.3f}  Brier {r.brier:.3f}  log loss {r.log_loss:.3f}  accuracy {r.accuracy:.3f}  "
                 f"balanced acc {r.balanced_accuracy:.3f}  MCC {r.mcc:.3f}  specificity {r.specificity:.3f}")
if fitted is not None:
    f = fitted[(fitted.model == "fitted-competency") & (fitted.source == "all")].iloc[0]
    lines.append(f"{'BKT fitted (07_bkt_fit.py)':32s} AUC {f.auc:.3f}  Brier {f.brier:.3f}  log loss {f.log_loss:.3f}  "
                 f"accuracy {f.accuracy:.3f}  balanced acc {f.balanced_accuracy:.3f}  MCC {f.mcc:.3f}  specificity {f.specificity:.3f}")
lines.append("")
for m in MODELS:
    w = stats.wilcoxon(folds[f"auc_{m}"], folds["auc_bkt_hand"])
    better = int((folds[f"auc_{m}"] > folds["auc_bkt_hand"]).sum())
    lines.append(f"{m}: higher AUC than hand-set BKT for {better} of {len(folds)} held-out participants "
                 f"(Wilcoxon p = {w.pvalue:.4f}); mean per-participant AUC {folds[f'auc_{m}'].mean():.3f} "
                 f"vs {folds['auc_bkt_hand'].mean():.3f}")
(RESULTS / "4_3_pfa_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\n", met.round(3).to_string(index=False))
