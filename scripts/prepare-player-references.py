#!/usr/bin/env python3
"""Remove the chroma background and normalize the sorcerer turnaround sheets."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path.home() / "Downloads"
OUTPUT = ROOT / "validation/player-reference/processed"
FILES = [
    "sorcerer_front_apose.png",
    "sorcerer_side_apose.png",
    "sorcerer_back_apose.png",
    "sorcerer_face_closeup.png",
    "sorcerer_hair_3view.png",
    "sorcerer_coat_flatlay.png",
    "sorcerer_gear_boots_gloves_belt_tools.png",
    "sorcerer_material_sheet.png",
    "sorcerer_shoulder_armor_detail.png",
    "sorcerer_expression_sheet.png",
]


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            # Generated sheets use a deliberately saturated chroma-magenta.
            # Fade the fringe as well as removing the flat background.
            dominance = min(red, blue) - green
            if red > 190 and blue > 150 and dominance > 80:
                edge_alpha = max(0, 255 - (dominance - 80) * 3)
                pixels[x, y] = (red, green, blue, min(alpha, edge_alpha))
    bbox = rgba.getbbox()
    return rgba.crop(bbox) if bbox else rgba


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        source = SOURCE / name
        if not source.exists():
            raise FileNotFoundError(source)
        cleaned = remove_magenta(Image.open(source))
        cleaned.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
        destination = OUTPUT / name
        cleaned.save(destination, optimize=True)
        print(f"{destination.relative_to(ROOT)} {cleaned.width}x{cleaned.height}")


if __name__ == "__main__":
    main()
