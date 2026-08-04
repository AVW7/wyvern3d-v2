#!/usr/bin/env python3
"""Audit the wyvern clips for mirroring, loop-seam and frame-0 defects.

This is the driver. It finds Blender and hands the work to
`scripts/audit-wyvern-clips-blender.py`, mirroring the split between
`author-wyvern-idle.py` and `author-wyvern-idle-blender.py`.

    pnpm assets:wyvern-audit              # report only; touch nothing
    pnpm assets:wyvern-audit --fix        # repair, save the .blend, export the GLB
    pnpm assets:wyvern-audit --fix --dry-run   # repair in memory and re-audit

The audit exits non-zero if any clip still has wings mirrored on the wrong axis,
a loop seam over 0.05 on a clip the manifest loops, or a first key off frame 0 --
so it is usable as a gate as well as a report.

`public/models/wyvern-rig.blend` is gitignored and is the source of truth for
every clip in the GLB. Blender leaves a `.blend1` backup beside it on save.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BLEND = ROOT / "public/models/wyvern-rig.blend"
INNER = ROOT / "scripts/audit-wyvern-clips-blender.py"
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
    parser.add_argument("--fix", action="store_true", help="apply the repairs")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="do not save the .blend or write the GLB",
    )
    parser.add_argument("--out", default="", help="write the audit JSON here")
    parser.add_argument("--quiet", action="store_true", help="print only the verdict")
    args = parser.parse_args()

    if not BLEND.is_file():
        raise SystemExit(f"{BLEND} not found")

    inner = []
    if args.fix:
        inner.append("--fix")
        if not args.dry_run:
            inner += ["--save", "--export", str(GLB)]
    if args.out:
        inner += ["--out", args.out]

    command = [str(blender_binary()), "-b", str(BLEND), "-P", str(INNER), "--", *inner]
    completed = subprocess.run(command, capture_output=True, text=True)

    stdout = completed.stdout
    report, problems = "", "[]"
    if "<<<REPORT>>>" in stdout:
        rest = stdout.split("<<<REPORT>>>", 1)[1]
        report, _, tail = rest.partition("<<<PROBLEMS>>>")
        problems = tail.split("Blender quit", 1)[0].strip()
        # The JSON runs until Blender's own trailing chatter.
        problems = problems[: problems.rfind("]") + 1] if "]" in problems else "[]"

    if completed.returncode != 0 and not report:
        sys.stderr.write(stdout)
        sys.stderr.write(completed.stderr)
        return completed.returncode

    for line in stdout.splitlines():
        if line.startswith(("mirrored ", "closed ", "shifted ", "exported ", "saved ")):
            print(line)
    if not args.quiet and report.strip():
        print(report.strip())

    issues = json.loads(problems)
    if issues:
        print(f"\n{len(issues)} problem(s):")
        for issue in issues:
            print(f"  - {issue}")
        return 1
    print("\nclips clean: wings mirrored, loops closed, every clip starts at frame 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
