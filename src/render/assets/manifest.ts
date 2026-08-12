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
  | 'run'
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
  | 'offer'
  | 'pet'
  | 'inspect'
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
   * How far this pose's lowest point falls below the rig origin, negated — the
   * lift that plants the clip on the ground plane.
   *
   * In *rig* units, and multiplied by `scale` at the root (see GameModel), so a
   * half-size juvenile needs half the correction. Overrides the entry's
   * `yOffset` for as long as this clip is the one playing, which is what lets
   * poses that reach different distances below the origin each sit flat. Ground
   * loops and the one-shots that end on the ground need one; airborne clips are
   * positioned by the scene rather than planted, so they stay at 0.
   *
   * A state with a pool of interchangeable clips carries one per pool entry,
   * since the variants bottom out at different heights.
   */
  yOffset?: number
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
  /** Multiple compact animation-only GLBs sharing the base model's node names. */
  animationUrls?: string[]
  /** Uniform scale factor applied at the root. */
  scale: number
  /**
   * Root vertical offset for cosmetic fitting to the ground plane, in rig units
   * and multiplied by `scale`. The default for any clip that carries no
   * `ClipSpec.yOffset` of its own.
   */
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
  | `library.${string}`
  | 'character.player'

/**
 * World metres per authored rig unit, for `public/models/wyvern.glb`.
 *
 * The rig is authored in centimetres, so a conversion is needed; the value is
 * *not* the naive 0.01. Measured through three.js with skinning applied, the
 * widest wing extension any clip reaches is 6538 units, and the vendor dragon
 * this replaces spanned 65.1 units at a 0.72 fit — 46.9 m. Matching that gives
 * 46.9 / 6538 = 0.00717.
 *
 * The earlier 0.01 came from measuring the *bind matrices* (4541 units wing
 * tip to wing tip) and comparing them against the old model's *mesh* span. The
 * drawn wing membrane reaches well past the wing-finger bone tips, so those two
 * are not comparable, and 0.01 rendered the adult at 65 m — 40% oversized.
 *
 * One world unit is one metre (CharacterController's EYE_HEIGHT is 1.6).
 */
const WYVERN_FIT = 0.0072

/**
 * Clip map shared by every species — all five differ only by size, exactly as
 * the vendor model's five did.
 *
 * `yOffset` is in *rig* units and is multiplied by `scale` at the root (see
 * GameModel), so these are the measured drop below the origin for each pose,
 * negated. Only the ground loops carry one: the airborne clips are positioned
 * by the scene, not planted.
 *
 * The grounded offsets are measured against the exported clips. Re-run the
 * measurement whenever their pose changes: a lift that is correct for a wingtip
 * touching the floor can leave an otherwise planted walk visibly floating.
 */
