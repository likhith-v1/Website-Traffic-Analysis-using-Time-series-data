"""Load and prepare Wikipedia traffic data for time series analysis.

Includes MongoDB loaders plus a simple CSV fallback.
"""

import pandas as pd
import numpy as np
from pymongo import MongoClient
from pathlib import Path

MONGO_URI = "mongodb://localhost:27017/"
DB_NAME   = "wikipedia_traffic"
COL_NAME  = "pageviews"


# MongoDB loaders

def get_collection():
    client = MongoClient(MONGO_URI)
    return client[DB_NAME][COL_NAME]


def load_article(article: str, project: str = "en.wikipedia.org",
                 access: str = "all-access", agent: str = "all-agents") -> pd.DataFrame:
    """Return daily views for one article as a date-indexed DataFrame."""
    col = get_collection()
    query = {"article": article, "project": project, "access": access, "agent": agent}
    docs = list(col.find(query, {"_id": 0, "date": 1, "views": 1}).sort("date", 1))

    if not docs:
        raise ValueError(f"No data found for article='{article}', project='{project}'")

    df = pd.DataFrame(docs)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    df.index.freq = pd.infer_freq(df.index)
    print(f"Loaded {len(df)} daily records for '{article}' [{project}]")
    return df


def load_aggregated_daily(project: str = "en.wikipedia.org",
                           access: str = "all-access",
                           start: str = None, end: str = None) -> pd.DataFrame:
    """Return per-day aggregates across all articles for a project/access pair."""
    col = get_collection()
    match = {"project": project, "access": access}
    if start or end:
        date_filter = {}
        if start: date_filter["$gte"] = start
        if end:   date_filter["$lte"] = end
        match["date"] = date_filter

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$date",
            "total_views":  {"$sum": "$views"},
            "page_count":   {"$sum": 1},
            "avg_views":    {"$avg": "$views"},
            "max_views":    {"$max": "$views"},
        }},
        {"$sort": {"_id": 1}}
    ]

    docs = list(col.aggregate(pipeline, allowDiskUse=True))
    df = pd.DataFrame(docs).rename(columns={"_id": "date"})
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    print(f"Loaded {len(df)} aggregated daily rows for project='{project}', access='{access}'")
    return df


def load_top_articles(n: int = 50, project: str = "en.wikipedia.org",
                      access: str = "all-access") -> pd.DataFrame:
    """Return top N articles ranked by total views."""
    col = get_collection()
    pipeline = [
        {"$match": {"project": project, "access": access}},
        {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}},
        {"$limit": n}
    ]
    docs = list(col.aggregate(pipeline, allowDiskUse=True))
    df = pd.DataFrame(docs).rename(columns={"_id": "article"})
    print(f"Top {n} articles by views:")
    print(df.head(10).to_string(index=False))
    return df


def load_by_project_breakdown(date: str = "2016-01-01") -> pd.DataFrame:
    """Views breakdown by project for a specific date."""
    col = get_collection()
    pipeline = [
        {"$match": {"date": date}},
        {"$group": {"_id": "$project", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}}
    ]
    return pd.DataFrame(list(col.aggregate(pipeline))).rename(columns={"_id": "project"})


# CSV fallback

def load_from_csv(filepath: str, article_filter: str = None) -> pd.DataFrame:
    """Load the long-format CSV (output of transform_to_mongo.py)."""
    df = pd.read_csv(filepath, parse_dates=["date"])
    if article_filter:
        df = df[df["article"].str.contains(article_filter, case=False)]
    df = df.sort_values("date").set_index("date")
    return df


# Preprocessing helpers

def fill_missing_dates(df: pd.DataFrame, freq: str = "D") -> pd.DataFrame:
    """Reindex to fill any missing dates with 0."""
    full_idx = pd.date_range(df.index.min(), df.index.max(), freq=freq)
    df = df.reindex(full_idx, fill_value=0)
    missing = (df == 0).sum()
    print(f"Filled {missing.max()} missing dates with 0.")
    return df


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add common calendar features used in exploratory time series work."""
    df = df.copy()
    df["year"]        = df.index.year
    df["month"]       = df.index.month
    df["day_of_week"] = df.index.dayofweek
    df["week"]        = df.index.isocalendar().week.astype(int)
    df["quarter"]     = df.index.quarter
    df["is_weekend"]  = (df.index.dayofweek >= 5).astype(int)
    return df


def split_train_test(series: pd.Series, test_days: int = 60):
    """Split a series into train and test windows by the last N days."""
    train = series.iloc[:-test_days]
    test  = series.iloc[-test_days:]
    print(f"Train: {len(train)} days | Test: {len(test)} days")
    return train, test
