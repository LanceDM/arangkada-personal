"""BKT using the IRT (Rasch) item difficulty, compared with plain BKT.

Instead of learning a separate easiness for each question (09_bkt_items.py),
this version gives BKT the question's Rasch difficulty b and fits one weight
for it, so harder questions get a lower guess and a higher slip:

    logit(guess_i) = guess_source - w * b_i
    logit(slip_i)  = slip_source  + w * b_i

b is the Rasch first estimate the app uses for the post-test design,
b = ln((1 - p) / p), with p the share right among the training participants
(p kept half a response away from 0 and 1). It is recomputed in every fold
from the 20 training participants only, so the held-out participant's answers
never inform their own questions' difficulty. Questions the training
participants never saw get b = 0 (average difficulty).

  BKT + IRT b (all questions)   b for pre-test items, quiz items and drive checks
  BKT + IRT b (test items only) b only for the 60 calibrated test items (the
                                pre-test); quiz items and drive checks get b = 0

Same answers, pre-test handling and leave-one-participant-out evaluation as
07, 08 and 09. Needs PyTorch.

Outputs (results/):
  4_3_bktirt_summary.txt
  4_3_bktirt_metrics.csv
  4_3_bktirt_folds.csv
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


def rasch_b(train_seqs, test_only):
    """Rasch first estimate b = ln((1 - p) / p) per question, from the training answers."""
    right, n = defaultdict(int), defaultdict(int)
    for s in train_seqs:
        for y, src, item, _ in s["ans"]:
            right[item] += y
            n[item] += 1
    b = np.zeros(len(ITEMS))
    for item, total in n.items():
        if test_only and not item.startswith("T:"):
            continue
        c = min(max(right[item], 0.5), total - 0.5)
        b[ii[item]] = np.log((total - c) / c)
    known = b != 0
    if known.any():
        b[known] -= b[known].mean()   # centre the scale, as the Rasch model does
    return torch.tensor(b)


def init_params(with_irt):
    p = {"init": torch.zeros(len(COMPS)), "trans": torch.full((len(COMPS),), -2.0),
         "guess": torch.full((3,), -1.1), "slip": torch.full((3,), -2.2)}
    if with_irt:
        p["w"] = torch.tensor([0.5])
    for v in p.values():
        v.requires_grad_(True)
    return p


def forward(p, b, data):
    Y, S, I, M, C = data
    L0 = torch.sigmoid(p["init"])[C]
    tr = torch.sigmoid(p["trans"])[C]
    L = L0
    preds = []
    for t in range(T):
        lg, ls = p["guess"][S[:, t]], p["slip"][S[:, t]]
        if "w" in p:
            shift = p["w"] * b[I[:, t]]
            lg, ls = lg - shift, ls + shift
        g, s = torch.sigmoid(lg), torch.sigmoid(ls)
        pre = S[:, t] == 0
        Lp = torch.where(pre, L0, L)
        pc = (Lp * (1 - s) + (1 - Lp) * g).clamp(1e-9, 1 - 1e-9)
        preds.append(pc)
        y = Y[:, t]
        pcur = (L * (1 - s) + (1 - L) * g).clamp(1e-9, 1 - 1e-9)
        post = torch.where(y == 1, L * (1 - s) / pcur, L * s / (1 - pcur))
        step = torch.where(pre, torch.zeros_like(tr), tr)
        L = torch.where(M[:, t], post + (1 - post) * step, L)
    return torch.stack(preds, 1)


def fit(with_irt, b, data):
    p = init_params(with_irt)
    opt = torch.optim.LBFGS(list(p.values()), lr=1, max_iter=ITERS, line_search_fn="strong_wolfe")
    Y, _, _, M, _ = data

    def closure():
        opt.zero_grad()
        pr = forward(p, b, data)
        l = -(Y * torch.log(pr) + (1 - Y) * torch.log(1 - pr))[M].sum()
        l.backward()
        return l
    opt.step(closure)
    return p


MODES = {"BKT (pre-test as a block)": (False, False),
         "BKT + IRT b (all questions)": (True, False),
         "BKT + IRT b (test items only)": (True, True)}
preds = {m: [] for m in MODES}
weights = {m: [] for m in MODES if MODES[m][0]}
ys, srcs, codes = [], [], []
for code in CODES:
    tr_seqs = [s for s in seqs if s["code"] != code]
    te_seqs = [s for s in seqs if s["code"] == code]
    trd, ted = pack(tr_seqs), pack(te_seqs)
    m = ted[3].numpy()
    ys.append(ted[0].numpy()[m]); srcs.append(ted[1].numpy()[m]); codes += [code] * int(m.sum())
    for name, (with_irt, test_only) in MODES.items():
        b = rasch_b(tr_seqs, test_only)
        p = fit(with_irt, b, trd)
        if with_irt:
            weights[name].append(float(p["w"]))
        with torch.no_grad():
            preds[name].append(forward(p, b, ted).numpy()[m])
    print(f"  fold {code} done", flush=True)

y = np.concatenate(ys); src = np.concatenate(srcs); codes = np.array(codes)
P = {k: np.concatenate(v) for k, v in preds.items()}


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
met.round(4).to_csv(RESULTS / "4_3_bktirt_metrics.csv", index=False)
folds = pd.DataFrame([{"code": c, **{f"auc_{m}": auc(y[codes == c], s[codes == c]) for m, s in P.items()}}
                      for c in CODES])
folds.round(4).to_csv(RESULTS / "4_3_bktirt_folds.csv", index=False)

lines = [f"Answers: {len(y)}, {len(CODES)} participants; leave-one-participant-out; "
         "b recomputed per fold from the training participants", ""]
for m in P:
    r = met[(met.model == m) & (met.source == "all")].iloc[0]
    lines.append(f"{m:30s} AUC {r.auc:.3f}  Brier {r.brier:.3f}  log loss {r.log_loss:.3f}  accuracy {r.accuracy:.3f}  "
                 f"balanced acc {r.balanced_accuracy:.3f}  MCC {r.mcc:.3f}  specificity {r.specificity:.3f}")
prev = RESULTS / "4_3_bktitems_metrics.csv"
if prev.exists():
    f = pd.read_csv(prev)
    r = f[(f.model == "BKT + item easiness") & (f.source == "all")].iloc[0]
    lines.append(f"{'BKT + item easiness (09)':30s} AUC {r.auc:.3f}  Brier {r.brier:.3f}  log loss {r.log_loss:.3f}  "
                 f"accuracy {r.accuracy:.3f}  balanced acc {r.balanced_accuracy:.3f}  MCC {r.mcc:.3f}  specificity {r.specificity:.3f}")
lines.append("")
for m, w in weights.items():
    lines.append(f"{m}: fitted weight on b, mean {np.mean(w):.3f} (range {min(w):.3f} to {max(w):.3f}); "
                 f"higher AUC than plain BKT for {int((folds[f'auc_{m}'] > folds['auc_BKT (pre-test as a block)']).sum())} "
                 f"of {len(folds)} participants (Wilcoxon p = "
                 f"{stats.wilcoxon(folds[f'auc_{m}'], folds['auc_BKT (pre-test as a block)']).pvalue:.4f})")
(RESULTS / "4_3_bktirt_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\n", met.round(3).to_string(index=False))
