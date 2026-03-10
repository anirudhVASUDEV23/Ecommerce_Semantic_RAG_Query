"""
ingest_to_pinecone.py
─────────────────────
One-time script: reads app/resources/faq_data.csv and upserts all FAQ
records into the Pinecone index.

Pinecone's hosted llama-text-embed-v2 model handles embedding server-side,
so we just send raw text.

Run from the project root:
    python ingest_to_pinecone.py
"""

import sys
from pathlib import Path

import pandas as pd
from pinecone import Pinecone

# ── Allow importing from app/ ─────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent / "app"))
from config import settings

# ── Paths ─────────────────────────────────────────────────────────────────────
FAQ_CSV = Path(__file__).parent / "app" / "resources" / "faq_data.csv"
NAMESPACE = "_default_"
BATCH_SIZE = 96  # Pinecone inference endpoint limit per call


def main() -> None:
    print(f"Connecting to Pinecone index: {settings.PINECONE_INDEX_NAME} ...")
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    index = pc.Index(host=settings.PINECONE_INDEX_HOST)

    # ── Check current count ───────────────────────────────────────────────────
    stats = index.describe_index_stats()
    ns = stats.get("namespaces", {}).get(NAMESPACE, {})
    existing = ns.get("vector_count", 0)
    if existing > 0:
        print(
            f"⚠  Index already has {existing} record(s) in namespace '{NAMESPACE}'.\n"
            "   Delete them via the Pinecone console first if you want a fresh ingest.\n"
            "   Proceeding with upsert (duplicates will be overwritten)."
        )

    # ── Load FAQ CSV ──────────────────────────────────────────────────────────
    print(f"Loading FAQ data from: {FAQ_CSV}")
    df = pd.read_csv(FAQ_CSV)
    print(f"Found {len(df)} FAQ rows.")

    # ── Build records (Pinecone embeds the 'text' field automatically) ────────
    records = [
        {
            "id": f"faq_{i}",
            "text": row["question"],   # field mapped for embedding (llama-text-embed-v2)
            "answer": row["answer"],   # stored metadata, returned on search
        }
        for i, row in df.iterrows()
    ]

    # ── Upsert in batches ─────────────────────────────────────────────────────
    total = len(records)
    for start in range(0, total, BATCH_SIZE):
        batch = records[start : start + BATCH_SIZE]
        index.upsert_records(NAMESPACE, batch)
        print(f"  Upserted records {start + 1}–{min(start + BATCH_SIZE, total)} / {total}")

    print(f"\n✅ Done! {total} FAQ records ingested into Pinecone index '{settings.PINECONE_INDEX_NAME}'.")

    # ── Verify ────────────────────────────────────────────────────────────────
    stats_after = index.describe_index_stats()
    ns_after = stats_after.get("namespaces", {}).get(NAMESPACE, {})
    print(f"   Pinecone now reports {ns_after.get('vector_count', '?')} vectors in namespace '{NAMESPACE}'.")


if __name__ == "__main__":
    main()
