/**
 * Logical asset id -> model mapping.
 *
 * Every entry starts with `url: null`, which makes <GameModel> fall back to a
 * procedural placeholder. That is deliberate: the entire game is playable
 * before a single GLB exists, and adding a real asset later is a one-line edit
 * here — no scene or gameplay code changes.
 *
 * Gameplay dimensions (collision radius, attack range, speed) live in
 * src/core/data and are NEVER read from a loaded model. `scale` and `yOffset`
 * below are purely cosmetic fitting.
 *
 * To add a supplied model:
 *   1. Compress it. For a skinned, animated model, disable the scene-graph
 *      rewriting steps — flatten/join/palette/instance reshuffle the hierarchy
 *      the skeleton and animation tracks are bound to:
 *
 *      npx @gltf-transform/cli optimize in.glb out.glb \
 *        --compress meshopt --texture-compress webp --texture-size 1024 \
 *        --simplify false --flatten false --join false --instance false --palette false
 *
 *   2. Check what the source encodes its materials with. three.js dropped
 *      KHR_materials_pbrSpecularGlossiness, and a spec/gloss source keeps its
 *      colour maps *inside* that extension — so the model loads and animates
 *      but renders as an untextured white blob. Convert first:
 *
 *      npx @gltf-transform/cli metalrough in.glb metalrough.glb
 *
 *   3. move out.glb to public/models/
 *   4. set url: '/models/out.glb' here, plus scale/yOffset and the clip names
 *
 * meshopt needs no decoder setup — drei's useGLTF registers one by default.
 */
/**
 * The animation states gameplay can ask a model for.
 *
 * `airborne` is the one state gameplay never asks for directly: `fly` is a
 * takeoff, and the manifest chains it here when that takeoff finishes. See
 * ClipSpec.
 */
export type ModelState =
  | 'idle'
  | 'fly'
  | 'airborne'
  | 'attack'
  | 'attackAir'
  | 'walk'
  | 'death'
  | 'hop'
  | 'breathe'
  | 'breatheAir'
  | 'rest'
  | 'land'
  | 'sleep'
  | 'sit'
  | 'seated'
  | 'rise'
  | 'eat'
  | 'huntGrip'
  | 'huntCarry'
  | 'huntFinish'
  | 'drink'
  | 'groom'
  | 'perch'
  | 'cruise'
  | 'scout'
  | 'speed'
  | 'glide'
  | 'dive'
  | 'bankLeft'
  | 'bankRight'
  | 'hover'
  | 'nuzzle'
  | 'calm'
  | 'pickUp'
  | 'drop'

/**
 * One state's clip, and how to play it.
 *
 * Vendor clips are not all loops. Roughly half of this model's are one-shots —
 * takeoffs, landings, deaths — and looping them snaps the pose back to frame 0
 * mid-air. `loop: false` plays once and holds the final pose; `next` chains to
 * another state when it lands, which is how a takeoff becomes level flight
 * without gameplay knowing that the transition exists.
 */
export interface ClipSpec {
  /** Clip name inside the GLB. */
  clip: string
  /** Defaults to true. False plays once and clamps on the last frame. */
  loop?: boolean
  /** For one-shots: the state to advance to when the clip finishes. */
  next?: ModelState
  /** Crossfade duration in seconds. Defaults to 0.25. */
  fadeIn?: number
  /** Playback-rate multiplier. Defaults to 1. */
  timeScale?: number
  /**
   * Loop family whose normalized playback phase should survive a crossfade.
   * Used by compatible flight loops so changing bank direction does not restart
   * the wingbeat from frame 0, but continues it from wherever the outgoing clip
   * was mid-flap.
   *
   * Example: a left-bank loop crossfading to a right-bank loop should keep the
   * wings in mid-stroke, not pop them to the top of the travel. Every state in a
   * bank-family should share a phaseGroup, and phaseGroup membership implies
   * `loop: true`.
   */
  phaseGroup?: string
  /**
   * Vertical offset from the model origin to its visual root when this clip is
   * playing. Most non-loops have one; 'idle' supports an array of
   * interchangeable variants, each carrying its own offset as well.
   */
  yOffset?: number | number[]
}

export interface MaterialOverride {
  color?: string
  emissive?: string
  roughness?: number
  metalness?: number
}

export interface AssetEntry {
  /** Null means fall back to procedural placeholder. */
  url: string | null
  /** Separate animation-only GLBs — common with Mixamo and similar sources. */
  animationUrl?: string
  /** Uniform scale factor applied at the root. */
  scale: number
  /** Root vertical offset for cosmetic fitting to the ground plane. */
  yOffset?: number
  material?: MaterialOverride
  /** Each state maps to one clip (or a small pool to pick from). */
  animations: Partial<Record<ModelState, ClipSpec | ClipSpec[]>> & {
    /** A state that plays once on landing and then chains to idle. */
    land?: ClipSpec
  }
}

