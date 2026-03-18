"""Convert Wikipedia traffic CSV data into JSONL for MongoDB import.

Input is wide format (`Page` + many date columns).
Output is long format (one document per page per day).
"""

import polars as pl
import json
import re
from pathlib import Path
from tqdm import tqdm

# Configuration
INPUT_FILE   = "train_2.csv"
OUTPUT_JSONL = "traffic_long.jsonl"
CHUNK_SIZE   = 10_000    # rows of wide CSV per chunk (tune to your RAM)

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)


def resolve_input_path(input_name: str) -> Path:
    """Find the input CSV in expected project locations."""
    candidates = [
        PROJECT_ROOT / input_name,
        DATA_DIR / input_name,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    checked = "\n  - ".join(str(p) for p in candidates)
    raise FileNotFoundError(f"Could not find '{input_name}'. Checked:\n  - {checked}")

# Page parser
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


# Script entry point
if __name__ == "__main__":
    input_path = resolve_input_path(INPUT_FILE)
    output_path = DATA_DIR / OUTPUT_JSONL
    print(f"Reading {input_path} with Polars...")

    # Read the CSV.
    df = pl.read_csv(input_path, infer_schema_length=0)  # all cols as strings first
    date_cols = [c for c in df.columns if c != "Page"]
    total_pages = len(df)
    print(f"  {total_pages:,} pages × {len(date_cols)} dates = {total_pages * len(date_cols):,} documents")

    total_docs = 0

    with open(output_path, "w") as jf:
        for start in tqdm(range(0, total_pages, CHUNK_SIZE), desc="Transforming chunks"):
            chunk = df.slice(start, CHUNK_SIZE)

            # Convert from wide to long format.
            long = chunk.unpivot(
                index="Page",
                on=date_cols,
                variable_name="date",
                value_name="views"
            )

            # Parse numeric views safely (handles values like "1e+05").
            long = long.with_columns([
                pl.col("views").cast(pl.Float64, strict=False),
                pl.col("date").str.to_date("%Y-%m-%d"),
            ])
            long = long.filter(pl.col("views").is_not_null())
            long = long.with_columns(pl.col("views").round(0).cast(pl.Int64))

            # Add calendar fields.
            long = long.with_columns([
                pl.col("date").dt.year().alias("year"),
                pl.col("date").dt.month().alias("month"),
                pl.col("date").dt.day().alias("day"),
                pl.col("date").dt.weekday().alias("day_of_week"),
                pl.col("date").dt.week().alias("week"),
                pl.col("date").dt.to_string("%Y-%m-%d").alias("date_str"),
            ])

            # Write JSONL rows.
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

    print(f"\n✓ Done. {total_docs:,} documents written → {output_path}")
    print(f"\nNow run:")
    print(f"  mongoimport --db wikipedia_traffic --collection pageviews \\")
    print(f"              --file {output_path} --numInsertionWorkers 4")
