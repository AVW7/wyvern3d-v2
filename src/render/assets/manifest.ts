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
  | 'climb'
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
  // Re-measured on the promoted wing (`pnpm assets:gothic-wing`), where all
  // three carry v1's own grounded performance — body as well as wing on `idle`
  // and `walk`, which are whole-clip grafts of `Battle_Stand` and `Battle_Walk`.
  // The lift pass raises the folded wing onto the foot plane before export, so
  // what is left below the origin afterwards is belly and knuckle, not a
  // draping wing, and these are those depths negated.
  //
  // All three moved when the retarget stage stopped saving a stale 15-degree
  // `RootMotion` pose into the rig, which had been tilting every clip in the
  // model — see retarget-gothic-wing-blender.py. Re-measure here whenever that
  // pipeline changes; the previous values predate it and planted the model up to
  // 2.6 m out at the shipped fit.
  idle: { clip: 'idle', yOffset: 229.14 },
  walk: { clip: 'walk', yOffset: 183.46 },
  rest: { clip: 'rest', yOffset: 26.74 },

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
  climb: { clip: 'cruise', yOffset: 0 },
  speed: { clip: 'speed', yOffset: 0 },

  // The authored strike has no separate air variant; it reads acceptably
  // airborne because it is all forequarters. The v1 pool member does have one.
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
  //
  // Both strikes are pools, picked per model by `seed` (see `resolveClipSpec`),
  // so a rank of wyverns attacking together does not swing as one animal. The
  // two sources are different in kind on purpose: `attack` is the authored
  // 1.500 s snap (`scripts/author-wyvern-attack-blender.py`), symmetric to the
  // rig's 0.0009 m floor and starting and ending on the neutral pose; `attack2`
  // and `attackAir2` are v1's own `Battle_Attack06` and `Battle_Attack04`
  // captures retargeted whole at 3.333 s, which lead with one side and are
  // listed in `validate-wyvern-clips.mjs`'s asymmetric-by-design set for that
  // reason. The pick is per model, not per swing — `seed` is stable for the
  // lifetime of an instance.
  attack: [
    { clip: 'attack', loop: false, yOffset: 0 },
    { clip: 'attack2', loop: false, yOffset: 0 },
  ],
  attackAir: [
    { clip: 'attack', loop: false, yOffset: 0, fadeIn: 0.16 },
    { clip: 'attackAir2', loop: false, yOffset: 0, fadeIn: 0.16 },
  ],
  breathe: { clip: 'breath', loop: false, yOffset: 0 },
  breatheAir: { clip: 'breath', loop: false, yOffset: 0 },

  // Grounded and hunting behavior fallbacks (prevent T-pose fallback)
  sleep: { clip: 'rest', yOffset: 368.8 },
  sit: { clip: 'rest', yOffset: 368.8 },
  eat: { clip: 'idle', yOffset: 152.89 },
  drink: { clip: 'rest', yOffset: 368.8 },
  groom: { clip: 'rest', yOffset: 368.8 },
  nuzzle: { clip: 'idle', yOffset: 152.89 },
  calm: { clip: 'idle', yOffset: 152.89 },
  perch: { clip: 'idle', yOffset: 152.89 },
  hop: { clip: 'walk', yOffset: 85.57 },
  seated: { clip: 'rest', yOffset: 368.8 },
  rise: { clip: 'takeoff', loop: false, next: 'idle', yOffset: 0 },
  pickUp: { clip: 'attack', loop: false, yOffset: 0 },
  huntGrip: { clip: 'attack', loop: false, yOffset: 0 },
  huntCarry: { clip: 'cruise', yOffset: 0, phaseGroup: 'flight' },
  drop: { clip: 'attack', loop: false, yOffset: 0 },
  huntFinish: { clip: 'attack', loop: false, yOffset: 0 },
}

/**
 * 52-clip animation set for the vendor/Blender Drogon model (drogon.glb).
 */