const WYVERN_CLIPS: AssetEntry['animations'] = {
  // Ground loops, planted on the measured low point of each pose.
  //
  // idle is re-authored — `pnpm assets:wyvern-idle` regenerates it, and
  // scripts/author-wyvern-idle-blender.py carries the parameters and the rig's
  // measured axis conventions. It needs no lift: its lowest skinned vertex is a
  // toe at +0.10..+0.13 m above the rig origin through the whole 6 s loop. The
  // clip it replaced sank its left wingtip 0.99 m BELOW the origin, because the
  // fold was mirrored wrong and put that wing forward across the chest.
  idle: { clip: 'idle', yOffset: 0 },
  // The relaxed carrier clears its leading spar; a toe is now the low point
  // (-7.31 rig units), so this small lift plants the gait rather than floating
  // the whole animal on the old, wingtip-based 314-unit offset.
  walk: { clip: 'walk', yOffset: 7.5 },
  // Rebuilt after the jaw-hinge repair: the folded, planted rest loop reaches
  // -331.00 rig units at f32, rather than the old spread-wing clip's -1104.
  rest: { clip: 'rest', yOffset: 331 },

  // One-shots. `fly` is the takeoff and chains to the cruise loop, so gameplay
  // only ever asks for `fly`.
  fly: { clip: 'takeoff', loop: false, next: 'airborne', yOffset: 0 },
  land: { clip: 'land', loop: false, next: 'idle', yOffset: 0 },
  death: { clip: 'death', loop: false, yOffset: 0 },

  // Flight loops. cruise and the two banks share a phase group so steering does
  // not restart the wingbeat mid-stroke.
  airborne: { clip: 'cruise', yOffset: 0, phaseGroup: 'flight' },
  cruise: { clip: 'cruise', yOffset: 0, phaseGroup: 'flight' },
  // Deliberately slower two-beat search loop; unlike cruise it does not share
  // the phase group because its cadence is different.
  scout: { clip: 'scout', yOffset: 0 },
  bankLeft: { clip: 'bankLeft', yOffset: 0, phaseGroup: 'flight' },
  bankRight: { clip: 'bankRight', yOffset: 0, phaseGroup: 'flight' },
  hover: { clip: 'hover', yOffset: 0 },
  glide: { clip: 'glide', yOffset: 0 },
  dive: { clip: 'dive', yOffset: 0 },
  speed: { clip: 'speed', yOffset: 0 },

  // The rig has no separate air-attack clip; the ground one reads acceptably
  // airborne because it is all forequarters.
  //
  // All three are one-shots, and they have to be: these are the only states the
  // action channel plays, and GameModel emits `onActionFinished` — the single
  // signal that clears a tell — for `loop: false` alone. A looping entry here
  // can therefore never end. `attack` and `breathe` both used to default to
  // looping, which left a ground attacker stuck in the attack tell (snapping 45
  // degrees back to the wind-up on every wrap) and a breather stuck exhaling:
  // BreathVFX reads `action?.state === 'breathe'` and restarts its 0.85 s burst
  // for as long as that holds, so the fire never stopped either. The clips are
  // authored for it — `attack` opens on a wound-up pose and resolves every
  // channel to neutral on its last frame.
  //
  // manifest.action-channel.test.ts locks this: every action-channel state
  // must carry `loop: false`.
  attack: { clip: 'attack', loop: false, yOffset: 0 },
  attackAir: { clip: 'attack', loop: false, yOffset: 0, fadeIn: 0.16 },
  breathe: { clip: 'breath', loop: false, yOffset: 0 },
  breatheAir: { clip: 'breath', loop: false, yOffset: 0 },

  // Grounded and hunting behavior fallbacks (prevent T-pose fallback)
  sleep: { clip: 'rest', yOffset: 331 },
  sit: { clip: 'rest', yOffset: 331 },
  eat: { clip: 'rest', yOffset: 331 },
  drink: { clip: 'rest', yOffset: 331 },
  groom: { clip: 'rest', yOffset: 331 },
  nuzzle: { clip: 'idle', yOffset: 0 },
  calm: { clip: 'idle', yOffset: 0 },
  perch: { clip: 'idle', yOffset: 0 },
  hop: { clip: 'walk', yOffset: 7.5 },
  seated: { clip: 'rest', yOffset: 331 },
  rise: { clip: 'takeoff', loop: false, next: 'idle', yOffset: 0 },
  pickUp: { clip: 'attack', loop: false, yOffset: 0 },
  huntGrip: { clip: 'attack', loop: false, yOffset: 0 },
  huntCarry: { clip: 'cruise', yOffset: 0, phaseGroup: 'flight' },
  drop: { clip: 'attack', loop: false, yOffset: 0 },
  huntFinish: { clip: 'attack', loop: false, yOffset: 0 },
}

/** One species' entry. `size` is its relative bulk, ordered by tier. */
function wyvernAsset(size: number): AssetEntry {
  return {
    url: '/models/wyvern.glb',
    scale: WYVERN_FIT * size,
    yOffset: 0,
    animations: WYVERN_CLIPS,
  }
}

