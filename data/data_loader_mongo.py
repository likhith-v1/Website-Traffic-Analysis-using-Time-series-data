"""Load and prepare Wikipedia traffic data with Polars.

The helpers in this file are shared by the CLI pipeline and the FastAPI app.
"""

import os

import polars as pl
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("MONGO_DB_NAME", "wikipedia_traffic")
COL_NAME = os.getenv("MONGO_COLLECTION_NAME", "pageviews")


# MongoDB connection

def get_collection():
    client = MongoClient(MONGO_URI)
    return client[DB_NAME][COL_NAME]


# Data loaders

def load_article(article: str,
                 project: str = "en.wikipedia.org",
                 access:  str = "all-access",
                 agent:   str = "all-agents") -> pl.DataFrame:
    """Return daily views for one article, sorted by date."""
    col = get_collection()
    docs = list(col.find(
        {"article": article, "project": project, "access": access, "agent": agent},
        {"_id": 0, "date": 1, "views": 1}
    ).sort("date", 1))

    if not docs:
        raise ValueError(f"No data for article='{article}', project='{project}'")

    df = (
        pl.DataFrame(docs)
        .with_columns(pl.col("date").str.to_date("%Y-%m-%d"))
        .sort("date")
    )
    print(f"Loaded {len(df)} daily records for '{article}' [{project}]")
    return df


def load_aggregated_daily(project: str = "en.wikipedia.org",
                           access:  str = "all-access",
                           start:   str = None,
                           end:     str = None) -> pl.DataFrame:
    """Return daily totals across all articles for one project/access pair."""
    col = get_collection()
    match: dict = {"project": project, "access": access}
    if start or end:
        date_filter = {}
        if start: date_filter["$gte"] = start
        if end:   date_filter["$lte"] = end
        match["date"] = date_filter

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id":         "$date",
            "total_views": {"$sum": "$views"},
            "page_count":  {"$sum": 1},
            "avg_views":   {"$avg": "$views"},
            "max_views":   {"$max": "$views"},
        }},
        {"$sort": {"_id": 1}}
    ]

    docs = list(col.aggregate(pipeline, allowDiskUse=True))
    df = (
        pl.DataFrame(docs)
        .rename({"_id": "date"})
        .with_columns(pl.col("date").str.to_date("%Y-%m-%d"))
        .sort("date")
    )
    print(f"Loaded {len(df)} aggregated daily rows [{project} / {access}]")
    return df


def load_top_articles(n: int = 50,
                      project: str = "en.wikipedia.org",
                      access:  str = "all-access") -> pl.DataFrame:
    """Return top N articles ranked by total views."""
    col = get_collection()
    pipeline = [
        {"$match": {"project": project, "access": access}},
        {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}},
        {"$limit": n}
    ]
    df = pl.DataFrame(list(col.aggregate(pipeline, allowDiskUse=True))).rename({"_id": "article"})
    print(f"Top {n} articles:\n{df.head(10)}")
    return df


def load_by_project_breakdown(date: str = "2016-01-01") -> pl.DataFrame:
    """Views by project for a specific date."""
    col = get_collection()
    pipeline = [
        {"$match": {"date": date}},
        {"$group": {"_id": "$project", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}}
    ]
    return pl.DataFrame(list(col.aggregate(pipeline))).rename({"_id": "project"})


def load_project_breakdown(project_limit: int | None = None) -> pl.DataFrame:
    """Return total views grouped by project."""
    col = get_collection()
    pipeline = [
        {"$group": {"_id": "$project", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}},
    ]
    if project_limit is not None:
        pipeline.append({"$limit": project_limit})
    return pl.DataFrame(list(col.aggregate(pipeline, allowDiskUse=True))).rename({"_id": "project"})


def load_access_breakdown() -> pl.DataFrame:
    """Return total views grouped by access type."""
    col = get_collection()
    pipeline = [
        {"$group": {"_id": "$access", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}},
    ]
    return pl.DataFrame(list(col.aggregate(pipeline, allowDiskUse=True))).rename({"_id": "access"})


def search_articles(query: str, project: str = "en.wikipedia.org", limit: int = 20) -> pl.DataFrame:
    """Search articles by name and rank them by total views."""
    col = get_collection()
    pipeline = [
        {
            "$match": {
                "project": project,
                "article": {"$regex": query, "$options": "i"},
            }
        },
        {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}},
        {"$limit": limit},
    ]
    return pl.DataFrame(list(col.aggregate(pipeline, allowDiskUse=True))).rename({"_id": "article"})


def load_stats() -> dict:
    """Return lightweight collection stats for the dashboard."""
    col = get_collection()
    db = col.database
    stats = db.command("collstats", COL_NAME)

    first_doc = col.find_one(sort=[("date", 1)], projection={"_id": 0, "date": 1})
    last_doc = col.find_one(sort=[("date", -1)], projection={"_id": 0, "date": 1})
    project_count = len(col.distinct("project"))

    return {
        "documents": int(stats.get("count", 0)),
        "size_gb": round(stats.get("size", 0) / 1e9, 3),
        "indexes": int(stats.get("nindexes", 0)),
        "projects": project_count,
        "date_range": {
            "start": first_doc["date"] if first_doc else None,
            "end": last_doc["date"] if last_doc else None,
        },
    }


def load_from_jsonl(filepath: str, article_filter: str = None) -> pl.DataFrame:
    """Load JSONL directly with Polars, without using MongoDB."""
    df = pl.read_ndjson(filepath)
    df = df.with_columns(pl.col("date").str.to_date("%Y-%m-%d")).sort("date")
    if article_filter:
        df = df.filter(pl.col("article").str.contains(article_filter))
    print(f"Loaded {len(df):,} rows from {filepath}")
    return df


# Preprocessing helpers

def fill_missing_dates(df: pl.DataFrame, date_col: str = "date",
                       views_col: str = "views") -> pl.DataFrame:
    """Fill missing dates in a single-article series with 0 views."""
    full = pl.date_range(
        df[date_col].min(), df[date_col].max(), interval="1d", eager=True
    ).alias(date_col).to_frame()
    df = full.join(df, on=date_col, how="left").with_columns(
        pl.col(views_col).fill_null(0)
    )
    print(f"Filled missing dates → {len(df)} total rows")
    return df


def add_time_features(df: pl.DataFrame, date_col: str = "date") -> pl.DataFrame:
    """Add simple calendar features for analysis and modeling."""
    return df.with_columns([
        pl.col(date_col).dt.year().alias("year"),
        pl.col(date_col).dt.month().alias("month"),
        pl.col(date_col).dt.day().alias("day"),
        pl.col(date_col).dt.weekday().alias("day_of_week"),
        pl.col(date_col).dt.week().alias("week"),
        pl.col(date_col).dt.quarter().alias("quarter"),
        (pl.col(date_col).dt.weekday() >= 5).cast(pl.Int8).alias("is_weekend"),
    ])


def split_train_test(df: pl.DataFrame, views_col: str = "views",
                     test_days: int = 60) -> tuple[pl.Series, pl.Series]:
    """Split into train/test by last N rows."""
    series = df[views_col]
    train = series[:-test_days]
    test  = series[-test_days:]
    print(f"Train: {len(train)} days | Test: {len(test)} days")
    return train, test
