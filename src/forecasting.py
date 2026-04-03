"""Forecast Wikipedia traffic and save dashboard-ready artifacts."""

from __future__ import annotations

import argparse
import json
import logging
import sys
import warnings
from pathlib import Path

log = logging.getLogger(__name__)

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX

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
    dates = pd.to_datetime(df.get_column(date_col).to_list())
    values = df.get_column(views_col).to_list()
    return pd.Series(values, index=dates, name=views_col).asfreq("D").ffill()


def evaluate(actual, predicted, model_name: str = "") -> dict:
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    mae = mean_absolute_error(actual, predicted)
    mse = mean_squared_error(actual, predicted)
    rmse = float(np.sqrt(mean_squared_error(actual, predicted)))
    mape = float(np.mean(np.abs((actual - predicted) / (actual + 1))) * 100)
    smape = float(
        np.mean((2 * np.abs(actual - predicted)) / (np.abs(actual) + np.abs(predicted) + 1)) * 100
    )
    wape = float((np.sum(np.abs(actual - predicted)) / (np.sum(np.abs(actual)) + 1)) * 100)
    r2 = float(r2_score(actual, predicted))
    bias = float(np.mean(predicted - actual))
    metrics = {
        "Model": model_name,
        "MAE": round(mae, 2),
        "MSE": round(mse, 2),
        "RMSE": round(rmse, 2),
        "MAPE (%)": round(mape, 2),
        "SMAPE (%)": round(smape, 2),
        "WAPE (%)": round(wape, 2),
        "R2": round(r2, 4),
        "Bias": round(bias, 2),
    }
    log.info("%-30s MAE=%.2f  RMSE=%.2f  MAPE=%.2f%%  SMAPE=%.2f%%  R2=%.3f",
             model_name, mae, rmse, mape, smape, r2)
    return metrics


