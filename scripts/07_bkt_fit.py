"""Fitting BKT to the study data (post-hoc analysis; the app is not changed).

During the study BKT ran with hand-set parameters, one set per evidence source:
  pre-test  pTransit 0,    pGuess 0.25, pSlip 0.10
  quiz      pTransit 0.03, pGuess 0.25, pSlip 0.20
  drive     pTransit 0.03, pGuess 0.35, pSlip 0.10
  pInit 0.50 for every competency.

This script replays the same answer sequences (participant x competency, in
the order logged, userSeq) and fits the parameters by maximum likelihood:

  A. hand-set     the parameters used in the study (replay = the logged predictions)
  B. fitted-global      one pInit, one pTransit (quiz and drive; 0 on the pre-test,
                        as in the app), pGuess and pSlip per source        -> 8 parameters
  C. fitted-pinit       B, with pInit per competency                       -> 18 parameters
  D. fitted-competency  C, with pTransit per competency too                -> 28 parameters

Bounds (to keep the model identifiable, Baker, Corbett & Aleven, 2008):
pGuess <= 0.30, pSlip <= 0.20 (the hand-set drive guess of 0.35 is outside this).

Evaluation: leave-one-participant-out. For each of the 21 participants, the
models are fitted on the other 20 and predict that participant's answers, so
every prediction comes from parameters that never saw that person.

Outputs (results/):
  4_3_bktfit_summary.txt
  4_3_bktfit_metrics.csv        per model: AUC, Brier, log loss, accuracy, confusion counts
  4_3_bktfit_params.csv         parameters fitted on all 21 participants
  4_3_bktfit_folds.csv          per held-out participant: log loss and AUC per model
  fig_4_3_bktfit_calibration.png
"""
from collections import defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import minimize

from common import RESULTS, study_participants

SOURCES = ["pre_test", "quiz", "drive"]
HAND = {"pInit": 0.5,
        "pTransit": {"pre_test": 0.0, "quiz": 0.03, "drive": 0.03},
        "pGuess": {"pre_test": 0.25, "quiz": 0.25, "drive": 0.35},
        "pSlip": {"pre_test": 0.10, "quiz": 0.20, "drive": 0.10}}
B_GUESS, B_SLIP, B_TRANSIT, B_INIT = (0.01, 0.30), (0.01, 0.20), (0.0, 0.50), (0.01, 0.99)
STARTS = 6
rng = np.random.default_rng(20261124)

# --- sequences -------------------------------------------------------------------
seqs = []  # dicts: code, competency, y (array), src (array of source index), logged (array)
for p in study_participants():
    if p["withdrawn"]:
        continue
    by = defaultdict(list)
    for b in sorted(p["sub"].get("bktUpdates", []), key=lambda b: int(b.get("userSeq") or 0)):
        by[b["competency"]].append(b)
    for c, ups in by.items():
        seqs.append({"code": p["code"], "competency": c,
                     "y": np.array([int(bool(u["correct"])) for u in ups]),
                     "src": np.array([SOURCES.index(u["source"]) for u in ups]),
                     "logged": np.array([float(u["predictedCorrect"]) for u in ups])})
COMPS = sorted({s["competency"] for s in seqs})
CODES = sorted({s["code"] for s in seqs})
T = max(len(s["y"]) for s in seqs)


def pack(subset):
    n = len(subset)
    Y = np.zeros((n, T)); S = np.zeros((n, T), int); M = np.zeros((n, T), bool)
    C = np.array([COMPS.index(s["competency"]) for s in subset])
    for i, s in enumerate(subset):
        k = len(s["y"]); Y[i, :k] = s["y"]; S[i, :k] = s["src"]; M[i, :k] = True
    return Y, S, M, C


# --- the model -------------------------------------------------------------------
def unpack(theta, model):
    """theta -> per-competency pInit (11), per-competency pTransit (11), guess (3), slip (3)."""
    g, s = theta[0:3], theta[3:6]
    if model == "fitted-global":
        init = np.full(len(COMPS), theta[6]); tr = np.full(len(COMPS), theta[7])
    elif model == "fitted-pinit":
        tr = np.full(len(COMPS), theta[6]); init = theta[7:7 + len(COMPS)]
    else:  # fitted-competency
        init = theta[6:6 + len(COMPS)]; tr = theta[6 + len(COMPS):6 + 2 * len(COMPS)]
    return init, tr, g, s


def bounds(model):
    b = [B_GUESS] * 3 + [B_SLIP] * 3
    if model == "fitted-global":
        return b + [B_INIT, B_TRANSIT]
    if model == "fitted-pinit":
        return b + [B_TRANSIT] + [B_INIT] * len(COMPS)
    return b + [B_INIT] * len(COMPS) + [B_TRANSIT] * len(COMPS)


