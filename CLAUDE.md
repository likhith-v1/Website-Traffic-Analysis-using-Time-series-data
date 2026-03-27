# Project Context — Wikipedia Traffic Analysis

## Assignment Overview

**Course:** Time Series Analysis and Forecasting Techniques (23BSCSMA61)
**Branch:** CSE: AIMLA, B, C & D | **Semester:** VI
**Activity:** Experiential Learning Activity — 15 Marks (Group Activity)
**Deadline:** On or before **March 30, 2026** (late submissions not accepted)
**Group size:** Maximum 6 students per group (individual submissions permitted)
**Submission format:** Soft binding or stick file, using the provided report template

---

## Assignment Topic

**Real-World Time Series Analysis and Forecasting**

The chosen domain is **Wikipedia page traffic analysis** — a real-world website traffic dataset from 2015–2016, stored in MongoDB. Daily view counts per article are the time-dependent variable being analyzed and forecasted.

---

## Required Deliverables (per PDF instructions)

### 1. Problem Statement and Significance
- Real-world problem: website traffic / page view forecasting
- Time granularity: **daily**
- Objectives: trend identification, seasonal pattern study, correlation analysis, forecasting
- Data: Wikipedia pageviews 2015–2016 via Wikimedia REST API, stored in MongoDB (`wikipedia_traffic.pageviews`)

### 2. Data Collection (proof required)
- Source: Wikimedia REST API (secondary source — research repository)
- Data is time-ordered (daily), with sufficient observations for trend and forecasting
- Fields: `article`, `project`, `access`, `agent`, `date`, `views`, `year`, `month`, `day`, `day_of_week`, `week`

### 3. Time Series Analysis Methods (all implemented in `src/analysis.py`)
- **Moving averages:** 7-day, 30-day, 90-day (`02_moving_averages.png`)
- **Semi-averages:** trend line from two halves of the series (also in `02_moving_averages.png`)
- **STL Decomposition:** Trend + Seasonal + Residual components (`03_stl_decomposition.png`)
- **ACF / PACF:** 40-lag autocorrelation and partial autocorrelation (`04_acf_pacf.png`)
- **Seasonal subseries:** day-of-week and monthly averages (`05_seasonal_subseries.png`)
- **Lag/Lead correlation:** scatter plots at lags 1, 7, 14, 30 days with correlation coefficients (`06_lag_scatter.png`)
- **Stationarity checks:** ADF test + KPSS test; auto-differencing up to order 3
- **De-trending / De-seasonalization:** via differencing and STL decomposition

### 4. Tool Selection
- **Python** with: `statsmodels`, `scikit-learn`, `polars`, `pandas`, `matplotlib`
- **FastAPI** backend, **React + Vite** frontend, **MongoDB** database

### 5. Forecasting Models (all implemented in `src/forecasting.py`)
- **Linear Trend Regression** (trend projection) → `07_linear_trend.png`
- **Holt-Winters Exponential Smoothing** (additive trend + additive seasonal, period=7) → `08_holt_winters.png`
- **ARIMA(2, d, 2)** → `09_arima.png`
- **SARIMA(1, d, 1)×(1, 1, 0, 7)** → `10_sarima.png`
- `d` is auto-detected via ADF test (make_stationary)
- Forecast horizon: **30 days** ahead (configurable via `--steps`)
- Test set: **60 days** held out (configurable via `--test-days`)

### 6. Forecasting Accuracy Metrics (8 metrics, all in `src/forecasting.py`)
- MAE, MSE, RMSE, MAPE (%), SMAPE (%), WAPE (%), R², Bias
- Best model selected by lowest MAPE

### 7. Conclusions and Learning Reflection
- Summary of findings should cover: practical relevance, insights from modelling, limitations, scope for improvement
- This section lives in the written report (not in the code)

---

## Project Architecture

