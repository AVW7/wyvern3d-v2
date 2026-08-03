#!/usr/bin/env python3
"""Measure every wyvern clip and write the committed signature report.

This is the driver. It decompresses the vendor GLB, finds Blender, and hands the
work to `scripts/analyze-clips-blender.py`, mirroring the split between
`build-sidecar.py` and `export-drogon-sidecar-blender.py`.

    pnpm assets:analyze-clips
    pnpm assets:analyze-clips --trace Sanct_Soar --trace Battle_Down02

The output, `validation/wyvern-animations/clip-signatures.json`, is committed on
purpose: it is what `src/render/assets/animationContracts.test.ts` asserts
against, so `pnpm test` gates animation quality with no Blender in the loop, and
regenerating it after an authoring change shows up as a readable per-channel git
diff rather than an image nobody can compare.

The vendor GLB is meshopt-compressed and Blender cannot import it directly, so a
decompressed copy is staged in a temporary directory. It is a copy in both
senses: this never writes back to `public/models/drogon.glb`.
"""

from __future__ import annotations

import argparse
import os
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / "public/models/drogon.glb"
BLEND = ROOT / "assets/blender/drogon-sanctuary.blend"
INNER = ROOT / "scripts/analyze-clips-blender.py"
OUT = ROOT / "validation/wyvern-animations/clip-signatures.json"


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--trace",
        action="append",
        default=[],
        help="Clip name or suffix to print per-frame channels for. Repeatable.",
    )
    parser.add_argument("--out", type=pathlib.Path, default=OUT)
    parser.add_argument(
        "--clearance-samples",
        type=int,
        help="Frames per clip to evaluate the skin on. 13 reproduces the original catalogue.",
    )
    parser.add_argument(
        "--source",
        type=pathlib.Path,
        help="Reuse an already-decompressed vendor GLB instead of staging one.",
    )
    parser.add_argument(
        "--no-sidecar",
        action="store_true",
        help="Measure vendor clips only, skipping the authored actions.",
    )
    return parser.parse_args()


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


def decompress(destination: pathlib.Path) -> pathlib.Path:
    subprocess.run(
        ["pnpm", "exec", "gltf-transform", "copy", str(BASE), str(destination)],
        check=True,
        cwd=ROOT,
    )
    return destination


def run(source: pathlib.Path, args: argparse.Namespace) -> None:
    before = args.out.stat().st_mtime if args.out.exists() else 0.0
    command = [
        str(blender_binary()),
        "--background",
        "--python",
        str(INNER),
        "--",
        "--source",
        str(source),
        "--out",
        str(args.out),
    ]
    if not args.no_sidecar:
        command += ["--sidecar-blend", str(BLEND)]
    if args.clearance_samples:
        command += ["--clearance-samples", str(args.clearance_samples)]
    for clip in args.trace:
        command += ["--trace", clip]
    subprocess.run(command, check=True, cwd=ROOT)
    # Blender has historically exited 0 on a failed script. The inner script
    # forces a non-zero exit, and this catches the case where it cannot.
    if not args.out.exists() or args.out.stat().st_mtime <= before:
        raise SystemExit(f"Blender produced no new report at {args.out}")


def main() -> None:
    args = arguments()
    for required in (BASE, INNER):
        if not required.exists():
            raise SystemExit(f"missing required input: {required}")
    if not args.no_sidecar and not BLEND.exists():
        raise SystemExit(f"missing required input: {BLEND}")

    if args.source:
        run(args.source.expanduser().resolve(), args)
        return

    with tempfile.TemporaryDirectory() as temporary:
        source = decompress(pathlib.Path(temporary) / "drogon-source.glb")
        run(source, args)


if __name__ == "__main__":
    main()