const DROGON_CLIPS: AssetEntry['animations'] = {
  // Planted on the measured low point of each pose, the same way `WYVERN_CLIPS`
  // is. This asset is a review reference — the Flight Lab's species picker and
  // the model catalogue are its only two callers — and an unplanted reference is
  // not one: with these at 0 it floated a metre above the plane the gothic model
  // stands on, so the two could not be compared on stance, contact or ground
  // clearance, which is most of what it is there to answer.
  //
  // Only the ground loops carry an offset, matching the gothic entry. `takeoff`
  // and `land` measure ~23 here because they leave the ground mid-clip, and the
  // Lab positions airborne states by altitude instead.
  //
  // The original idle/walk guesses were authored in world units against a rig
  // measured in units 100x smaller, and idle carried the wrong sign — it lifted
  // the reference *further* off the plane it was meant to plant. Re-measured
  // headlessly (skeleton-clone + mixer + skinned-vertex Box3, dense-sampled over
  // each cycle) — the method reproduces the sidecar-authored values (sleep 2.14,
  // sit -0.58, seated -0.41, perch -1.46) to ±0.01, so the corrected numbers
  // below are on the authoring pipeline's own basis.
  idle: { clip: 'SKM_DaenerysDragon|AA_DaenerysDragon_Battle_Stand', yOffset: -1.52 },
  walk: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Walk', yOffset: 0.29 },
  rest: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Damage_GroggyLoop', yOffset: 2.048 },

  fly: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Up', loop: false, next: 'airborne', yOffset: 0 },
  land: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down', loop: false, next: 'idle', yOffset: 0 },
  death: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Death', loop: false, yOffset: 0 },

  airborne: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02', yOffset: 0, phaseGroup: 'flight' },
  cruise: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02', yOffset: 0, phaseGroup: 'flight' },
  scout: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02', yOffset: 0 },
  bankLeft: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_SkyMoveL', yOffset: 0, phaseGroup: 'flight' },
  bankRight: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_SkyMoveR', yOffset: 0, phaseGroup: 'flight' },
  hover: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02', yOffset: 0 },
  glide: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02', yOffset: 0 },
  dive: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02', yOffset: 0 },
  climb: { clip: 'Sanct_Climb', yOffset: 0 },
  speed: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02', yOffset: 0 },

  attack: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Attack06', loop: false, yOffset: 0 },
  attackAir: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Attack06', loop: false, yOffset: 0, fadeIn: 0.16 },
  breathe: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Skill03', loop: false, yOffset: 0 },
  breatheAir: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Skill03', loop: false, yOffset: 0 },

  sleep: { clip: 'Sanct_Sleep', yOffset: 2.14 },
  sit: { clip: 'Sanct_Sit', yOffset: -0.58 },
  eat: { clip: 'Sanct_Eat', yOffset: 0.52 },
  drink: { clip: 'Sanct_Drink', yOffset: 0.74 },
  groom: { clip: 'Sanct_Groom', yOffset: -0.75 },
  nuzzle: { clip: 'Sanct_Nuzzle', yOffset: -1.23 },
  calm: { clip: 'Sanct_Calm', yOffset: -0.89 },
  perch: { clip: 'Sanct_PerchGrip', yOffset: -1.46 },
  hop: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Skill07', yOffset: 0 },
  seated: { clip: 'Sanct_SitLoop', yOffset: -0.41 },
  rise: { clip: 'Sanct_Rise', loop: false, next: 'idle', yOffset: -0.58 },
  pickUp: { clip: 'Sanct_PickUp', loop: false, yOffset: 0 },
  huntGrip: { clip: 'Sanct_HuntGrip', loop: false, yOffset: 0.49 },
  huntCarry: { clip: 'Sanct_HuntCarry', yOffset: 0, phaseGroup: 'flight' },
  drop: { clip: 'Sanct_Drop', loop: false, yOffset: 0 },
  huntFinish: { clip: 'Sanct_HuntFinish', loop: false, yOffset: -0.88 },
}

/** One species' entry. `size` is its relative bulk, ordered by tier. */
function wyvernAsset(size: number): AssetEntry {
  return {
    url: '/models/wyvern-gothic.glb',
    scale: WYVERN_FIT * size,
    yOffset: 0,
    animations: WYVERN_CLIPS,
  }
}

/**
 * Thornwing's seven authored source clips. Keeping the clip names and measured
 * fitting values in one place makes the manifest easy to update after the
 * asset analyzer reports its final clearances.
 */
const THORNWING_SOURCE_CLIPS = {
  idle: 'idle',
  walk: 'walk',
  takeoff: 'takeoff',
  cruise: 'cruise',
  land: 'land',
  attack: 'attack',
  death: 'death',
} as const

/**
 * Per-source-clip fitting in Thornwing rig units. The build bakes measured
 * visual RootMotion alignment into every grounded frame, so no static manifest
 * lift is needed (and gait frames cannot hover when their low point changes).
 * Flight keeps the authored origin because scene motion owns its altitude.
 */
