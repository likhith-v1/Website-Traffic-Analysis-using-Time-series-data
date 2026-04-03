"""Run the full Wikipedia traffic workflow from the project root.

This script keeps the happy path simple:
1. analyze the time series
2. choose a differencing order
3. generate forecasts and dashboard-ready JSON
"""

import argparse
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

from src.analysis import run as run_analysis
from src.forecasting import run as run_forecasting


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Wikipedia traffic time-series pipeline"
    )
    parser.add_argument("--article", default="Main_Page")
    parser.add_argument("--project", default="en.wikipedia.org")
    parser.add_argument("--access", default="all-access")
    parser.add_argument("--test-days", type=int, default=60)
    parser.add_argument(
        "--steps",
        type=int,
        default=30,
        help="Future forecast horizon in days",
    )
    parser.add_argument(
        "--aggregated",
        action="store_true",
        help="Aggregate all pages instead of a single article",
    )
    parser.add_argument(
        "--skip-analysis",
        action="store_true",
        help="Skip analysis and go straight to forecasting",
    )
    parser.add_argument(
        "--d",
        type=int,
        default=None,
        help="Override differencing order and skip auto-detection",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    d = args.d

    if not args.skip_analysis:
        log.info("=" * 60)
        log.info("Step 1: Time Series Analysis")
        log.info("=" * 60)
        _, d_detected, summary = run_analysis(
            article=args.article,
            project=args.project,
            access=args.access,
            use_aggregated=args.aggregated,
        )
        if d is None:
            d = d_detected
        analysis_path = ROOT / "outputs" / "precomputed" / "analysis_results.json"
        analysis_path.parent.mkdir(parents=True, exist_ok=True)
        analysis_path.write_text(json.dumps(summary, indent=2, default=str))
        log.info("Saved JSON -> analysis_results.json")
    else:
        if d is None:
            d = 1
        log.info("Skipping analysis. Using d=%d.", d)

    log.info("=" * 60)
    log.info("Step 2: Forecasting")
    log.info("=" * 60)
    run_forecasting(
        article=args.article,
        project=args.project,
        access=args.access,
        d=d,
        test_days=args.test_days,
        forecast_steps=args.steps,
        use_aggregated=args.aggregated,
    )

    log.info("=" * 60)
    log.info("Pipeline complete")
    log.info("Plots       -> outputs/plots/")
    log.info("Precomputed -> outputs/precomputed/")
    log.info("Dashboard   -> http://localhost:5173/models")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
