"""
src/analysis.py

Time series analysis pipeline for Wikipedia traffic data.
Pulls from MongoDB via data/data_loader_mongo.py, runs decomposition,
stationarity tests, ACF/PACF, and saves plots to outputs/plots/.

Usage:
    python3 src/analysis.py
    python3 src/analysis.py --article "Albert_Einstein"
    python3 src/analysis.py --article "Main_Page" --project "en.wikipedia.org"
"""

import argparse
import sys
import warnings
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parent.parent
PLOTS_DIR   = ROOT / "outputs" / "plots"
PRECOMP_DIR = ROOT / "outputs" / "precomputed"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)
PRECOMP_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT))
from data.data_loader_mongo import (
    load_article, load_aggregated_daily,
    fill_missing_dates, add_time_features, split_train_test
)

# statsmodels needs numpy arrays / pandas Series — we convert from Polars
import pandas as pd
from statsmodels.tsa.seasonal import STL, seasonal_decompose
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_pandas(df, date_col="date", views_col="views") -> pd.Series:
    """Convert a Polars DataFrame to a pandas Series indexed by date."""
    pdf = df.to_pandas()
    pdf[date_col] = pd.to_datetime(pdf[date_col])
    s = pdf.set_index(date_col)[views_col].asfreq("D")
    return s


def savefig(fig, name: str):
    path = PLOTS_DIR / name
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved → {path.name}")


# ── 1. Time Plot ──────────────────────────────────────────────────────────────

def plot_time_series(series: pd.Series, title: str = "Daily Views"):
    fig, ax = plt.subplots(figsize=(14, 5))
    ax.plot(series.index, series.values, color="#e8ff47", linewidth=1.2)
    ax.fill_between(series.index, series.values, alpha=0.15, color="#e8ff47")
    ax.set_facecolor("#0a0a0f")
    fig.patch.set_facecolor("#0a0a0f")
    ax.tick_params(colors="#6b6b8a")
    ax.spines[:].set_color("#1e1e2e")
    ax.set_title(title, color="#e8e8f0", fontsize=14, fontweight="bold", pad=14)
    ax.set_xlabel("Date", color="#6b6b8a")
    ax.set_ylabel("Views", color="#6b6b8a")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=45)
    plt.tight_layout()
    savefig(fig, "01_time_plot.png")


# ── 2. Moving Averages ────────────────────────────────────────────────────────

