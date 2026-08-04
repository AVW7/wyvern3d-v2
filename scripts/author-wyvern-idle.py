#!/usr/bin/env python3
"""Re-author the wyvern `idle` clip and re-export the GLB.

This is the driver. It finds Blender and hands the work to
`scripts/author-wyvern-idle-blender.py`, mirroring the split between
`analyze-clips.py` and `analyze-clips-blender.py`.

    pnpm assets:wyvern-idle              # rebuild idle, save the .blend, export
    pnpm assets:wyvern-idle --measure    # ...and print the measured signature
    pnpm assets:wyvern-idle --dry-run    # measure only; touch nothing on disk

The clip is generated rather than hand-keyed. Read the inner script's docstring
before changing it: the rig's axis conventions are measured, several of them are
the opposite of the obvious guess, and the previous clip shipped a 97.5 degree
left/right wing mismatch by assuming one of them.

`public/models/wyvern-rig.blend` is gitignored and is the source of truth for
every clip in the GLB. Blender leaves a `.blend1` backup beside it on save.
"""

from __future__ import annotations

import argparse
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BLEND = ROOT / "public/models/wyvern-rig.blend"
INNER = ROOT / "scripts/author-wyvern-idle-blender.py"
MEASURE = ROOT / "scripts/measure-wyvern-clip-blender.py"
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="build and measure in memory; do not save the .blend or write the GLB",
    )
    parser.add_argument(
        "--measure", action="store_true", help="print the measured clip signature"
    )
    parser.add_argument("--out", default="", help="write the signature JSON here")
    args = parser.parse_args()

    if not BLEND.is_file():
        raise SystemExit(f"{BLEND} not found")

    scripts = ["-P", str(INNER)]
    inner_args = []
    if not args.dry_run:
        inner_args += ["--save", "--export", str(GLB)]
    if args.measure or args.out or args.dry_run:
        scripts += ["-P", str(MEASURE)]
        inner_args += ["--action", "idle"]
        if args.out:
            inner_args += ["--out", args.out]

    command = [str(blender_binary()), "-b", str(BLEND), *scripts, "--", *inner_args]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        sys.stderr.write(completed.stdout)
        sys.stderr.write(completed.stderr)
        return completed.returncode

    report = False
    for line in completed.stdout.splitlines():
        if line.startswith("<<<REPORT>>>"):
            report = True
            continue
        if report or line.startswith(("authored ", "exported ", "saved ")):
            print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
