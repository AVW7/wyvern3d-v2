/** Shared shapes for the whole simulation. Pure data — no behaviour lives here. */

export type ResourceId = 'food' | 'gold' | 'ore' | 'timber' | 'arcane' | 'water' | 'hide' | 'iron'
export type Resources = Record<ResourceId, number>

export type StatId = 'power' | 'speed' | 'stamina' | 'firepower' | 'armor'
export type Stats = Record<StatId, number>

export type BuildingId =
  | 'hatchery'
  | 'trainingGrounds'
  | 'barracks'
  | 'infirmary'
  | 'farm'
  | 'aqueduct'
  | 'pasture'
  | 'foundry'
  | 'sawmill'
  | 'housing'
  | 'academy'
  | 'apothecary'
  | 'blacksmith'

export type WildlifeType = 'deer' | 'boar' | 'goat' | 'bird'

export type RulerTitle = 'king' | 'queen'
export type RulerEdict = 'conquest_harvest' | 'royal_garrison' | 'dragon_harmony' | 'grand_taxation'
export type ElementalAffinity = 'fire' | 'water' | 'earth' | 'air'
export type PhilosophyId = 'balance' | 'dominion' | 'stoicism' | 'hermetics'
export type EquipmentType = 'wyvern_armor' | 'flame_spears' | 'iron_shields'
export type ElixirType = 'vitality_salve' | 'dragon_tonic' | 'growth_elixir'

export interface RealmHistoryEntry {
  tick: number
  title: string
  description: string
  category: 'conquest' | 'revolt' | 'philosophy' | 'mastery' | 'royal'
}

export interface SanctuaryRealmState {
  ruler: {
    title: RulerTitle
    edict: RulerEdict
    prestige: number
  }
  grandMaster: {
    masteryLevels: Record<ElementalAffinity, number>
    activeFocus: ElementalAffinity
  }
  philosophies: {
    unlocked: PhilosophyId[]
    activeResearch: PhilosophyId | null
    researchProgress: number
  }
  equipment: Record<EquipmentType, number>
  elixirs: Record<ElixirType, number>
  history: RealmHistoryEntry[]
}

export interface SanctuaryEconomyState {
  population: {
    total: number
    assigned: Partial<Record<BuildingId, number>>
  }
  livestock: Record<WildlifeType, number>
}

/** Only `adult` is battle-legal — that gate is what makes the raising loop matter. */
export type AgeStage = 'hatchling' | 'juvenile' | 'adult'

export type Faction = 'player' | 'enemy'

// ---------------------------------------------------------------------------
// Content definitions (static, authored in core/data)
// ---------------------------------------------------------------------------

export interface WyvernSpecies {
  id: string
  name: string
  /** Placeholder tint until real assets land; also used for map/UI accents. */
  color: string
  baseStats: Stats
  /** Per-level stat gain applied on level-up. */
  growth: Stats
  /** Traits a wild/hatched member of this species can roll. */
  traitPool: string[]
  /** Rough power tier, used for encounter scaling and unlock ordering. */
  tier: number
}

export interface Trait {
  id: string
  name: string
  description: string
  /** Flat stat modifiers applied on top of base+growth. */
  modifiers: Partial<Stats>
  /** Multiplier on bond gained from training. */
  bondRate?: number
}

export interface UnitType {
  id: string
  name: string
  color: string
  tier: number
  /** Per-troop contribution to a squad. */
  attack: number
  defense: number
  /** Effective engagement range in world units. */
  range: number
  speed: number
  /** Unit ids this one is strong against. */
  strongAgainst: string[]
  cost: Partial<Resources>
  /** Gold per tick per 10 troops. */
  upkeep: number
}

export interface BuildingDef {
  id: BuildingId
  name: string
  description: string
  maxLevel: number
  /** Cost of upgrading *to* level n (index 0 = to level 1). */
  costPerLevel: Partial<Resources>[]
  /** What each level grants — interpreted by the system that owns it. */
  capacityPerLevel: number[]
}

