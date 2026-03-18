"""
backend/main.py
FastAPI backend — serves live MongoDB queries + precomputed results.

Install:  pip install fastapi uvicorn pymongo python-dotenv
Run:      uvicorn backend.main:app --reload --port 8000
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pathlib import Path
import json, os

app = FastAPI(title="Wikipedia Traffic API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
col = client["wikipedia_traffic"]["pageviews"]
PRECOMPUTED_DIR = Path("outputs/precomputed")


# ── /stats ────────────────────────────────────────────────────────────────────
@app.get("/stats")
def get_stats():
    """MongoDB collection stats."""
    db = client["wikipedia_traffic"]
    stats = db.command("collstats", "pageviews")
    return {
        "documents":   stats["count"],
        "size_gb":     round(stats["size"] / 1e9, 2),
        "indexes":     stats["nindexes"],
        "date_range":  {"start": "2015-07-01", "end": "2016-12-31"},
        "projects":    8,
    }


# ── /top-articles ─────────────────────────────────────────────────────────────
@app.get("/top-articles")
def top_articles(
    n:       int    = Query(20, le=100),
    project: str    = Query("en.wikipedia.org"),
    access:  str    = Query("all-access"),
):
    pipeline = [
        {"$match": {"project": project, "access": access}},
        {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}}},
        {"$sort":  {"total_views": -1}},
        {"$limit": n},
    ]
    return [{"article": d["_id"], "total_views": d["total_views"]}
            for d in col.aggregate(pipeline, allowDiskUse=True)]


# ── /article ──────────────────────────────────────────────────────────────────
@app.get("/article")
def get_article(
    name:    str = Query(...),
    project: str = Query("en.wikipedia.org"),
    access:  str = Query("all-access"),
    agent:   str = Query("all-agents"),
):
    """Daily views for a single article."""
    docs = list(col.find(
        {"article": name, "project": project, "access": access, "agent": agent},
        {"_id": 0, "date": 1, "views": 1}
    ).sort("date", 1))
    if not docs:
        raise HTTPException(404, f"Article '{name}' not found")
    return docs


# ── /aggregated-daily ─────────────────────────────────────────────────────────
@app.get("/aggregated-daily")
def aggregated_daily(
    project: str = Query("en.wikipedia.org"),
    access:  str = Query("all-access"),
    start:   str = Query(None),
    end:     str = Query(None),
):
    """Total daily views across all articles."""
    match: dict = {"project": project, "access": access}
    if start: match["date"] = {**match.get("date", {}), "$gte": start}
    if end:   match["date"] = {**match.get("date", {}), "$lte": end}

    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$date", "total_views": {"$sum": "$views"}, "page_count": {"$sum": 1}}},
        {"$sort":  {"_id": 1}},
    ]
    return [{"date": d["_id"], "total_views": d["total_views"], "page_count": d["page_count"]}
            for d in col.aggregate(pipeline, allowDiskUse=True)]


# ── /project-breakdown ────────────────────────────────────────────────────────
@app.get("/project-breakdown")
def project_breakdown():
    pipeline = [
        {"$group": {"_id": "$project", "total_views": {"$sum": "$views"}}},
        {"$sort":  {"total_views": -1}},
    ]
    return [{"project": d["_id"] or "unknown", "total_views": d["total_views"]}
            for d in col.aggregate(pipeline, allowDiskUse=True)]


# ── /access-breakdown ─────────────────────────────────────────────────────────
@app.get("/access-breakdown")
def access_breakdown():
    pipeline = [
        {"$match": {"access": {"$ne": None}}},
        {"$group": {"_id": "$access", "total_views": {"$sum": "$views"}}},
        {"$sort":  {"total_views": -1}},
    ]
    return [{"access": d["_id"], "total_views": d["total_views"]}
            for d in col.aggregate(pipeline, allowDiskUse=True)]


# ── /search ───────────────────────────────────────────────────────────────────
@app.get("/search")
def search_articles(
    q:       str = Query(..., min_length=2),
    project: str = Query("en.wikipedia.org"),
    limit:   int = Query(10, le=50),
):
    """Search article names by substring."""
    pipeline = [
        {"$match": {"article": {"$regex": q, "$options": "i"}, "project": project}},
        {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}}},
        {"$sort":  {"total_views": -1}},
        {"$limit": limit},
    ]
    return [{"article": d["_id"], "total_views": d["total_views"]}
            for d in col.aggregate(pipeline, allowDiskUse=True)]


# ── /precomputed/forecast ─────────────────────────────────────────────────────
@app.get("/precomputed/forecast")
def get_forecast(article: str = Query("Main_Page")):
    """Return precomputed forecast results for an article."""
    path = PRECOMPUTED_DIR / f"{article}_forecast.json"
    if not path.exists():
        raise HTTPException(404, f"No precomputed forecast for '{article}'. Run analysis first.")
    return json.loads(path.read_text())


# ── /precomputed/model-comparison ─────────────────────────────────────────────
@app.get("/precomputed/model-comparison")
def get_model_comparison():
    path = PRECOMPUTED_DIR / "model_comparison.json"
    if not path.exists():
        raise HTTPException(404, "Run main.py to generate model comparison.")
    return json.loads(path.read_text())
