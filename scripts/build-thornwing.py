#!/usr/bin/env python3
"""Build the playable Thornwing GLB from the committed static display mesh."""

from __future__ import annotations

import os
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/models/library/forest-wyvern-display.glb"
OUTPUT = ROOT / "public/models/thornwing.glb"
INNER = ROOT / "scripts/build-thornwing-blender.py"


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
    for required in (SOURCE, INNER):
        if not required.is_file():
            raise SystemExit(f"missing required input: {required}")
    command = [
        str(blender_binary()),
        "--background",
        "--factory-startup",
        "--python",
        str(INNER),
        "--",
        "--source",
        str(SOURCE),
        "--output",
        str(OUTPUT),
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    if not OUTPUT.is_file():
        raise SystemExit(f"Blender produced no output: {OUTPUT}")
    print(f"built {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
