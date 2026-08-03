import type { GameState, Resources } from '../types'
import type { Intent } from '../intents'
import { BUILDINGS } from '../data/buildings'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { SPECIES } from '../data/species'
import { STATIONS } from '../data/stations'
import { UNITS } from '../data/units'
import {
  canAfford,
  capacityOf,
  gain,
  isAttackable,
  log,
  nextId,
  spend,
  withRng,
} from '../state/game'
import {
  applyXp,
  createWyvern,
  isDeployable,
  nameFor,
  rollSpeciesStats,
  rollSpeciesTraits,
} from '../entities/wyvern'
import { deriveSeed, type Rng } from '../math/rng'
import { clamp } from '../math/vec'

import {
  cloneSanctuaryLayout,
  createDefaultSanctuaryLayout,
  ensureSanctuaryLayout,
} from '../state/sanctuaryLayout'

/**
 * Executions are the ONLY code permitted to mutate GameState. Every one of
 * them re-validates its intent — intents arriving from a replay or a future
 * server are untrusted, and a rejected intent must leave state untouched.
 */
export function execute(state: GameState, intent: Intent): void {
  switch (intent.type) {
    case 'ASSIGN_TRAINING':
      return assignTraining(state, intent.wyvernId, intent.stationId)
    case 'CANCEL_ASSIGNMENT':
      return cancelAssignment(state, intent.wyvernId)
    case 'START_BREEDING':
      return startBreeding(state, intent.aId, intent.bId)
    case 'INCUBATE_EGG':
      return incubateEgg(state, intent.eggId)
    case 'FEED_WYVERN':
      return feedWyvern(state, intent.wyvernId)
    case 'HUNT_WILDLIFE':
      return huntWildlife(state, intent.wyvernId, intent.prey)
    case 'SET_WYVERN_PERCH':
      return setWyvernPerch(state, intent.wyvernId, intent.perchIndex)
    case 'RENAME_WYVERN':
      return renameWyvern(state, intent.wyvernId, intent.name)
    case 'RELEASE_WYVERN':
      return releaseWyvern(state, intent.wyvernId)
    case 'RECRUIT_SQUAD':
      return recruitSquad(state, intent.unitId, intent.strength)
    case 'DISBAND_SQUAD':
      return disbandSquad(state, intent.squadId)
    case 'STATION_SQUAD':
      return stationSquad(state, intent.squadId, intent.regionId)
    case 'UPGRADE_BUILDING':
      return upgradeBuilding(state, intent.buildingId)
    case 'LAUNCH_ATTACK':
      return launchAttack(state, intent)
    case 'RESOLVE_BATTLE':
      return resolveBattle(state, intent.result)
    case 'ABORT_BATTLE':
      state.pendingBattle = null
      return
    case 'ADD_SANCTUARY_OBJECT':
      return addSanctuaryObject(state, intent)
    case 'MOVE_SANCTUARY_OBJECT':
      return moveSanctuaryObject(state, intent.id, intent.position, intent.rotationY)
    case 'ROTATE_SANCTUARY_OBJECT':
      return rotateSanctuaryObject(state, intent.id, intent.rotationY)
    case 'STORE_SANCTUARY_OBJECT':
      return storeSanctuaryObject(state, intent.id)
    case 'RESET_SANCTUARY_LAYOUT':
      return resetSanctuaryLayout(state)
    case 'RESTORE_SANCTUARY_LAYOUT':
      return restoreSanctuaryLayout(state, intent.layout)
  }
}

// ---------------------------------------------------------------------------
// Sanctuary
// ---------------------------------------------------------------------------

function countAssigned(state: GameState, kind: 'training' | 'breeding'): number {
  return Object.values(state.wyverns).filter((w) => w.assignment.kind === kind).length
}

function assignTraining(state: GameState, wyvernId: string, stationId: string): void {
  const w = state.wyverns[wyvernId]
  const station = STATIONS[stationId]
  if (!w || !station) return
  if (w.assignment.kind !== 'idle') return log(state, 'bad', `${w.name} is already busy.`)
  if (countAssigned(state, 'training') >= capacityOf(state, 'trainingGrounds')) {
    return log(state, 'bad', 'No free training slot — upgrade the Training Grounds.')
  }
  if (!canAfford(state, station.cost)) return log(state, 'bad', `Not enough supplies for the ${station.name}.`)

  spend(state, station.cost)
  w.assignment = { kind: 'training', stationId, ticksLeft: station.duration }
  log(state, 'info', `${w.name} begins training at the ${station.name}.`)
}

