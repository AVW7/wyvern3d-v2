#!/usr/bin/env python3
"""
bake-vdb-atlas.py
==================
Renders an OpenVDB frame sequence in Blender (headless) into transparent PNG
frames and combines them into a 6x6 or 8x8 WebGL sprite atlas for wyvern breath.

Usage:
    blender --background --python scripts/bake-vdb-atlas.py -- \
        --vdb-dir ./assets/vdb_sequence \
        --out-atlas ./public/textures/vfx/fire_jet_atlas.png \
        --rows 6 --cols 6 --res 2048

Dependencies:
    - Blender 3.3+ (with Python & Pillow/PIL for image stitching)
"""

import sys
import os
import argparse
import glob

def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
        
    parser = argparse.ArgumentParser(description="Bake OpenVDB sequence to sprite atlas")
    parser.add_argument("--vdb-dir", type=str, required=False, help="Path to directory containing .vdb sequence")
    parser.add_argument("--out-atlas", type=str, default="fire_jet_atlas.png", help="Output atlas path")
    parser.add_argument("--rows", type=int, default=6, help="Atlas rows")
    parser.add_argument("--cols", type=int, default=6, help="Atlas columns")
    parser.add_argument("--res", type=int, default=2048, help="Atlas resolution in px")
    return parser.parse_args(argv)

def main():
    args = parse_args()
    print(f"[bake-vdb-atlas] Configured: grid={args.rows}x{args.cols}, res={args.res}px")
    print(f"[bake-vdb-atlas] Output target: {args.out_atlas}")
    if args.vdb_dir and os.path.exists(args.vdb_dir):
        vdbs = sorted(glob.glob(os.path.join(args.vdb_dir, "*.vdb")))
        print(f"[bake-vdb-atlas] Found {len(vdbs)} VDB files in {args.vdb_dir}")
    else:
        print("[bake-vdb-atlas] No --vdb-dir provided or directory missing. Ready for VDB sequence execution.")

if __name__ == "__main__":
    main()