/**
 * Wyvern model wired to the clean rig (wyvern.glb): 46 joints, wings parented
 * to Spine3 (not Neck), RootMotion bone.
 *
 * Keys must be `wyvern.<speciesId>` for the ids in `core/data/species` — the
 * scenes build the asset id as `wyvern.${wyvern.speciesId}`. They previously
 * carried the vendor model's names (drogon, rhaegal, …), which match no species
 * this game defines, so every lookup missed and every wyvern rendered as the
 * procedural placeholder.
 */
export const ASSETS: Record<AssetId, AssetEntry> = {
  'wyvern.emberback': wyvernAsset(0.85),
  'wyvern.cragwing': wyvernAsset(0.9),
  'wyvern.mirefang': wyvernAsset(1),
  'wyvern.frostmaw': wyvernAsset(1.05),
  'wyvern.duskwyrm': wyvernAsset(1.1),

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

  /** Imported Meshy showcase assets. Static and cosmetic until placed by a scene/editor. */
  'library.alchemistWorkstation': {
    url: '/models/library/arcane-alchemist-workstation.glb',
    scale: 2.2,
    yOffset: 0.390625,
    animations: {},
  },
  'library.forestWyvernDisplay': {
    url: '/models/library/forest-wyvern-display.glb',
    scale: 6,
    yOffset: 0.867645,
    animations: {},
  },
  'library.arcaneAcademyCrest': {
    url: '/models/library/arcane-academy-crest.glb',
    scale: 1.25,
    yOffset: 1,
    animations: {},
  },
  'library.throneOfBooks': {
    url: '/models/library/throne-of-books.glb',
    scale: 1.6,
    yOffset: 0.950724,
    animations: {},
  },

  /** Player character in direct-control scenes */
  'character.player': {
    url: '/models/arcane-handler.glb',
    scale: 1,
    animationUrls: [
      '/models/arcane-handler-animations/idle.glb',
      '/models/arcane-handler-animations/walk.glb',
      '/models/arcane-handler-animations/run.glb',
      '/models/arcane-handler-animations/offer.glb',
      '/models/arcane-handler-animations/pet.glb',
      '/models/arcane-handler-animations/calm.glb',
      '/models/arcane-handler-animations/inspect.glb',
    ],
    animations: {
      idle: { clip: 'idle', yOffset: 0 },
      walk: { clip: 'walk', yOffset: 0 },
      run: { clip: 'run', yOffset: 0 },
      offer: { clip: 'offer', loop: false, yOffset: 0 },
      pet: { clip: 'pet', loop: false, yOffset: 0 },
      calm: { clip: 'calm', loop: false, yOffset: 0 },
      inspect: { clip: 'inspect', loop: false, yOffset: 0 },
    },
  },
}

/**
 * The vertical extent of a model at a given state, for camera framing.
 *
 * Flat for now. 11 is close to the measured adult: the `idle` pose tops out
 * 1492 rig units above the origin, which is 10.7 m at `WYVERN_FIT`. Worth
 * making per-state once the clips settle — `hover` and `takeoff` reach roughly
 * twice that.
 */
export function modelStateHeight(_state: ModelState, _seed: number): number {
  return 11
}

/** How far from the model origin to look down to focus on a named bone. */
export function boneOffset(_boneName: string): number {
  // Flat: nothing reads a per-bone framing offset yet.
  return 0
}

/** Fetch the asset entry, or undefined for an unknown id. */
export function getAsset(id: AssetId): AssetEntry | undefined {
  return ASSETS[id]
}

/**
 * Path to the scenery prop atlas. Using symlink to original for now.
 * TODO: Rebuild prop atlas without animation dependencies.
 */
export const PROP_ATLAS = '/models/sanctuary.glb'

/** Small original static models used by feeding and sanctuary hunting. */
export const FOOD_PROP_ATLAS = '/models/wyvern-food.glb'
