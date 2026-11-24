"""BKT with question difficulty (KT-IDEM style), compared with plain BKT and PFA.

Standard BKT gives every question in a competency the same guess and slip. Here
each question (pre-test item, quiz item, or drive check = scenario + expected
action) can shift them:

  BKT                 pInit and pTransit per competency; guess and slip per source
  BKT + item easiness the same, plus one easiness per question that raises the
                      guess and lowers the slip together (logit scale)
  KT-IDEM             the same base, plus a separate guess and slip offset per
                      question (Pardos & Heffernan, 2011)

Question offsets carry an L2 penalty (as in the PFA comparison), so a question
seen only a few times stays close to its source's guess and slip.

The pre-test is treated as one block, as in 08_pfa.py: each pre-test answer is
predicted from the state before the pre-test, and all of them then update it.
(The BKT log lists pre-test answers per competency with the correct ones first;
updating within the block would let that order leak into the predictions.)
No learning step is applied on the pre-test (pTransit = 0 there), as in the app.

Evaluation: leave-one-participant-out, the same 4,650 answers as 07 and 08.
Needs PyTorch (for the gradients): pip install torch

Outputs (results/):
  4_3_bktitems_summary.txt
  4_3_bktitems_metrics.csv
  4_3_bktitems_folds.csv
"""
from collections import defaultdict

import numpy as np
import pandas as pd
import torch
from scipy import stats

from common import RESULTS, study_participants

torch.set_default_dtype(torch.float64)
torch.manual_seed(20261124)
SOURCES = ["pre_test", "quiz", "drive"]
L2 = 1.0
ITERS = 300

# --- sequences (same answers and order as 07/08) -----------------------------------
seqs = []
for p in study_participants():
    if p["withdrawn"]:
        continue
    pre_items = defaultdict(list)
    for t in p["sub"].get("testSittings", []):
        if t["kind"] == "pre":
            for r in sorted(t["responses"], key=lambda r: r["itemId"]):
                if r.get("chosen") is not None:
                    pre_items[(r["competency"], bool(r["correct"]))].append(r["itemId"])
    by = defaultdict(list)
    for b in sorted(p["sub"].get("bktUpdates", []), key=lambda b: int(b.get("userSeq") or 0)):
        c, y = b["competency"], bool(b["correct"])
        if b["source"] == "pre_test":
            pool = pre_items[(c, y)]
            item = "T:" + pool.pop(0) if pool else "T:?"
        elif b["source"] == "quiz":
            item = "Q:" + str(b.get("itemId"))
        else:
            item = f"D:{b.get('scenarioId')}|{b.get('expectedAction')}"
        by[c].append((int(y), SOURCES.index(b["source"]), item, float(b["predictedCorrect"])))
    for c, ans in by.items():
        seqs.append({"code": p["code"], "competency": c, "ans": ans})

COMPS = sorted({s["competency"] for s in seqs})
ITEMS = sorted({a[2] for s in seqs for a in s["ans"]})
CODES = sorted({s["code"] for s in seqs})
T = max(len(s["ans"]) for s in seqs)
ci, ii = {c: i for i, c in enumerate(COMPS)}, {t: i for i, t in enumerate(ITEMS)}


def pack(subset):
    n = len(subset)
    Y = np.zeros((n, T)); S = np.zeros((n, T), int); I = np.zeros((n, T), int); M = np.zeros((n, T), bool)
    for k, s in enumerate(subset):
        for t, (y, src, item, _) in enumerate(s["ans"]):
            Y[k, t], S[k, t], I[k, t], M[k, t] = y, src, ii[item], True
    C = np.array([ci[s["competency"]] for s in subset])
    return (torch.tensor(Y), torch.tensor(S), torch.tensor(I), torch.tensor(M), torch.tensor(C))


def init_params(mode):
    p = {"init": torch.zeros(len(COMPS)), "trans": torch.full((len(COMPS),), -2.0),
         "guess": torch.full((3,), -1.1), "slip": torch.full((3,), -2.2)}
    if mode == "easiness":
        p["item"] = torch.zeros(len(ITEMS))
    if mode == "idem":
        p["item_g"] = torch.zeros(len(ITEMS)); p["item_s"] = torch.zeros(len(ITEMS))
    for v in p.values():
        v.requires_grad_(True)
    return p


def forward(p, mode, data):
    Y, S, I, M, C = data
    L0 = torch.sigmoid(p["init"])[C]
    tr = torch.sigmoid(p["trans"])[C]
    L = L0
    preds = []
    for t in range(T):
        lg, ls = p["guess"][S[:, t]], p["slip"][S[:, t]]
        if mode == "easiness":
            lg, ls = lg + p["item"][I[:, t]], ls - p["item"][I[:, t]]
        elif mode == "idem":
            lg, ls = lg + p["item_g"][I[:, t]], ls + p["item_s"][I[:, t]]
        g, s = torch.sigmoid(lg), torch.sigmoid(ls)
        pre = S[:, t] == 0
        Lp = torch.where(pre, L0, L)                     # pre-test: predicted from before the block
        pc = (Lp * (1 - s) + (1 - Lp) * g).clamp(1e-9, 1 - 1e-9)
        preds.append(pc)
        y = Y[:, t]
        pcur = (L * (1 - s) + (1 - L) * g).clamp(1e-9, 1 - 1e-9)
        post = torch.where(y == 1, L * (1 - s) / pcur, L * s / (1 - pcur))
        step = torch.where(pre, torch.zeros_like(tr), tr)
        L = torch.where(M[:, t], post + (1 - post) * step, L)
    return torch.stack(preds, 1)


