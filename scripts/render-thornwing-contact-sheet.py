#!/usr/bin/env python3
"""Render and assemble the committed Thornwing animation contact sheet."""

from __future__ import annotations

import os
import pathlib
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL = ROOT / "public/models/thornwing.glb"
INNER = ROOT / "scripts/render-thornwing-contact-sheet-blender.py"
OUTPUT = ROOT / "docs/images/thornwing-animation-contact-sheet.png"
CLIPS = ("idle", "walk", "takeoff", "cruise", "land", "attack", "death")
SAMPLE_LABELS = {
    "cruise": ("0%", "12.5%", "25%", "37.5%", "50%"),
}
SAMPLES = 5
CELL = 256
LABEL = 28


def blender_binary() -> pathlib.Path:
    configured = os.environ.get("BLENDER")
    candidates = [
        pathlib.Path(configured).expanduser() if configured else None,
        pathlib.Path(shutil.which("blender")) if shutil.which("blender") else None,
        pathlib.Path("/Applications/Blender.app/Contents/MacOS/Blender"),
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate
    raise SystemExit("Blender not found; set BLENDER to its executable")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="thornwing-contact-") as temporary:
        directory = pathlib.Path(temporary)
        subprocess.run(
            [
                str(blender_binary()), "--background", "--factory-startup",
                "--python", str(INNER), "--", "--model", str(MODEL),
                "--output-dir", str(directory),
            ],
            cwd=ROOT,
            check=True,
        )
        sheet = Image.new("RGB", (CELL * SAMPLES, (CELL + LABEL) * len(CLIPS)), "#080c12")
        draw = ImageDraw.Draw(sheet)
        font = ImageFont.load_default(size=16)
        small = ImageFont.load_default(size=12)
        for row, clip in enumerate(CLIPS):
            y = row * (CELL + LABEL)
            draw.text((8, y + 6), clip, fill="#e8f0e4", font=font)
            labels = SAMPLE_LABELS.get(clip, ("0%", "25%", "50%", "75%", "100%"))
            for column in range(SAMPLES):
                frame = Image.open(directory / f"{clip}-{column}.png").convert("RGB")
                sheet.paste(frame, (column * CELL, y + LABEL))
                draw.text(
                    (column * CELL + 7, y + LABEL + 7),
                    labels[column],
                    fill="#b8c9b1",
                    font=small,
                    stroke_width=2,
                    stroke_fill="#10150f",
                )
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(OUTPUT, optimize=True)
    print(f"rendered {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
