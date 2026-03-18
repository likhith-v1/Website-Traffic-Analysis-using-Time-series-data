# Website Traffic Analysis Using Time Series Data

This project turns Wikipedia pageview data into a small analytics stack:

- a MongoDB-backed data store
- a Python analysis and forecasting pipeline
- a FastAPI backend
- a React dashboard

## Project structure

- `main.py`: runs analysis and forecasting from the project root
- `src/analysis.py`: generates time-series diagnostics and plot artifacts
- `src/forecasting.py`: trains forecasting models and writes dashboard JSON
- `backend/main.py`: FastAPI app used by the React frontend
- `data/transform_to_mongo.py`: converts wide CSV pageview data to long JSONL
- `data/mongo_setup.py`: creates indexes and runs sample MongoDB checks
- `data/data_loader_mongo.py`: shared MongoDB and preprocessing helpers
- `frontend/`: Vite + React dashboard

## Setup

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Typical workflow

1. Convert and import the dataset into MongoDB.

```bash
python3 data/transform_to_mongo.py
mongoimport --db wikipedia_traffic --collection pageviews --file data/traffic_long.jsonl --numInsertionWorkers 4
python3 data/mongo_setup.py
```

2. Run the analysis and forecasting pipeline.

```bash
python3 main.py --article Main_Page
```

3. Start the backend API.

```bash
uvicorn backend.main:app --reload
```

4. Start the frontend dashboard in another terminal.

```bash
cd frontend
npm run dev
```

The dashboard will be available at `http://localhost:5173`, and the API will run on `http://localhost:8000`.

## Notes

- The frontend defaults to calling `/api` through the Vite proxy in development.
- If you want the frontend to talk to a different backend URL, set `VITE_API_BASE_URL`.
- Generated plots and precomputed JSON are written to `outputs/`, which is ignored by git.
