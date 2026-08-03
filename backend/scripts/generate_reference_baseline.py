"""Generate the production drift-reference baseline from settled fixtures.

Run from the backend directory:

    PYTHONPATH=. python scripts/generate_reference_baseline.py

This command intentionally fails without writing an artifact when the minimum
verified sample cannot be met. It never fabricates or zero-fills a baseline.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.db.session import close_db, get_db_session, init_db  # noqa: E402
from src.monitoring.baseline import (  # noqa: E402
    BaselineGenerationConfig,
    BaselineGenerationError,
    ReferenceBaselineGenerator,
)

logger = logging.getLogger("sabiscore.ml.baseline")
DEFAULT_OUTPUT = BACKEND_ROOT / "data" / "reference" / "baseline_v1.parquet"
DEFAULT_MANIFEST = BACKEND_ROOT / "data" / "reference" / "baseline_v1.manifest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a drift reference through the production feature path."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--minimum-sample", type=int, default=1_000)
    parser.add_argument("--limit", type=int, default=5_000)
    parser.add_argument("--league", default=None)
    parser.add_argument(
        "--include-reduced-evidence",
        action="store_true",
        help="Include vectors flagged as reduced-evidence baselines.",
    )
    return parser.parse_args()


async def run(args: argparse.Namespace) -> int:
    await init_db()
    try:
        async with get_db_session() as session:
            result = await ReferenceBaselineGenerator().generate(
                session,
                BaselineGenerationConfig(
                    output_path=args.output.resolve(),
                    manifest_path=args.manifest.resolve(),
                    minimum_sample=args.minimum_sample,
                    fixture_limit=args.limit,
                    league=args.league,
                    include_reduced_evidence=args.include_reduced_evidence,
                ),
            )
        logger.info(
            "Reference baseline ready: %s rows x %s columns; sha256=%s",
            result.rows,
            result.columns,
            result.artifact_sha256,
        )
        logger.info("Manifest: %s", result.manifest_path)
        return 0
    except BaselineGenerationError as exc:
        logger.error("Baseline generation blocked: %s", exc)
        return 2
    finally:
        await close_db()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    return asyncio.run(run(parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