def save_forecast_plot(
    train, test, forecast, future, model_name: str, filename: str,
    conf_lower=None, conf_upper=None,
) -> None:
    """Save forecast plot in both light and dark themes."""
    for theme, c in THEMES.items():
        fig, ax = plt.subplots(figsize=(14, 5))
        fig.patch.set_facecolor(c["fig_bg"])
        ax.set_facecolor(c["ax_bg"])
        ax.plot(train.index, train.values, color=c["train"], linewidth=1, label="Train")
        ax.plot(test.index, test.values, color=c["actual"], linewidth=2, label="Actual (test)")
        ax.plot(
            test.index, forecast, color=c["forecast"],
            linewidth=2, linestyle="--", label=f"Forecast ({model_name})",
        )
        if future is not None:
            future_index = pd.date_range(
                test.index[-1] + pd.Timedelta(days=1), periods=len(future), freq="D"
            )
            ax.plot(future_index, future, color=c["future"], linewidth=2, linestyle=":", label="Future")
            if conf_lower is not None and conf_upper is not None:
                ax.fill_between(
                    future_index, conf_lower, conf_upper,
                    color=c["future"], alpha=0.15, label="95% CI",
                )
        ax.set_title(f"{model_name} Forecast vs Actual", color=c["text"], fontsize=13, fontweight="bold")
        ax.tick_params(colors=c["muted"])
        for spine in ax.spines.values():
            spine.set_color(c["spine"])
        ax.legend(facecolor=c["legend_bg"], labelcolor=c["text"], edgecolor=c["spine"])
        plt.tight_layout()

        stem, ext = filename.rsplit(".", 1)
        path = PLOTS_DIR / f"{stem}_{theme}.{ext}"
        fig.savefig(path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        log.info("Saved plot -> %s", path.name)


def plot_comparison(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows).sort_values("MAPE (%)")

    for theme, c in THEMES.items():
        fig, axes = plt.subplots(1, 3, figsize=(14, 4))
        fig.patch.set_facecolor(c["fig_bg"])

        for ax, metric in zip(axes, ["MAE", "RMSE", "MAPE (%)"]):
            ax.barh(
                df["Model"],
                df[metric],
                color=[c["palette"][i % len(c["palette"])] for i in range(len(df))],
                edgecolor=c["edge"],
            )
            ax.set_title(metric, color=c["text"], fontsize=12)
            ax.set_facecolor(c["ax_bg"])
            ax.tick_params(colors=c["muted"])
            for spine in ax.spines.values():
                spine.set_color(c["spine"])
            ax.invert_yaxis()

        fig.suptitle("Model Comparison", color=c["text"], fontsize=13, fontweight="bold")
        plt.tight_layout()
        path = PLOTS_DIR / f"11_model_comparison_{theme}.png"
        fig.savefig(path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        log.info("Saved plot -> %s", path.name)

    return df


def split_series(series: pd.Series, test_days: int = 60) -> tuple[pd.Series, pd.Series]:
    if test_days <= 0 or test_days >= len(series):
        raise ValueError("test_days must be between 1 and len(series) - 1")
    return series.iloc[:-test_days], series.iloc[-test_days:]


def linear_trend(train, test, forecast_steps: int = 30):
    x_train = np.arange(len(train)).reshape(-1, 1)
    x_test = np.arange(len(train), len(train) + len(test)).reshape(-1, 1)
    x_future = np.arange(len(train) + len(test), len(train) + len(test) + forecast_steps).reshape(-1, 1)
    model = LinearRegression().fit(x_train, train.values)
    forecast = model.predict(x_test)
    future = model.predict(x_future)
    # approx CI: ±1.96 * residual std
    sigma = float(np.std(train.values - model.predict(x_train)))
    conf_lower = (future - 1.96 * sigma).tolist()
    conf_upper = (future + 1.96 * sigma).tolist()
    save_forecast_plot(train, test, forecast, future, "Linear Trend", "07_linear_trend.png", conf_lower, conf_upper)
    return evaluate(test.values, forecast, "Linear Trend"), forecast.tolist(), future.tolist(), conf_lower, conf_upper


def holt_winters(train, test, forecast_steps: int = 30):
    model = ExponentialSmoothing(
        train,
        trend="add",
        seasonal="add",
        seasonal_periods=7,
        initialization_method="estimated",
    ).fit(optimized=True)
    forecast = model.forecast(len(test)).values
    future = model.forecast(len(test) + forecast_steps).values[-forecast_steps:]
    sigma = float(np.std(model.resid))
    conf_lower = (future - 1.96 * sigma).tolist()
    conf_upper = (future + 1.96 * sigma).tolist()
    save_forecast_plot(train, test, forecast, future, "Holt-Winters", "08_holt_winters.png", conf_lower, conf_upper)
    return evaluate(test.values, forecast, "Holt-Winters"), forecast.tolist(), future.tolist(), conf_lower, conf_upper


def fit_arima(train, test, d: int = 1, forecast_steps: int = 30):
    order = (2, d, 2)
    model = ARIMA(train, order=order).fit()
    fc = model.get_forecast(steps=len(test) + forecast_steps)
    all_pred = fc.predicted_mean.values
    forecast = all_pred[:len(test)]
    future = all_pred[-forecast_steps:]
    ci = fc.conf_int(alpha=0.05)
    conf_lower = ci.iloc[-forecast_steps:, 0].values.tolist()
    conf_upper = ci.iloc[-forecast_steps:, 1].values.tolist()
    save_forecast_plot(train, test, forecast, future, f"ARIMA{order}", "09_arima.png", conf_lower, conf_upper)
    return evaluate(test.values, forecast, f"ARIMA{order}"), forecast.tolist(), future.tolist(), conf_lower, conf_upper


def fit_sarima(train, test, d: int = 1, forecast_steps: int = 30):
    order = (1, d, 1)
    seasonal_order = (1, 1, 0, 7)
    model = SARIMAX(
        train,
        order=order,
        seasonal_order=seasonal_order,
        enforce_stationarity=False,
        enforce_invertibility=False,
    ).fit(disp=False)
    fc = model.get_forecast(steps=len(test) + forecast_steps)
    all_pred = fc.predicted_mean.values
    forecast = all_pred[:len(test)]
    future = all_pred[-forecast_steps:]
    ci = fc.conf_int(alpha=0.05)
    conf_lower = ci.iloc[-forecast_steps:, 0].values.tolist()
    conf_upper = ci.iloc[-forecast_steps:, 1].values.tolist()
    save_forecast_plot(train, test, forecast, future, "SARIMA", "10_sarima.png", conf_lower, conf_upper)
    return evaluate(test.values, forecast, f"SARIMA{order}x{seasonal_order}"), forecast.tolist(), future.tolist(), conf_lower, conf_upper


def best_model_key(model_name: str) -> str:
    normalized = model_name.lower()
    if "holt" in normalized:
        return "holt_winters"
    if "sarima" in normalized:
        return "sarima"
    if "arima" in normalized:
        return "arima"
    return "linear"


def run(
    article: str = "Main_Page",
    project: str = "en.wikipedia.org",
    access: str = "all-access",
    d: int = 1,
    test_days: int = 60,
    forecast_steps: int = 30,
    use_aggregated: bool = False,
):
    log.info("=" * 60)
    log.info("Wikipedia Traffic Forecasting")
    log.info("Article : %s", article if not use_aggregated else "(aggregated)")
    log.info("d       : %d", d)
    log.info("=" * 60)

    log.info("[1/4] Loading data from MongoDB...")
    if use_aggregated:
        df = load_aggregated_daily(project=project, access=access).rename({"total_views": "views"})
    else:
        df = load_article(article=article, project=project, access=access)
    df = fill_missing_dates(df)
    series = to_pandas_series(df)
    log.info("Loaded %d daily points", len(series))

    train, test = split_series(series, test_days=test_days)
    log.info("Train: %d | Test: %d", len(train), len(test))

    log.info("[2/4] Running forecasting models...")
    metric_rows = []
    forecasts = {}
    futures = {}
    conf_lowers = {}
    conf_uppers = {}

    for model_fn in (
        linear_trend,
        holt_winters,
        lambda tr, te, steps: fit_arima(tr, te, d=d, forecast_steps=steps),
        lambda tr, te, steps: fit_sarima(tr, te, d=d, forecast_steps=steps),
    ):
        metrics, forecast, future, conf_lower, conf_upper = model_fn(train, test, forecast_steps)
        key = best_model_key(metrics["Model"])
        metric_rows.append(metrics)
        forecasts[key] = forecast
        futures[key] = future
        conf_lowers[key] = conf_lower
        conf_uppers[key] = conf_upper

    log.info("[3/4] Comparing model quality...")
    comparison_df = plot_comparison(metric_rows)
    log.info("\n%s", comparison_df[
        ["Model", "MAE", "MSE", "RMSE", "MAPE (%)", "SMAPE (%)", "WAPE (%)", "R2", "Bias"]
    ].to_string(index=False))

    log.info("[4/4] Saving precomputed results...")
    comparison_path = PRECOMP_DIR / "model_comparison.json"
    comparison_path.write_text(json.dumps(metric_rows, indent=2))
    log.info("Saved JSON -> %s", comparison_path.name)

    winner = min(metric_rows, key=lambda row: row["MAPE (%)"])
    winner_key = best_model_key(winner["Model"])
    forecast_doc = {
        "article": article,
        "actual": test.values.tolist(),
        "forecast": forecasts[winner_key],
        "future": futures[winner_key],
        "conf_lower": conf_lowers[winner_key],
        "conf_upper": conf_uppers[winner_key],
        "best_model": winner["Model"],
        "metrics": metric_rows,
        "test_dates": [str(index.date()) for index in test.index],
    }
    safe_name = article.replace("/", "_")
    forecast_path = PRECOMP_DIR / f"{safe_name}_forecast.json"
    forecast_path.write_text(json.dumps(forecast_doc, indent=2))
    log.info("Saved JSON -> %s", forecast_path.name)

    log.info("Forecasting complete")
    log.info("Best model: %s (MAPE=%.2f%%)", winner["Model"], winner["MAPE (%)"])
    return forecast_doc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Wikipedia traffic forecasting")
    parser.add_argument("--article", default="Main_Page")
    parser.add_argument("--project", default="en.wikipedia.org")
    parser.add_argument("--access", default="all-access")
    parser.add_argument("--d", type=int, default=1, help="Differencing order from analysis")
    parser.add_argument("--test-days", type=int, default=60)
    parser.add_argument("--steps", type=int, default=30, help="Future forecast steps")
    parser.add_argument("--aggregated", action="store_true")
    return parser


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cli_args = build_parser().parse_args()
    run(
        article=cli_args.article,
        project=cli_args.project,
        access=cli_args.access,
        d=cli_args.d,
        test_days=cli_args.test_days,
        forecast_steps=cli_args.steps,
        use_aggregated=cli_args.aggregated,
    )
