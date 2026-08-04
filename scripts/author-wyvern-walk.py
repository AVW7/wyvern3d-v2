#!/usr/bin/env python3
"""Re-author and export the new-rig grounded walk wing carrier."""

from __future__ import annotations

import argparse
import os
import pathlib
import shutil
import subprocess


ROOT = pathlib.Path(__file__).resolve().parents[1]
BLEND = ROOT / "public/models/wyvern-rig.blend"
INNER = ROOT / "scripts/author-wyvern-walk-blender.py"
GLB = ROOT / "public/models/wyvern.glb"


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
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="author in memory only")
    args = parser.parse_args()
    if not BLEND.is_file():
        raise SystemExit(f"missing source blend: {BLEND}")

    command = [str(blender_binary()), "-b", str(BLEND), "-P", str(INNER), "--"]
    if not args.dry_run:
        command.extend(["--save", "--export", str(GLB)])
    subprocess.run(command, check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
