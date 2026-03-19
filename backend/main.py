"""FastAPI backend for the Wikipedia traffic dashboard."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from data.data_loader_mongo import (
    load_access_breakdown,
    load_aggregated_daily,
    load_article,
    load_project_breakdown,
    load_stats,
    load_top_articles,
    search_articles,
)

ROOT = Path(__file__).resolve().parent.parent
PRECOMP_DIR = ROOT / "outputs" / "precomputed"

app = FastAPI(
    title="Wikipedia Traffic API",
    description="Backend API for the dashboard and forecasting artifacts.",
    version="1.0.0",
)

# Allow both localhost and 127.0.0.1 variants so the Vite dev server works
# regardless of which loopback address the browser resolves to.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",   # vite preview
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "name": "Wikipedia Traffic API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


def frame_to_records(frame) -> list[dict]:
    """Convert a Polars DataFrame into JSON-friendly records."""
    return frame.to_dicts()


def load_json_file(path: Path):
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")
    return json.loads(path.read_text())


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.get("/stats")
def get_stats() -> dict:
    try:
        return load_stats()
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Could not load stats: {exc}") from exc


@app.get("/top-articles")
def get_top_articles(
    n: int = Query(default=20, ge=1, le=100),
    project: str = "en.wikipedia.org",
    access: str = "all-access",
) -> list[dict]:
    try:
        return frame_to_records(load_top_articles(n=n, project=project, access=access))
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Could not load top articles: {exc}") from exc


@app.get("/article")
def get_article(
    name: str = Query(..., min_length=1),
    project: str = "en.wikipedia.org",
    access: str = "all-access",
) -> list[dict]:
    try:
        return frame_to_records(load_article(article=name, project=project, access=access))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Could not load article data: {exc}") from exc


@app.get("/aggregated-daily")
def get_aggregated_daily(
    project: str = "en.wikipedia.org",
    access: str = "all-access",
    start: str | None = None,
    end: str | None = None,
) -> list[dict]:
    try:
        frame = load_aggregated_daily(project=project, access=access, start=start, end=end)
        return frame_to_records(frame)
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Could not load aggregated data: {exc}") from exc


@app.get("/project-breakdown")
def get_project_breakdown() -> list[dict]:
    try:
        return frame_to_records(load_project_breakdown())
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Could not load project breakdown: {exc}") from exc


@app.get("/access-breakdown")
def get_access_breakdown() -> list[dict]:
    try:
        return frame_to_records(load_access_breakdown())
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Could not load access breakdown: {exc}") from exc


@app.get("/search")
def search(
    q: str = Query(..., min_length=2),
    project: str = "en.wikipedia.org",
) -> list[dict]:
    try:
        return frame_to_records(search_articles(query=q, project=project))
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Could not search articles: {exc}") from exc


@app.get("/precomputed/model-comparison")
def get_model_comparison():
    return load_json_file(PRECOMP_DIR / "model_comparison.json")


@app.get("/precomputed/forecast")
def get_forecast(article: str = Query("Main_Page")):
    safe_name = article.replace("/", "_")
    return load_json_file(PRECOMP_DIR / f"{safe_name}_forecast.json")
