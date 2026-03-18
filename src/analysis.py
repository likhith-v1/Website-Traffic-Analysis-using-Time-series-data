"""Time-series analysis for Wikipedia traffic data.

The module reads daily pageviews from MongoDB, prepares a clean daily series,
generates analysis plots, and returns a differencing order that the
forecasting step can reuse.
"""

from __future__ import annotations

import argparse
import sys
import warnings
from pathlib import Path

import matplotlib
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.stattools import adfuller, kpss

warnings.filterwarnings("ignore")
matplotlib.use("Agg")

ROOT = Path(__file__).resolve().parent.parent
PLOTS_DIR = ROOT / "outputs" / "plots"
PRECOMP_DIR = ROOT / "outputs" / "precomputed"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)
PRECOMP_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT))

from data.data_loader_mongo import fill_missing_dates, load_aggregated_daily, load_article


def to_pandas_series(df, date_col: str = "date", views_col: str = "views") -> pd.Series:
    """Convert a Polars DataFrame into a pandas Series with daily frequency.

    We build the Series directly to avoid requiring `pyarrow` for
    `polars.DataFrame.to_pandas()`.
    """
    dates = pd.to_datetime(df.get_column(date_col).to_list())
    values = df.get_column(views_col).to_list()
    return pd.Series(values, index=dates, name=views_col).asfreq("D")


def save_figure(fig: plt.Figure, filename: str) -> None:
    path = PLOTS_DIR / filename
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved plot -> {path.name}")


def plot_time_series(series: pd.Series, title: str = "Daily Views") -> None:
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
    save_figure(fig, "01_time_plot.png")


def plot_moving_averages(series: pd.Series, windows: tuple[int, ...] = (7, 30, 90)) -> None:
    fig, ax = plt.subplots(figsize=(14, 5))
    ax.set_facecolor("#0a0a0f")
    fig.patch.set_facecolor("#0a0a0f")
    ax.plot(series.index, series.values, alpha=0.3, color="#6b6b8a", linewidth=0.8, label="Original")

    colors = ["#e8ff47", "#47c8ff", "#ff6b6b"]
    for window, color in zip(windows, colors):
        moving_average = series.rolling(window=window, center=True).mean()
        ax.plot(moving_average.index, moving_average.values, color=color, linewidth=2, label=f"{window}-day MA")

    midpoint = len(series) // 2
    first_half_average = series.iloc[:midpoint].mean()
    second_half_average = series.iloc[midpoint:].mean()
    ax.plot(
        [series.index[midpoint // 2], series.index[midpoint + midpoint // 2]],
        [first_half_average, second_half_average],
        "w--",
        linewidth=1.5,
        label="Semi-average trend",
    )

    ax.tick_params(colors="#6b6b8a")
    ax.spines[:].set_color("#1e1e2e")
    ax.set_title("Moving Averages and Semi-Average Trend", color="#e8e8f0", fontsize=13, fontweight="bold")
    ax.legend(facecolor="#111118", labelcolor="#e8e8f0", edgecolor="#1e1e2e")
    ax.set_xlabel("Date", color="#6b6b8a")
    ax.set_ylabel("Views", color="#6b6b8a")
    plt.tight_layout()
    save_figure(fig, "02_moving_averages.png")


def decompose(series: pd.Series, period: int = 7):
    """Run STL decomposition, which handles outliers better than classic decomposition."""
    result = STL(series.ffill(), period=period, robust=True).fit()

    fig, axes = plt.subplots(4, 1, figsize=(14, 12), sharex=True)
    fig.patch.set_facecolor("#0a0a0f")
    components = [
        (series, "Observed", "#e8ff47"),
        (result.trend, "Trend", "#47c8ff"),
        (result.seasonal, "Seasonal", "#ff6b6b"),
        (result.resid, "Residual", "#a855f7"),
    ]
    for ax, (data, label, color) in zip(axes, components):
        ax.plot(series.index, data, color=color, linewidth=1)
        ax.set_ylabel(label, color="#6b6b8a", fontsize=11)
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")

    fig.suptitle("STL Decomposition", color="#e8e8f0", fontsize=14, fontweight="bold")
    plt.tight_layout()
    save_figure(fig, "03_stl_decomposition.png")
    return result


def adf_test(series: pd.Series, label: str = "Series") -> dict:
    result = adfuller(series.dropna(), autolag="AIC")
    response = {
        "label": label,
        "ADF Stat": round(result[0], 4),
        "p-value": round(result[1], 4),
        "Stationary": result[1] < 0.05,
        "Crits": result[4],
    }
    status = "stationary" if response["Stationary"] else "non-stationary"
    print(f"ADF [{label}] p={response['p-value']} -> {status}")
    return response


def kpss_test(series: pd.Series, label: str = "Series") -> dict:
    result = kpss(series.dropna(), regression="c", nlags="auto")
    response = {
        "label": label,
        "KPSS Stat": round(result[0], 4),
        "p-value": round(result[1], 4),
        "Stationary": result[1] > 0.05,
    }
    status = "stationary" if response["Stationary"] else "non-stationary"
    print(f"KPSS [{label}] p={response['p-value']} -> {status}")
    return response


def make_stationary(series: pd.Series) -> tuple[pd.Series, int]:
    """Auto-difference until the ADF test passes, up to order 3."""
    differencing_order = 0
    stationary_series = series.copy()
    while adfuller(stationary_series.dropna())[1] > 0.05 and differencing_order < 3:
        stationary_series = stationary_series.diff()
        differencing_order += 1
    print(f"Suggested differencing order: d={differencing_order}")
    return stationary_series, differencing_order


def plot_acf_pacf(series: pd.Series, lags: int = 40) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(14, 4))
    fig.patch.set_facecolor("#0a0a0f")
    for ax in axes:
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")

    plot_acf(
        series.dropna(),
        lags=lags,
        ax=axes[0],
        title="ACF",
        color="#e8ff47",
        vlines_kwargs={"colors": "#1e1e2e"},
    )
    plot_pacf(
        series.dropna(),
        lags=lags,
        ax=axes[1],
        title="PACF",
        color="#47c8ff",
        method="ywm",
        vlines_kwargs={"colors": "#1e1e2e"},
    )

    for ax, title in zip(axes, ["ACF", "PACF"]):
        ax.set_title(title, color="#e8e8f0", fontsize=13)

    plt.tight_layout()
    save_figure(fig, "04_acf_pacf.png")


def plot_seasonal_subseries(series: pd.Series) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(14, 4))
    fig.patch.set_facecolor("#0a0a0f")

    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_of_week_average = series.groupby(series.index.dayofweek).mean()
    axes[0].bar(days, day_of_week_average.values, color="#e8ff47", edgecolor="#0a0a0f")
    axes[0].set_title("Average Views by Day of Week", color="#e8e8f0", fontsize=12)

    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_average = series.groupby(series.index.month).mean()
    axes[1].bar([months[month - 1] for month in monthly_average.index], monthly_average.values, color="#47c8ff", edgecolor="#0a0a0f")
    axes[1].set_title("Average Views by Month", color="#e8e8f0", fontsize=12)

    for ax in axes:
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")

    plt.tight_layout()
    save_figure(fig, "05_seasonal_subseries.png")


