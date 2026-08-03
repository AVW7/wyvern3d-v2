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
   * a wingbeat.
   */
  phaseGroup?: string
  /**
   * Overrides the asset's yOffset while this clip plays.
   *
   * Each pose reaches a different distance below the rig origin — the idle
   * bottoms out 1.57 above it, the walk 0.24 below — so one number per asset
   * plants exactly one clip and sinks or floats the rest.
   */
  yOffset?: number
}

/**
 * A state's clip, or several interchangeable ones.
 *
 * An array is picked from by the entity's `seed`, so a roost of perched wyverns
 * is not breathing in lockstep. Every entry must be equally valid for the state
 * — same stance, same loopability — because which one plays is arbitrary.
 */
export type StateClips = ClipSpec | ClipSpec[]

/**
 * Cosmetic surface overrides, applied to every material in a loaded model.
 *
 * This exists so a vendor model's finish can be art-directed without touching
 * the GLB. `color` multiplies the base colour map, so it can only darken or
 * tint; `emissive` adds on top, which is the only way to lift a very dark map
 * toward grey without washing its detail out.
 */
export interface MaterialOverride {
  color?: string
  emissive?: string
  roughness?: number
  metalness?: number
}

export interface AssetEntry {
  /** Public path to a .glb, or null to use the procedural placeholder. */
  url: string | null
  /** Optional meshless GLB whose clips target nodes in the base model. */
  animationUrl?: string
  scale: number
  yOffset: number
  /** Clips inside the GLB, mapped to the states the game asks for. */
  animations?: Partial<Record<ModelState, StateClips>>
  material?: MaterialOverride
}

export type AssetId =
  | `wyvern.${string}`
  | `unit.${string}`
  | `building.${string}`
  | `prop.${string}`
  | 'character.player'

/**
 * Every species currently shares one model, staying visually distinct through
 * `scale` here and their `color` in core/data/species.ts. The file ships 52
 * clips; the map below drives six states out of them.
 *
 * This is a flying dragon's rig: of the 52, only the three walk cycles are
 * authored with the feet at the origin. Every other pose — the battle stance
 * included — hovers, because in its original game the creature fights airborne.
 * Lowest point of the posed skin relative to the origin, sampled across each
 * clip:
 *
 *   Battle_Stand (idle)  +1.57 … +1.89     Battle_Walk    -0.24 … +0.46
 *   Battle_Up  (takeoff) -19.16 … +1.75    Battle_Skill11_L  -22.93 … -0.17
 *
 * Hence the negative yOffset: it plants the hovering idle stance on the ground,
 * which is what the sanctuary needs. It leaves the airborne states 1.55 low,
 * which is invisible on a 44-unit creature hundreds of units up.
 *
 * docs/WYVERN_ANIMATIONS.md has all 52 measured, classified, and staged. Read it
 * before mapping a new state — half the clips are one-shots, and four are
 * additive delta poses that bury the model if played as states.
 */
/**
 * The two colour maps average RGB(42, 36, 30) — a very dark brown-black, which
 * is the look we want, so the override neutralises the brown rather than
 * darkening further: a cool grey multiply pulls the hue off warm, and a small
 * emissive lift keeps the silhouette from collapsing into a flat black hole
 * under the sanctuary's low fill light. Rebuild the GLB with
 * scripts/rebuild-drogon.py; tune the finish here.
 */
