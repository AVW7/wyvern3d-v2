#!/usr/bin/env python3
"""Rebuild the wyvern's gothic wing, end to end.

    pnpm assets:gothic-wing

Four Blender passes, each saving its own blend so a failure can be inspected at
the stage it happened rather than re-run from the top:

    gothic-rig        rebuilt spars, panel battens, exact mirror
    gothic-weighted   membrane reweighted, dead vertex groups dropped
    gothic-retargeted the 16 gameplay clips reconnected to the new spars
    gothic-grafted    v1's wing performances on the five grounded clips
    gothic-lifted     those folds raised to the foot plane they stand on
    wyvern-gothic.glb the candidate export

Nothing here writes to public/models. The candidate lands in .gothic/ and is
promoted by hand once `node scripts/validate-wyvern-clips.mjs` on it reads
better than the same command on the shipped model.
"""
from __future__ import annotations
import os, pathlib, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / ".gothic"
SOURCE = ROOT / "public/models/wyvern-rig-v1wing.blend"
REFERENCE = ROOT / "public/models/wyvern.glb"


def blender() -> pathlib.Path:
    configured = os.environ.get("BLENDER")
    for candidate in (
        pathlib.Path(configured).expanduser() if configured else None,
        pathlib.Path(shutil.which("blender")) if shutil.which("blender") else None,
        pathlib.Path("/Applications/Blender.app/Contents/MacOS/Blender"),
    ):
        if candidate and candidate.is_file():
            return candidate
    raise SystemExit("Blender not found; set BLENDER to its executable")


def run(blend: pathlib.Path, script: str, *extra: str) -> None:
    subprocess.run(
        [str(blender()), "--background", str(blend), "--python",
         str(ROOT / "scripts" / script), "--", *extra],
        check=True, cwd=ROOT,
    )


def main() -> None:
    for required in (SOURCE, REFERENCE):
        if not required.is_file():
            raise SystemExit(f"missing required input: {required}")
    WORK.mkdir(exist_ok=True)
    staged = WORK / "gothic-src.blend"
    shutil.copy2(SOURCE, staged)  # the authored blend is never written to

    run(staged, "build-gothic-wing-blender.py",
        "--out", str(WORK / "gothic-rig.blend"),
        "--report", str(WORK / "gothic-report.json"))
    run(WORK / "gothic-rig.blend", "weight-gothic-wing-blender.py",
        "--out", str(WORK / "gothic-weighted.blend"),
        "--report", str(WORK / "gothic-weights.json"))
    run(WORK / "gothic-weighted.blend", "retarget-gothic-wing-blender.py",
        "--reference", str(REFERENCE),
        "--out", str(WORK / "gothic-retargeted.blend"),
        "--report", str(WORK / "gothic-retarget.json"))
    run(WORK / "gothic-retargeted.blend", "graft-v1-wing-clips-blender.py",
        "--out", str(WORK / "gothic-grafted.blend"),
        "--report", str(WORK / "gothic-graft.json"))
    # v1's grounded captures hang the folded wing well below the foot line --
    # measured on the graft output, 2119 units under it on `walk`. This project
    # plants ground clips on the foot, so the fold is raised here instead, after
    # the graft and on this rig: the solve is geometric and does not survive a
    # transfer onto differently-oriented spars.
    run(WORK / "gothic-grafted.blend", "lift-v1-wing-clips-blender.py",
        "--clips", "idle,rest,walk,takeoff,land",
        "--out", str(WORK / "gothic-lifted.blend"))
    run(WORK / "gothic-lifted.blend", "export-gothic-wing-blender.py",
        "--out", str(WORK / "wyvern-gothic.glb"))

    candidate = WORK / "wyvern-gothic.glb"
    print(f"\ncandidate: {candidate.relative_to(ROOT)} "
          f"({candidate.stat().st_size / 1024 / 1024:.1f} MB)")
    print("gate it with: node scripts/validate-wyvern-clips.mjs .gothic/wyvern-gothic.glb")


if __name__ == "__main__":
    main()