function cancelAssignment(state: GameState, wyvernId: string): void {
  const w = state.wyverns[wyvernId]
  if (!w || w.assignment.kind === 'idle') return
  // Breeding is a pair — cancelling one has to release the partner too,
  // or the partner is stranded in a breeding assignment forever.
  if (w.assignment.kind === 'breeding') {
    const partner = state.wyverns[w.assignment.partnerId]
    if (partner && partner.assignment.kind === 'breeding') partner.assignment = { kind: 'idle' }
  }
  w.assignment = { kind: 'idle' }
  log(state, 'info', `${w.name} is recalled.`)
}

function startBreeding(state: GameState, aId: string, bId: string): void {
  const a = state.wyverns[aId]
  const b = state.wyverns[bId]
  if (!a || !b || a.id === b.id) return
  for (const w of [a, b]) {
    if (w.stage !== 'adult') return log(state, 'bad', `${w.name} is not yet grown.`)
    if (w.assignment.kind !== 'idle') return log(state, 'bad', `${w.name} is already busy.`)
    if (w.bond < CONFIG.wyvern.breedBond) return log(state, 'bad', `${w.name} does not trust you enough.`)
    if (w.breedCooldown > 0) return log(state, 'bad', `${w.name} needs more time to recover.`)
  }
  if (capacityOf(state, 'hatchery') <= 0) return log(state, 'bad', 'Build a Hatchery first.')

  const duration = CONFIG.wyvern.breedDuration
  a.assignment = { kind: 'breeding', partnerId: b.id, ticksLeft: duration }
  b.assignment = { kind: 'breeding', partnerId: a.id, ticksLeft: duration }
  log(state, 'info', `${a.name} and ${b.name} are paired.`)
}

function incubateEgg(state: GameState, eggId: string): void {
  const egg = state.eggs[eggId]
  if (!egg || egg.incubatingTicksLeft !== null) return
  const inSlots = Object.values(state.eggs).filter((e) => e.incubatingTicksLeft !== null).length
  if (inSlots >= capacityOf(state, 'hatchery')) {
    return log(state, 'bad', 'Every roost is occupied — upgrade the Hatchery.')
  }
  egg.incubatingTicksLeft = CONFIG.wyvern.incubationTicks
  log(state, 'info', `A ${SPECIES[egg.speciesId]?.name ?? 'wyvern'} egg is set to warm.`)
}

function feedWyvern(state: GameState, wyvernId: string): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  if (state.resources.food < CONFIG.wyvern.feedCost) return log(state, 'bad', 'Not enough food.')
  state.resources.food -= CONFIG.wyvern.feedCost
  w.hunger = clamp(w.hunger - CONFIG.wyvern.feedRelief, 0, 100)
  log(state, 'good', `${w.name} is fed.`)
}

/**
 * The render layer confirms a physical prey hit, then records the resulting
 * harvest through this normal replay-safe intent. The prey's pose and respawn
 * clock remain cosmetic, but the food reward is authoritative and rate-limited.
 */
function huntWildlife(state: GameState, wyvernId: string, prey: 'deer' | 'bird'): void {
  const w = state.wyverns[wyvernId]
  if (!w || w.stage !== 'adult' || w.assignment.kind !== 'idle') return
  if (prey !== 'deer' && prey !== 'bird') return
  if (state.tick < w.lastHuntTick + CONFIG.wyvern.huntCooldownTicks) {
    return log(state, 'bad', `${w.name} needs time before another hunt.`)
  }
  const food = CONFIG.wyvern.huntFood[prey]
  w.lastHuntTick = state.tick
  gain(state, { food })
  log(state, 'good', `${w.name} brings back ${food} food from a ${prey} hunt.`)
}

function setWyvernPerch(state: GameState, wyvernId: string, perchIndex: number): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  w.preferredPerchIndex = perchIndex
  log(state, 'info', `${w.name}'s idle perch assigned to Spot ${perchIndex + 1}.`)
}

function renameWyvern(state: GameState, wyvernId: string, name: string): void {
  const w = state.wyverns[wyvernId]
  const trimmed = name.trim().slice(0, 24)
  if (!w || trimmed.length === 0) return
  w.name = trimmed
}

function releaseWyvern(state: GameState, wyvernId: string): void {
  const w = state.wyverns[wyvernId]
  if (!w) return
  cancelAssignment(state, wyvernId)
  delete state.wyverns[wyvernId]
  log(state, 'info', `${w.name} is released to the wild.`)
}

// ---------------------------------------------------------------------------
// Armies
// ---------------------------------------------------------------------------

/** Unit costs are quoted per 10 troops. */
function scaledCost(base: Partial<Resources>, strength: number): Partial<Resources> {
  const factor = strength / 10
  const out: Partial<Resources> = {}
  for (const [k, v] of Object.entries(base) as [keyof Resources, number][]) {
    out[k] = Math.round(v * factor)
  }
  return out
}