const DROGON: Omit<AssetEntry, 'scale'> = {
  url: '/models/drogon.glb',
  animationUrl: '/models/drogon-sanctuary.glb',
  yOffset: -1.55,
  material: {
    color: '#aab3bf',
    emissive: '#1b1e24',
    roughness: 0.62,
    metalness: 0.05,
  },
  animations: {
    // Three interchangeable idles: all planted, all seamless loops, 5–15.3s.
    // Each carries its own offset because they bottom out at +1.57, +0.86 and
    // -0.35 respectively — one shared number would sink the roar by 1.9 units.
    idle: [
      { clip: 'SKM_DaenerysDragon|AA_DaenerysDragon_Battle_Stand', yOffset: -1.55 },
      { clip: 'SKM_DaenerysDragon|DaenerysDragon_Neutural_Watch', yOffset: -0.86 },
      { clip: 'SKM_DaenerysDragon|DaenerysDragon_Neutural_Roar', yOffset: 0.35 },
    ],
    walk: { clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Walk', yOffset: 0.24 },
    // Battle_Up is the ground-to-air transition, not a cruise: it opens folded
    // on the ground and ends wings-spread at altitude, 6.8 units of pose away
    // from where it started. Looped, it snapped back to the crouch every 8.1s.
    fly: {
      clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Up',
      loop: false,
      next: 'airborne',
      yOffset: 0,
      fadeIn: 0.35,
    },
    // A purpose-built, seamless cruise loop. Keeping the chained internal
    // state separate from `cruise` lets gameplay still ask for `fly` and receive
    // the complete takeoff -> cruise sequence.
    airborne: { clip: 'Sanct_Cruise', yOffset: 0, phaseGroup: 'flight' },
    // 3.3s planted snap-bite. Attack01 is an 8.1s rearing combo — too long to
    // read as a single blow.
    attack: {
      clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Attack06',
      yOffset: 0.45,
    },
    // Airborne lunge. This is an action-channel one-shot: a flight selector
    // keeps owning the base loop underneath, so the strike cannot be stomped
    // by the next cruise-state update.
    attackAir: {
      clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Attack04',
      loop: false,
      yOffset: 0,
      fadeIn: 0.16,
    },
    // Holds the final collapsed pose instead of standing back up on loop.
    death: {
      clip: 'SKM_DaenerysDragon|DaenerysDragon_Death',
      loop: false,
      yOffset: 2.15,
      fadeIn: 0.12,
    },
    // Existing vendor clips promoted for sanctuary work.
    hop: {
      clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Skill07',
      yOffset: -1.75,
    },
    breathe: {
      clip: 'Sanct_Breathe',
      loop: false,
      yOffset: 0.20,
      fadeIn: 0.2,
    },
    breatheAir: {
      clip: 'Sanct_BreatheAir',
      loop: false,
      yOffset: 0,
      fadeIn: 0.2,
    },
    rest: {
      clip: 'Sanct_Rest',
      yOffset: 2.21,
    },
    land: {
      clip: 'SKM_DaenerysDragon|DaenerysDragon_Battle_Down02',
      loop: false,
      next: 'idle',
      fadeIn: 0.4,
    },
    // Blender-authored, meshless sidecar clips. Every offset below is the
    // negated `ground_clearance.min` in
    // validation/wyvern-animations/clip-signatures.json, sampled 48 frames per
    // clip. The previous values came from a 13-frame sample, which misses the
    // lowest frame of a pose and therefore floats the model: the nuzzle's true
    // low point is +1.19, not the +1.73 that was wired here.
    sleep: { clip: 'Sanct_Sleep', yOffset: 2.04 },
    sit: {
      clip: 'Sanct_Sit',
      loop: false,
      next: 'seated',
      yOffset: -0.58,
      fadeIn: 0.35,
    },
    seated: { clip: 'Sanct_SitLoop', yOffset: -0.41 },
    rise: {
      clip: 'Sanct_Rise',
      loop: false,
      next: 'idle',
      yOffset: -0.58,
      fadeIn: 0.35,
    },
    eat: { clip: 'Sanct_Eat', yOffset: 0.86, timeScale: 0.85 },
    huntGrip: {
      clip: 'Sanct_HuntGrip',
      loop: false,
      yOffset: 0.49,
      fadeIn: 0.18,
    },
    huntCarry: {
      clip: 'Sanct_HuntCarry',
      yOffset: 0,
      phaseGroup: 'hunt-carry',
      fadeIn: 0.3,
    },
    huntFinish: {
      clip: 'Sanct_HuntFinish',
      loop: false,
      next: 'idle',
      yOffset: -0.88,
      fadeIn: 0.28,
    },
    pickUp: {
      clip: 'Sanct_PickUp',
      loop: false,
      yOffset: 0,
      fadeIn: 0.2,
    },
    drop: {
      clip: 'Sanct_Drop',
      loop: false,
      yOffset: 0,
      fadeIn: 0.2,
    },
    drink: { clip: 'Sanct_Drink', yOffset: 0.74, timeScale: 0.9 },
    groom: { clip: 'Sanct_Groom', yOffset: -0.75 },
    perch: { clip: 'Sanct_PerchGrip', yOffset: -1.46 },
    // Direct sanctuary-command clips. Cruise intentionally has no ground-fit
    // correction: its root stays at the director's patrol altitude.
    cruise: { clip: 'Sanct_Cruise', yOffset: 0, phaseGroup: 'flight' },
    bankLeft: {
      clip: 'Sanct_BankL',
      yOffset: 0,
      phaseGroup: 'flight',
      fadeIn: 0.3,
    },
    bankRight: {
      clip: 'Sanct_BankR',
      yOffset: 0,
      phaseGroup: 'flight',
      fadeIn: 0.3,
    },
    // The four motion-selected modes. None of them may join
    // `phaseGroup: 'flight'`: preserving normalized phase across a crossfade
    // only keeps two loops in step when a normalized phase means the same thing
    // in both, and none of these three agree with cruise. Speed runs 4 beats in
    // 5.0s against cruise's 3 in 6.0s, and the two held clips have no wingbeat
    // cycle at all — `cycle` measures null on both, which is precisely what
    // makes them unpowered rather than slowed. All three keep yOffset 0 for the
    // same reason cruise does: their root stays at the director's altitude.
    //
    // Scout is a slow, two-beat search loop (0.333 Hz), so its normalized phase
    // cannot match cruise's three beats even though both last six seconds.
    scout: { clip: 'Sanct_Scout', yOffset: 0, fadeIn: 0.35 },
    //
    // 0.8 Hz against cruise's 0.5, on a body line that is nose-down on every
    // frame (-12.6 to -7.0) where cruise spans -0.6 to +5.0.
    speed: { clip: 'Sanct_Speed', yOffset: 0, fadeIn: 0.25 },
    // Wings held extended and level with no stroke: 8.5 degrees of elevation
    // travel against cruise's 103.2, and 0.12 of extension travel against 6.37.
    glide: { clip: 'Sanct_Soar', yOffset: 0, fadeIn: 0.35 },
    // The mirror of hover about the cruise line — 27.8 degrees nose-down
    // against hover's 32.1 up — with the wings held at the tightest fold in the
    // sampled beat. Loops, because the selector holds `dive` for as long as the
    // flight path does; a one-shot with a `next` would force-exit and fight it.
    dive: { clip: 'Sanct_Dive', yOffset: 0, fadeIn: 0.3 },
    // A real hover, not a slowed cruise. Measured against the cruise loop it
    // shares a rig with: 32.1 degrees nose-up against 2.1, and four wingbeats in
    // the same six seconds against three.
    //
    // Deliberately outside `phaseGroup: 'flight'`. Phase preservation carries
    // *normalized* time across a crossfade, which only keeps two loops in step
    // when a normalized phase means the same thing in both — equal duration and
    // equal beat count. Hover and cruise share a duration but not a cadence, so
    // preserving phase would land mid-beat and jump the wingbeat. Cadence is
    // what makes hover a different mode; matching it to cruise would defeat the
    // clip to satisfy a crossfade. `animationContracts.test.ts` asserts this.
    hover: {
      clip: 'Sanct_Hover',
      yOffset: 0,
      fadeIn: 0.3,
    },
    nuzzle: {
      clip: 'Sanct_Nuzzle',
      loop: false,
      next: 'idle',
      yOffset: -1.24,
      fadeIn: 0.3,
    },
    calm: {
      clip: 'Sanct_Calm',
      loop: false,
      next: 'idle',
      yOffset: -0.9,
      fadeIn: 0.35,
    },
  },
}

/**
 * The sculpt is authored at its own scale: ~44 units nose-to-tail, ~63 across
 * the spread wings, ~11 standing. Since one world unit is one metre here, that
 * is a full-grown Drogon at the size the screen version reads as — an adult
 * spans more than a third of the sanctuary. The fit takes it two size steps
 * down from that (the same ~15% per step the species ladder below uses), so an
 * adult reads large without swallowing the campus; juveniles and hatchlings
 * scale down further via GameModel's `scale` prop.
 */
export const DROGON_FIT = 0.72

export const ASSETS: Record<string, AssetEntry> = {
  // --- wyverns (one per species id in core/data/species.ts) ---
  'wyvern.emberback': { ...DROGON, scale: DROGON_FIT },
  'wyvern.cragwing': { ...DROGON, scale: DROGON_FIT * 1.15 },
  'wyvern.mirefang': { ...DROGON, scale: DROGON_FIT * 1.05 },
  'wyvern.frostmaw': { ...DROGON, scale: DROGON_FIT * 1.25 },
  'wyvern.duskwyrm': { ...DROGON, scale: DROGON_FIT * 1.4 },

  // --- sanctuary wildlife ---
  // Supplied animal models, compressed for the sanctuary at build time. Their
  // clips are mapped through the same model seam as wyverns so models never
  // leak direct GLTF loading into a scene component.
  'wildlife.deer': {
    url: '/models/wildlife/doe.glb',
    // Calibrated against the in-scene human: a doe should be around
    // shoulder-height rather than tower over the sanctuary keeper.
    scale: 1.4,
    yOffset: 0.01,
    // The supplied doe used the retired spec/gloss material extension. Its
    // source was converted to standard PBR during the wildlife build; this
    // subtle warm lift keeps the coat readable in the sanctuary's cool light.
    material: {
      color: '#f2d6b3',
      emissive: '#160b06',
      roughness: 0.9,
      metalness: 0,
    },
    animations: {
      idle: [
        { clip: 'SK-Deer_Female|AA_Stand_Idle_01' },
        { clip: 'SK-Deer_Female|Stand_Idle_02' },
        { clip: 'SK-Deer_Female|Stand_Breathing_01' },
      ],
      // The original Sanctuary wiring accidentally mapped a full run here.
      // Highlands uses the measured slow walk for grazing movement instead.
      walk: { clip: 'SK-Deer_Female|Loco_WalkSlow' },
      eat: { clip: 'SK-Deer_Female|Stand_Eating_01' },
      // The doe remains in this clamped final pose while the wyvern feeds.
      death: { clip: 'SK-Deer_Female|Death_Stand_R01', loop: false },
    },
  },
  'wildlife.bird': {
    url: '/models/wildlife/guineafowl.glb',
    // A guineafowl is a small ground bird beside the human and deer.
    scale: 1.4,
    yOffset: 0.00921,
    // The base texture carries the guineafowl's markings. A low emissive lift
    // prevents its dark feathers from collapsing into a silhouette at range.
    material: {
      color: '#e0edf0',
      emissive: '#10201c',
      roughness: 0.88,
      metalness: 0,
    },
    animations: {
      idle: { clip: 'Guineafowl|Guineafowl_A_Idle' },
      walk: { clip: 'Guineafowl|Guineafowl_A_WalkMedium' },
      fly: { clip: 'Guineafowl|Guineafowl_B_FlyFlapping' },
    },
  },

  // --- army units ---
  'unit.spearman': { url: null, scale: 1, yOffset: 0 },
  'unit.archer': { url: null, scale: 1, yOffset: 0 },
  'unit.rider': { url: null, scale: 1.2, yOffset: 0 },
  'unit.siege': { url: null, scale: 1.6, yOffset: 0 },

  // --- sanctuary buildings ---
  'building.hatchery': { url: null, scale: 1, yOffset: 0 },
  'building.trainingGrounds': { url: null, scale: 1, yOffset: 0 },
  'building.barracks': { url: null, scale: 1, yOffset: 0 },
  'building.infirmary': { url: null, scale: 1, yOffset: 0 },
  'building.keep': { url: null, scale: 1, yOffset: 0 },
  'building.warTable': { url: null, scale: 1, yOffset: 0 },

  // --- the player's sim ---
  'character.player': { url: null, scale: 1, yOffset: 0 },
}

/**
 * Shared scenery atlas: every static sanctuary prop in one GLB, keyed by node
 * name, sharing one material and one palette texture.
 *
 * Scenery is declared in scripts/asset-sources.json and built by
 * scripts/extract-assets.py rather than listed here, because a prop is a node
 * inside this file rather than a file of its own. ASSETS above stays the map
 * for per-entity models — wyverns, units, the player — which are separate GLBs
 * with their own skeletons and clips.
 */
export const PROP_ATLAS = '/models/sanctuary.glb'

export const getAsset = (id: string): AssetEntry =>
  ASSETS[id] ?? { url: null, scale: 1, yOffset: 0 }

/** True once a real model has been wired up for this id. */
export const hasModel = (id: string): boolean => getAsset(id).url !== null
