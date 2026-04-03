"""Load and prepare Wikipedia traffic data with Polars.

Shared by the CLI pipeline and the FastAPI app.
Override DB/collection via MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_NAME env vars.
"""

import logging
import os
import re

import polars as pl

log = logging.getLogger(__name__)
from pymongo import MongoClient

# -- Article blocklist --------------------------------------------------------

# Wikipedia namespace prefixes (excluded from article queries)
_NS_PREFIXES = [
    "Special", "Wikipedia", "User", "File", "Help",
    "Category", "Talk", "Template", "Portal", "Draft",
    "MediaWiki", "Module", "Book", "WP",
]

# matches "Special:Search", "Wikipedia:About", etc.
_NS_REGEX = "^(" + "|".join(re.escape(p) for p in _NS_PREFIXES) + "):"

# Adult content titles known to appear in this dataset
_ADULT_TERMS = [
    r"[Pp]orn", r"[Xx][Xx][Xx]", r"[Xx]video", r"[Pp]ornhub",
    r"[Xx]hamster", r"[Xx]nxx", r"[Rr]edtube", r"[Yy]ouporn",
    r"[Bb]razzers", r"[Pp]layboy", r"[Pp]enthaus", r"[Pp]enthouse",
    r"[Ee]rotic", r"[Hh]entai", r"[Ss]ex[_ ]video", r"[Ff]uck",
    r"[Nn]aked[_ ]",
]


def _article_filter_clause() -> dict:
    """Return a MongoDB $match clause that excludes namespace pages and adult content."""
    blocked_pattern = "|".join([_NS_REGEX] + _ADULT_TERMS)
    return {"article": {"$not": {"$regex": blocked_pattern, "$options": "i"}}}


def _filter_articles_df(df: pl.DataFrame) -> pl.DataFrame:
    """Drop namespace and adult-content rows from a Polars DataFrame (post-fetch safety net)."""
    blocked = "|".join([_NS_REGEX] + _ADULT_TERMS)
    return df.filter(
        ~pl.col("article").str.contains(f"(?i)(?:{blocked})")
    )

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("MONGO_DB_NAME", "wikipedia_traffic")
COL_NAME = os.getenv("MONGO_COLLECTION_NAME", "pageviews")

# Module-level singleton — one connection pool shared by all callers.
_client: MongoClient | None = None


