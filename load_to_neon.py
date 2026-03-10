"""
load_to_neon.py
---------------
Creates the 'product' table in Neon PostgreSQL and loads all rows from
the scraped CSV file.

Run once from the project root:
    python load_to_neon.py
"""

import asyncio
import asyncpg
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
import os

# Load .env from app/ directory (where config lives)
load_dotenv(Path(__file__).parent / "app" / ".env")

DATABASE_URL = os.getenv("NEON_DATABASE_URL")
CSV_PATH = Path(__file__).parent / "webscraping" / "flipkart_product_data.csv"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS product (
    product_link  TEXT,
    title         TEXT,
    brand         TEXT,
    price         INTEGER,
    discount      FLOAT,
    avg_rating    FLOAT,
    total_ratings INTEGER
);
"""


async def main():
    if not DATABASE_URL:
        raise RuntimeError(
            "NEON_DATABASE_URL not set. Make sure app/.env contains it."
        )

    print(f"Connecting to Neon PostgreSQL ...")
    conn = await asyncpg.connect(DATABASE_URL)

    # Create table
    print("Creating 'product' table if not exists ...")
    await conn.execute(CREATE_TABLE_SQL)

    # Load CSV
    print(f"Loading CSV from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    print(f"Found {len(df)} rows.")

    # Clean up: replace NaN with None (inserts as NULL)
    df = df.where(pd.notnull(df), None)

    # Convert price / total_ratings to int where possible
    def to_int_or_none(val):
        try:
            return int(float(val)) if val is not None else None
        except (ValueError, TypeError):
            return None

    # Truncate existing data to avoid duplicates on re-run
    await conn.execute("TRUNCATE TABLE product;")
    print("Truncated existing data.")

    # Bulk insert using executemany
    rows = []
    for _, row in df.iterrows():
        rows.append((
            row.get("product_link"),
            row.get("title"),
            str(row.get("brand")).strip() if row.get("brand") else None,
            to_int_or_none(row.get("price")),
            float(row["discount"]) if row.get("discount") is not None else None,
            float(row["avg_rating"]) if row.get("avg_rating") is not None else None,
            to_int_or_none(row.get("total_ratings")),
        ))

    await conn.executemany(
        """
        INSERT INTO product
            (product_link, title, brand, price, discount, avg_rating, total_ratings)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        rows,
    )

    count = await conn.fetchval("SELECT COUNT(*) FROM product;")
    print(f"\n✅ Done! {count} rows loaded into Neon 'product' table.")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
