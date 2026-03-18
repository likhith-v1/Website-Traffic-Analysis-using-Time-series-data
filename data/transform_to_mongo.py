"""
data/transform_to_mongo.py

Converts train_2.csv (wide format) → long format JSONL for mongoimport.
Uses Polars for fast, memory-efficient processing.

145,063 pages × 803 dates = ~116 million documents

Usage:
    pip install polars tqdm
    python data/transform_to_mongo.py

Then import to MongoDB:
    mongoimport --db wikipedia_traffic --collection pageviews \
                --file data/traffic_long.jsonl \
                --numInsertionWorkers 4
"""

import polars as pl
import json
import re
from pathlib import Path
from tqdm import tqdm

# ── Config ────────────────────────────────────────────────────────────────────
INPUT_FILE   = "train_2.csv"
OUTPUT_JSONL = "data/traffic_long.jsonl"
CHUNK_SIZE   = 10_000    # rows of wide CSV per chunk (tune to your RAM)

Path("data").mkdir(exist_ok=True)

# ── Page name parser ──────────────────────────────────────────────────────────
_PAGE_RE = re.compile(
    r"^(?P<article>.+)_(?P<project>[a-z]+\.wikipedia\.org|wikimedia\.org)"
    r"_(?P<access>all-access|desktop|mobile-web)"
    r"_(?P<agent>all-agents|spider|user)$"
)

def parse_page(page: str) -> dict:
    m = _PAGE_RE.match(page)
    if m:
        return m.groupdict()
    return {"article": page, "project": None, "access": None, "agent": None}


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Reading {INPUT_FILE} with Polars...")

    # Read full CSV — Polars does this in parallel, very fast
    df = pl.read_csv(INPUT_FILE, infer_schema_length=0)  # all cols as strings first
    date_cols = [c for c in df.columns if c != "Page"]
    total_pages = len(df)
    print(f"  {total_pages:,} pages × {len(date_cols)} dates = {total_pages * len(date_cols):,} documents")

    total_docs = 0

    with open(OUTPUT_JSONL, "w") as jf:
        for start in tqdm(range(0, total_pages, CHUNK_SIZE), desc="Transforming chunks"):
            chunk = df.slice(start, CHUNK_SIZE)

            # Melt wide → long
            long = chunk.unpivot(
                index="Page",
                on=date_cols,
                variable_name="date",
                value_name="views"
            )

            # Drop nulls and cast
            long = long.filter(pl.col("views").is_not_null())
            long = long.with_columns([
                pl.col("views").cast(pl.Int32),
                pl.col("date").str.to_date("%Y-%m-%d"),
            ])

            # Add time features
            long = long.with_columns([
                pl.col("date").dt.year().alias("year"),
                pl.col("date").dt.month().alias("month"),
                pl.col("date").dt.day().alias("day"),
                pl.col("date").dt.weekday().alias("day_of_week"),
                pl.col("date").dt.week().alias("week"),
                pl.col("date").dt.to_string("%Y-%m-%d").alias("date_str"),
            ])

            # Write JSONL
            for row in long.iter_rows(named=True):
                meta = parse_page(row["Page"])
                doc = {
                    "article":     meta["article"],
                    "project":     meta["project"],
                    "access":      meta["access"],
                    "agent":       meta["agent"],
                    "date":        row["date_str"],
                    "views":       row["views"],
                    "year":        row["year"],
                    "month":       row["month"],
                    "day":         row["day"],
                    "day_of_week": row["day_of_week"],
                    "week":        row["week"],
                }
                jf.write(json.dumps(doc) + "\n")
                total_docs += 1

    print(f"\n✓ Done. {total_docs:,} documents written → {OUTPUT_JSONL}")
    print(f"\nNow run:")
    print(f"  mongoimport --db wikipedia_traffic --collection pageviews \\")
    print(f"              --file {OUTPUT_JSONL} --numInsertionWorkers 4")