const THORNWING_Y_OFFSETS: Record<keyof typeof THORNWING_SOURCE_CLIPS, number> = {
  idle: 0,
  walk: 0,
  takeoff: 0,
  cruise: 0,
  land: 0,
  attack: 0,
  death: 0,
}

const THORNWING_IDLE: ClipSpec = {
  clip: THORNWING_SOURCE_CLIPS.idle,
  yOffset: THORNWING_Y_OFFSETS.idle,
}
const THORNWING_WALK: ClipSpec = {
  clip: THORNWING_SOURCE_CLIPS.walk,
  yOffset: THORNWING_Y_OFFSETS.walk,
}
const THORNWING_CRUISE: ClipSpec = {
  clip: THORNWING_SOURCE_CLIPS.cruise,
  yOffset: THORNWING_Y_OFFSETS.cruise,
  phaseGroup: 'thornwing-flight',
}
const THORNWING_ATTACK: ClipSpec = {
  clip: THORNWING_SOURCE_CLIPS.attack,
  loop: false,
  yOffset: THORNWING_Y_OFFSETS.attack,
}
/**
 * Attack carries a measured 1.052532-unit visual ground alignment at its
 * neutral endpoints. Airborne aliases cancel that carrier so switching from
 * cruise does not move the creature roughly five world metres at scale 6.
 */
const THORNWING_ATTACK_AIR: ClipSpec = {
  clip: THORNWING_SOURCE_CLIPS.attack,
  loop: false,
  yOffset: -1.052532,
  fadeIn: 0.16,
}

/**
 * Complete runtime coverage from Thornwing's compact seven-clip vertical
 * slice. `satisfies Record` intentionally turns any future ModelState addition
 * into a compile error here rather than a bind-pose fallback in the world.
 */
