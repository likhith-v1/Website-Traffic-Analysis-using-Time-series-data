"""Convert raw pageview CSVs into analysis-friendly long-format outputs.

Produces:
1) JSONL for mongoimport (one document per page per day)
2) CSV for pandas workflows

Input files are processed in chunks to keep memory usage manageable.
"""

import pandas as pd
import json
import re
import os
from pathlib import Path
from tqdm import tqdm

# Configuration
INPUT_FILES = ["train_1.csv", "train_2.csv"]   # adjust paths if needed
OUTPUT_JSONL = "data/traffic_long.jsonl"
OUTPUT_CSV   = "data/traffic_long.csv"
CHUNK_SIZE   = 5000   # Wide-format rows processed per chunk.

Path("data").mkdir(exist_ok=True)

# Page-name parser
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


# Main transform
def transform(input_csv: str, jsonl_fh, csv_fh, write_csv_header: bool):
    print(f"\nProcessing {input_csv} ...")
    total_docs = 0

    reader = pd.read_csv(input_csv, chunksize=CHUNK_SIZE)
    for chunk in tqdm(reader, desc=f"  Chunks ({CHUNK_SIZE} rows each)"):
        # Reshape from wide to long format.
        date_cols = [c for c in chunk.columns if c != "Page"]
        long = chunk.melt(id_vars=["Page"], value_vars=date_cols,
                          var_name="date", value_name="views")

        # Skip missing view counts.
        long = long.dropna(subset=["views"])
        long["views"] = long["views"].astype(int)
        long["date"]  = pd.to_datetime(long["date"])

        # Extract article metadata from the page string.
        meta = long["Page"].apply(parse_page).apply(pd.Series)
        long = pd.concat([long.drop(columns=["Page"]), meta], axis=1)

        # Add calendar fields for filtering and aggregations.
        long["year"]        = long["date"].dt.year
        long["month"]       = long["date"].dt.month
        long["day"]         = long["date"].dt.day
        long["day_of_week"] = long["date"].dt.dayofweek   # 0=Mon
        long["week"]        = long["date"].dt.isocalendar().week.astype(int)
        long["date"]        = long["date"].dt.strftime("%Y-%m-%d")

        # Write JSONL: one JSON object per line.
        for row in long.itertuples(index=False):
            doc = {
                "article":     row.article,
                "project":     row.project,
                "access":      row.access,
                "agent":       row.agent,
                "date":        row.date,
                "views":       row.views,
                "year":        row.year,
                "month":       row.month,
                "day":         row.day,
                "day_of_week": row.day_of_week,
                "week":        row.week,
            }
            jsonl_fh.write(json.dumps(doc) + "\n")

        # Append long-format CSV rows.
        long.to_csv(csv_fh, index=False, header=write_csv_header)
        write_csv_header = False   # Header is written once.

        total_docs += len(long)

    print(f"  → {total_docs:,} documents written from {input_csv}")
    return total_docs


# Script entry point
if __name__ == "__main__":
    grand_total = 0
    write_header = True

    with open(OUTPUT_JSONL, "w") as jf, open(OUTPUT_CSV, "w") as cf:
        for f in INPUT_FILES:
            if not os.path.exists(f):
                print(f"WARNING: {f} not found, skipping.")
                continue
            grand_total += transform(f, jf, cf, write_header)
            write_header = False

    print(f"\n✓ Done. Total documents: {grand_total:,}")
    print(f"  JSONL → {OUTPUT_JSONL}")
    print(f"  CSV   → {OUTPUT_CSV}")
    print(f"\nTo import into MongoDB:")
    print(f"  mongoimport --db wikipedia_traffic --collection pageviews \\")
    print(f"              --file {OUTPUT_JSONL} --numInsertionWorkers 4")