def loss(p, mode, data):
    Y, _, _, M, _ = data
    pr = forward(p, mode, data)
    nll = -(Y * torch.log(pr) + (1 - Y) * torch.log(1 - pr))[M].sum()
    pen = sum((v ** 2).sum() for k, v in p.items() if k.startswith("item")) * L2 / 2
    return nll + pen


def fit(mode, data):
    p = init_params(mode)
    opt = torch.optim.LBFGS(list(p.values()), lr=1, max_iter=ITERS, line_search_fn="strong_wolfe")

    def closure():
        opt.zero_grad()
        l = loss(p, mode, data)
        l.backward()
        return l
    opt.step(closure)
    return p


MODES = {"BKT (pre-test as a block)": "plain", "BKT + item easiness": "easiness", "KT-IDEM": "idem"}
preds = {m: [] for m in MODES}
ys, hand, srcs, codes = [], [], [], []
for code in CODES:
    tr_seqs = [s for s in seqs if s["code"] != code]
    te_seqs = [s for s in seqs if s["code"] == code]
    trd, ted = pack(tr_seqs), pack(te_seqs)
    m = ted[3].numpy()
    ys.append(ted[0].numpy()[m]); srcs.append(ted[1].numpy()[m]); codes += [code] * int(m.sum())
    lg = np.zeros(m.shape)
    for k, s in enumerate(te_seqs):
        lg[k, :len(s["ans"])] = [a[3] for a in s["ans"]]
    hand.append(lg[m])
    for name, mode in MODES.items():
        p = fit(mode, trd)
        with torch.no_grad():
            preds[name].append(forward(p, mode, ted).numpy()[m])
    print(f"  fold {code} done", flush=True)

y = np.concatenate(ys); src = np.concatenate(srcs); codes = np.array(codes)
P = {"BKT hand-set (as logged)": np.concatenate(hand), **{k: np.concatenate(v) for k, v in preds.items()}}


def auc(y, s):
    pos, neg = s[y == 1], s[y == 0]
    return stats.mannwhitneyu(pos, neg).statistic / (len(pos) * len(neg))


def evaluate(y, s, thr=0.5):
    s = np.clip(s, 1e-9, 1 - 1e-9)
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


rows = []
for m, s in P.items():
    rows.append({"model": m, "source": "all", **evaluate(y, s)})
    for k, name in enumerate(SOURCES):
        rows.append({"model": m, "source": name, **evaluate(y[src == k], s[src == k])})
met = pd.DataFrame(rows)
met.round(4).to_csv(RESULTS / "4_3_bktitems_metrics.csv", index=False)
folds = pd.DataFrame([{"code": c, **{f"auc_{m}": auc(y[codes == c], s[codes == c]) for m, s in P.items()}}
                      for c in CODES])
folds.round(4).to_csv(RESULTS / "4_3_bktitems_folds.csv", index=False)

pfa = RESULTS / "4_3_pfa_metrics.csv"
lines = [f"Answers: {len(y)}, {len(CODES)} participants, {len(ITEMS)} questions / drive checks; "
         f"leave-one-participant-out; L2 on question offsets = {L2}", ""]
for m in P:
    r = met[(met.model == m) & (met.source == "all")].iloc[0]
    lines.append(f"{m:28s} AUC {r.auc:.3f}  Brier {r.brier:.3f}  log loss {r.log_loss:.3f}  accuracy {r.accuracy:.3f}  "
                 f"balanced acc {r.balanced_accuracy:.3f}  MCC {r.mcc:.3f}  specificity {r.specificity:.3f}")
if pfa.exists():
    f = pd.read_csv(pfa)
    for m in ("Item difficulty only", "PFA + items"):
        r = f[(f.model == m) & (f.source == "all")].iloc[0]
        lines.append(f"{m + ' (08_pfa.py)':28s} AUC {r.auc:.3f}  Brier {r.brier:.3f}  log loss {r.log_loss:.3f}  "
                     f"accuracy {r.accuracy:.3f}  balanced acc {r.balanced_accuracy:.3f}  MCC {r.mcc:.3f}  specificity {r.specificity:.3f}")
lines.append("")
for m in ("BKT + item easiness", "KT-IDEM"):
    w = stats.wilcoxon(folds[f"auc_{m}"], folds["auc_BKT (pre-test as a block)"])
    lines.append(f"{m}: higher AUC than plain BKT for {int((folds[f'auc_{m}'] > folds['auc_BKT (pre-test as a block)']).sum())} "
                 f"of {len(folds)} held-out participants (Wilcoxon p = {w.pvalue:.4f})")
(RESULTS / "4_3_bktitems_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\n", met.round(3).to_string(index=False))
