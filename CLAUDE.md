# Project Context — Wikipedia Traffic Analysis

## Assignment Overview

**Course:** Time Series Analysis and Forecasting Techniques (23BSCSMA61)
**Student:** Likhith | **USN:** 23BTRCL257
**Branch:** CSE: AIML-D | **Semester:** VI
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
- `d` is auto-detected via ADF test (`make_stationary`); can be overridden with `--d`
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

| File                        | Role                                              |
| --------------------------- | ------------------------------------------------- |
| `main.py`                   | Root pipeline orchestrator (CLI entry point)      |
| `src/analysis.py`           | Time series analysis — plots + stationarity tests |
| `src/forecasting.py`        | Model training, evaluation, future forecast       |
| `backend/main.py`           | FastAPI server (API + SSE pipeline streaming)     |
| `data/data_loader_mongo.py` | MongoDB data access (Polars-based) + article blocklist |
| `data/mongo_setup.py`       | Index definitions                                 |
| `frontend/src/`             | React + Vite dashboard                            |

### Frontend Pages

| Route          | Page          | Description                                              |
| -------------- | ------------- | -------------------------------------------------------- |
| `/`            | Overview      | Traffic summary, language breakdown, access type         |
| `/explore`     | Explore       | Leaderboard podium + paginated table + article chart     |
| `/search`      | Page Insights | Deep-dive search: metrics, platform split, YoY growth    |
| `/leaderboard` | Leaderboard   | Top N articles by total views with bar chart             |
| `/models`      | System Health | Pipeline runner + model comparison + analysis plots      |
| `/database`    | Database      | MongoDB schema, indexes, collection stats                |

### Frontend Components

| Component                          | Role                                        |
| ---------------------------------- | ------------------------------------------- |
| `components/Sidebar.jsx`           | Fixed left nav with brand + links           |
| `components/PageHeader.jsx`        | Reusable eyebrow + title + subtitle header  |
| `components/SurfaceCard.jsx`       | Reusable card with optional accent border   |
| `components/StatCard.jsx`          | Stat display card with accent variant       |

### Output Files

```
outputs/
├── plots/
│   ├── 01_time_plot_{light|dark}.png
│   ├── 02_moving_averages_{light|dark}.png
│   ├── 03_stl_decomposition_{light|dark}.png
│   ├── 04_acf_pacf_{light|dark}.png
│   ├── 05_seasonal_subseries_{light|dark}.png
│   ├── 06_lag_scatter_{light|dark}.png
│   ├── 07_linear_trend_{light|dark}.png
│   ├── 08_holt_winters_{light|dark}.png
│   ├── 09_arima_{light|dark}.png
│   ├── 10_sarima_{light|dark}.png
│   └── 11_model_comparison_{light|dark}.png
└── precomputed/
    ├── model_comparison.json
    ├── analysis_results.json       ← ADF/KPSS results, d, trend_strength
    └── {article}_forecast.json    ← actual, forecast, future, best_model, metrics
```

### API Endpoints

| Endpoint                             | Description                                     |
| ------------------------------------ | ----------------------------------------------- |
| `GET /stats`                         | Collection stats                                |
| `GET /top-articles`                  | Top N articles (filtered — see blocklist)       |
| `GET /article`                       | Single article timeseries                       |
| `GET /search?q=&project=`            | Fuzzy article search (space matches underscore) |
| `GET /aggregated-daily`              | Aggregated daily traffic                        |
| `GET /project-breakdown`             | Views by Wikipedia language                     |
| `GET /access-breakdown`              | Views by access type                            |
| `GET /precomputed/model-comparison`  | All 4 model metrics                             |
| `GET /precomputed/forecast?article=` | Best model forecast + future values             |
| `GET /precomputed/analysis`          | ADF/KPSS results + differencing order           |
| `GET /plots/{filename}`              | Serve analysis/forecast PNG plots               |
| `GET /run-pipeline`                  | SSE stream — runs `main.py` subprocess          |

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

# Override d but still run analysis
python main.py --article Main_Page --d 1

