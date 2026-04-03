# Repository Guidelines

## Project Structure & Module Organization
`main.py` runs the end-to-end analysis and forecasting pipeline. Core Python logic lives in `src/` (`analysis.py`, `forecasting.py`). The API layer is in `backend/main.py`, and MongoDB ingestion helpers live in `data/`. The React dashboard is isolated in `frontend/`, with pages under `frontend/src/pages/`, reusable UI in `frontend/src/components/`, and API calls in `frontend/src/api/client.js`. Generated artifacts belong in `outputs/plots/` and `outputs/precomputed/`; treat them as build output, not hand-edited source.

## Build, Test, and Development Commands
Install Python dependencies with `pip install -r requirements.txt`.
Install frontend dependencies with `cd frontend && npm install`.
Run the pipeline with `python3 main.py --article Main_Page` or `python3 main.py --aggregated`.
Start the API with `uvicorn backend.main:app --reload`.
Start the dashboard with `cd frontend && npm run dev`.
Create a production frontend build with `cd frontend && npm run build`.

## Coding Style & Naming Conventions
Follow the existing style instead of introducing a new one. Python uses 4-space indentation, type hints where useful, standard-library `pathlib`, and short module docstrings. Keep filenames snake_case, for example `data_loader_mongo.py`. React code uses ES modules, single quotes, and PascalCase component files such as `SurfaceCard.jsx`; keep utility modules lower-case like `utils.js`. Match the current Tailwind-first styling approach in `frontend/src/index.css` and component class lists. No formatter or linter is configured, so keep diffs small and consistent.

## Testing Guidelines
There is no automated test suite in this repository today. Validate changes by running the affected workflow locally: pipeline changes should be checked with `python3 main.py`, backend changes with `uvicorn backend.main:app --reload`, and frontend changes with `cd frontend && npm run dev`. For data/API work, verify `/health`, `/docs`, and one dashboard page before opening a PR.

## Commit & Pull Request Guidelines
Recent history uses short, informal commit messages like `updated read me` and `made few more improvements to ui`. Prefer clearer imperative messages going forward, for example `Add SARIMA forecast endpoint` or `Refine leaderboard layout`. PRs should include a concise summary, the commands used for verification, any MongoDB or environment assumptions, and screenshots for visible frontend changes.

## Configuration Notes
Local development assumes MongoDB at `mongodb://localhost:27017/`. Override connection settings with `MONGO_URI`, `MONGO_DB_NAME`, and `MONGO_COLLECTION_NAME`. For frontend API routing, use `VITE_API_BASE_URL` when not relying on the default `/api` proxy.