const THORNWING_CLIPS = {
  idle: THORNWING_IDLE,
  fly: {
    clip: THORNWING_SOURCE_CLIPS.takeoff,
    loop: false,
    next: 'cruise',
    yOffset: THORNWING_Y_OFFSETS.takeoff,
  },
  airborne: THORNWING_CRUISE,
  attack: THORNWING_ATTACK,
  attackAir: THORNWING_ATTACK_AIR,
  walk: THORNWING_WALK,
  run: THORNWING_WALK,
  death: {
    clip: THORNWING_SOURCE_CLIPS.death,
    loop: false,
    yOffset: THORNWING_Y_OFFSETS.death,
  },
  hop: THORNWING_WALK,
  breathe: THORNWING_ATTACK,
  breatheAir: THORNWING_ATTACK_AIR,
  rest: THORNWING_IDLE,
  land: {
    clip: THORNWING_SOURCE_CLIPS.land,
    loop: false,
    next: 'idle',
    yOffset: THORNWING_Y_OFFSETS.land,
  },
  sleep: THORNWING_IDLE,
  sit: THORNWING_IDLE,
  seated: THORNWING_IDLE,
  rise: THORNWING_IDLE,
  eat: THORNWING_IDLE,
  huntGrip: THORNWING_ATTACK,
  huntCarry: THORNWING_CRUISE,
  huntFinish: THORNWING_ATTACK,
  drink: THORNWING_IDLE,
  groom: THORNWING_IDLE,
  perch: THORNWING_IDLE,
  cruise: THORNWING_CRUISE,
  scout: THORNWING_CRUISE,
  speed: THORNWING_CRUISE,
  glide: THORNWING_CRUISE,
  dive: THORNWING_CRUISE,
  climb: THORNWING_CRUISE,
  bankLeft: THORNWING_CRUISE,
  bankRight: THORNWING_CRUISE,
  hover: THORNWING_CRUISE,
  nuzzle: THORNWING_IDLE,
  calm: THORNWING_IDLE,
  offer: THORNWING_IDLE,
  pet: THORNWING_IDLE,
  inspect: THORNWING_IDLE,
  pickUp: THORNWING_ATTACK,
  drop: THORNWING_ATTACK_AIR,
} satisfies Record<ModelState, ClipSpec>

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
  /**
   * The rebuilt gothic wing. Promoted: `wyvernAsset` now points every playable
   * species here, and this id is the Flight Lab / Model Library handle for the
   * same file.
   *
   * Built by `pnpm assets:gothic-wing`, which restores v1's six three-phalanx
   * digits and grafts v1's own performances onto the clips. What promotion
   * bought, measured through `validate-wyvern-clips`: the flight loops beat as
   * one family at v1's cadence, and the membrane folds with the digits instead
   * of swinging as a rigid card — distal wing motion on `cruise` goes 8.4° to
   * 54.7°.
   *
   * Still open: the gothic silhouette is not cut into the mesh, and `bankLeft`
   * (65.9° of wing elevation) against `bankRight` (127.5°) is a wider spread
   * than v1's own 85.2/118.4.
   */
  'wyvern.gothic': {
    url: '/models/wyvern-gothic.glb',
    scale: WYVERN_FIT,
    yOffset: 0,
    animations: WYVERN_CLIPS,
  },
  'wyvern.drogon': {
    url: '/models/drogon.glb',
    animationUrls: ['/models/drogon-sanctuary.glb'],
    scale: 0.72,
    yOffset: 0,
    animations: DROGON_CLIPS,
  },
  'wyvern.emberback': wyvernAsset(0.85),
  'wyvern.cragwing': wyvernAsset(0.9),
  'wyvern.mirefang': wyvernAsset(1),
  'wyvern.frostmaw': wyvernAsset(1.05),
  'wyvern.duskwyrm': wyvernAsset(1.1),
  'wyvern.thornwing': {
    url: '/models/thornwing.glb',
    scale: 6,
    yOffset: 0,
    animations: THORNWING_CLIPS,
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
    url: '/models/wildlife/doe.glb',
    // Numeric fit: 1.77004 authored units high -> 1.35 m adult doe.
    scale: 0.7627,
    yOffset: 0.0146,
    animations: {
      idle: { clip: 'SK-Deer_Female|AA_Stand_Idle_01' },
      walk: { clip: 'SK-Deer_Female|Loco_Walk' },
      run: { clip: 'SK-Deer_Female|Loco_Run' },
      eat: { clip: 'SK-Deer_Female|Stand_Eating_01' },
      death: { clip: 'SK-Deer_Female|Death_Stand_R01', loop: false },
    },
  },
  'wildlife.guineafowl': {
    url: '/models/wildlife/guineafowl.glb',
    // Numeric fit: 0.64765 authored units high -> 0.55 m adult bird.
    scale: 0.84922,
    yOffset: 0.00279,
    animations: {
      idle: { clip: 'Guineafowl|Guineafowl_A_Idle' },
      walk: { clip: 'Guineafowl|Guineafowl_A_WalkMedium' },
      fly: { clip: 'Guineafowl|Guineafowl_B_FlyFlapping' },
    },
  },
  'wildlife.rabbit': {
    url: '/models/wildlife/rabbit.glb',
    // Numeric fit: 20.75382 authored units high -> 0.4 m adult rabbit
    // (sitting-height; the rig's single clip is a sit/idle cycle).
    scale: 0.01927,
    yOffset: 0.35227,
    animations: {
      idle: { clip: 'Take 001' },
    },
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
  /**
   * The Elderroot Grove landmark. Numeric fit: 1150.08 authored units tall ->
   * 34 m, which reads as a canopy a wyvern can circle rather than a set piece.
   *
   * The offset is deliberately *not* the usual -min.y. Only seven vertices sit
   * at the model's lowest point — dangling root tips 11 m out — while the
   * trunk's underside is 2.4 m above them, so planting the bounding box left
   * the whole tree hovering on its root tips. This offset drops it by that 2.4
   * m instead: the trunk meets the ground and the tips bury.
   */
  'library.ancientTree': {
    url: '/models/library/ancient-tree.glb',
    scale: 0.02956,
    yOffset: 1.5927,
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

/**
 * Hatchery and gate props: the incubating eggs on the roost pads and the
 * banner beside the keep gate. Built by scripts/build-hatchery-atlas.mjs from
 * licence-verified Sketchfab singles (see CREDITS.md); multi-material like the
 * biome atlas, so props.tsx handles each prop as several primitives.
 */
export const HATCHERY_PROP_ATLAS = '/models/hatchery.glb'

/**
 * Biome scenery atlas: trees, rocks, crystals and landmarks that dress the
 * explorable biomes. Built by scripts/build-biome-atlas.mjs from the curated
 * scripts/biome-library.json; see docs/BIOME_LIBRARY.md.
 *
 * Unlike the sanctuary atlas it is multi-material, so a prop here can be
 * several primitives. props.tsx handles both.
 */
export const BIOME_PROP_ATLAS = '/models/biomes.glb'
