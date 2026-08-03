# Drogon sanctuary animation sidecar

Generated from the measured Drogon rig without round-tripping or modifying
`public/models/drogon.glb`.

## Outputs

- `assets/blender/drogon-sanctuary.blend` — armature-only editable source.
- `public/models/drogon-sanctuary.glb` — meshless, skinless runtime sidecar.
- `clip-signatures.json` — the measured signature of all 74 clips, vendor and
  authored, on one rig. Regenerate with `pnpm assets:analyze-clips`.
- `clip-contracts.json` — per-mode thresholds asserted by `pnpm test`.
- `sidecar-build-report.json` — export and target-name validation.
- `sanctuary-contact-sheet.png`, `contact-sheet-report.json` — optional visual
  aid. Not the approval gate; see `docs/WYVERN_ANIMATION_BASELINE.md`.

## Actions

| Action | Frames | Loop | Measured ground Z | Runtime yOffset |
|---|---:|---|---:|---:|
| `Sanct_Sleep` | 0–120 | yes | −2.14 | +2.14 |
| `Sanct_Rest` | 0–144 | yes | −2.21 | +2.21 |
| `Sanct_Sit` | 0–48 | no | +0.58 | −0.58 |
| `Sanct_SitLoop` | 0–96 | yes | +0.41 | −0.41 |
| `Sanct_Rise` | 0–48 | no | +0.58 | −0.58 |
| `Sanct_Eat` | 0–192 | yes; bite, tear, chew, swallow | −0.86 | +0.86 |
| `Sanct_Drink` | 0–144 | yes | −0.63 | +0.63 |
| `Sanct_Groom` | 0–192 | yes | +0.89 | −0.89 |
| `Sanct_HuntGrip` | 0–72 | no; jaw closes into stable hold | −0.49 | +0.49 |
| `Sanct_HuntCarry` | 0–144 | yes; three powered beats, stable head and jaw | −11.65 | airborne |
| `Sanct_HuntFinish` | 0–120 | no; chew, swallow, scan, recover | +0.88 | −0.88 |
| `Sanct_PerchGrip` | 0–72 | yes | +1.46 | −1.46 |
| `Sanct_Cruise` | 0–144 | yes; 107.7° stroke, three symmetric beats | −12.29 | airborne |
| `Sanct_Scout` | 0–144 | yes; 0.333 Hz, two symmetric beats | −12.25 | airborne |
| `Sanct_BankL` | 0–144 | yes; inside stroke 82.9° vs outside 112.1° | −13.66 | airborne |
| `Sanct_BankR` | 0–144 | yes; mirror of left | −14.15 | airborne |
| `Sanct_Hover` | 0–144 | yes; 32.1° nose-up, four beats | −12.36 | airborne |
| `Sanct_Speed` | 0–120 | yes; 0.8 Hz, four beats, body line nose-down throughout | −12.83 | airborne |
| `Sanct_Soar` | 0–144 | yes; unpowered, no cycle, wings held extended | −3.03 | airborne |
| `Sanct_Dive` | 0–144 | yes; unpowered, no cycle, 27.8° nose-down | −2.75 | airborne |
| `Sanct_Nuzzle` | 0–96 | no | +1.19 | −1.19 |
| `Sanct_Calm` | 0–120 | no | +0.58 | −0.58 |

All actions are authored at 24 fps and target the same 292 nodes as the base
rig. Loop endpoints were compared across location, quaternion rotation, and
scale; every looping action returns exactly to its first pose.

Ground Z is `ground_clearance.min` from `clip-signatures.json`, sampled 48 frames
per clip. The previous column sampled 13, which over-estimates the minimum: the
nuzzle's true low point is +1.19, not the +1.73 that shipped as its offset.

The cruise family takes its body line from one sampled source frame rather than
a correction layered on top: `Sanct_Cruise` measures a 2.1° mean head-to-tail
axis against `Battle_Down02`'s 7.8°. Takeoff and landing remain on their upright
vendor poses, while runtime pitch is layered around the cruise baseline.

The body comes from a *single* frame because the cruise source is a landing and
its wingbeat arrives welded to a flare: across frames 40–66 the pelvis pitches
from −50.7° to −88.0° while the spine counter-rotates to hold the head-to-tail
line level. Sampling whole poses baked that flare into a loop and snapped it
back at the seam, measured as 11.4° of `root_roll_delta_deg` range; the wing
chains alone now cycle, and it measures 0.0. Freezing only the flight root is
not a cheaper version of this — that leaves the counter-rotation uncompensated
and swings the body line from 2.2° to 39.6° over one beat.

Hover is the same propulsion cycle at a different primary posture and cadence,
which is the distinction the development contract draws between flight modes:
32.1° nose-up against cruise's 2.1°, and four beats in the same six seconds
against three.

The flight family now separates on two axes, both measured rather than described:

| clip | body axis | cadence | wing elevation range |
|---|--:|--:|--:|
| `Sanct_Dive` | −27.8° | none | 6.0 |
| `Sanct_Soar` | −1.8° | none | 8.5 |
| `Sanct_Cruise` | +2.1° | 0.5 Hz | 103.2 |
| `Sanct_Scout` | +8.1° | 0.333 Hz | 100.7 |
| `Sanct_Speed` | −10.0° | 0.8 Hz | 106.0 |
| `Sanct_Hover` | +32.1° | 0.667 Hz | 81.5 |

