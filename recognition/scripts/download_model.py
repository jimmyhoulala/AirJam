#!/usr/bin/env python3
"""Download the MediaPipe Hand Landmarker task model."""

from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from hand_instrument.model import DEFAULT_MODEL_PATH, HAND_LANDMARKER_MODEL_URL


def download_model(output_path: Path, url: str, force: bool) -> Path:
    output_path = output_path.expanduser().resolve()
    if output_path.exists() and not force:
        print(f"Model already exists: {output_path}")
        return output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading MediaPipe Hand Landmarker model to {output_path}")
    urllib.request.urlretrieve(url, output_path)
    print("Done.")
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / DEFAULT_MODEL_PATH,
        help="Path for the downloaded .task model.",
    )
    parser.add_argument(
        "--url",
        default=HAND_LANDMARKER_MODEL_URL,
        help="Model URL to download.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite the model if it already exists.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    download_model(args.output, args.url, args.force)


if __name__ == "__main__":
    main()

