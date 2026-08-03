#!/usr/bin/env python3
"""Build the tracked sanctuary animation contact sheet and diff report."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("frames", type=Path)
    parser.add_argument("sheet", type=Path)
    parser.add_argument("report", type=Path)
    return parser.parse_args()


def mean_rgb_diff(left: Image.Image, right: Image.Image) -> float:
    diff = ImageChops.difference(left.convert("RGB"), right.convert("RGB"))
    return sum(ImageStat.Stat(diff).mean) / 3


def main() -> None:
    args = arguments()
    paths = sorted(args.frames.glob("Sanct_*__f*.png"))
    if not paths:
        raise SystemExit(f"No animation frames found in {args.frames}")

    grouped: dict[str, list[Path]] = defaultdict(list)
    for path in paths:
        grouped[path.name.split("__", 1)[0]].append(path)
    if any(len(group) != 5 for group in grouped.values()):
        raise SystemExit(
            f"Expected five frames per action: "
            f"{ {name: len(group) for name, group in grouped.items()} }"
        )

    images = [Image.open(path).convert("RGB") for path in paths]
    width, height = images[0].size
    if any(image.size != (width, height) for image in images):
        raise SystemExit("Animation samples do not share one resolution")

    columns = 5
    rows = len(grouped)
    sheet = Image.new("RGB", (width * columns, height * rows), "black")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, (path, image) in enumerate(zip(paths, images, strict=True)):
        x = (index % columns) * width
        y = (index // columns) * height
        sheet.paste(image, (x, y))
        draw.text((x + 7, y + 5), path.stem, fill="#ffff00", font=font)

    frame_diff = [
        {
            "from": left.name,
            "to": right.name,
            "mean_rgb_diff": mean_rgb_diff(left_image, right_image),
        }
        for left, right, left_image, right_image in zip(
            paths[:-1],
            paths[1:],
            images[:-1],
            images[1:],
            strict=True,
        )
    ]
    report = {
        "schema": "animation_contact_sheet_report.v1",
        "frames": [path.name for path in paths],
        "frame_diff": frame_diff,
    }

    args.sheet.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.sheet, optimize=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        f"contact-sheet:{args.sheet} actions:{rows} frames:{len(paths)} "
        f"max-diff:{max(item['mean_rgb_diff'] for item in frame_diff):.3f}"
    )


if __name__ == "__main__":
    main()