# Aggregate all articles
python main.py --aggregated
```

---

## Key Design Decisions

### Theme & Styling

- **Theme system:** `applyTheme()` in `App.jsx` sets `document.documentElement.dataset.theme = 'dark'|'light'`; Tailwind's `darkMode: ["selector", "[data-theme='dark']"]` activates all `dark:` utilities; persisted in `localStorage`
- **Fonts:** Manrope (display/body/headline/label, `font-display` / `font-body`), JetBrains Mono (mono, `font-mono`) — loaded from Google Fonts, configured in `tailwind.config.js`
- **Styling:** Fully Tailwind CSS (no custom CSS classes). Chart colors use CSS variables (`--chart-1` through `--chart-8`, `--chart-line`, `--chart-tick`) defined in `index.css` for Recharts compatibility
- **Utility:** `cx()` helper from `src/lib/utils.js` (clsx + tailwind-merge) used in all components for conditional class composition

### Design Palette (Material Design 3 tokens in `tailwind.config.js`)

The UI uses a four-color palette applied consistently across all pages, components, and matplotlib plots:

| Role | Token | Light value | Dark value |
| ---- | ----- | ----------- | ---------- |
| **Primary** | `primary-container` | `#1b254b` | — (use `primary-fixed-dim` `#bbc4f4`) |
| **Secondary** | `secondary` / `secondary-container` | `#b36b00` / `#f6ad55` | `#f6ad55` |
| **Tertiary** | `tertiary` | `#4a5568` | `#94a3b8` |
| **Neutral** | `outline` | `#718096` | `#94a3b8` |
| **Surface** | `surface` | `#f8f9ff` | `slate-950 #020617` |
| **Cards** | `surface-container-lowest` | `#ffffff` | `slate-900 #0f172a` |

- Active nav, buttons, avatars → `bg-primary-container` (`#1b254b`)
- Accent text, sparklines, chart-2 → `text-secondary` / `bg-secondary-container` (`#f6ad55`)
- Muted text, ticks → `text-on-surface-variant` / `text-outline` (`#718096`)
- All pages wrap content in `bg-surface dark:bg-slate-950`
- Cards use `bg-surface-container-lowest dark:bg-slate-900` with `border-surface-container dark:border-slate-800`
- **Do not use raw `gray-*`, `blue-*`, or `indigo-*` Tailwind classes** — always use the design token names above

### Matplotlib Plot Themes

Both `src/analysis.py` and `src/forecasting.py` generate plots in **light** and **dark** variants using the same palette:

| Key | Light | Dark |
| --- | ----- | ---- |
| `fig_bg` | `#f8f9ff` | `#020617` |
| `ax_bg` | `#ffffff` | `#0f172a` |
| `line1` / actual | `#1b254b` | `#bbc4f4` |
| `line2` / forecast | `#b36b00` | `#f6ad55` |
| `line3` / future | `#4a5568` | `#94a3b8` |
| `muted` / ticks | `#718096` | `#94a3b8` |

Plot filenames follow `{NN}_{name}_{light|dark}.png`. The frontend reads the correct variant based on the current theme.

### Article Blocklist (`data/data_loader_mongo.py`)

All article queries (`load_top_articles`, `search_articles`) filter out two categories at the **MongoDB level** (via `$not + $regex`) with a Polars-side safety net:

1. **Wikipedia namespace pages** — `Special:`, `Wikipedia:`, `User:`, `File:`, `Help:`, `Category:`, `Talk:`, `Template:`, `Portal:`, `Draft:`, `MediaWiki:`, `Module:`, `Book:`, `WP:`
2. **Adult/pornography content** — common adult site names and explicit terms

Constants: `_NS_PREFIXES`, `_NS_REGEX`, `_ADULT_TERMS`, `_ADULT_RE`  
Helper functions: `_article_filter_clause()` (MongoDB dict), `_filter_articles_df()` (Polars filter)

### Pipeline SSE & `d` Propagation

- FastAPI `/run-pipeline` spawns `python main.py` as a subprocess and streams stdout via SSE
- When `skip_analysis=False`: `d` is auto-detected by ADF test in `src/analysis.py`; the `d` query param is ignored
- When `skip_analysis=True`: the frontend sends `d = analysis?.d ?? 1` (the previously computed value from `analysis_results.json`), which is forwarded as `--d` to `main.py`
- **Do not hardcode `d: 1`** in `streamPipeline()` calls — always read from `analysis` state

### Search

- `re.escape(query)` then replace spaces with `[_ ]` so "donald trump" matches "donald_trump" in MongoDB
- Minimum query length: 2 characters (enforced in FastAPI `Query(min_length=2)`)

---

## Known Bugs Fixed

| Location | Bug | Fix applied |
| -------- | --- | ----------- |
| `Models.jsx:163` | `d: 1` hardcoded in `streamPipeline` call | Changed to `d: analysis?.d ?? 1` |
| `Explore.jsx:143` | `useEffect` for article chart missing `project, access` deps | Added both to dependency array |
| `PageInsights.jsx:133` | `Math.min(...positives)` crashes with empty array → `Infinity` → `indexOf = -1` | Guard with `positives.length > 0` check |
| `Overview.jsx:88-94` | `filter(Boolean)` dropped months with no data, breaking bar chart alignment | Pre-initialize all 12 months; use `activeBars` for `avgDaily` |
| `DatabasePage.jsx:49` | `getAccessBreakdown()` called but result never stored | Removed call and import |
| `data_loader_mongo.py:57` | `_filter_articles_df` mixed Polars regex + Python `map_elements` lambda (slow) | Unified into single `str.contains(f"(?i)(?:{blocked})")` |
