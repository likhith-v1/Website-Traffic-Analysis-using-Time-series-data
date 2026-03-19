"""FastAPI backend for the Wikipedia traffic dashboard."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def frame_to_records(frame) -> list[dict]:
    return frame.to_dicts()


def load_json_file(path: Path):
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Core routes
# ---------------------------------------------------------------------------

@app.get("/")
def root() -> dict:
    return {"name": "Wikipedia Traffic API", "status": "ok", "docs": "/docs", "health": "/health"}


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


# ---------------------------------------------------------------------------
# Pipeline SSE endpoint
# ---------------------------------------------------------------------------

@app.get("/run-pipeline")
async def run_pipeline(
    article: str = Query(default="Main_Page"),
    skip_analysis: bool = Query(default=False),
    d: int = Query(default=1),
):
    """
    Stream pipeline stdout line-by-line as Server-Sent Events.
    Final event is either  data: DONE  or  data: ERROR:<message>
    """
    cmd = [sys.executable, str(ROOT / "main.py"), "--article", article]
    if skip_analysis:
        cmd += ["--skip-analysis", "--d", str(d)]

    async def event_stream():
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(ROOT),
            )
            async for raw in proc.stdout:
                line = raw.decode("utf-8", errors="replace").rstrip()
                if line:
                    yield f"data: {line}\n\n"
                await asyncio.sleep(0)
            await proc.wait()
            if proc.returncode == 0:
                yield "data: DONE\n\n"
            else:
                yield f"data: ERROR:Pipeline exited with code {proc.returncode}\n\n"
        except Exception as exc:
            yield f"data: ERROR:{exc}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
