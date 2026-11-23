"""4.2 (classical test statistics): item difficulty, discrimination, KR-20, routing.

The IRT (Rasch) evaluation is in 04_irt.py. No pre-test vs post-test comparison
is made.

Pre-test: 60 fixed items (the whole test bank). Post-test: a two-stage
adaptive test of 30 items, 15 routing items for everyone, then a 15-item easy,
medium or hard block chosen by the routing score. Every post-test item is also
in the pre-test.

Sample: the 19 participants who fully answered the pre-test (P-0003 and P-0014
had theirs closed by the time limit); the 21 for the post-test routing.

Outputs (results/):
  4_2_summary.txt
  4_2_item_analysis.csv       per item: difficulty (p) and discrimination, pre and post
  4_2_routing.csv             post-test routing per participant
"""
import numpy as np
import pandas as pd
from scipy import stats

from common import RESULTS, load, study_participants

items = {q["_id"]: q for q in load("quiz_items") if q.get("use") == "test"}
design = next(d for d in load("test_designs") if d["_id"] == "post")
block_of = {i: b for b in ("routing", "easy", "medium", "hard") for i in design.get(b, [])}

resp = []   # one row per answered item
sit = {}    # (code, kind) -> sitting
for p in study_participants():
    if p["withdrawn"]:
        continue
    for t in p["sub"].get("testSittings", []):
        sit[(p["code"], t["kind"])] = t
        for r in t.get("responses", []):
            resp.append({"code": p["code"], "test": t["kind"], "item": r["itemId"],
                         "competency": r.get("competency"), "block": r.get("block"),
                         "answered": r.get("chosen") is not None,
                         "correct": int(bool(r.get("correct"))) if r.get("chosen") is not None else np.nan,
                         "timeMs": r.get("timeMs")})
R = pd.DataFrame(resp)
codes = sorted(R.code.unique())
full = lambda kind: {c for c in codes if (c, kind) in sit and
                     all(r.get("chosen") is not None for r in sit[(c, kind)]["responses"])}
complete = sorted(full("pre") & full("post"))


def kr20(matrix):
    """KR-20 for a persons x items 0/1 matrix with no missing values."""
    k = matrix.shape[1]
    p = matrix.mean(axis=0)
    var_total = matrix.sum(axis=1).var(ddof=1)
    return k / (k - 1) * (1 - (p * (1 - p)).sum() / var_total) if var_total > 0 else np.nan


def item_stats(df):
    """Difficulty p and corrected point-biserial (item vs. rest of the test)."""
    m = df.pivot_table(index="code", columns="item", values="correct")
    total = m.sum(axis=1)
    out = []
    for it in m.columns:
        x = m[it].dropna()
        rest = (total - m[it].fillna(0)).loc[x.index]
        r = np.corrcoef(x, rest)[0, 1] if x.nunique() > 1 and rest.nunique() > 1 else np.nan
        out.append({"item": it, "n": len(x), "p": x.mean(), "r_pb": r})
    return pd.DataFrame(out).set_index("item")


def p_band(p):
    return "easy (p > .80)" if p > .80 else "moderate (.30-.80)" if p >= .30 else "difficult (p < .30)"


def d_band(r):
    if np.isnan(r):
        return "no variance"
    return ("very good (>= .40)" if r >= .40 else "good (.30-.39)" if r >= .30
            else "fair (.20-.29)" if r >= .20 else "poor (< .20)")


# --- item analysis -----------------------------------------------------------
pre = R[(R.test == "pre") & R.answered]
pre_full = pre[pre.code.isin(full("pre"))]
ia = item_stats(pre_full).add_prefix("pre_")
post_stats = item_stats(R[(R.test == "post") & R.answered]).add_prefix("post_")
ia = ia.join(post_stats, how="left")
ia["competency"] = [items.get(i, {}).get("competency") for i in ia.index]
ia["post_block"] = [block_of.get(i, "") for i in ia.index]
ia["difficulty"] = ia.pre_p.map(p_band)
ia["discrimination"] = ia.pre_r_pb.map(d_band)
ia.round(4).to_csv(RESULTS / "4_2_item_analysis.csv")

pre_matrix = pre_full.pivot_table(index="code", columns="item", values="correct").values
pre_kr20 = kr20(pre_matrix)
post = R[(R.test == "post") & R.answered]
routing_matrix = post[post.block == "routing"].pivot_table(index="code", columns="item", values="correct").values
routing_kr20 = kr20(routing_matrix)

# --- routing -----------------------------------------------------------------
rt = pd.DataFrame([{"code": c, "routing_score": sit[(c, "post")]["routing"]["score"],
                    "cuts": "/".join(map(str, sit[(c, "post")]["routing"]["cuts"])),
                    "block": sit[(c, "post")]["routing"]["block"],
                    "block_score": int(post[(post.code == c) & (post.block != "routing")].correct.sum())}
                   for c in codes if (c, "post") in sit])
rt.to_csv(RESULTS / "4_2_routing.csv", index=False)
blk = rt.groupby("block").agg(participants=("code", "size"), mean_routing=("routing_score", "mean"),
                              mean_block_score=("block_score", "mean"))

lines = [
    f"Participants: {len(codes)} active; {len(full('pre'))} fully answered the pre-test, "
    f"{len(full('post'))} the post-test; {len(complete)} both",
    "",
    "Item analysis (pre-test, 60 items, fully answered pre-tests)",
    f"  mean difficulty p = {ia.pre_p.mean():.3f}; " + "; ".join(f"{k}: {v}" for k, v in ia.difficulty.value_counts().items()),
    "  discrimination (corrected point-biserial): " + "; ".join(f"{k}: {v}" for k, v in ia.discrimination.value_counts().items()),
    f"  KR-20 pre-test (60 items, n = {pre_matrix.shape[0]}): {pre_kr20:.3f}",
    f"  KR-20 post-test routing stage (15 items, n = {routing_matrix.shape[0]}): {routing_kr20:.3f}",
    "",
    "Post-test routing (cuts " + "/".join(map(str, design.get("cuts") if isinstance(design.get("cuts"), list) else rt.cuts.iloc[0].split("/"))) + ")",
] + [f"  {b}: {int(r.participants)} participants, mean routing score {r.mean_routing:.1f}/15, "
     f"mean block score {r.mean_block_score:.1f}/15" for b, r in blk.iterrows()] + [
]
(RESULTS / "4_2_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