### Key Files
| File | Role |
|------|------|
| `main.py` | Root pipeline orchestrator (CLI entry point) |
| `src/analysis.py` | Time series analysis — plots + stationarity tests |
| `src/forecasting.py` | Model training, evaluation, future forecast |
| `backend/main.py` | FastAPI server (API + SSE pipeline streaming) |
| `data/data_loader_mongo.py` | MongoDB data access (Polars-based) |
| `data/mongo_setup.py` | Index definitions |
| `frontend/src/` | React + Vite dashboard |

### Frontend Pages
| Route | Page | Description |
|-------|------|-------------|
| `/` | Overview | Traffic summary, language breakdown, access type |
| `/explore` | Explore | Interactive time-series chart with brush zoom |
| `/search` | Search | MongoDB article search (partial/fuzzy, space=underscore) |
| `/leaderboard` | Leaderboard | Top N articles by total views |
| `/models` | Models | Pipeline runner + model comparison + analysis plots |
| `/database` | Database | MongoDB schema, indexes, collection stats |

### Output Files
```
outputs/
├── plots/
│   ├── 01_time_plot.png
│   ├── 02_moving_averages.png
│   ├── 03_stl_decomposition.png
│   ├── 04_acf_pacf.png
│   ├── 05_seasonal_subseries.png
│   ├── 06_lag_scatter.png
│   ├── 07_linear_trend.png
│   ├── 08_holt_winters.png
│   ├── 09_arima.png
│   ├── 10_sarima.png
│   └── 11_model_comparison.png
└── precomputed/
    ├── model_comparison.json
    ├── analysis_results.json       ← ADF/KPSS results, d, trend_strength
    └── {article}_forecast.json    ← actual, forecast, future, best_model, metrics
```

### API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /stats` | Collection stats |
| `GET /top-articles` | Top N articles |
| `GET /article` | Single article timeseries |
| `GET /search?q=&project=` | Fuzzy article search (space matches underscore) |
| `GET /aggregated-daily` | Aggregated daily traffic |
| `GET /project-breakdown` | Views by Wikipedia language |
| `GET /access-breakdown` | Views by access type |
| `GET /precomputed/model-comparison` | All 4 model metrics |
| `GET /precomputed/forecast?article=` | Best model forecast + future values |
| `GET /precomputed/analysis` | ADF/KPSS results + differencing order |
| `GET /plots/{filename}` | Serve analysis/forecast PNG plots |
| `GET /run-pipeline` | SSE stream — runs `main.py` subprocess |

---

## Running the Project

```bash
# Backend (from project root)
uvicorn backend.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev

# Run the full pipeline (analysis + forecasting)
python main.py --article Main_Page

# Skip analysis phase (use cached d)
python main.py --article Donald_Trump --skip-analysis --d 0

# Aggregate all articles
python main.py --aggregated
```

---

## Key Design Decisions

- **Search fix:** `re.escape(query)` then replace spaces with `[_ ]` so "donald trump" matches "donald_trump" in MongoDB
- **Theme system:** `applyTheme()` in `App.jsx` sets `document.documentElement.dataset.theme = 'dark'|'light'`; Tailwind's `darkMode: ["selector", "[data-theme='dark']"]` activates all `dark:` utilities; persisted in `localStorage`
- **Pipeline streaming:** FastAPI SSE endpoint spawns `python main.py` as a subprocess and streams stdout line-by-line to the frontend via `EventSource`
- **Analysis results:** Saved to `outputs/precomputed/analysis_results.json` after each full pipeline run (not saved when `--skip-analysis` is used)
- **Fonts:** Bricolage Grotesque (display, `font-display`), Space Mono (mono, `font-mono`), Sora (body, `font-body`) — configured in `tailwind.config.js`
- **Styling:** Fully Tailwind CSS (no custom CSS classes). Chart colors use CSS variables (`--chart-1` through `--chart-8`, `--chart-line`, `--chart-tick`) defined in `index.css` for Recharts compatibility
- **Utility:** `cx()` helper from `src/lib/utils.js` (clsx + tailwind-merge) used in all components for conditional class composition
- **Design tokens:** Gray-neutral palette with blue accent — sidebar `bg-gray-50 dark:bg-gray-925`, cards `bg-white dark:bg-gray-950`, borders `border-gray-200 dark:border-gray-800`
