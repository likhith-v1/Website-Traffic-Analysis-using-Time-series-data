# Wikipedia Traffic Analysis Using Time Series Data

This project is a small full-stack data analysis app built around Wikipedia pageview data.

It takes raw traffic data, stores it in MongoDB, analyzes it with Python, generates forecasts, and shows everything in a dashboard where you can explore trends, compare models, and inspect the dataset more comfortably.

## What this project does

- loads Wikipedia traffic data into MongoDB
- analyzes daily pageview trends
- builds forecasts using multiple time-series models
- compares model performance with metrics like MAE, RMSE, MAPE, SMAPE, WAPE, R2, and Bias
- serves the data through a FastAPI backend
- shows the results in a React dashboard

## Tech stack

- Python for analysis and forecasting
- MongoDB for storage
- FastAPI for the backend API
- React + Vite for the frontend

## Project structure

```text
.
├── main.py                    # Runs the full analysis + forecasting pipeline
├── src/
│   ├── analysis.py            # Time-series analysis and plots
│   └── forecasting.py         # Forecasting models and metrics
├── backend/
│   └── main.py                # FastAPI backend
├── data/
│   ├── transform_to_mongo.py  # Converts raw CSV data into JSONL
│   ├── mongo_setup.py         # Creates MongoDB indexes and runs sample checks
│   └── data_loader_mongo.py   # Shared MongoDB loaders and helpers
└── frontend/                  # React dashboard
```

## Before you start

You’ll need:

- Python 3.10 or newer
- Node.js 18 or newer
- MongoDB running locally on `mongodb://localhost:27017/`

## Setup

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Install the frontend dependencies:

```bash
cd frontend
npm install
```

## Preparing the data

If you have the Wikipedia pageview CSV file, convert it and import it into MongoDB like this:

```bash
python3 data/transform_to_mongo.py
mongoimport --db wikipedia_traffic --collection pageviews --file data/traffic_long.jsonl --numInsertionWorkers 4
python3 data/mongo_setup.py
```

By default, the project uses:

- database: `wikipedia_traffic`
- collection: `pageviews`

## Running the project

### 1. Run the analysis and forecasting pipeline

This step generates plots in `outputs/plots/` and precomputed JSON files in `outputs/precomputed/`.

Run it for a single article:

```bash
python3 main.py --article Main_Page
```

Run it for aggregated traffic:

```bash
python3 main.py --aggregated
```

Skip analysis and reuse a known differencing order:

```bash
python3 main.py --skip-analysis --d 1
```

### 2. Start the backend

```bash
uvicorn backend.main:app --reload
```

Helpful URLs:

- `http://localhost:8000/docs`
- `http://localhost:8000/health`

### 3. Start the frontend

Open a second terminal and run:

```bash
cd frontend
npm run dev
```

You should then have:

- frontend at `http://localhost:5173`
- backend at `http://localhost:8000`

## Environment notes

In development, the frontend talks to the backend through the Vite proxy using `/api`.

If you want to point the frontend to a different backend URL, set:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

Optional MongoDB environment variables:

```bash
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=wikipedia_traffic
MONGO_COLLECTION_NAME=pageviews
```

## Outputs

The project writes generated files to:

- `outputs/plots/` for charts and visual analysis
- `outputs/precomputed/` for JSON files used by the dashboard

These are generated artifacts, so they are ignored by git.

## Troubleshooting

### The graphs are blank

Usually this means one of these is missing:

- MongoDB is not running
- the FastAPI backend is not running
- the dashboard cannot reach the backend
- the forecast files have not been generated yet

Start by checking:

- `http://localhost:8000/docs`
- `http://localhost:8000/health`

If the Models page is empty, run:

```bash
python3 main.py
```

### I get a missing package error

Reinstall the Python dependencies:

```bash
pip install -r requirements.txt
```

### The forecast page has no results

Generate the precomputed forecast files first:

```bash
python3 main.py --article Main_Page
```

## In short

This repo is basically a data project plus a dashboard:

- MongoDB stores the traffic data
- Python analyzes and forecasts it
- FastAPI serves it
- React displays it

If you want, I can also make this README look more GitHub-ready with a quick start section, screenshots, and cleaner formatting for a portfolio project.
