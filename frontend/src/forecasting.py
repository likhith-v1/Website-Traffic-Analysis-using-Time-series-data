"""
src/forecasting.py

Forecasting pipeline for Wikipedia traffic data.
Pulls from MongoDB, runs Linear Trend / Holt-Winters / ARIMA / SARIMA,
saves model comparison JSON + forecast JSON for the dashboard.

Usage:
    python3 src/forecasting.py
    python3 src/forecasting.py --article "Albert_Einstein" --d 1
"""

import argparse
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

warnings.filterwarnings("ignore")

ROOT        = Path(__file__).resolve().parent.parent
PLOTS_DIR   = ROOT / "outputs" / "plots"
PRECOMP_DIR = ROOT / "outputs" / "precomputed"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)
PRECOMP_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT))
from data.data_loader_mongo import (
    load_article, load_aggregated_daily,
    fill_missing_dates, add_time_features
)

import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_pandas(df, date_col="date", views_col="views") -> pd.Series:
    pdf = df.to_pandas()
    pdf[date_col] = pd.to_datetime(pdf[date_col])
    s = pdf.set_index(date_col)[views_col].asfreq("D").fillna(method="ffill")
    return s


def evaluate(actual, predicted, model_name="") -> dict:
    mae  = mean_absolute_error(actual, predicted)
    rmse = np.sqrt(mean_squared_error(actual, predicted))
    mape = np.mean(np.abs((actual - predicted) / (actual + 1))) * 100
    metrics = {
        "Model":    model_name,
        "MAE":      round(mae, 2),
        "RMSE":     round(rmse, 2),
        "MAPE (%)": round(mape, 2),
    }
    print(f"  {model_name:30s} MAE={mae:.0f}  RMSE={rmse:.0f}  MAPE={mape:.2f}%")
    return metrics


def dark_plot(train, test, forecast, future, model_name, filename):
    fig, ax = plt.subplots(figsize=(14, 5))
    fig.patch.set_facecolor("#0a0a0f")
    ax.set_facecolor("#0a0a0f")
    ax.plot(train.index, train.values, color="#6b6b8a", linewidth=1, label="Train")
    ax.plot(test.index,  test.values,  color="#47c8ff", linewidth=2, label="Actual (test)")
    ax.plot(test.index,  forecast,     color="#e8ff47", linewidth=2, linestyle="--", label=f"Forecast ({model_name})")
    if future is not None:
        future_idx = pd.date_range(test.index[-1] + pd.Timedelta(days=1), periods=len(future), freq="D")
        ax.plot(future_idx, future, color="#ff6b6b", linewidth=2, linestyle=":", label="Future")
    ax.set_title(f"{model_name} — Forecast vs Actual", color="#e8e8f0", fontsize=13, fontweight="bold")
    ax.tick_params(colors="#6b6b8a")
    ax.spines[:].set_color("#1e1e2e")
    ax.legend(facecolor="#111118", labelcolor="#e8e8f0", edgecolor="#1e1e2e")
    plt.tight_layout()
    path = PLOTS_DIR / filename
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved → {path.name}")


def split(series: pd.Series, test_days: int = 60):
    return series.iloc[:-test_days], series.iloc[-test_days:]


# ── 1. Linear Trend Regression ────────────────────────────────────────────────

def linear_trend(train, test, forecast_steps=30):
    X_tr = np.arange(len(train)).reshape(-1, 1)
    X_te = np.arange(len(train), len(train) + len(test)).reshape(-1, 1)
    X_fu = np.arange(len(train) + len(test),
                     len(train) + len(test) + forecast_steps).reshape(-1, 1)
    m = LinearRegression().fit(X_tr, train.values)
    fc   = m.predict(X_te)
    fut  = m.predict(X_fu)
    dark_plot(train, test, fc, fut, "Linear Trend", "07_linear_trend.png")
    return evaluate(test.values, fc, "Linear Trend"), fc.tolist(), fut.tolist()


# ── 2. Holt-Winters ───────────────────────────────────────────────────────────

def holt_winters(train, test, forecast_steps=30):
    model = ExponentialSmoothing(
        train, trend="add", seasonal="add", seasonal_periods=7,
        initialization_method="estimated"
    ).fit(optimized=True)
    fc  = model.forecast(len(test)).values
    fut = model.forecast(len(test) + forecast_steps).values[-forecast_steps:]
    dark_plot(train, test, fc, fut, "Holt-Winters", "08_holt_winters.png")
    return evaluate(test.values, fc, "Holt-Winters"), fc.tolist(), fut.tolist()


# ── 3. ARIMA ──────────────────────────────────────────────────────────────────

def fit_arima(train, test, d=1, forecast_steps=30):
    order = (2, d, 2)
    model = ARIMA(train, order=order).fit()
    fc  = model.forecast(steps=len(test)).values
    fut = model.forecast(steps=len(test) + forecast_steps).values[-forecast_steps:]
    dark_plot(train, test, fc, fut, f"ARIMA{order}", "09_arima.png")
    return evaluate(test.values, fc, f"ARIMA{order}"), fc.tolist(), fut.tolist()


# ── 4. SARIMA ─────────────────────────────────────────────────────────────────

