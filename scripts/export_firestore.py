"""Read-only export of the Arangkada Firestore database to local JSON files.

Only reads are used (get / collections); nothing is written to Firestore.
Output: data/export/<collection>.json, with subcollections nested under each
document as "_sub", plus data/export/_counts.json.

Documents are read in pages (each page fully loaded before moving on), so no
read stream stays open while subcollections are being exported. Collections
that already have an export file are skipped, so a failed run can be resumed;
delete a file in data/export/ to export that collection again.
"""
import json
import os
import sys
import time
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore
from google.api_core import exceptions as gexc
from google.cloud.firestore_v1 import DocumentReference, GeoPoint

PROJECT_ID = "arangkada-ec6b5"
KEY = "data/serviceAccount.json"
OUT = "data/export"
PAGE = 200          # documents per read
TIMEOUT = 120       # seconds per read
RETRIES = 4

with open(KEY, encoding="utf-8") as f:
    if json.load(f).get("project_id") != PROJECT_ID:
        raise SystemExit(f"The key is not for {PROJECT_ID}")

firebase_admin.initialize_app(credentials.Certificate(KEY), {"projectId": PROJECT_ID})
db = firestore.client()
counts = {}


def plain(v):
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, GeoPoint):
        return {"lat": v.latitude, "lng": v.longitude}
    if isinstance(v, DocumentReference):
        return {"_ref": v.path}
    if isinstance(v, list):
        return [plain(x) for x in v]
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    return v


def with_retry(fn, what):
    for attempt in range(1, RETRIES + 1):
        try:
            return fn()
        except (gexc.DeadlineExceeded, gexc.ServiceUnavailable, gexc.InternalServerError) as e:
            if attempt == RETRIES:
                raise
            wait = 5 * attempt
            print(f"\n  {what}: {type(e).__name__}, retrying in {wait}s...", end=" ", flush=True)
            time.sleep(wait)


def read_all(col_ref):
    """Read a whole collection page by page; returns a list of snapshots."""
    snaps, last = [], None
    while True:
        q = col_ref.order_by("__name__").limit(PAGE)
        if last is not None:
            q = q.start_after(last)
        page = with_retry(lambda: q.get(timeout=TIMEOUT), col_ref.id)
        snaps.extend(page)
        if len(page) < PAGE:
            return snaps
        last = page[-1]


def dump(col_ref, label):
    out = []
    for snap in read_all(col_ref):
        entry = {
            "_id": snap.id,
            "_created": snap.create_time.isoformat() if snap.create_time else None,
            "_updated": snap.update_time.isoformat() if snap.update_time else None,
            **plain(snap.to_dict() or {}),
        }
        subs = with_retry(lambda: list(snap.reference.collections(timeout=TIMEOUT)), snap.id)
        if subs:
            entry["_sub"] = {s.id: dump(s, f"{label}/*/{s.id}") for s in subs}
        out.append(entry)
    counts[label] = counts.get(label, 0) + len(out)
    return out


os.makedirs(OUT, exist_ok=True)
for col in db.collections():
    path = f"{OUT}/{col.id}.json"
    if os.path.exists(path):
        print(f"Skipping {col.id} (already exported)")
        continue
    print(f"Exporting {col.id}...", end=" ", flush=True)
    docs = dump(col, col.id)
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
    print(f"{len(docs)} docs")

with open(f"{OUT}/_counts.json", "w", encoding="utf-8") as f:
    json.dump({"exportedAt": datetime.now().isoformat(), "counts": counts}, f, indent=1)
print("\nDocument counts (this run):")
for k, n in sorted(counts.items()):
    print(f"  {k}: {n}")