function recruitSquad(state: GameState, unitId: string, strength: number): void {
  const unit = UNITS[unitId]
  const size = Math.round(strength)
  if (!unit || size <= 0) return
  if (Object.keys(state.squads).length >= capacityOf(state, 'barracks')) {
    return log(state, 'bad', 'No room for another squad — upgrade the Barracks.')
  }
  const cost = scaledCost(unit.cost, size)
  if (!canAfford(state, cost)) return log(state, 'bad', `Not enough to raise ${size} ${unit.name}.`)

  spend(state, cost)
  const id = nextId(state, 'sq')
  state.squads[id] = { id, unitId, strength: size, stationedAt: null }
  log(state, 'good', `${size} ${unit.name} answer the call.`)
}

function disbandSquad(state: GameState, squadId: string): void {
  const squad = state.squads[squadId]
  if (!squad) return
  delete state.squads[squadId]
  log(state, 'info', `A squad of ${UNITS[squad.unitId]?.name ?? 'troops'} is disbanded.`)
}

function stationSquad(state: GameState, squadId: string, regionId: string | null): void {
  const squad = state.squads[squadId]
  if (!squad) return
  if (regionId !== null && state.regions[regionId]?.owner !== 'player') {
    return log(state, 'bad', 'You do not hold that region.')
  }
  squad.stationedAt = regionId
  const where = regionId ? (REGIONS[regionId]?.name ?? regionId) : 'the sanctuary'
  log(state, 'info', `Squad redeployed to ${where}.`)
}

function upgradeBuilding(state: GameState, buildingId: string): void {
  const def = BUILDINGS[buildingId]
  if (!def) return
  const level = state.buildings[def.id] ?? 0
  if (level >= def.maxLevel) return log(state, 'bad', `${def.name} is already at its full extent.`)
  const cost = def.costPerLevel[level] ?? {}
  if (!canAfford(state, cost)) return log(state, 'bad', `Not enough materials to extend the ${def.name}.`)

  spend(state, cost)
  state.buildings[def.id] = level + 1
  log(state, 'good', `${def.name} extended to level ${level + 1}.`)
}

// ---------------------------------------------------------------------------
// Conquest
// ---------------------------------------------------------------------------

function launchAttack(
  state: GameState,
  intent: Extract<Intent, { type: 'LAUNCH_ATTACK' }>,
): void {
  if (state.pendingBattle) return log(state, 'bad', 'A campaign is already under way.')
  if (!isAttackable(state, intent.regionId)) return log(state, 'bad', 'That region cannot be reached from your holdings.')

  const wyvernIds = intent.wyvernIds.filter((id) => {
    const w = state.wyverns[id]
    return w !== undefined && isDeployable(w)
  })
  const squadIds = intent.squadIds.filter((id) => state.squads[id]?.stationedAt === null)

  if (wyvernIds.length === 0 && squadIds.length === 0) {
    return log(state, 'bad', 'Nothing fit to march.')
  }

  const piloted =
    intent.pilotedWyvernId && wyvernIds.includes(intent.pilotedWyvernId)
      ? intent.pilotedWyvernId
      : (wyvernIds[0] ?? null)

  state.pendingBattle = {
    regionId: intent.regionId,
    // Derived from world seed + tick + region, so the same attack always plays
    // out from the same starting conditions on replay.
    seed: deriveSeed(state.seed, `${intent.regionId}:${state.tick}`),
    wyvernIds,
    squadIds,
    pilotedWyvernId: piloted,
    mode: intent.mode,
  }
  log(state, 'info', `The host moves on ${REGIONS[intent.regionId]?.name ?? intent.regionId}.`)
}

