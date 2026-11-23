"""Read-only export of the Arangkada Firestore database to local JSON files.

Only reads (stream / collections) are used; nothing is written to Firestore.
Output: data/export/<collection>.json, with subcollections nested under each
document as "_sub", plus data/export/_counts.json.
"""
import json
import os
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import DocumentReference, GeoPoint

PROJECT_ID = "arangkada-ec6b5"
KEY = "data/serviceAccount.json"
OUT = "data/export"

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


def dump(col_ref, label):
    out = []
    for snap in col_ref.stream():
        entry = {
            "_id": snap.id,
            "_created": snap.create_time.isoformat() if snap.create_time else None,
            "_updated": snap.update_time.isoformat() if snap.update_time else None,
            **plain(snap.to_dict() or {}),
        }
        subs = list(snap.reference.collections())
        if subs:
            entry["_sub"] = {s.id: dump(s, f"{label}/*/{s.id}") for s in subs}
        out.append(entry)
    counts[label] = counts.get(label, 0) + len(out)
    return out


os.makedirs(OUT, exist_ok=True)
for col in db.collections():
    print(f"Exporting {col.id}...", end=" ", flush=True)
    docs = dump(col, col.id)
    with open(f"{OUT}/{col.id}.json", "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=1)
    print(f"{len(docs)} docs")

with open(f"{OUT}/_counts.json", "w", encoding="utf-8") as f:
    json.dump({"exportedAt": datetime.now().isoformat(), "counts": counts}, f, indent=1)
print("\nDocument counts:")
for k, n in sorted(counts.items()):
    print(f"  {k}: {n}")
