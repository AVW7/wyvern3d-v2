"""Runtime naming contract helpers. Importable without Blender for offline tooling."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Iterable


CONTRACT_PATH = Path(__file__).with_name("wyvern_v2_rig_contract.json")


def load_contract(path: str | Path = CONTRACT_PATH) -> dict[str, Any]:
    contract = json.loads(Path(path).read_text())
    if contract.get("contractVersion") != 1:
        raise ValueError(f"unsupported rig contract version: {contract.get('contractVersion')!r}")
    asset = contract.get("asset", {})
    bones = contract.get("bones", [])
    if len(bones) != asset.get("jointCount"):
        raise ValueError("bone manifest length does not match asset.jointCount")
    names = [bone.get("name") for bone in bones]
    if None in names or len(set(names)) != len(names):
        raise ValueError("bone manifest has missing or duplicate names")
    known_names = set(names)
    parents = {bone["name"]: bone.get("parent") for bone in bones}
    for name, parent in parents.items():
        if parent is not None and parent not in known_names:
            raise ValueError(f"bone {name!r} references unknown Blender parent {parent!r}")
        seen: set[str] = set()
        cursor: str | None = name
        while cursor is not None:
            if cursor in seen:
                raise ValueError(f"cycle in bone parent contract at {cursor!r}")
            seen.add(cursor)
            cursor = parents.get(cursor)
    if len(set(contract.get("clips", []))) != asset.get("animationCount"):
        raise ValueError("clip manifest length does not match asset.animationCount")
    return contract


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iter_action_fcurves(action: Any, slot_identifier: str | None = None) -> Iterable[Any]:
    """Yield curves from legacy and layered Actions, optionally selecting one slot."""
    if hasattr(action, "fcurves"):
        yield from action.fcurves
        return
    for layer in action.layers:
        for strip in layer.strips:
            if getattr(strip, "type", None) != "KEYFRAME":
                continue
            for bag in strip.channelbags:
                slot = getattr(bag, "slot", None)
                if slot_identifier and (slot is None or slot.identifier != slot_identifier):
                    continue
                yield from bag.fcurves


def bone_parent_map(bones: Iterable[Any]) -> dict[str, str | None]:
    return {bone.name: bone.parent.name if bone.parent else None for bone in bones}
