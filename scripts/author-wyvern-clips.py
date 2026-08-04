#!/usr/bin/env python3
"""Re-author every wyvern clip and re-export the GLB.

This is the driver. It finds Blender and hands the work to
`scripts/author-wyvern-clips-blender.py`, mirroring the split between
`analyze-clips.py` and `analyze-clips-blender.py`.

    pnpm assets:wyvern-clips                 # rebuild all 16, save, export
    pnpm assets:wyvern-clips --measure       # ...and write clip signatures
    pnpm assets:wyvern-clips --compress      # ...and run the meshopt/WebP recipe
    pnpm assets:wyvern-clips --dry-run       # measure only; touch nothing
    pnpm assets:wyvern-clips --only cruise,hover

The full rebuild is `--measure --compress`: it re-authors every clip, saves the
.blend, exports the GLB, writes the signatures the test gate asserts, compresses
the result and verifies the compression did not change the animation.

Read the inner script's docstring before changing a clip: the rig's axis
conventions are measured, several are the opposite of the obvious guess, and
the clips this replaces shipped seven dislocated wings because unkeyed bones
inherit whatever pose the .blend happened to be sitting in at export.

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
INNER = ROOT / "scripts/author-wyvern-clips-blender.py"
MEASURE = ROOT / "scripts/measure-wyvern-clips-blender.py"
GLB = ROOT / "public/models/wyvern.glb"
SIGNATURES = ROOT / "validation/wyvern-animations/wyvern-clip-signatures.json"


# The compression recipe, same shape as `rebuild-drogon.py` and for the same
# reasons. Blender writes an uncompressed 17.4 MB GLB; this takes it to 1.5 MB.
#
# Compression is deliberately NOT run from `optimize`: that command hard-codes
# `--quantization-volume mesh`, which fits a separate grid per mesh and, on a
# file whose meshes share one skin, forces the skin to split. `meshopt` below
# sets a scene-wide grid and keeps it whole.
CLI = ["npx", "--no-install", "@gltf-transform/cli"]
OPTIMIZE = [
    "--compress", "false",
    "--texture-compress", "webp",
    "--texture-size", "1024",
    "--simplify", "false",
    "--flatten", "false",
    "--join", "false",
    "--instance", "false",
    "--palette", "false",
]
MESHOPT = ["--quantization-volume", "scene"]


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
        "--measure", action="store_true", help="write the measured clip signatures"
    )
    parser.add_argument("--only", default="", help="comma-separated clip subset")
    parser.add_argument("--plant", action="append", default=[],
                        metavar="NAME=VALUE", help="override a grounded-stance angle")
    parser.add_argument("--out", default="", help="write the signature JSON here")
    parser.add_argument(
        "--compress",
        action="store_true",
        help="run the meshopt/WebP recipe on the exported GLB and verify it",
    )
    args = parser.parse_args()

    if not BLEND.is_file():
        raise SystemExit(f"{BLEND} not found")

    scripts = ["-P", str(INNER)]
    inner_args = []
    if args.only:
        inner_args += ["--only", args.only]
    for override in args.plant:
        inner_args += ["--plant", override]
    if not args.dry_run:
        inner_args += ["--save", "--export", str(GLB)]
    if args.measure or args.out or args.dry_run:
        scripts += ["-P", str(MEASURE)]
        out = args.out or str(SIGNATURES)
        inner_args += ["--out", out]

    command = [str(blender_binary()), "-b", str(BLEND), *scripts, "--", *inner_args]
    completed = subprocess.run(command, capture_output=True, text=True)
    combined = completed.stdout + completed.stderr
    # Blender exits 0 even when a `-P` script raises, and the first version of
    # this driver reported success while the measurement quietly described the
    # OLD actions. A traceback anywhere in the output is a failure.
    if completed.returncode != 0 or "Traceback (most recent call last)" in combined:
        sys.stderr.write(combined)
        return completed.returncode or 1

    report = False
    for line in completed.stdout.splitlines():
        if line.startswith("<<<REPORT>>>"):
            report = True
            continue
        if report or line.startswith(("authored ", "exported ", "saved ", "wrote ")):
            print(line)

    if args.compress and not args.dry_run:
        return compress()
    return 0


def compress() -> int:
    """Run the recipe, then prove the result still animates before adopting it.

    The verification is not optional politeness: `gltf-transform meshopt` logs
    `prune: Removed types... Skin (1)` on the way through, and this file has
    exactly one skin. It survives — but that is a thing to check, not assume.
    """
    import tempfile

    uncompressed = GLB.with_suffix(".uncompressed.glb")
    shutil.copyfile(GLB, uncompressed)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            staged = pathlib.Path(tmp) / "staged.glb"
            built = pathlib.Path(tmp) / "built.glb"
            for command in (
                [*CLI, "optimize", str(GLB), str(staged), *OPTIMIZE],
                [*CLI, "meshopt", str(staged), str(built), *MESHOPT],
            ):
                done = subprocess.run(command, capture_output=True, text=True)
                if done.returncode != 0:
                    sys.stderr.write(done.stdout + done.stderr)
                    return done.returncode
            shutil.copyfile(built, GLB)

        check = subprocess.run(
            ["node", str(ROOT / "scripts/validate-wyvern-runtime.mjs"),
             str(GLB), "--against", str(uncompressed)],
            capture_output=True, text=True,
        )
        sys.stdout.write(check.stdout)
        if check.returncode != 0:
            sys.stderr.write(check.stderr)
            sys.stderr.write("compression changed the animation; restoring\n")
            shutil.copyfile(uncompressed, GLB)
            return check.returncode
        print(f"compressed {GLB} to {GLB.stat().st_size / 1e6:.2f} MB")
        return 0
    finally:
        uncompressed.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