export interface LandmarkDef {
  id: string
  name: string
  description: string
  category: 'natural' | 'ruin' | 'settlement' | 'monolith' | 'shrine'
}

export interface AtlasRegionData {
  summary: string
  climateTags: string[]
  terrainTags: string[]
  threatNotes: string
  landmarks: LandmarkDef[]
}

export interface RegionDef {
  id: string
  name: string
  biome: string
  tier: number
  /** Position on the 3D map board (XZ plane). */
  position: { x: number; z: number }
  /** Ids of adjacent regions. Attacks are only legal into an adjacent region. */
  neighbors: string[]
  /** Per-tick resource output once held. */
  yields: Partial<Resources>
  /** Species whose eggs this region drops. */
  nativeSpecies: string
  /** Garrison the region spawns with. */
  garrison: { unitId: string; strength: number }[]
  /** Enemy wyverns defending, as species ids. */
  defenders: string[]
  /** True for the player's starting territory. */
  starting?: boolean
  /** Optional authored composition tag guiding regional identity (e.g. 'windswept', 'dense_canopy'). */
  compositionTag?: string
  /** Authored static atlas lore and landmark data. */
  atlas?: AtlasRegionData
}

export interface TrainingStationDef {
  id: string
  name: string
  /** Which stat this station trains. */
  stat: StatId
  /** Ticks to complete one training cycle. */
  duration: number
  /** Stat points granted on completion. */
  gain: number
  /** Bond granted on completion. */
  bond: number
  cost: Partial<Resources>
}

// ---------------------------------------------------------------------------
// Runtime entities (mutable, serialized into the save)
// ---------------------------------------------------------------------------

export type Assignment =
  | { kind: 'idle' }
  | { kind: 'training'; stationId: string; ticksLeft: number }
  | { kind: 'breeding'; partnerId: string; ticksLeft: number }
  | { kind: 'garrison'; regionId: string }

export interface WyvernInstance {
  id: string
  speciesId: string
  name: string
  stage: AgeStage
  /** Ticks lived since hatching; drives stage promotion. */
  ageTicks: number
  stats: Stats
  level: number
  xp: number
  /** 0–100. Gates obedience in battle and eligibility to breed. */
  bond: number
  /** 0–100. Rises when food runs out; drains bond and stats when high. */
  hunger: number
  /** 0–100. Battle damage carried home; blocks deployment above a threshold. */
  injury: number
  traits: string[]
  assignment: Assignment
  /** Custom assigned idle perch spot (0-7), if set by the player. */
  preferredPerchIndex?: number
  /** Ticks until this wyvern can breed again. */
  breedCooldown: number
  /** Tick of the last successful sanctuary hunt. Keeps food rewards rate-limited. */
  lastHuntTick: number
  origin: 'starter' | 'hatched' | 'tamed'
}

export interface Egg {
  id: string
  speciesId: string
  /** Present for bred eggs; drives inherited stats and traits. */
  parents: [string, string] | null
  /** Pre-rolled at creation so incubation itself stays trivially deterministic. */
  rolledStats: Stats
  rolledTraits: string[]
  /** Null while in storage; set when placed in a hatchery slot. */
  incubatingTicksLeft: number | null
}

export interface Squad {
  id: string
  unitId: string
  /** Troop count. Reduced by casualties. */
  strength: number
  /** Region id, or null when garrisoned at the sanctuary. */
  stationedAt: string | null
}

export interface RegionState {
  id: string
  owner: Faction
  /** 0–100. Reduces yield, and above the revolt threshold flips the region back. */
  unrest: number
  garrison: { unitId: string; strength: number }[]
  /** Eggs still lootable from this region. */
  eggsAvailable: number
  conqueredAtTick: number | null
}

export interface RegionKnowledge {
  regionId: string
  mapped: boolean
  visited: boolean
  discoveredLandmarkIds: string[]
  /** Phenomena the player has deliberately observed here (Biome Stage 4). */
  observedPhenomenonIds: string[]
  firstVisitedTick: number | null
}

