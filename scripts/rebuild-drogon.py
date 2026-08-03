#!/usr/bin/env python3
"""Rebuild public/models/drogon.glb from the vendor source.

The vendor file is authored with KHR_materials_pbrSpecularGlossiness, and its
two colour maps live *inside* that extension. three.js dropped support for
spec/gloss, so a straight compression pass produces a model whose materials
have an empty pbrMetallicRoughness block: the dragon loads, animates, and
renders as an untextured white blob. Converting to metal/rough is therefore
mandatory, not an optimisation.

Steps:
  1. metalrough  - spec/gloss -> metal/rough, so diffuseTexture becomes
                   baseColorTexture and three.js can see it.
  2. optimize    - meshopt + webp + 1024px, with every scene-graph rewriting
                   step disabled (flatten/join/palette/instance reshuffle the
                   hierarchy the 292-joint skeleton and 52 clips are bound to).
  3. strip       - drop KHR_materials_ior / KHR_materials_specular, which
                   metalrough emits to encode "specularFactor was 0". They make
                   GLTFLoader build a MeshPhysicalMaterial with all specular
                   response disabled; without them we get a plain
                   MeshStandardMaterial, which is cheaper and reads better.
                   Surface finish is set at runtime instead - see manifest.ts.

Run from the repo root:
    python3 scripts/rebuild-drogon.py [source.glb]
"""

from __future__ import annotations

import json
import pathlib
import struct
import subprocess
import sys
import tempfile

SOURCE = pathlib.Path(
    '/Volumes/Untitled/A4/3Dassets/drogon__game_of_thrones_dragon.glb'
)
DEST = pathlib.Path('public/models/drogon.glb')
STRIP = ('KHR_materials_ior', 'KHR_materials_specular')

CLI = ['npx', '--no-install', '@gltf-transform/cli']
# Compression is deliberately *not* run from `optimize`: that command hard-codes
# `--quantization-volume mesh`, which fits a separate quantization grid per mesh.
# Both meshes here share one 292-joint skin, and the per-mesh dequantization has
# nowhere to live but the inverse bind matrices, so a per-mesh grid forces the
# skin to split in two - identical joint lists, IBM scales 3136.11 and 191.85.
# Anything that then binds a mesh to the other copy draws it ~16x oversized. See
# the `meshopt` step below, which sets a scene-wide grid and keeps the skin whole.
OPTIMIZE = [
    '--compress', 'false',
    '--texture-compress', 'webp',
    '--texture-size', '1024',
    '--simplify', 'false',
    '--flatten', 'false',
    '--join', 'false',
    '--instance', 'false',
    '--palette', 'false',
]
# One quantization grid for the whole scene, so both meshes dequantize through
# the same transform and keep sharing the single vendor skin.
MESHOPT = ['--quantization-volume', 'scene']


def split_glb(data: bytes) -> tuple[dict, bytes]:
    """Return (json chunk parsed, binary chunk raw)."""
    magic, _version, _length = struct.unpack_from('<4sII', data, 0)
    if magic != b'glTF':
        raise SystemExit('not a GLB')
    offset, chunks = 12, {}
    while offset < len(data):
        size, kind = struct.unpack_from('<I4s', data, offset)
        chunks[kind] = data[offset + 8: offset + 8 + size]
        offset += 8 + size
    return json.loads(chunks[b'JSON'].decode('utf-8')), chunks.get(b'BIN\x00', b'')


def build_glb(doc: dict, binary: bytes) -> bytes:
    """Re-pack a GLB, re-padding both chunks to a 4-byte boundary."""
    js = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    binary += b'\x00' * (-len(binary) % 4)
    total = 12 + 8 + len(js) + (8 + len(binary) if binary else 0)
    out = struct.pack('<4sII', b'glTF', 2, total)
    out += struct.pack('<I4s', len(js), b'JSON') + js
    if binary:
        out += struct.pack('<I4s', len(binary), b'BIN\x00') + binary
    return out


def strip_extensions(path: pathlib.Path) -> dict:
    doc, binary = split_glb(path.read_bytes())
    removed = 0
    for material in doc.get('materials', []):
        extensions = material.get('extensions')
        if not extensions:
            continue
        for name in STRIP:
            removed += extensions.pop(name, None) is not None
        if not extensions:
            del material['extensions']
    for key in ('extensionsUsed', 'extensionsRequired'):
        if key in doc:
            doc[key] = [e for e in doc[key] if e not in STRIP]
            if not doc[key]:
                del doc[key]
    path.write_bytes(build_glb(doc, binary))
    return {'removed': removed, 'materials': doc.get('materials', [])}


def main() -> None:
    source = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
    if not source.exists():
        raise SystemExit(f'source not found: {source}')

    with tempfile.TemporaryDirectory() as tmp:
        staged = pathlib.Path(tmp) / 'metalrough.glb'
        optimized = pathlib.Path(tmp) / 'optimized.glb'
        built = pathlib.Path(tmp) / 'built.glb'
        subprocess.run([*CLI, 'metalrough', str(source), str(staged)], check=True)
        subprocess.run([*CLI, 'optimize', str(staged), str(optimized), *OPTIMIZE], check=True)
        subprocess.run([*CLI, 'meshopt', str(optimized), str(built), *MESHOPT], check=True)

        report = strip_extensions(built)
        doc, _ = split_glb(built.read_bytes())

        # A silent regression here is expensive: gameplay maps five states onto
        # clip names, and a dropped skin or renamed clip only shows up as a
        # frozen or inside-out dragon at runtime.
        assert len(doc['animations']) == 52, len(doc['animations'])
        # The vendor file has exactly one skin, shared by the body and head
        # meshes. Two means a quantization pass split it and gave each copy a
        # different IBM scale; the head then renders ~16x oversized as a mass of
        # giant horns hanging over the body.
        assert len(doc['skins']) == 1, len(doc['skins'])
        for material in doc['materials']:
            assert 'baseColorTexture' in material['pbrMetallicRoughness'], material['name']

        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(built.read_bytes())

    size_mb = DEST.stat().st_size / (1024 * 1024)
    print(f'built:{DEST} {size_mb:.2f}MB clips:{len(doc["animations"])} '
          f'stripped_extensions:{report["removed"]}')


if __name__ == '__main__':
    main()