def forward(params, packed):
    """Run BKT over every sequence at once; returns P(correct) before each answer."""
    init, tr, g, s = params
    Y, S, M, C = packed
    L = init[C].copy()
    pred = np.zeros_like(Y)
    for t in range(T):
        live = M[:, t]
        if not live.any():
            break
        gt, st = g[S[:, t]], s[S[:, t]]
        pc = L * (1 - st) + (1 - L) * gt
        pred[:, t] = pc
        y = Y[:, t]
        post = np.where(y == 1, L * (1 - st) / pc, L * st / (1 - pc))
        trt = np.where(S[:, t] == 0, 0.0, tr[C])  # no learning step on the pre-test, as in the app
        L = np.where(live, post + (1 - post) * trt, L)
    return pred


def nll(theta, model, packed):
    pred = np.clip(forward(unpack(theta, model), packed), 1e-9, 1 - 1e-9)
    Y, _, M, _ = packed
    return -(Y * np.log(pred) + (1 - Y) * np.log(1 - pred))[M].sum()


def fit(model, packed):
    bd = bounds(model)
    best = None
    for k in range(STARTS):
        x0 = np.array([rng.uniform(lo + .1 * (hi - lo), hi - .1 * (hi - lo)) for lo, hi in bd])
        r = minimize(nll, x0, args=(model, packed), method="L-BFGS-B", bounds=bd)
        if best is None or r.fun < best.fun:
            best = r
    return best.x


def hand_params():
    return (np.full(len(COMPS), HAND["pInit"]),
            np.full(len(COMPS), 0.03),
            np.array([HAND["pGuess"][s] for s in SOURCES]),
            np.array([HAND["pSlip"][s] for s in SOURCES]))


def hand_forward(packed):
    """The hand-set model, with its own pTransit per source (0 on the pre-test)."""
    return forward(hand_params(), packed)


MODELS = ["fitted-global", "fitted-pinit", "fitted-competency"]

# --- sanity: the hand-set replay reproduces the logged predictions ---------------
allp = pack(seqs)
logged = np.zeros((len(seqs), T))
for i, q in enumerate(seqs):
    logged[i, :len(q["logged"])] = q["logged"]
replay_gap = np.abs(hand_forward(allp) - logged)[allp[2]].max()
assert replay_gap < 1e-9, f"hand-set replay differs from the logged predictions by {replay_gap}"

# --- leave-one-participant-out -----------------------------------------------------
preds = {m: [] for m in ["hand-set"] + MODELS}
ys, srcs, fold_rows = [], [], []
for code in CODES:
    train = [s for s in seqs if s["code"] != code]
    test = [s for s in seqs if s["code"] == code]
    tp, te = pack(train), pack(test)
    y = te[0][te[2]]
    ys.append(y); srcs.append(te[1][te[2]])
    row = {"code": code, "answers": len(y)}
    hp = hand_forward(te)[te[2]]
    preds["hand-set"].append(hp)
    for m in MODELS:
        th = fit(m, tp)
        pr = forward(unpack(th, m), te)[te[2]]
        preds[m].append(pr)
    for m in preds:
        pr = np.clip(preds[m][-1], 1e-9, 1 - 1e-9)
        row[f"logloss_{m}"] = -np.mean(y * np.log(pr) + (1 - y) * np.log(1 - pr))
    fold_rows.append(row)
    print(f"  fold {code} done", flush=True)
y = np.concatenate(ys)
src = np.concatenate(srcs)
P = {m: np.concatenate(v) for m, v in preds.items()}


def auc(y, s):
    pos, neg = s[y == 1], s[y == 0]
    return stats.mannwhitneyu(pos, neg).statistic / (len(pos) * len(neg))


def evaluate(y, s, thr=0.5):
    s = np.clip(s, 1e-9, 1 - 1e-9)
    yh = (s >= thr).astype(int)
    tp = int(((y == 1) & (yh == 1)).sum()); tn = int(((y == 0) & (yh == 0)).sum())
    fp = int(((y == 0) & (yh == 1)).sum()); fn = int(((y == 1) & (yh == 0)).sum())
    rec, spec = tp / (tp + fn), tn / (tn + fp) if tn + fp else np.nan
    denom = np.sqrt(float((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)))
    return {"n": len(y), "auc": auc(y, s), "brier": np.mean((s - y) ** 2),
            "log_loss": -np.mean(y * np.log(s) + (1 - y) * np.log(1 - s)),
            "accuracy": (yh == y).mean(), "recall": rec, "specificity": spec,
            "balanced_accuracy": (rec + spec) / 2, "mcc": (tp * tn - fp * fn) / denom if denom else 0.0,
            "TP": tp, "FP": fp, "FN": fn, "TN": tn}


