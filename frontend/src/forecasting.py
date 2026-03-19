"""Forecast Wikipedia traffic and save dashboard-ready artifacts."""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from pathlib import Path

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


def to_pandas_series(df, date_col: str = "date", views_col: str = "views") -> pd.Series:
    dates = pd.to_datetime(df.get_column(date_col).to_list())
    values = df.get_column(views_col).to_list()
    return pd.Series(values, index=dates, name=views_col).asfreq("D").ffill()


def evaluate(actual, predicted, model_name: str = "") -> dict:
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    mae = mean_absolute_error(actual, predicted)
    mse = mean_squared_error(actual, predicted)
    rmse = float(np.sqrt(mse))
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
    print(
        f"{model_name:30s} "
        f"MAE={mae:.0f}  RMSE={rmse:.0f}  MAPE={mape:.2f}%  "
        f"SMAPE={smape:.2f}%  R2={r2:.3f}"
    )
    return metrics


def save_forecast_plot(train, test, forecast, future, model_name: str, filename: str) -> None:
    fig, ax = plt.subplots(figsize=(14, 5))
    fig.patch.set_facecolor("#0a0a0f")
    ax.set_facecolor("#0a0a0f")
    ax.plot(train.index, train.values, color="#6b6b8a", linewidth=1, label="Train")
    ax.plot(test.index, test.values, color="#47c8ff", linewidth=2, label="Actual (test)")
    ax.plot(test.index, forecast, color="#e8ff47", linewidth=2, linestyle="--", label=f"Forecast ({model_name})")
    if future is not None:
        future_index = pd.date_range(test.index[-1] + pd.Timedelta(days=1), periods=len(future), freq="D")
        ax.plot(future_index, future, color="#ff6b6b", linewidth=2, linestyle=":", label="Future")
    ax.set_title(f"{model_name} Forecast vs Actual", color="#e8e8f0", fontsize=13, fontweight="bold")
    ax.tick_params(colors="#6b6b8a")
    ax.spines[:].set_color("#1e1e2e")
    ax.legend(facecolor="#111118", labelcolor="#e8e8f0", edgecolor="#1e1e2e")
    plt.tight_layout()
    path = PLOTS_DIR / filename
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved plot -> {path.name}")


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
    save_forecast_plot(train, test, forecast, future, "Linear Trend", "07_linear_trend.png")
    return evaluate(test.values, forecast, "Linear Trend"), forecast.tolist(), future.tolist()


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
    save_forecast_plot(train, test, forecast, future, "Holt-Winters", "08_holt_winters.png")
    return evaluate(test.values, forecast, "Holt-Winters"), forecast.tolist(), future.tolist()


def fit_arima(train, test, d: int = 1, forecast_steps: int = 30):
    order = (2, d, 2)
    model = ARIMA(train, order=order).fit()
    forecast = model.forecast(steps=len(test)).values
    future = model.forecast(steps=len(test) + forecast_steps).values[-forecast_steps:]
    save_forecast_plot(train, test, forecast, future, f"ARIMA{order}", "09_arima.png")
    return evaluate(test.values, forecast, f"ARIMA{order}"), forecast.tolist(), future.tolist()


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
    forecast = model.forecast(steps=len(test)).values
    future = model.forecast(steps=len(test) + forecast_steps).values[-forecast_steps:]
    save_forecast_plot(train, test, forecast, future, "SARIMA", "10_sarima.png")
    return evaluate(test.values, forecast, f"SARIMA{order}x{seasonal_order}"), forecast.tolist(), future.tolist()


def model_slug(model_name: str) -> str:
    """Convert a model name to a stable dict key, keeping ARIMA and SARIMA distinct."""
    normalized = model_name.lower()
    if "holt" in normalized:
        return "holt_winters"
    # Check SARIMA before ARIMA so the substring "arima" inside "sarima" doesn't
    # cause a false match. Previously both would resolve to "arima", making the
    # SARIMA entry silently overwrite the ARIMA entry in the forecasts dict.
    if "sarima" in normalized:
        return "sarima"
    if "arima" in normalized:
        return "arima"
    return "linear"