/**
 * Logical asset id -> model mapping.
 */
export type AssetId =
  | `wyvern.${string}`
  | `unit.${string}`
  | `building.${string}`
  | `prop.${string}`
  | `wildlife.${string}`
  | 'character.player'

/**
 * Wyvern model wired with new clean rig (wyvern.glb).
 * 46 joints, wings parented to Spine3 (not Neck), RootMotion bone.
 * Animations pending — model renders in T-pose/rest for now.
 */
export const ASSETS: Record<AssetId, AssetEntry> = {
  /** Wyvern - new clean rig, no animations yet */
  'wyvern.drogon': {
    url: '/models/wyvern.glb',
    scale: 0.01, // Mesh is in cm (~1000 units), scale down to meters
    yOffset: 0,
    animations: {
      idle: { clip: 'idle', yOffset: 0 },
      fly: { clip: 'fly', loop: false, next: 'airborne', yOffset: 0 },
      airborne: { clip: 'cruise', yOffset: 0 },
      attack: { clip: 'attack', yOffset: 0 },
      attackAir: { clip: 'attackAir', loop: false, yOffset: 0, fadeIn: 0.16 },
      death: { clip: 'death', loop: false, yOffset: 0 },
      walk: { clip: 'walk', yOffset: 0 },
      cruise: { clip: 'cruise', yOffset: 0 },
      hover: { clip: 'hover', yOffset: 0 },
      rest: { clip: 'rest', yOffset: 0 },
    },
  },
  'wyvern.rhaegal': {
    url: null,
    scale: 0.9,
    animations: {},
  },
  'wyvern.viserion': {
    url: null,
    scale: 0.85,
    animations: {},
  },
  'wyvern.sunfyre': {
    url: null,
    scale: 1.1,
    animations: {},
  },
  'wyvern.meraxes': {
    url: null,
    scale: 1.05,
    animations: {},
  },

  /** Units - placeholder army troops */
  'unit.soldier': {
    url: null,
    scale: 1,
    animations: {
      idle: { clip: 'idle', yOffset: 0 },
      walk: { clip: 'walk', yOffset: 0 },
      attack: { clip: 'attack', yOffset: 0 },
      death: { clip: 'death', loop: false, yOffset: 0 },
    },
  },
  'unit.archer': {
    url: null,
    scale: 0.95,
    animations: {},
  },
  'unit.cavalry': {
    url: null,
    scale: 1.1,
    animations: {},
  },
  'unit.pikeman': {
    url: null,
    scale: 1,
    animations: {},
  },

  /** Buildings - placeholder structures */
  'building.hatchery': {
    url: null,
    scale: 1.5,
    animations: {},
  },
  'building.barracks': {
    url: null,
    scale: 1.2,
    animations: {},
  },
  'building.infirmary': {
    url: null,
    scale: 1.1,
    animations: {},
  },
  'building.trainingGrounds': {
    url: null,
    scale: 1.3,
    animations: {},
  },

  /** Props - placeholder scenery */
  'prop.tree': {
    url: null,
    scale: 1,
    animations: {},
  },
  'prop.rock': {
    url: null,
    scale: 1,
    animations: {},
  },

  /** Wildlife - placeholder ambient creatures */
  'wildlife.deer': {
    url: null,
    scale: 1,
    animations: {},
  },

  /** Player character in direct-control scenes */
  'character.player': {
    url: null,
    scale: 1,
    animations: {
      idle: { clip: 'idle', yOffset: 0 },
      walk: { clip: 'walk', yOffset: 0 },
      fly: { clip: 'fly', loop: false, next: 'airborne', yOffset: 0 },
      airborne: { clip: 'cruise', yOffset: 0 },
    },
  },
}

/** The vertical extent of a model at a given state, for camera framing. */
export function modelStateHeight(_state: ModelState, _seed: number): number {
  // Placeholder: return a reasonable default
  return 11
}

/** How far from the model origin to look down to focus on a named bone. */
export function boneOffset(_boneName: string): number {
  // Placeholder: no bone offsets until new rig
  return 0
}

/** Fetch the asset entry, or undefined for an unknown id. */
export function getAsset(id: AssetId): AssetEntry | undefined {
  return ASSETS[id]
}

/** Hack: the DROGON_FIT constant is used in a few places for height calc. */
export const DROGON_FIT = 1

/**
 * Path to the scenery prop atlas. Using symlink to original for now.
 * TODO: Rebuild prop atlas without animation dependencies.
 */
export const PROP_ATLAS = '/models/sanctuary.glb'
