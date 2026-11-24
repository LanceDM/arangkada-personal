"""4.2: IRT (Rasch) evaluation of the assessment and its adaptive post-test.

The system scores tests with the Rasch (1PL) model: one difficulty b per item,
ability theta by weighted likelihood estimation (WLE; Warm, 1989), as in the
deployed scoring. The post-test adapts by stage: 15
routing items for everyone, then an easy, medium or hard block of 15 chosen by
the routing score (cuts 6 / 12). The blocks were built from item difficulties
estimated on the pre-tests.

This script:
  4.2.1 calibrates the 60 items on the pre-test with conditional maximum
        likelihood (CML), with standard errors and infit / outfit mean squares;
  4.2.2 reports reliability (KR-20, WLE person reliability) and the test and
        block information functions;
  4.2.3 estimates each participant's ability (WLE theta, SE) on the pre-test and
        on the post-test, and the Ability Estimation Error (sqrt of mean SE^2);
  4.2.4 checks the difficulty adjustment: block difficulties in order, each
        routed participant's block against the block that is most informative at
        their routing ability, and how well the routed block matched their
        ability compared with the blocks they were not given.

No pre-test vs post-test comparison of scores or abilities is made here.

Outputs (results/):
  4_2_irt_summary.txt
  4_2_irt_items.csv          b, SE, infit, outfit, p, point-biserial, block
  4_2_irt_persons.csv        theta and SE per participant (pre, routing, post)
  4_2_irt_routing.csv        routing check per participant
  fig_4_2_wright_map.png     persons and items on one logit scale
  fig_4_2_information.png    information of the routing and stage-2 blocks
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.optimize import brentq, minimize

from common import RESULTS, load, study_participants


design = next(d for d in load("test_designs") if d["_id"] == "post")
BLOCKS = ["routing", "easy", "medium", "hard"]
block_of = {i: b for b in BLOCKS for i in design[b]}
comp_of = {q["_id"]: q.get("competency") for q in load("quiz_items")}

pre_rows, post = [], {}
for p in study_participants():
    if p["withdrawn"]:
        continue
    for t in p["sub"].get("testSittings", []):
        r = [x for x in t.get("responses", []) if x.get("chosen") is not None]
        if t["kind"] == "pre" and len(r) == len(t["responses"]) and r:
            pre_rows.append({"code": p["code"], **{x["itemId"]: int(bool(x["correct"])) for x in r}})
        if t["kind"] == "post":
            post[p["code"]] = {"routing": t["routing"], "resp": r}
X = pd.DataFrame(pre_rows).set_index("code").sort_index()
items = list(X.columns)

# --- 4.2.1 CML calibration ---------------------------------------------------------
score = X.sum(axis=1)
keep_p = (score > 0) & (score < X.shape[1])
p_item = X.mean()
extreme_items = [i for i in items if p_item[i] in (0.0, 1.0)]
est_items = [i for i in items if i not in extreme_items]
Xe = X.loc[keep_p, est_items].values
r_e = Xe.sum(axis=1)
k = len(est_items)


def esf(eps):
    """Elementary symmetric functions gamma_0..gamma_k of eps."""
    g = np.zeros(k + 1); g[0] = 1.0
    for e in eps:
        g[1:] = g[1:] + e * g[:-1]
    return g


def cml_nll(b_free):
    b = np.r_[b_free, -b_free.sum()]  # sum of b = 0
    g = esf(np.exp(-b))
    return (Xe @ b).sum() + np.log(g[r_e]).sum()


res = minimize(cml_nll, np.zeros(k - 1), method="BFGS")
b_hat = np.r_[res.x, -res.x.sum()]
# standard errors from the numerical Hessian of the free parameters
h = 1e-4
H = np.zeros((k - 1, k - 1))
for i in range(k - 1):
    for j in range(i, k - 1):
        e_i, e_j = np.eye(k - 1)[i] * h, np.eye(k - 1)[j] * h
        H[i, j] = H[j, i] = (cml_nll(res.x + e_i + e_j) - cml_nll(res.x + e_i - e_j)
                             - cml_nll(res.x - e_i + e_j) + cml_nll(res.x - e_i - e_j)) / (4 * h * h)
cov = np.linalg.inv(H)
J = np.vstack([np.eye(k - 1), -np.ones(k - 1)])
se_b = np.sqrt(np.diag(J @ cov @ J.T))
B = dict(zip(est_items, b_hat))
SE_B = dict(zip(est_items, se_b))


def p_correct(theta, b):
    return 1 / (1 + np.exp(-(theta - b)))


def wle(resp):
    """resp: list of (b, correct). Warm's (1989) weighted likelihood estimate and its SE,
    1 / sqrt(I(theta)). Finite for all-correct and all-wrong patterns."""
    bs = np.array([b for b, _ in resp]); ys = np.array([float(y) for _, y in resp])

    def score(th):
        pr = p_correct(th, bs)
        i = (pr * (1 - pr)).sum()
        j = (pr * (1 - pr) * (1 - 2 * pr)).sum()
        return (ys - pr).sum() + j / (2 * i)

    th = brentq(score, -10, 10)
    pr = p_correct(th, bs)
    return th, 1 / np.sqrt((pr * (1 - pr)).sum())


def info(theta, bs):
    pr = p_correct(theta, np.asarray(bs)[:, None] if np.ndim(theta) else np.asarray(bs))
    return (pr * (1 - pr)).sum(axis=0)


# person estimates on the pre-test (calibrated items only)
persons = []
for code, row in X.iterrows():
    th, se = wle([(B[i], row[i]) for i in est_items])
    persons.append({"code": code, "pre_score": int(row.sum()), "pre_items": len(items),
                    "theta_pre": th, "se_pre": se})
persons = pd.DataFrame(persons).set_index("code")

# infit / outfit at the WLE thetas
fit = []
for i in est_items:
    th = persons.loc[X.index, "theta_pre"].values
    pr = p_correct(th, B[i]); y = X[i].values
    w = pr * (1 - pr)
    z2 = (y - pr) ** 2 / w
    fit.append({"item": i, "infit": ((y - pr) ** 2).sum() / w.sum(), "outfit": z2.mean()})
fit = pd.DataFrame(fit).set_index("item")

# classical statistics alongside
tot = X.sum(axis=1)
rpb = {i: np.corrcoef(X[i], tot - X[i])[0, 1] if X[i].nunique() > 1 else np.nan for i in items}
item_tab = pd.DataFrame({
    "competency": [comp_of.get(i) for i in items],
    "post_block": [block_of.get(i) for i in items],
    "p_correct_pre": p_item.values,
    "point_biserial": [rpb[i] for i in items],
    "b": [B.get(i, np.nan) for i in items],
    "se_b": [SE_B.get(i, np.nan) for i in items],
}, index=items).join(fit)
item_tab["status"] = ["estimated" if i in B else ("all correct" if p_item[i] == 1 else "all wrong") for i in items]
item_tab["fit"] = np.where(item_tab.infit.between(0.5, 1.5) & item_tab.outfit.between(0.5, 1.5), "productive (0.5-1.5)",
                           np.where(item_tab.status != "estimated", "not estimated", "misfit"))
item_tab.index.name = "item"
item_tab.sort_values("b").round(4).to_csv(RESULTS / "4_2_irt_items.csv")

# --- 4.2.2 reliability and information ------------------------------------------------
def kr20(m):
    m = np.asarray(m, float); kk = m.shape[1]; pq = (m.mean(0) * (1 - m.mean(0))).sum()
    v = m.sum(1).var(ddof=1)
    return kk / (kk - 1) * (1 - pq / v)


kr20_pre = kr20(X.values)
# WLE person reliability: the share of the variance of the estimates that is not error
wle_rel_pre = 1 - (persons.se_pre ** 2).mean() / persons.theta_pre.var(ddof=1)

# block b's: items without an estimate (everyone right / wrong) get the extreme-score
# value the app uses, b = ln((1 - p) / p) with p clamped half a response from 0 / 1
n_pre = X.shape[0]
def b_any(i):
    if i in B:
        return B[i]
    c = min(max(X[i].sum(), 0.5), n_pre - 0.5)
    return np.log((n_pre - c) / c) - (np.mean([np.log((n_pre - min(max(X[j].sum(), .5), n_pre - .5))
                                                       / min(max(X[j].sum(), .5), n_pre - .5)) for j in est_items])
                                       - np.mean(b_hat))
BB = {i: b_any(i) for i in items}
block_b = {bl: [BB[i] for i in design[bl]] for bl in BLOCKS}

# --- 4.2.3 post-test abilities ------------------------------------------------------------
prow = []
for code, d in post.items():
    resp = d["resp"]
    rt = [(BB[x["itemId"]], bool(x["correct"])) for x in resp if x.get("block") == "routing"]
    allr = [(BB[x["itemId"]], bool(x["correct"])) for x in resp]
    th_r, se_r = wle(rt)
    th_p, se_p = wle(allr)
    routed = d["routing"]["block"]
    inf = {bl: info(th_r, block_b[bl]) for bl in ("easy", "medium", "hard")}
    best = max(inf, key=inf.get)
    stage2 = [bb for bb, _ in allr[len(rt):]]
    gaps = {bl: abs(th_p - np.mean(block_b[bl])) for bl in ("easy", "medium", "hard")}
    # SE the participant would have had with each block instead (routing + block)
    se_alt = {bl: 1 / np.sqrt(info(th_p, [b for b, _ in rt] + block_b[bl])) for bl in ("easy", "medium", "hard")}
    prow.append({"code": code, "routing_score": d["routing"]["score"], "routed_block": routed,
                 "theta_routing": th_r, "se_routing": se_r,
                 "most_informative_block": best, "consistent": routed == best,
                 "theta_post": th_p, "se_post": se_p, "post_items": len(allr),
                 "gap_routed": gaps[routed], "gap_best_other": min(v for b, v in gaps.items() if b != routed),
                 "routed_block_closest": gaps[routed] <= min(gaps.values()) + 1e-12,
                 "se_routed_block": se_alt[routed],
                 **{f"se_if_{b}": v for b, v in se_alt.items()},
                 "expected_p_correct_stage2": float(np.mean(p_correct(th_p, np.array(stage2)))) if stage2 else np.nan})
R = pd.DataFrame(prow).set_index("code").sort_index()
R.round(4).to_csv(RESULTS / "4_2_irt_routing.csv")
persons = persons.join(R[["routed_block", "theta_routing", "se_routing", "theta_post", "se_post"]], how="outer")
persons.round(4).to_csv(RESULTS / "4_2_irt_persons.csv")

rmse_pre = np.sqrt((persons.se_pre.dropna() ** 2).mean())
rmse_post = np.sqrt((R.se_post ** 2).mean())
wle_rel_post = 1 - (R.se_post ** 2).mean() / R.theta_post.var(ddof=1)

# --- figures ----------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.5, 5.5), dpi=200)
bins = np.arange(-4, 4.01, 0.5)
colors = {"routing": "#888888", "easy": "#2E7D32", "medium": "#E0A800", "hard": "#C8102E"}
ax.hist(persons.theta_pre.dropna(), bins=bins, orientation="horizontal", color="#223864", alpha=.85,
        label="Participants (pre-test θ)")
for col, bl in enumerate(BLOCKS):
    bs = np.round([BB[i] for i in design[bl]], 2)
    seen = {}
    xs = []
    for b in bs:  # items with the same difficulty are spread sideways
        xs.append(-(4.6 - 1.15 * col) + 0.22 * seen.get(b, 0))
        seen[b] = seen.get(b, 0) + 1
    ax.scatter(xs, bs, marker="_", s=90, lw=2, color=colors[bl], label=f"{bl.capitalize()} items (15)")
ax.axvline(0, color="#cccccc", lw=1)
ax.set_xlabel("← Items (by post-test block)          Participants (count) →")
ax.set_ylabel("Logits (higher = more able / harder)")
ax.set_xticks([0, 2, 4, 6, 8])
ax.set_xlim(-5, 8.5)
ax.legend(frameon=False, fontsize=8, loc="lower right")
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_2_wright_map.png")

fig, ax = plt.subplots(figsize=(7.5, 4.6), dpi=200)
th = np.linspace(-5, 5, 201)
for bl in BLOCKS:
    ax.plot(th, info(th, block_b[bl]), color=colors[bl], lw=2, label=f"{bl.capitalize()} block (15 items)")
ax.set_xlabel("Ability θ (logits)")
ax.set_ylabel("Test information")
ax.grid(color="#eeeeee")
ax.legend(frameon=False, fontsize=8)
for s in ("top", "right"):
    ax.spines[s].set_visible(False)
fig.tight_layout()
fig.savefig(RESULTS / "fig_4_2_information.png")

# --- summary --------------------------------------------------------------------------------
it = item_tab[item_tab.status == "estimated"]
order_ok = np.mean(block_b["easy"]) < np.mean(block_b["medium"]) < np.mean(block_b["hard"])
lines = [
    "4.2.1 Item calibration (Rasch, CML on the pre-test)",
    f"  pre-tests: {X.shape[0]} complete ({int((~keep_p).sum())} with an extreme score left out of CML); 60 items",
    f"  items estimated: {len(est_items)}; not estimable: {len(extreme_items)} "
    f"({', '.join(f'{i} ({item_tab.status[i]})' for i in extreme_items) or '-'})",
    f"  difficulty b: mean {it.b.mean():.2f}, SD {it.b.std():.2f}, range {it.b.min():.2f} to {it.b.max():.2f}; "
    f"mean SE {it.se_b.mean():.2f}",
    f"  fit (infit and outfit within 0.5-1.5): {int((it.fit == 'productive (0.5-1.5)').sum())} of {len(it)}; "
    f"misfit: {', '.join(it.index[it.fit == 'misfit']) or '-'}",
    "",
    "4.2.2 Reliability and information",
    f"  KR-20 pre-test: {kr20_pre:.3f}; WLE person reliability pre-test: {wle_rel_pre:.3f}",
    "  block mean b: " + ", ".join(f"{bl} {np.mean(block_b[bl]):.2f}" for bl in BLOCKS)
    + f"; easy < medium < hard: {order_ok}",
    "  ability where each block gives most information: "
    + ", ".join(f"{bl} {th[np.argmax(info(th, block_b[bl]))]:.2f}" for bl in BLOCKS),
    "",
    "4.2.3 Ability estimates (WLE)",
    f"  pre-test theta: mean {persons.theta_pre.mean():.2f}, SD {persons.theta_pre.std():.2f}; "
    f"Ability Estimation Error sqrt(mean SE^2) = {rmse_pre:.3f} (60 items)",
    f"  post-test theta: mean {R.theta_post.mean():.2f}, SD {R.theta_post.std():.2f}; "
    f"Ability Estimation Error = {rmse_post:.3f} (30 items); WLE reliability {wle_rel_post:.3f}",
    "",
    "4.2.4 Adaptive difficulty (two-stage routing, cuts " + "/".join(map(str, design["cuts"])) + ")",
    "  routed: " + ", ".join(f"{b} {n}" for b, n in R.routed_block.value_counts().items()),
    f"  routed block = most informative block at the routing ability: {int(R.consistent.sum())} of {len(R)}",
    f"  routed block's mean difficulty closest to the participant's post-test ability: "
    f"{int(R.routed_block_closest.sum())} of {len(R)}",
    f"  mean |theta - block mean b|: routed block {R.gap_routed.mean():.2f} vs best other block {R.gap_best_other.mean():.2f}",
    f"  expected chance of a correct stage-2 answer at the participant's ability: mean {R.expected_p_correct_stage2.mean():.2f}",
    "  SE with the routed block vs the same routing + another block: "
    + f"routed {R.se_routed_block.mean():.3f}; "
    + ", ".join(f"if every one took {b} {R[f'se_if_{b}'].mean():.3f}" for b in ('easy', 'medium', 'hard')),
]
(RESULTS / "4_2_irt_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
print("\n", R[["routing_score", "routed_block", "theta_routing", "most_informative_block", "consistent",
               "theta_post", "se_post", "gap_routed", "gap_best_other"]].round(2).to_string())