export type SanctuaryDutyKind = 'feed' | 'medicine' | 'companionship' | 'flightExercise'
export type SanctuaryDutyStatus = 'available' | 'carrying' | 'complete'

export interface SanctuaryDuty {
  id: number
  kind: SanctuaryDutyKind
  subjectId: string
  createdTick: number
  status: SanctuaryDutyStatus
  sourceId?: string
}

export interface SanctuaryDutiesState {
  nextSeq: number
  active: SanctuaryDuty[]
  carriedDutyId: number | null
  completed: number
}

export interface LogEntry {
  tick: number
  kind: 'info' | 'good' | 'bad'
  message: string
}

export type GameEventKind =
  | 'training_completed'
  | 'egg_laid'
  | 'egg_hatched'
  | 'stage_promoted'
  | 'wyvern_died'
  | 'wyvern_leveled'
  | 'sanctuary_duty_completed'
  | 'region_visited'
  | 'landmark_discovered'
  | 'phenomenon_observed'

export interface GameEvent {
  seq: number
  tick: number
  kind: GameEventKind
  subjectId: string
  objectId?: string
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Battle hand-off
// ---------------------------------------------------------------------------

export interface BattleSetup {
  regionId: string
  /** Seed for this specific encounter, derived from the world seed + tick. */
  seed: number
  wyvernIds: string[]
  squadIds: string[]
  /** Which wyvern the player pilots. */
  pilotedWyvernId: string | null
  mode: 'play' | 'auto'
}

export interface BattleResult {
  regionId: string
  victory: boolean
  /** Ticks of sim time the encounter took. */
  duration: number
  /** Per-wyvern outcome, keyed by wyvern id. */
  wyverns: Record<string, { injury: number; xp: number; bondDelta: number; died: boolean }>
  /** Surviving strength per squad id. */
  squads: Record<string, number>
  eggsLooted: number
  /** Species id of a wild wyvern successfully tamed during the fight. */
  tamed: string | null
  loot: Partial<Resources>
}

// ---------------------------------------------------------------------------
// Sanctuary Layout & Decorator types
// ---------------------------------------------------------------------------

export type SanctuaryObjectCategory = 'structure' | 'scenery' | 'furniture' | 'utility'

export interface SanctuaryPlacedObject {
  id: string
  propId: string
  position: [number, number, number]
  rotationY: number
  scale?: number
  category: SanctuaryObjectCategory
  label: string
  interactableId?: string
  station?: string
  panel?: string
  radius?: number
}

export interface SanctuaryLayoutState {
  objects: SanctuaryPlacedObject[]
  storage: Record<string, number>
}

// ---------------------------------------------------------------------------
// Root state
// ---------------------------------------------------------------------------

export interface GameState {
  saveVersion: number
  seed: number
  /** Serialized RNG cursor so a reloaded save continues the same stream. */
  rngState: number
  tick: number
  resources: Resources
  wyverns: Record<string, WyvernInstance>
  eggs: Record<string, Egg>
  squads: Record<string, Squad>
  regions: Record<string, RegionState>
  /** Persistent player discovery and exploration knowledge of regions and landmarks. */
  atlasKnowledge: Record<string, RegionKnowledge>
  /** Active and completed physical sanctuary duties for wyvern care. */
  duties: SanctuaryDutiesState
  buildings: Record<BuildingId, number>
  /** Sanctuary population, worker assignment & livestock state. */
  economy: SanctuaryEconomyState
  /** Macro realm governance, philosophy, elemental mastery & history codex. */
  realm: SanctuaryRealmState
  /** Customizable sanctuary layout & stored inventory. */
  sanctuaryLayout: SanctuaryLayoutState
  /** Monotonic id counter — deterministic, unlike a uuid. */
  nextId: number
  log: LogEntry[]
  /** Sequence counter for discrete game events. */
  nextEventSeq: number
  /** Bounded event ring for visual flourishes and notifications. */
  events: GameEvent[]
  /** Set when a battle is staged and awaiting resolution. */
  pendingBattle: BattleSetup | null
  lastBattle: BattleResult | null
}