def fit_sarima(train, test, d=1, forecast_steps=30):
    order          = (1, d, 1)
    seasonal_order = (1, 1, 0, 7)   # weekly seasonality
    model = SARIMAX(
        train, order=order, seasonal_order=seasonal_order,
        enforce_stationarity=False, enforce_invertibility=False
    ).fit(disp=False)
    fc  = model.forecast(steps=len(test)).values
    fut = model.forecast(steps=len(test) + forecast_steps).values[-forecast_steps:]
    dark_plot(train, test, fc, fut, "SARIMA", "10_sarima.png")
    return evaluate(test.values, fc, f"SARIMA{order}x{seasonal_order}"), fc.tolist(), fut.tolist()


# ── 5. Model comparison plot ──────────────────────────────────────────────────

def plot_comparison(rows: list[dict]):
    df = pd.DataFrame(rows).sort_values("MAPE (%)")
    fig, axes = plt.subplots(1, 3, figsize=(14, 4))
    fig.patch.set_facecolor("#0a0a0f")
    colors = ["#e8ff47", "#47c8ff", "#ff6b6b", "#a855f7"]
    for ax, metric in zip(axes, ["MAE", "RMSE", "MAPE (%)"]):
        ax.barh(df["Model"], df[metric],
                color=[colors[i % len(colors)] for i in range(len(df))],
                edgecolor="#0a0a0f")
        ax.set_title(metric, color="#e8e8f0", fontsize=12)
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")
        ax.invert_yaxis()
    fig.suptitle("Model Comparison", color="#e8e8f0", fontsize=13, fontweight="bold")
    plt.tight_layout()
    path = PLOTS_DIR / "11_model_comparison.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved → {path.name}")
    return df


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run(article="Main_Page", project="en.wikipedia.org",
        access="all-access", d=1, test_days=60, forecast_steps=30,
        use_aggregated=False):

    print(f"\n{'='*60}")
    print(f"  Wikipedia Traffic — Forecasting Pipeline")
    print(f"  Article : {article if not use_aggregated else '(aggregated)'}")
    print(f"  d       : {d}  (from analysis.py)")
    print(f"{'='*60}\n")

    # Load
    print("[1/4] Loading data from MongoDB...")
    if use_aggregated:
        df = load_aggregated_daily(project=project, access=access)
        df = df.rename({"total_views": "views"})
    else:
        df = load_article(article=article, project=project, access=access)
    df = fill_missing_dates(df)
    series = to_pandas(df)
    print(f"  {len(series)} daily points\n")

    train, test = split(series, test_days=test_days)
    print(f"  Train: {len(train)} | Test: {len(test)}\n")

    # Forecasting
    print("[2/4] Running models...")
    results = {}
    m1, fc1, fut1 = linear_trend(train, test, forecast_steps)
    m2, fc2, fut2 = holt_winters(train, test, forecast_steps)
    m3, fc3, fut3 = fit_arima(train, test, d=d, forecast_steps=forecast_steps)
    m4, fc4, fut4 = fit_sarima(train, test, d=d, forecast_steps=forecast_steps)

    metrics = [m1, m2, m3, m4]
    forecasts = {"linear": fc1, "holt_winters": fc2, "arima": fc3, "sarima": fc4}
    futures   = {"linear": fut1, "holt_winters": fut2, "arima": fut3, "sarima": fut4}

    # Comparison
    print("\n[3/4] Model comparison...")
    comp_df = plot_comparison(metrics)
    print(f"\n{comp_df[['Model','MAE','RMSE','MAPE (%)']].to_string(index=False)}")

    # Save for dashboard
    print("\n[4/4] Saving precomputed results...")

    # model_comparison.json
    (PRECOMP_DIR / "model_comparison.json").write_text(
        json.dumps(metrics, indent=2)
    )
    print("  Saved → model_comparison.json")

    # {article}_forecast.json — used by Models page
    best_model = min(metrics, key=lambda x: x["MAPE (%)"])["Model"].lower().split("(")[0].strip().replace(" ","_").replace("-","_")
    best_key   = "holt_winters" if "holt" in best_model else \
                 "sarima"       if "sarima" in best_model else \
                 "arima"        if "arima" in best_model else "linear"

    forecast_doc = {
        "article":    article,
        "actual":     test.values.tolist(),
        "forecast":   forecasts[best_key],
        "future":     futures[best_key],
        "best_model": best_model,
        "metrics":    metrics,
        "test_dates": [str(d.date()) for d in test.index],
    }
    safe_name = article.replace("/", "_")
    (PRECOMP_DIR / f"{safe_name}_forecast.json").write_text(
        json.dumps(forecast_doc, indent=2)
    )
    print(f"  Saved → {safe_name}_forecast.json")

    print(f"\n✓ Forecasting complete.")
    print(f"  Best model : {best_model} (MAPE={min(m['MAPE (%)'] for m in metrics):.2f}%)")
    print(f"  Plots      → outputs/plots/")
    print(f"  Dashboard  → outputs/precomputed/\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--article",    default="Main_Page")
    parser.add_argument("--project",    default="en.wikipedia.org")
    parser.add_argument("--access",     default="all-access")
    parser.add_argument("--d",          type=int, default=1,
                        help="Differencing order from analysis.py")
    parser.add_argument("--test-days",  type=int, default=60)
    parser.add_argument("--steps",      type=int, default=30,
                        help="Future forecast steps")
    parser.add_argument("--aggregated", action="store_true")
    args = parser.parse_args()

    run(article=args.article, project=args.project, access=args.access,
        d=args.d, test_days=args.test_days, forecast_steps=args.steps,
        use_aggregated=args.aggregated)
