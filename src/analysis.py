"""Time-series analysis for Wikipedia traffic data.

The module reads daily pageviews from MongoDB, prepares a clean daily series,
generates analysis plots (in both light and dark themes), and returns a
differencing order that the forecasting step can reuse.
"""

from __future__ import annotations

import argparse
import logging
import sys
import warnings
from pathlib import Path

log = logging.getLogger(__name__)

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
from src.plot_themes import THEMES


def to_pandas_series(df, date_col: str = "date", views_col: str = "views") -> pd.Series:
    """Convert a Polars DataFrame into a pandas Series with daily frequency."""
    dates = pd.to_datetime(df.get_column(date_col).to_list())
    values = df.get_column(views_col).to_list()
    return pd.Series(values, index=dates, name=views_col).asfreq("D")


def save_figure(fig: plt.Figure, filename: str, theme: str = "dark") -> None:
    stem, ext = filename.rsplit(".", 1)
    path = PLOTS_DIR / f"{stem}_{theme}.{ext}"
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    log.info("Saved plot -> %s", path.name)


def _style_ax(ax, c: dict) -> None:
    """Apply theme colours to a single axes object."""
    ax.set_facecolor(c["ax_bg"])
    ax.tick_params(colors=c["muted"])
    for spine in ax.spines.values():
        spine.set_color(c["spine"])


def plot_time_series(series: pd.Series, title: str = "Daily Views") -> None:
    for theme, c in THEMES.items():
        fig, ax = plt.subplots(figsize=(14, 5))
        fig.patch.set_facecolor(c["fig_bg"])
        ax.plot(series.index, series.values, color=c["line1"], linewidth=1.2)
        ax.fill_between(series.index, series.values, alpha=0.15, color=c["line1"])
        _style_ax(ax, c)
        ax.set_title(title, color=c["text"], fontsize=14, fontweight="bold", pad=14)
        ax.set_xlabel("Date", color=c["muted"])
        ax.set_ylabel("Views", color=c["muted"])
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
        plt.xticks(rotation=45)
        plt.tight_layout()
        save_figure(fig, "01_time_plot.png", theme)


