# Wikipedia Traffic Analysis Using Time Series Data

**Student:** Likhith | **USN:** 23BTRCL257
**Section:** AIML-D | **Course:** Time Series Analysis and Forecasting Techniques (23BSCSMA61) — Semester VI

A full-stack data analysis project built around Wikipedia pageview data (2015–2016). It stores daily traffic in MongoDB, analyzes it with Python, generates forecasts, and presents everything in an interactive React dashboard.

---

## What it does

- Loads Wikipedia pageview data into MongoDB
- Analyzes daily traffic: moving averages, STL decomposition, ACF/PACF, stationarity tests
- Forecasts future traffic using Linear Trend, Holt-Winters, ARIMA, and SARIMA
- Compares models across MAE, RMSE, MAPE, SMAPE, WAPE, R², and Bias
- Serves all data through a FastAPI backend
- Displays results in a React dashboard with light/dark themes

---

## Tech stack

| Layer | Tools |
|---|---|
| Analysis | Python, statsmodels, scikit-learn, pandas, matplotlib |
| Data | MongoDB, Polars |
| Backend | FastAPI, uvicorn |
| Frontend | React, Vite, Tailwind CSS, Recharts |

---

## Project structure

```text
.
├── main.py                      # Pipeline entry point (analysis → forecasting)
├── src/
│   ├── analysis.py              # Time-series analysis and plots
│   ├── forecasting.py           # Forecasting models and metrics
│   └── plot_themes.py           # Shared matplotlib colour palettes (light + dark)
├── backend/
│   └── main.py                  # FastAPI server
├── data/
│   ├── transform_to_mongo.py    # Converts raw CSV to JSONL
│   ├── mongo_setup.py           # Creates MongoDB indexes
│   └── data_loader_mongo.py     # Shared MongoDB loaders
├── frontend/                    # React + Vite dashboard
└── outputs/
    ├── plots/                   # Generated PNG charts (light + dark variants)
    └── precomputed/             # JSON artifacts consumed by the dashboard
```

---

## Dashboard pages

| Route | Page | What it shows |
|---|---|---|
| `/` | Overview | Traffic summary, language breakdown, access type chart, trending articles |
| `/explore` | Traffic Trends | Podium leaderboard, paginated article table, article chart with compare mode |
| `/search` | Page Insights | Deep-dive search: platform split, peak day, YoY growth, 30-day average |
| `/leaderboard` | Leaderboard | Top N articles by total views with a ranked bar chart |
| `/models` | System Health | Pipeline runner, live logs, model comparison table, analysis and forecast plots |
| `/database` | Database | MongoDB schema, index list, collection stats, language distribution |

---

## Setup

**Requirements:** Python 3.10+, Node.js 18+, MongoDB running on `localhost:27017`

```bash
# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install
```

---

## Preparing the data

Convert the raw CSV and import it into MongoDB:

```bash
python3 data/transform_to_mongo.py
mongoimport --db wikipedia_traffic --collection pageviews \
  --file data/traffic_long.jsonl --numInsertionWorkers 4
python3 data/mongo_setup.py
```

Database defaults: `wikipedia_traffic` / collection `pageviews`.

---

## Running the project

### 1. Analysis + forecasting pipeline

Generates plots in `outputs/plots/` and JSON in `outputs/precomputed/`.

```bash
# Single article
python3 main.py --article Main_Page

# Aggregated traffic across all articles
python3 main.py --aggregated

# Skip analysis phase (reuse a known differencing order)
python3 main.py --article Donald_Trump --skip-analysis --d 1
```

### 2. Backend

```bash
uvicorn backend.main:app --reload
# API docs → http://localhost:8000/docs
# Health   → http://localhost:8000/health
```

### 3. Frontend

```bash
cd frontend
npm run dev
# Dashboard → http://localhost:5173
```

---

## Environment variables

```bash
# Frontend — point to a non-default backend
VITE_API_BASE_URL=http://localhost:8000

# Backend — override MongoDB target
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=wikipedia_traffic
MONGO_COLLECTION_NAME=pageviews
```

---

## Results

### Model comparison — `Main_Page`, 60-day test set

| Model | MAE | RMSE | MAPE (%) | SMAPE (%) | WAPE (%) | R² | Bias |
|---|---|---|---|---|---|---|---|
| Linear Trend | 8,101,490 | 8,269,291 | 51.84 | 40.50 | 50.14 | −23.59 | 8,101,490 |
| Holt-Winters | 2,568,147 | 3,160,792 | 15.73 | 17.85 | 15.89 | −2.59 | −2,513,005 |
| ARIMA(2, 0, 2) | 4,080,373 | 4,546,259 | 26.54 | 22.63 | 25.25 | −6.43 | 4,050,244 |
| **SARIMA(1,0,1)×(1,1,0,7)** | **837,278** | **1,144,400** | **5.39** | **5.26** | **5.18** | **0.529** | **138,765** |

**Best model: SARIMA** — selected by lowest MAPE (5.39%).

SARIMA outperforms the others by a wide margin because it explicitly captures the weekly seasonal cycle (period = 7) in Wikipedia traffic. It is the only model with a positive R² (0.529), meaning it actually explains variance rather than performing worse than a flat baseline.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Graphs are blank | Check MongoDB is running and the backend is reachable at `localhost:8000/health` |
| Models page is empty | Run `python3 main.py --article Main_Page` to generate precomputed files |
| Missing package error | Re-run `pip install -r requirements.txt` |
| Frontend can't reach API | Make sure `uvicorn` is running; check `VITE_API_BASE_URL` if using a custom port |