def plot_moving_averages(series: pd.Series, windows=(7, 30, 90)):
    fig, ax = plt.subplots(figsize=(14, 5))
    ax.set_facecolor("#0a0a0f")
    fig.patch.set_facecolor("#0a0a0f")
    ax.plot(series.index, series.values, alpha=0.3, color="#6b6b8a", linewidth=0.8, label="Original")

    colors = ["#e8ff47", "#47c8ff", "#ff6b6b"]
    for w, c in zip(windows, colors):
        ma = series.rolling(window=w, center=True).mean()
        ax.plot(ma.index, ma.values, color=c, linewidth=2, label=f"{w}-day MA")

    # Semi-averages
    mid = len(series) // 2
    sa1 = series.iloc[:mid].mean()
    sa2 = series.iloc[mid:].mean()
    ax.plot([series.index[mid // 2], series.index[mid + mid // 2]],
            [sa1, sa2], "w--", linewidth=1.5, label="Semi-average trend")

    ax.tick_params(colors="#6b6b8a")
    ax.spines[:].set_color("#1e1e2e")
    ax.set_title("Moving Averages & Semi-Average Trend", color="#e8e8f0", fontsize=13, fontweight="bold")
    ax.legend(facecolor="#111118", labelcolor="#e8e8f0", edgecolor="#1e1e2e")
    ax.set_xlabel("Date", color="#6b6b8a")
    ax.set_ylabel("Views", color="#6b6b8a")
    plt.tight_layout()
    savefig(fig, "02_moving_averages.png")


# ── 3. STL Decomposition ──────────────────────────────────────────────────────

def decompose(series: pd.Series, period: int = 7) -> STL:
    """STL decomposition — robust to outliers."""
    stl = STL(series.fillna(method="ffill"), period=period, robust=True)
    result = stl.fit()

    fig, axes = plt.subplots(4, 1, figsize=(14, 12), sharex=True)
    fig.patch.set_facecolor("#0a0a0f")
    components = [
        (series, "Observed",  "#e8ff47"),
        (result.trend,    "Trend",     "#47c8ff"),
        (result.seasonal, "Seasonal",  "#ff6b6b"),
        (result.resid,    "Residual",  "#a855f7"),
    ]
    for ax, (data, label, color) in zip(axes, components):
        ax.plot(series.index, data, color=color, linewidth=1)
        ax.set_ylabel(label, color="#6b6b8a", fontsize=11)
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")

    fig.suptitle("STL Decomposition", color="#e8e8f0", fontsize=14, fontweight="bold")
    plt.tight_layout()
    savefig(fig, "03_stl_decomposition.png")
    return result


# ── 4. Stationarity Tests ─────────────────────────────────────────────────────

def adf_test(series: pd.Series, label: str = "Series") -> dict:
    result = adfuller(series.dropna(), autolag="AIC")
    out = {
        "label":      label,
        "ADF Stat":   round(result[0], 4),
        "p-value":    round(result[1], 4),
        "Stationary": result[1] < 0.05,
        "Crits":      result[4],
    }
    status = "✓ STATIONARY" if out["Stationary"] else "✗ NON-STATIONARY"
    print(f"  ADF [{label}]: p={out['p-value']} → {status}")
    return out


def kpss_test(series: pd.Series, label: str = "Series") -> dict:
    result = kpss(series.dropna(), regression="c", nlags="auto")
    out = {
        "label":      label,
        "KPSS Stat":  round(result[0], 4),
        "p-value":    round(result[1], 4),
        "Stationary": result[1] > 0.05,
    }
    status = "✓ STATIONARY" if out["Stationary"] else "✗ NON-STATIONARY"
    print(f"  KPSS [{label}]: p={out['p-value']} → {status}")
    return out


def make_stationary(series: pd.Series) -> tuple[pd.Series, int]:
    """Auto-difference until ADF passes. Returns (stationary_series, d)."""
    d = 0
    s = series.copy()
    while adfuller(s.dropna())[1] > 0.05 and d < 3:
        s = s.diff()
        d += 1
    print(f"  Stationary after d={d} differencing(s)")
    return s, d


# ── 5. ACF / PACF ─────────────────────────────────────────────────────────────

def plot_acf_pacf(series: pd.Series, lags: int = 40):
    fig, axes = plt.subplots(1, 2, figsize=(14, 4))
    fig.patch.set_facecolor("#0a0a0f")
    for ax in axes:
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")

    plot_acf(series.dropna(),  lags=lags, ax=axes[0], title="ACF",  color="#e8ff47",
             vlines_kwargs={"colors": "#1e1e2e"})
    plot_pacf(series.dropna(), lags=lags, ax=axes[1], title="PACF", color="#47c8ff",
              method="ywm", vlines_kwargs={"colors": "#1e1e2e"})

    for ax, title in zip(axes, ["ACF", "PACF"]):
        ax.set_title(title, color="#e8e8f0", fontsize=13)
        ax.title.set_color("#e8e8f0")

    plt.tight_layout()
    savefig(fig, "04_acf_pacf.png")


# ── 6. Seasonal Subseries ─────────────────────────────────────────────────────

def plot_seasonal_subseries(series: pd.Series):
    """Average views by day-of-week and by month."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 4))
    fig.patch.set_facecolor("#0a0a0f")

    days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    dow_avg = series.groupby(series.index.dayofweek).mean()
    axes[0].bar(days, dow_avg.values, color="#e8ff47", edgecolor="#0a0a0f")
    axes[0].set_title("Avg Views by Day of Week", color="#e8e8f0", fontsize=12)

    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    mon_avg = series.groupby(series.index.month).mean()
    axes[1].bar([months[m-1] for m in mon_avg.index], mon_avg.values,
                color="#47c8ff", edgecolor="#0a0a0f")
    axes[1].set_title("Avg Views by Month", color="#e8e8f0", fontsize=12)

    for ax in axes:
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")

    plt.tight_layout()
    savefig(fig, "05_seasonal_subseries.png")


# ── 7. Lag Scatter Plots ──────────────────────────────────────────────────────

def plot_lag_scatter(series: pd.Series, lags=(1, 7, 14, 30)):
    fig, axes = plt.subplots(1, len(lags), figsize=(4 * len(lags), 4))
    fig.patch.set_facecolor("#0a0a0f")
    for ax, lag in zip(axes, lags):
        ax.scatter(series[:-lag].values, series[lag:].values,
                   alpha=0.3, s=4, color="#e8ff47")
        r = np.corrcoef(series[:-lag].dropna(), series[lag:].dropna())[0, 1]
        ax.set_title(f"Lag {lag}  r={r:.2f}", color="#e8e8f0", fontsize=11)
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")
    plt.tight_layout()
    savefig(fig, "06_lag_scatter.png")


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run(article: str = "Main_Page", project: str = "en.wikipedia.org",
        access: str = "all-access", use_aggregated: bool = False):

    print(f"\n{'='*60}")
    print(f"  Wikipedia Traffic — Time Series Analysis")
    print(f"  Article : {article if not use_aggregated else '(aggregated all pages)'}")
    print(f"  Project : {project}")
    print(f"{'='*60}\n")

    # ── Load data ─────────────────────────────────────────────────────────────
    print("[1/6] Loading data from MongoDB...")
    if use_aggregated:
        df = load_aggregated_daily(project=project, access=access)
        df = df.rename({"total_views": "views"})
    else:
        df = load_article(article=article, project=project, access=access)

    df = fill_missing_dates(df)
    df = add_time_features(df)
    series = to_pandas(df)
    print(f"  {len(series)} daily data points loaded\n")

    # ── Time plot ─────────────────────────────────────────────────────────────
    print("[2/6] Plotting time series...")
    title = f"{article} — Daily Views ({project})" if not use_aggregated \
            else f"Aggregated English Wikipedia — Daily Views"
    plot_time_series(series, title)
    plot_moving_averages(series)

    # ── Decomposition ─────────────────────────────────────────────────────────
    print("[3/6] STL decomposition (period=7)...")
    stl_result = decompose(series, period=7)

    # ── Stationarity ──────────────────────────────────────────────────────────
    print("[4/6] Stationarity tests...")
    adf_orig  = adf_test(series, "Original")
    kpss_orig = kpss_test(series, "Original")
    diff_series, d = make_stationary(series)
    adf_diff  = adf_test(diff_series, f"After {d} diff(s)")

    # ── ACF/PACF ──────────────────────────────────────────────────────────────
    print("[5/6] ACF/PACF plots...")
    plot_acf_pacf(diff_series)
    plot_seasonal_subseries(series)
    plot_lag_scatter(series)

    # ── Save stationarity results for dashboard ────────────────────────────────
    print("[6/6] Saving analysis results...")
    import json
    results = {
        "article":    article,
        "project":    project,
        "n_points":   len(series),
        "date_start": str(series.index.min().date()),
        "date_end":   str(series.index.max().date()),
        "mean":       round(float(series.mean()), 2),
        "std":        round(float(series.std()), 2),
        "min":        round(float(series.min()), 2),
        "max":        round(float(series.max()), 2),
        "d":          d,
        "adf_original":  adf_orig,
        "kpss_original": kpss_orig,
        "adf_differenced": adf_diff,
        "plots": ["01_time_plot.png","02_moving_averages.png",
                  "03_stl_decomposition.png","04_acf_pacf.png",
                  "05_seasonal_subseries.png","06_lag_scatter.png"],
    }
    out_path = PRECOMP_DIR / f"{article}_analysis.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"  Saved → {out_path.name}")

    print(f"\n✓ Analysis complete.")
    print(f"  Plots       → outputs/plots/")
    print(f"  Results     → outputs/precomputed/{article}_analysis.json")
    print(f"  d (ARIMA)   = {d}  ← use this in forecasting.py\n")
    return results, d, series


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--article",    default="Main_Page")
    parser.add_argument("--project",    default="en.wikipedia.org")
    parser.add_argument("--access",     default="all-access")
    parser.add_argument("--aggregated", action="store_true",
                        help="Use aggregated daily totals instead of single article")
    args = parser.parse_args()

    run(article=args.article, project=args.project,
        access=args.access, use_aggregated=args.aggregated)