base = np.full_like(y, y.mean(), dtype=float)
rows = [{"model": "baseline: overall correct rate", "source": "all", **evaluate(y, base)}]
for m, s in P.items():
    rows.append({"model": m, "source": "all", **evaluate(y, s)})
    for k, name in enumerate(SOURCES):
        rows.append({"model": m, "source": name, **evaluate(y[src == k], s[src == k])})
met = pd.DataFrame(rows)
met.round(4).to_csv(RESULTS / "4_3_bktfit_metrics.csv", index=False)
folds = pd.DataFrame(fold_rows)
folds.round(4).to_csv(RESULTS / "4_3_bktfit_folds.csv", index=False)

# paired test across held-out participants: best fitted vs hand-set log loss
best_model = min(MODELS, key=lambda m: met[(met.model == m) & (met.source == "all")].log_loss.iloc[0])
wil = stats.wilcoxon(folds[f"logloss_{best_model}"], folds["logloss_hand-set"])
better = int((folds[f"logloss_{best_model}"] < folds["logloss_hand-set"]).sum())

# --- parameters fitted on everyone ----------------------------------------------------
prow = []
for m in MODELS:
    init, tr, g, s = unpack(fit(m, allp), m)
    for k, name in enumerate(SOURCES):
        prow.append({"model": m, "parameter": f"pGuess ({name})", "value": g[k]})
        prow.append({"model": m, "parameter": f"pSlip ({name})", "value": s[k]})
    if m == "fitted-global":
        prow += [{"model": m, "parameter": "pInit (all)", "value": init[0]},
                 {"model": m, "parameter": "pTransit (quiz, drive)", "value": tr[0]}]
    else:
        prow += [{"model": m, "parameter": f"pInit ({c})", "value": init[i]} for i, c in enumerate(COMPS)]
        if m == "fitted-pinit":
            prow.append({"model": m, "parameter": "pTransit (quiz, drive)", "value": tr[0]})
        else:
            prow += [{"model": m, "parameter": f"pTransit ({c})", "value": tr[i]} for i, c in enumerate(COMPS)]
par = pd.DataFrame(prow)
par.round(4).to_csv(RESULTS / "4_3_bktfit_params.csv", index=False)

# --- calibration figure ------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(5.6, 5), dpi=200)
ax.plot([0, 1], [0, 1], ls="--", color="#999999", lw=1, label="Perfect calibration")
for m, colr in (("hand-set", "#C8102E"), (best_model, "#223864")):
    d = pd.DataFrame({"p": P[m], "y": y})
    d["bin"] = pd.cut(d.p, np.linspace(0, 1, 11), include_lowest=True)
    c = d.groupby("bin", observed=True).agg(n=("y", "size"), p=("p", "mean"), o=("y", "mean"))
    c = c[c.n >= 20]
    ax.plot(c.p, c.o, marker="o", color=colr, lw=2, label=m)
ax.set_xlabel("Predicted probability of a correct answer")
ax.set_ylabel("Observed proportion correct")
ax.set_xlim(0, 1); ax.set_ylim(0, 1.02)
ax.grid(color="#eeeeee")
ax.legend(frameon=False, loc="upper left")
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_3_bktfit_calibration.png")

allrow = met[met.source == "all"].set_index("model")
lines = [f"Hand-set replay matches the logged predictions (max difference {replay_gap:.1e})",
         f"Answers: {len(y)} in {len(seqs)} sequences (participant x competency), {len(CODES)} participants; "
         f"leave-one-participant-out", ""]
for m in ["baseline: overall correct rate", "hand-set"] + MODELS:
    r = allrow.loc[m]
    lines.append(f"{m:32s} AUC {r.auc:.3f}  Brier {r.brier:.3f}  log loss {r.log_loss:.3f}  "
                 f"accuracy {r.accuracy:.3f}  balanced acc {r.balanced_accuracy:.3f}  MCC {r.mcc:.3f}")
lines += ["",
          f"Best fitted model by log loss: {best_model}; lower log loss than hand-set for "
          f"{better} of {len(folds)} held-out participants (Wilcoxon p = {wil.pvalue:.4f})",
          "", "Parameters fitted on all participants:"]
for m in MODELS:
    sub = par[par.model == m]
    lines.append(f"  {m}: " + ", ".join(f"{r.parameter} {r.value:.3f}" for r in sub.itertuples()))
(RESULTS / "4_3_bktfit_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\n", met.round(3).to_string(index=False))