def plot_comparison(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows).sort_values("MAPE (%)")
    fig, axes = plt.subplots(1, 3, figsize=(14, 4))
    fig.patch.set_facecolor("#0a0a0f")
    colors = ["#e8ff47", "#47c8ff", "#ff6b6b", "#a855f7"]

    for ax, metric in zip(axes, ["MAE", "RMSE", "MAPE (%)"]):
        ax.barh(
            df["Model"],
            df[metric],
            color=[colors[i % len(colors)] for i in range(len(df))],
            edgecolor="#0a0a0f",
        )
        ax.set_title(metric, color="#e8e8f0", fontsize=12)
        ax.set_facecolor("#0a0a0f")
        ax.tick_params(colors="#6b6b8a")
        ax.spines[:].set_color("#1e1e2e")
        ax.invert_yaxis()

    fig.suptitle("Model Comparison", color="#e8e8f0", fontsize=13, fontweight="bold")
    plt.tight_layout()
    output_path = PLOTS_DIR / "11_model_comparison.png"
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved plot -> {output_path.name}")
    return df


def run(
    article: str = "Main_Page",
    project: str = "en.wikipedia.org",
    access: str = "all-access",
    d: int = 1,
    test_days: int = 60,
    forecast_steps: int = 30,
    use_aggregated: bool = False,
):
    print("\n" + "=" * 60)
    print("Wikipedia Traffic Forecasting")
    print(f"Article : {article if not use_aggregated else '(aggregated)'}")
    print(f"d       : {d}")
    print("=" * 60 + "\n")

    print("[1/4] Loading data from MongoDB...")
    if use_aggregated:
        df = load_aggregated_daily(project=project, access=access).rename({"total_views": "views"})
    else:
        df = load_article(article=article, project=project, access=access)
    df = fill_missing_dates(df)
    series = to_pandas_series(df)
    print(f"Loaded {len(series)} daily points\n")

    train, test = split_series(series, test_days=test_days)
    print(f"Train: {len(train)} | Test: {len(test)}\n")

    print("[2/4] Running forecasting models...")
    metric_rows: list[dict] = []
    forecasts: dict[str, list] = {}
    futures: dict[str, list] = {}

    # Run each model individually so ARIMA and SARIMA get distinct slug keys.
    for model_fn, slug in [
        (lambda tr, te, steps: linear_trend(tr, te, steps), "linear"),
        (lambda tr, te, steps: holt_winters(tr, te, steps), "holt_winters"),
        (lambda tr, te, steps: fit_arima(tr, te, d=d, forecast_steps=steps), "arima"),
        (lambda tr, te, steps: fit_sarima(tr, te, d=d, forecast_steps=steps), "sarima"),
    ]:
        metrics, forecast, future = model_fn(train, test, forecast_steps)
        metric_rows.append(metrics)
        forecasts[slug] = forecast
        futures[slug] = future

    print("\n[3/4] Comparing model quality...")
    comparison_df = plot_comparison(metric_rows)
    print(
        comparison_df[
            ["Model", "MAE", "MSE", "RMSE", "MAPE (%)", "SMAPE (%)", "WAPE (%)", "R2", "Bias"]
        ].to_string(index=False)
    )

    print("\n[4/4] Saving precomputed results...")
    comparison_path = PRECOMP_DIR / "model_comparison.json"
    comparison_path.write_text(json.dumps(metric_rows, indent=2))
    print(f"Saved JSON -> {comparison_path.name}")

    winner = min(metric_rows, key=lambda row: row["MAPE (%)"])
    winner_key = model_slug(winner["Model"])
    forecast_doc = {
        "article": article,
        "actual": test.values.tolist(),
        "forecast": forecasts[winner_key],
        "future": futures[winner_key],
        "best_model": winner["Model"],
        "metrics": metric_rows,
        "test_dates": [str(idx.date()) for idx in test.index],
    }
    safe_name = article.replace("/", "_")
    forecast_path = PRECOMP_DIR / f"{safe_name}_forecast.json"
    forecast_path.write_text(json.dumps(forecast_doc, indent=2))
    print(f"Saved JSON -> {forecast_path.name}")

    print("\nForecasting complete")
    print(f"Best model: {winner['Model']} (MAPE={winner['MAPE (%)']:.2f}%)")
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