function resolveBattle(state: GameState, result: GameState['lastBattle']): void {
  if (!result) return
  const pending = state.pendingBattle
  if (!pending || pending.regionId !== result.regionId) return

  state.pendingBattle = null
  state.lastBattle = result

  // Wyvern outcomes: injuries and XP land whether you won or lost.
  for (const [id, outcome] of Object.entries(result.wyverns)) {
    const w = state.wyverns[id]
    if (!w) continue
    if (outcome.died) {
      delete state.wyverns[id]
      log(state, 'bad', `${w.name} fell at ${REGIONS[result.regionId]?.name ?? result.regionId}.`)
      continue
    }
    w.injury = clamp(w.injury + outcome.injury, 0, 100)
    w.bond = clamp(w.bond + outcome.bondDelta, 0, CONFIG.wyvern.maxBond)
    const levels = applyXp(w, outcome.xp)
    if (levels > 0) log(state, 'good', `${w.name} reaches level ${w.level}.`)
  }

  // Squad casualties.
  for (const [id, survivors] of Object.entries(result.squads)) {
    const squad = state.squads[id]
    if (!squad) continue
    squad.strength = Math.max(0, Math.round(survivors))
    if (squad.strength === 0) {
      delete state.squads[id]
      log(state, 'bad', `A squad of ${UNITS[squad.unitId]?.name ?? 'troops'} was wiped out.`)
    }
  }

  const region = state.regions[result.regionId]
  const def = REGIONS[result.regionId]
  if (!region || !def) return

  if (!result.victory) {
    log(state, 'bad', `The assault on ${def.name} was thrown back.`)
    return
  }

  region.owner = 'player'
  region.unrest = 25
  region.garrison = []
  region.conqueredAtTick = state.tick
  gain(state, result.loot)

  log(state, 'good', `${def.name} falls. The banners are yours.`)

  // Loot eggs of the region's native species — this is the main collection path.
  const eggs = Math.min(result.eggsLooted, region.eggsAvailable)
  region.eggsAvailable -= eggs
  if (eggs > 0) {
    withRng(state, (rng) => {
      for (let i = 0; i < eggs; i++) {
        const id = nextId(state, 'egg')
        state.eggs[id] = {
          id,
          speciesId: def.nativeSpecies,
          parents: null,
          rolledStats: rollSpeciesStats(def.nativeSpecies, rng),
          rolledTraits: rollSpeciesTraits(def.nativeSpecies, rng),
          incubatingTicksLeft: null,
        }
      }
    })
    log(state, 'good', `${eggs} ${SPECIES[def.nativeSpecies]?.name ?? 'wyvern'} egg(s) recovered.`)
  }

  // A wild wyvern tamed mid-battle joins as an adult, but distrustful.
  if (result.tamed) {
    withRng(state, (rng) => {
      const id = nextId(state, 'wy')
      state.wyverns[id] = createTamed(result.tamed!, id, state.nextId, rng)
    })
    log(state, 'good', `A wild ${SPECIES[result.tamed]?.name ?? 'wyvern'} submits to you.`)
  }
}

function createTamed(speciesId: string, id: string, n: number, rng: Rng) {
  return createWyvern({
    id,
    speciesId,
    name: nameFor(speciesId, n),
    stats: rollSpeciesStats(speciesId, rng),
    traits: rollSpeciesTraits(speciesId, rng),
    stage: 'adult',
    origin: 'tamed',
    // Tamed wyverns start hostile-adjacent: they will disobey until trained.
    bond: 15,
  })
}

// ---------------------------------------------------------------------------
// Sanctuary Layout Management
// ---------------------------------------------------------------------------

function addSanctuaryObject(
  state: GameState,
  intent: Extract<Intent, { type: 'ADD_SANCTUARY_OBJECT' }>,
): void {
  const layout = ensureSanctuaryLayout(state)
  const count = layout.storage[intent.propId] ?? 0
  const isStructure = intent.category === 'structure'

  if (!isStructure && count <= 0) {
    return log(state, 'bad', `No ${intent.label} available in storage.`)
  }

  if (!isStructure) {
    layout.storage[intent.propId] = Math.max(0, count - 1)
  }

  const id = nextId(state, 'obj')
  layout.objects.push({
    id,
    propId: intent.propId,
    position: intent.position,
    rotationY: intent.rotationY,
    scale: intent.scale,
    category: intent.category,
    label: intent.label,
    interactableId: intent.interactableId,
    station: intent.station,
    panel: intent.panel,
    radius: intent.radius,
  })

  log(state, 'good', `Placed ${intent.label} in sanctuary.`)
}

function moveSanctuaryObject(
  state: GameState,
  id: string,
  position: [number, number, number],
  rotationY?: number,
): void {
  const layout = ensureSanctuaryLayout(state)
  const obj = layout.objects.find((o) => o.id === id)
  if (!obj) return
  obj.position = position
  if (rotationY !== undefined) obj.rotationY = rotationY
}

function rotateSanctuaryObject(state: GameState, id: string, rotationY: number): void {
  const layout = ensureSanctuaryLayout(state)
  const obj = layout.objects.find((o) => o.id === id)
  if (!obj) return
  obj.rotationY = rotationY
}

function storeSanctuaryObject(state: GameState, id: string): void {
  const layout = ensureSanctuaryLayout(state)
  const idx = layout.objects.findIndex((o) => o.id === id)
  if (idx === -1) return
  const [removed] = layout.objects.splice(idx, 1)
  if (removed && removed.category !== 'structure') {
    layout.storage[removed.propId] = (layout.storage[removed.propId] ?? 0) + 1
  }
  if (removed) {
    log(state, 'info', `Stored ${removed.label} to inventory.`)
  }
}

function resetSanctuaryLayout(state: GameState): void {
  state.sanctuaryLayout = createDefaultSanctuaryLayout()
  log(state, 'info', 'Sanctuary layout reset to default.')
}

function restoreSanctuaryLayout(state: GameState, layout: GameState['sanctuaryLayout']): void {
  state.sanctuaryLayout = cloneSanctuaryLayout(layout)
  log(state, 'info', 'Sanctuary layout restored.')
}