Dive and hover sit 30° either side of the cruise line, from the same measured
1:1 trim of the flight root applied with opposite signs. Soar and dive carry no
`cycle` at all: their wing elevation stays under the analyzer's 15° threshold,
which is what makes them unpowered rather than slowed.

## Cruise beat source survey

`pnpm assets:analyze-clips` measures every clip — vendor and authored — on one
rig, in the same units, so a wingbeat source can be chosen on evidence rather
than by eye. It never round-trips the vendor GLB and never saves the tracked
`.blend`. It supersedes `survey-flight-clips.py`, which measured ten flight clips
only; the analyzer reproduces every column of its output exactly.

```bash
pnpm assets:analyze-clips
pnpm assets:analyze-clips --trace Battle_Down02
```

| clip | wing arc | tip path | L/R symmetry error | pelvis / tail / foot |
|---|---:|---:|---:|---|
| `Battle_Up` (takeoff) | 109.7° | 325 | **1.25** | 3.9 / 22.0 / 5.2 |
| `Battle_Down` (landing) | 94.7° | 240 | **1.26** | 4.9 / 23.1 / 6.6 |
| `Battle_Down02` (landing) | 96.3° | 179 | **1.49** | 0.0 / 28.3 / 3.8 |
| `Battle_SkyMoveL` | 179.4° | 522 | 14.00 | 9.5 / 43.9 / 13.5 |
| `Battle_Skill11_L` | 162.2° | 343 | 22.40 | 7.5 / 35.5 / 11.4 |

Symmetry error is the distance between the two wingtips after reflecting the left
one through the rig's sagittal plane; the rig is mirrored in X, so a symmetric
pose scores near zero. The takeoff and landing clips are an order of magnitude
more symmetric than the sky and skill clips, which are asymmetric swoops.

The two swoop figures were 12.10 and 18.90 under an earlier form of the metric
that compared wingtip magnitudes (`|left.x| − |right.x|`) instead of reflecting.
That form rated two wings stacked on the same side as perfectly symmetric, and
under-reported any pose swinging a wing across the midline. The takeoff and
landing numbers are unchanged because neither pose crosses a wing.

**Chosen source: `Battle_Down02`, frames 40–66.** Nine landmarks, selected
greedily to minimise the reconstruction error of the three channels that carry
a wingbeat — elevation, stroke-plane azimuth and wing extension:

| source frame | wing elevation | azimuth | extension |
|---:|---:|---:|---:|
| 40 | −26.0° | 49.7° | 16.40 |
| 43 | −49.4° | 42.6° | 17.00 |
| 45 | −51.6° | 36.0° | 16.00 |
| 48 | −35.0° | 23.8° | 15.10 |
| 52 | −2.4° | 11.2° | 15.40 |
| 55 | +9.3° | 18.4° | 16.80 |
| 59 | +23.5° | 57.5° | 13.50 |
| 61 | +28.7° | 62.5° | 11.60 |
| 63 | +16.5° | 40.0° | 11.40 |

Nine, not four, is the point. Four landmarks 12 frames apart reconstruct the
artist's own curves to a mean error of 5.6°; these nine reach 1.0°. Between
sparse keys Blender's AUTO_CLAMPED bezier invents a smooth arc that is not the
artist's, and what it flattened was never amplitude — elevation range measured
84.6° against the source's 81.4° — but the stroke plane, which collapsed from
53.9° of azimuth to 40.5°, and the wrist fold, from 6.2 of extension to 5.15.
Both are now gated in `clip-contracts.json`.

The window was chosen by measuring every candidate cycle in the clip rather
than by eye. It carries the widest stroke plane of any of them — 53.9° against
33.8° for the bottom-to-bottom cycle f21–f44 and 41.1° for f28–f55 — and its
endpoints hold nearly the same wing pose, 3.1° of elevation, 3.8° of azimuth
and 0.2 of extension apart, so the wrap back to the opening key continues the
artist's motion instead of snapping.

The clip wins on every criterion that matters for a cruise loop: a 96.3° stroke,
a body axis that stays within 13° of horizontal, pelvis Z constant at 5.1 on all
112 frames so there is no root displacement to cancel, and near-identical
elevation at both ends of the chosen window so it closes naturally. It is also
cruise's neighbour in the state graph, so a cruise built from its mechanics
blends out to landing without endpoint matching.

The one thing it does not give away for free is a level torso, which is why the
body is sampled separately — see the flare note above.

`Battle_Up` has a larger 106° stroke but a 23.5° mean body axis; it stays the
takeoff one-shot rather than the cruise source.

## Build and validation

```bash
pnpm assets:drogon-sidecar
pnpm assets:drogon-sidecar --from-export /path/to/blender-export.glb
pnpm assets:validate-sidecar
```

The `--from-export` form installs and validates an export produced by the
connected Blender session without launching a second Blender process.

The build rejects meshes, skins, materials, renamed nodes, duplicate node names,
unexpected clips, and any animation channel whose target is absent from the
base GLB. The runtime validation parses the sidecar through three.js and binds
every track to a base-model node name.

The generic web-pipeline Draco/decimation guidance is intentionally not used.
The base skinned model keeps its established meshopt/WebP pipeline; the
sidecar contains no geometry or textures to optimize.