def plot_moving_averages(series: pd.Series, windows: tuple[int, ...] = (7, 30, 90)) -> None:
    for theme, c in THEMES.items():
        fig, ax = plt.subplots(figsize=(14, 5))
        fig.patch.set_facecolor(c["fig_bg"])
        ax.plot(series.index, series.values, alpha=0.3, color=c["muted"], linewidth=0.8, label="Original")

        ma_colors = [c["line1"], c["line2"], c["line3"]]
        for window, color in zip(windows, ma_colors):
            ma = series.rolling(window=window, center=True).mean()
            ax.plot(ma.index, ma.values, color=color, linewidth=2, label=f"{window}-day MA")

        midpoint = len(series) // 2
        first_half_avg = series.iloc[:midpoint].mean()
        second_half_avg = series.iloc[midpoint:].mean()
        ax.plot(
            [series.index[midpoint // 2], series.index[midpoint + midpoint // 2]],
            [first_half_avg, second_half_avg],
            color=c["semi_avg"], linestyle="--", linewidth=1.5, label="Semi-average trend",
        )

        _style_ax(ax, c)
        ax.set_title("Moving Averages and Semi-Average Trend", color=c["text"], fontsize=13, fontweight="bold")
        ax.legend(facecolor=c["legend_bg"], labelcolor=c["text"], edgecolor=c["spine"])
        ax.set_xlabel("Date", color=c["muted"])
        ax.set_ylabel("Views", color=c["muted"])
        plt.tight_layout()
        save_figure(fig, "02_moving_averages.png", theme)


def decompose(series: pd.Series, period: int = 7):
    """Run STL decomposition and save themed plots."""
    result = STL(series.ffill(limit=7), period=period, robust=True).fit()

    stl_colors_dark  = ["#bbc4f4", "#f6ad55", "#94a3b8", "#fb923c"]
    stl_colors_light = ["#1b254b", "#b36b00", "#4a5568", "#F97316"]

    for theme, c in THEMES.items():
        stl_colors = stl_colors_dark if theme == "dark" else stl_colors_light
        fig, axes = plt.subplots(4, 1, figsize=(14, 12), sharex=True)
        fig.patch.set_facecolor(c["fig_bg"])
        components = [
            (series,         "Observed", stl_colors[0]),
            (result.trend,   "Trend",    stl_colors[1]),
            (result.seasonal,"Seasonal", stl_colors[2]),
            (result.resid,   "Residual", stl_colors[3]),
        ]
        for ax, (data, label, color) in zip(axes, components):
            ax.plot(series.index, data, color=color, linewidth=1)
            ax.set_ylabel(label, color=c["muted"], fontsize=11)
            _style_ax(ax, c)

        fig.suptitle("STL Decomposition", color=c["text"], fontsize=14, fontweight="bold")
        plt.tight_layout()
        save_figure(fig, "03_stl_decomposition.png", theme)

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
    log.info("ADF [%s] p=%.4f -> %s", label, response["p-value"], status)
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
    log.info("KPSS [%s] p=%.4f -> %s", label, response["p-value"], status)
    return response


def make_stationary(series: pd.Series) -> tuple[pd.Series, int]:
    """Auto-difference until the ADF test passes, up to order 3."""
    differencing_order = 0
    stationary_series = series.copy()
    while adfuller(stationary_series.dropna())[1] > 0.05 and differencing_order < 3:
        stationary_series = stationary_series.diff()
        differencing_order += 1
    log.info("Suggested differencing order: d=%d", differencing_order)
    return stationary_series, differencing_order


def plot_acf_pacf(series: pd.Series, lags: int = 40) -> None:
    for theme, c in THEMES.items():
        fig, axes = plt.subplots(1, 2, figsize=(14, 4))
        fig.patch.set_facecolor(c["fig_bg"])
        for ax in axes:
            _style_ax(ax, c)

        plot_acf(
            series.dropna(), lags=lags, ax=axes[0], title="ACF",
            color=c["line1"], vlines_kwargs={"colors": c["spine"]},
        )
        plot_pacf(
            series.dropna(), lags=lags, ax=axes[1], title="PACF",
            color=c["line2"], method="ywm", vlines_kwargs={"colors": c["spine"]},
        )

        for ax, title in zip(axes, ["ACF", "PACF"]):
            ax.set_title(title, color=c["text"], fontsize=13)

        plt.tight_layout()
        save_figure(fig, "04_acf_pacf.png", theme)


def plot_seasonal_subseries(series: pd.Series) -> None:
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    for theme, c in THEMES.items():
        fig, axes = plt.subplots(1, 2, figsize=(14, 4))
        fig.patch.set_facecolor(c["fig_bg"])

        dow_avg = series.groupby(series.index.dayofweek).mean()
        axes[0].bar(days, dow_avg.values, color=c["line1"], edgecolor=c["fig_bg"])
        axes[0].set_title("Average Views by Day of Week", color=c["text"], fontsize=12)

        mon_avg = series.groupby(series.index.month).mean()
        axes[1].bar(
            [months[m - 1] for m in mon_avg.index],
            mon_avg.values, color=c["line2"], edgecolor=c["fig_bg"],
        )
        axes[1].set_title("Average Views by Month", color=c["text"], fontsize=12)

        for ax in axes:
            _style_ax(ax, c)

        plt.tight_layout()
        save_figure(fig, "05_seasonal_subseries.png", theme)


def plot_lag_scatter(series: pd.Series, lags: tuple[int, ...] = (1, 7, 14, 30)) -> None:
    for theme, c in THEMES.items():
        fig, axes = plt.subplots(1, len(lags), figsize=(4 * len(lags), 4))
        fig.patch.set_facecolor(c["fig_bg"])
        if len(lags) == 1:
            axes = [axes]

        for ax, lag in zip(axes, lags):
            x = series[:-lag].dropna()
            y = series[lag:].dropna()
            n = min(len(x), len(y))
            x, y = x.iloc[:n], y.iloc[:n]
            correlation = np.corrcoef(x, y)[0, 1]
            ax.scatter(x.values, y.values, alpha=0.3, s=4, color=c["scatter"])
            ax.set_title(f"Lag {lag}  r={correlation:.2f}", color=c["text"], fontsize=11)
            _style_ax(ax, c)

        plt.tight_layout()
        save_figure(fig, "06_lag_scatter.png", theme)


def run(
    article: str = "Main_Page",
    project: str = "en.wikipedia.org",
    access: str = "all-access",
    use_aggregated: bool = False,
):
    log.info("=" * 60)
    log.info("Wikipedia Traffic Analysis")
    log.info("Article : %s", article if not use_aggregated else "(aggregated all pages)")
    log.info("Project : %s", project)
    log.info("=" * 60)

    log.info("[1/3] Loading data from MongoDB...")
    if use_aggregated:
        df = load_aggregated_daily(project=project, access=access).rename({"total_views": "views"})
    else:
        df = load_article(article=article, project=project, access=access)
    df = fill_missing_dates(df)
    series = to_pandas_series(df)
    log.info("Loaded %d daily points", len(series))

    log.info("[2/3] Running analysis plots and tests...")
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

    log.info("[3/3] Analysis complete")
    log.info("Suggested differencing order: d=%d", differencing_order)
    log.info("Plots saved to: %s", PLOTS_DIR)
    return series, differencing_order, summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Wikipedia traffic analysis")
    parser.add_argument("--article", default="Main_Page")
    parser.add_argument("--project", default="en.wikipedia.org")
    parser.add_argument("--access", default="all-access")
    parser.add_argument("--aggregated", action="store_true")
    return parser


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cli_args = build_parser().parse_args()
    run(
        article=cli_args.article,
        project=cli_args.project,
        access=cli_args.access,
        use_aggregated=cli_args.aggregated,
    )