def _get_client() -> MongoClient:
    """Return the shared MongoClient, creating it on first call."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_collection():
    """Return the configured MongoDB collection using the shared client."""
    return _get_client()[DB_NAME][COL_NAME]


# -- Data loaders -------------------------------------------------------------

def load_article(
    article: str,
    project: str = "en.wikipedia.org",
    access: str = "all-access",
    agent: str = "all-agents",
) -> pl.DataFrame:
    """Return daily views for one article, sorted by date."""
    col = get_collection()
    docs = list(
        col.find(
            {"article": article, "project": project, "access": access, "agent": agent},
            {"_id": 0, "date": 1, "views": 1},
        ).sort("date", 1)
    )

    if not docs:
        raise ValueError(f"No data for article='{article}', project='{project}'")

    df = (
        pl.DataFrame(docs)
        .with_columns(pl.col("date").str.to_date("%Y-%m-%d"))
        .sort("date")
    )
    log.info("Loaded %d daily records for '%s' [%s]", len(df), article, project)
    return df


def load_aggregated_daily(
    project: str = "en.wikipedia.org",
    access: str = "all-access",
    start: str | None = None,
    end: str | None = None,
) -> pl.DataFrame:
    """Return daily totals across all articles for one project/access pair."""
    col = get_collection()
    match: dict = {"project": project, "access": access}
    if start or end:
        date_filter: dict = {}
        if start:
            date_filter["$gte"] = start
        if end:
            date_filter["$lte"] = end
        match["date"] = date_filter

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": "$date",
                "total_views": {"$sum": "$views"},
                "page_count": {"$sum": 1},
                "avg_views": {"$avg": "$views"},
                "max_views": {"$max": "$views"},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    docs = list(col.aggregate(pipeline, allowDiskUse=True))
    df = (
        pl.DataFrame(docs)
        .rename({"_id": "date"})
        .with_columns(pl.col("date").str.to_date("%Y-%m-%d"))
        .sort("date")
    )
    log.info("Loaded %d aggregated daily rows [%s / %s]", len(df), project, access)
    return df


def load_top_articles(
    n: int = 50,
    project: str = "en.wikipedia.org",
    access: str = "all-access",
) -> pl.DataFrame:
    """Return top N articles ranked by total views, excluding namespace and adult-content pages."""
    col = get_collection()
    match_clause = {"project": project, "access": access}
    match_clause.update(_article_filter_clause())
    pipeline = [
        {"$match": match_clause},
        {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}, "project": {"$first": "$project"}}},
        {"$sort": {"total_views": -1}},
        {"$limit": n},
    ]
    df = pl.DataFrame(list(col.aggregate(pipeline, allowDiskUse=True))).rename({"_id": "article"})
    df = _filter_articles_df(df)  # Polars-side safety net
    log.debug("Top %d articles loaded", n)
    return df


def load_project_breakdown(project_limit: int | None = None) -> pl.DataFrame:
    """Return total views grouped by project."""
    col = get_collection()
    pipeline: list[dict] = [
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


SEARCH_COL_NAME = "article_search"

# Cached boolean: None = not yet checked, True/False = result of list_collection_names()
_search_col_exists: bool | None = None


def _has_search_collection() -> bool:
    """Return True if the article_search collection exists; result is cached after first check."""
    global _search_col_exists
    if _search_col_exists is None:
        db = _get_client()[DB_NAME]
        _search_col_exists = SEARCH_COL_NAME in db.list_collection_names()
    return _search_col_exists


def search_articles(
    query: str,
    project: str = "en.wikipedia.org",
    limit: int = 20,
) -> pl.DataFrame:
    """Search articles with partial matching, preferring article_search when available."""
    client = _get_client()
    db = client[DB_NAME]
    col = get_collection()
    blocked_pattern = "|".join([_NS_REGEX] + _ADULT_TERMS)

    normalized_query = query.strip().replace("_", " ")
    if not normalized_query:
        return pl.DataFrame(schema={"article": pl.Utf8, "total_views": pl.Int64, "project": pl.Utf8})

    word_pattern = re.escape(normalized_query)
    article_pattern = word_pattern.replace(r"\ ", r"[_ ]")

    docs: list[dict]
    if _has_search_collection():
        try:
            search_col = db[SEARCH_COL_NAME]
            docs = list(
                search_col
                .find(
                    {
                        "project": project,
                        "article_words": {"$regex": word_pattern, "$options": "i"},
                        "article": {"$not": {"$regex": blocked_pattern, "$options": "i"}},
                    },
                    {"_id": 0, "article": 1, "total_views": 1, "project": 1},
                )
                .sort("total_views", -1)
                .limit(limit)
            )
        except Exception:
            docs = []
    else:
        docs = []

    if not docs:
        pipeline = [
            {"$match": {"project": project, "article": {"$regex": article_pattern, "$options": "i"}}},
            {"$match": _article_filter_clause()},
            {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}, "project": {"$first": "$project"}}},
            {"$sort": {"total_views": -1}},
            {"$limit": limit},
        ]
        docs = list(col.aggregate(pipeline, allowDiskUse=True))
        if docs:
            docs = pl.DataFrame(docs).rename({"_id": "article"}).to_dicts()

    if not docs:
        return pl.DataFrame(schema={"article": pl.Utf8, "total_views": pl.Int64, "project": pl.Utf8})
    df = pl.DataFrame(docs)
    return _filter_articles_df(df)


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


# -- Preprocessing helpers ----------------------------------------------------

def fill_missing_dates(
    df: pl.DataFrame,
    date_col: str = "date",
    views_col: str = "views",
) -> pl.DataFrame:
    """Fill missing dates in a single-article series with 0 views."""
    full = (
        pl.date_range(df[date_col].min(), df[date_col].max(), interval="1d", eager=True)
        .alias(date_col)
        .to_frame()
    )
    df = full.join(df, on=date_col, how="left").with_columns(pl.col(views_col).fill_null(0))
    log.debug("Filled missing dates -> %d total rows", len(df))
    return df