def plot_lag_scatter(series: pd.Series, lags: tuple[int, ...] = (1, 7, 14, 30)) -> None:
    fig, axes = plt.subplots(1, len(lags), figsize=(4 * len(lags), 4))
    fig.patch.set_facecolor("#0a0a0f")
    if len(lags) == 1:
        axes = [axes]

    for ax, lag in zip(axes, lags):
        x = series[:-lag].dropna()
        y = series[lag:].dropna()
        paired_length = min(len(x), len(y))
        x = x.iloc[:paired_length]
        y = y.iloc[:paired_length]
        correlation = np.corrcoef(x, y)[0, 1]
        ax.scatter(x.values, y.values, alpha=0.3, s=4, color="#e8ff47")
        ax.set_title(f"Lag {lag}  r={correlation:.2f}", color="#e8e8f0", fontsize=11)
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")

    plt.tight_layout()
    save_figure(fig, "06_lag_scatter.png")


def run(
    article: str = "Main_Page",
    project: str = "en.wikipedia.org",
    access: str = "all-access",
    use_aggregated: bool = False,
):
    print("\n" + "=" * 60)
    print("Wikipedia Traffic Analysis")
    print(f"Article : {article if not use_aggregated else '(aggregated all pages)'}")
    print(f"Project : {project}")
    print("=" * 60 + "\n")

    print("[1/3] Loading data from MongoDB...")
    if use_aggregated:
        df = load_aggregated_daily(project=project, access=access).rename({"total_views": "views"})
    else:
        df = load_article(article=article, project=project, access=access)
    df = fill_missing_dates(df)
    series = to_pandas_series(df)
    print(f"Loaded {len(series)} daily points\n")

    print("[2/3] Running analysis plots and tests...")
    plot_time_series(series, f"Wikipedia Daily Views - {article}")
    plot_moving_averages(series)
    decomposition = decompose(series)
    adf_result = adf_test(series, "Original")
    kpss_result = kpss_test(series, "Original")
    stationary_series, differencing_order = make_stationary(series)
    plot_acf_pacf(stationary_series)
    plot_seasonal_subseries(series)
    plot_lag_scatter(series)

    summary = {
        "article": article,
        "project": project,
        "access": access,
        "use_aggregated": use_aggregated,
        "d": differencing_order,
        "adf": adf_result,
        "kpss": kpss_result,
        "trend_strength": float(np.nanstd(decomposition.trend)),
    }

    print("\n[3/3] Analysis complete")
    print(f"Suggested differencing order: d={differencing_order}")
    print(f"Plots saved to: {PLOTS_DIR}")
    return series, differencing_order, summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Wikipedia traffic analysis")
    parser.add_argument("--article", default="Main_Page")
    parser.add_argument("--project", default="en.wikipedia.org")
    parser.add_argument("--access", default="all-access")
    parser.add_argument("--aggregated", action="store_true")
    return parser


if __name__ == "__main__":
    cli_args = build_parser().parse_args()
    run(
        article=cli_args.article,
        project=cli_args.project,
        access=cli_args.access,
        use_aggregated=cli_args.aggregated,
    )
