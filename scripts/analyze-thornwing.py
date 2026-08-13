#!/usr/bin/env python3
"""Measure the shipped Thornwing rig and clips into a committed signature."""

from __future__ import annotations

import os
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL = ROOT / "public/models/thornwing.glb"
SOURCE = ROOT / "public/models/library/forest-wyvern-display.glb"
INNER = ROOT / "scripts/analyze-thornwing-blender.py"
OUTPUT = ROOT / "validation/thornwing-animations/clip-signatures.json"


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
    command = [
        str(blender_binary()), "--background", "--factory-startup",
        "--python", str(INNER), "--", "--model", str(MODEL),
        "--source", str(SOURCE), "--output", str(OUTPUT),
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    if not OUTPUT.is_file():
        raise SystemExit(f"Blender produced no report: {OUTPUT}")
    print(f"measured {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
