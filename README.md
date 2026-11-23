# Chapter 4 data analysis

Python scripts for computing the Chapter 4 results (4.1–4.3) from the
Firebase records of the study participants. Nothing here is deployed.

- `scripts/` — export and analysis scripts (committed)
- `data/` — service account key and raw Firestore export (git-ignored, stays local)
- `results/` — aggregate tables only, no names or user IDs

## Setup

    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt

## Export (read-only)

Put the service account key at `data/serviceAccount.json`, then:

    python scripts/export_firestore.py
