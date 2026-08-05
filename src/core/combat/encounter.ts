import type { BattleResult, Resources } from '../types'
import type { Actor, EncounterConfig, Order, Outcome, PilotInput } from './types'
import { NEUTRAL_INPUT } from './types'
import { CRUISE_ALTITUDE, applyMotion, canHit, steer, updateAi } from './ai'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { SPECIES } from '../data/species'
import { UNITS } from '../data/units'
import { createRng, type Rng } from '../math/rng'
import { RESOURCE_IDS } from '../state/game'
import { clamp, distance, scale, vec, type Vec3 } from '../math/vec'

export const BREATH_CONE_HALF_ANGLE = 0.62 // radians, half-angle
const BREATH_STAMINA_COST = 12
const BREATH_INTERVAL = 2.2

/**
 * The deterministic encounter simulation.
 *
 * This is the single most important object in the codebase: the playable
 * battle renders it while injecting pilot input, and auto-resolve runs the very
 * same instance with an AI at the controls. Because both paths share this code
 * and this RNG, they cannot drift apart in balance.
 */
export interface EncounterSim {
  readonly actors: Actor[]
  readonly regionId: string
  readonly time: number
  readonly outcome: Outcome
  /** The actor the player is flying, if any. */
  readonly piloted: Actor | null
  step(dt: number): void
  setPilotInput(input: PilotInput): void
  issueOrder(actorId: string, order: Order | null): void
  /** True if a tame is currently possible (weakened wild defender in reach). */
  canTame(): boolean
  attemptTame(): boolean
  result(): BattleResult
}

export function createEncounter(config: EncounterConfig): EncounterSim {
  const rng = createRng(config.seed)
  const actors: Actor[] = []
  const arena = CONFIG.battle.arenaRadius

  let nextActor = 0
  const actorId = (prefix: string) => `${prefix}${nextActor++}`

  // --- attacker wyverns -----------------------------------------------------
  config.attackers.wyverns.forEach((w, i) => {
    const spread = spreadX(i, config.attackers.wyverns.length, 26)
    const piloted = w.sourceId === config.pilotedSourceId
    // Obedience is rolled once, up front. A low-bond wyvern brought to a fight
    // may simply not listen — the payoff for all that training time.
    const disobeyChance = CONFIG.battle.disobedienceAtZeroBond * (1 - w.bond / 100)
    const disobedient = !piloted && rng.chance(disobeyChance)
    actors.push(
      makeWyvern({
        id: actorId('aw'),
        side: 'attacker',
        sourceId: w.sourceId,
        speciesId: w.speciesId,
        stats: w.stats,
        bond: w.bond,
        position: vec(spread, CRUISE_ALTITUDE, arena * 0.55),
        disobedient,
        feral: disobedient && w.bond < CONFIG.battle.feralBond,
        tameable: false,
      }),
    )
  })

  // --- attacker squads ------------------------------------------------------
  config.attackers.squads.forEach((s, i) => {
    const spread = spreadX(i, config.attackers.squads.length, 34)
    const actor = makeTroop({
      id: actorId('as'),
      side: 'attacker',
      sourceId: s.sourceId,
      unitId: s.unitId,
      strength: s.strength,
      position: vec(spread, 0, arena * 0.7),
    })
    if (actor) actors.push(actor)
  })

  // --- defenders ------------------------------------------------------------
  config.defenders.wyverns.forEach((d, i) => {
    const species = SPECIES[d.speciesId]
    if (!species) return
    const spread = spreadX(i, config.defenders.wyverns.length, 24)
    // Defenders scale with their tier so late regions actually threaten a
    // developed roster.
    const scaleFactor = 1 + (species.tier - 1) * 0.22
    actors.push(
      makeWyvern({
        id: actorId('dw'),
        side: 'defender',
        sourceId: null,
        speciesId: d.speciesId,
        stats: {
          power: species.baseStats.power * scaleFactor,
          speed: species.baseStats.speed * scaleFactor,
          stamina: species.baseStats.stamina * scaleFactor,
          firepower: species.baseStats.firepower * scaleFactor,
          armor: species.baseStats.armor * scaleFactor,
        },
        bond: 0,
        position: vec(spread, CRUISE_ALTITUDE, -arena * 0.45),
        disobedient: false,
        feral: false,
        // Every wild defender is a potential addition to the roster.
        tameable: true,
      }),
    )
  })

  config.defenders.squads.forEach((s, i) => {
    const spread = spreadX(i, config.defenders.squads.length, 32)
    const actor = makeTroop({
      id: actorId('ds'),
      side: 'defender',
      sourceId: null,
      unitId: s.unitId,
      strength: s.strength,
      position: vec(spread, 0, -arena * 0.6),
    })
    if (actor) actors.push(actor)
  })

  const byId = new Map(actors.map((a) => [a.id, a]))
  const pilotedActor =
    actors.find((a) => a.side === 'attacker' && a.sourceId === config.pilotedSourceId) ?? null

  let time = 0
  let outcome: Outcome = 'ongoing'
  let input: PilotInput = { ...NEUTRAL_INPUT }
  let tamed: string | null = null
  const startStrength = new Map(actors.map((a) => [a.id, a.strength]))

  const rallyPoint = (side: Actor['side']): Vec3 =>
    vec(0, 0, side === 'attacker' ? arena * 0.6 : -arena * 0.5)

  function step(dt: number): void {
    if (outcome !== 'ongoing') return
    time += dt

    for (const actor of actors) {
      if (!actor.alive) continue
      actor.hitThisTick = false
      actor.breathing = false
      actor.cooldown = Math.max(0, actor.cooldown - dt)
      actor.breathCooldown = Math.max(0, actor.breathCooldown - dt)

      if (actor === pilotedActor) {
        flyPiloted(actor, input, dt, arena)
      } else {
        updateAi(actor, actors, byId)
        steer(actor, actors, byId, rallyPoint(actor.side), dt, arena)
      }
    }

    // Attacks resolve after all movement, so nothing gets hit based on a
    // position half the actors haven't reached yet this step.
    for (const actor of actors) {
      if (!actor.alive) continue
      if (actor === pilotedActor) {
        // The pilot chooses when to breathe; the AI decides for everyone else.
        if (input.breathing) tryBreath(actor, actors, rng)
        updateAi(actor, actors, byId)
        tryMelee(actor, byId, rng)
      } else {
        tryBreath(actor, actors, rng)
        tryMelee(actor, byId, rng)
      }
      regenStamina(actor, dt)
    }

    for (const actor of actors) {
      if (actor.alive && actor.hp <= 0) {
        actor.alive = false
        actor.strength = 0
      }
    }

    const defendersLeft = actors.some((a) => a.alive && a.side === 'defender' && !a.feral)
    const attackersLeft = actors.some((a) => a.alive && a.side === 'attacker' && !a.feral)

    if (!defendersLeft) outcome = 'victory'
    else if (!attackersLeft) outcome = 'defeat'
    else if (time >= CONFIG.battle.maxDuration) outcome = 'defeat'
  }

  function tameCandidate(): Actor | null {
    if (tamed || !pilotedActor?.alive) return null
    for (const actor of actors) {
      if (!actor.alive || !actor.tameable) continue
      if (actor.hp / actor.maxHp > CONFIG.battle.tameHpThreshold) continue
      if (distance(actor.position, pilotedActor.position) > 30) continue
      return actor
    }
    return null
  }

  return {
    actors,
    regionId: config.regionId,
    get time() {
      return time
    },
    get outcome() {
      return outcome
    },
    get piloted() {
      return pilotedActor
    },
    step,
    setPilotInput(next) {
      input = next
    },
    issueOrder(id, order) {
      const actor = byId.get(id)
      // A disobedient wyvern accepts the order object but ignores it in the AI,
      // so the player sees the command land and then watches it be defied.
      if (actor && actor.side === 'attacker' && actor.alive) actor.order = order
    },
    canTame: () => tameCandidate() !== null,
    attemptTame() {
      const candidate = tameCandidate()
      if (!candidate || !pilotedActor) return false
      const chance = CONFIG.battle.tameBaseChance * (0.4 + 0.6 * (pilotedActor.bond / 100))
      // One shot per candidate: a failed attempt kills it off as a target.
      candidate.tameable = false
      if (!rng.chance(chance)) return false
      tamed = candidate.speciesId
      candidate.alive = false
      candidate.hp = 0
      return true
    },
    result: () => buildResult(config, actors, startStrength, outcome, time, tamed),
  }
}

// ---------------------------------------------------------------------------
// Actor construction
// ---------------------------------------------------------------------------

/** Evenly spaces N actors across a line centred on 0. */
function spreadX(index: number, count: number, gap: number): number {
  return (index - (count - 1) / 2) * gap
}

function makeWyvern(p: {
  id: string
  side: Actor['side']
  sourceId: string | null
  speciesId: string
  stats: { power: number; speed: number; stamina: number; firepower: number; armor: number }
  bond: number
  position: Vec3
  disobedient: boolean
  feral: boolean
  tameable: boolean
}): Actor {
  const s = p.stats
  return {
    id: p.id,
    kind: 'wyvern',
    side: p.side,
    sourceId: p.sourceId,
    speciesId: p.speciesId,
    unitId: null,
    position: p.position,
    velocity: vec(),
    yaw: p.side === 'attacker' ? Math.PI : 0,
    flying: true,
    hp: 70 + s.armor * 4 + s.stamina * 2,
    maxHp: 70 + s.armor * 4 + s.stamina * 2,
    strength: 1,
    initialStrength: 1,
    attack: s.power * 0.9,
    defense: s.armor * 0.12,
    range: 9,
    speed: 14 + s.speed * 0.4,
    attackInterval: 1.1,
    cooldown: 0,
    breathDamage: s.firepower * 1.4,
    breathRange: 26,
    breathCooldown: 0,
    stamina: 40 + s.stamina * 1.5,
    maxStamina: 40 + s.stamina * 1.5,
    bond: p.bond,
    disobedient: p.disobedient,
    feral: p.feral,
    tameable: p.tameable,
    ai: 'idle',
    targetId: null,
    order: null,
    alive: true,
    kills: 0,
    hitThisTick: false,
    breathing: false,
  }
}

function makeTroop(p: {
  id: string
  side: Actor['side']
  sourceId: string | null
  unitId: string
  strength: number
  position: Vec3
}): Actor | null {
  const unit = UNITS[p.unitId]
  if (!unit || p.strength <= 0) return null
  const hp = p.strength * (6 + unit.defense * 3)
  return {
    id: p.id,
    kind: 'troop',
    side: p.side,
    sourceId: p.sourceId,
    speciesId: null,
    unitId: p.unitId,
    position: p.position,
    velocity: vec(),
    yaw: p.side === 'attacker' ? Math.PI : 0,
    flying: false,
    hp,
    maxHp: hp,
    strength: p.strength,
    initialStrength: p.strength,
    attack: unit.attack * p.strength * 0.3,
    defense: unit.defense,
    range: unit.range,
    speed: unit.speed,
    attackInterval: 1.4,
    cooldown: 0,
    breathDamage: 0,
    breathRange: 0,
    breathCooldown: 0,
    stamina: 0,
    maxStamina: 0,
    bond: 0,
    disobedient: false,
    feral: false,
    tameable: false,
    ai: 'idle',
    targetId: null,
    order: null,
    alive: true,
    kills: 0,
    hitThisTick: false,
    breathing: false,
  }
}

// ---------------------------------------------------------------------------
// Combat resolution
// ---------------------------------------------------------------------------

function counterMultiplier(attacker: Actor, target: Actor): number {
  if (!attacker.unitId || !target.unitId) return 1
  return UNITS[attacker.unitId]?.strongAgainst.includes(target.unitId) ? 1.5 : 1
}

function dealDamage(attacker: Actor, target: Actor, amount: number, rng: Rng): void {
  const mitigated = (amount * counterMultiplier(attacker, target)) / (1 + target.defense * 0.08)
  // Small jitter so identical matchups don't produce identical timings — still
  // fully deterministic, because it comes from the encounter's seeded stream.
  const dealt = mitigated * rng.range(0.9, 1.1)
  target.hp -= dealt
  target.hitThisTick = true

  if (target.kind === 'troop') {
    target.strength = Math.max(0, target.initialStrength * (target.hp / target.maxHp))
  }
  if (target.hp <= 0 && target.alive) attacker.kills += 1
}

function tryMelee(actor: Actor, byId: Map<string, Actor>, rng: Rng): void {
  if (actor.cooldown > 0) return
  const target = actor.targetId ? byId.get(actor.targetId) : undefined
  if (!target?.alive || !canHit(actor, target)) return
  if (distance(actor.position, target.position) > actor.range) return

  dealDamage(actor, target, actor.attack, rng)
  actor.cooldown = actor.attackInterval
}

/** Cone breath against every valid enemy in front of the actor. */
function tryBreath(actor: Actor, actors: readonly Actor[], rng: Rng): void {
  if (actor.kind !== 'wyvern') return
  if (actor.breathCooldown > 0 || actor.stamina < BREATH_STAMINA_COST) return

  actor.breathing = true

  const forward = { x: Math.sin(actor.yaw), y: 0, z: Math.cos(actor.yaw) }
  let hitAny = false

  for (const other of actors) {
    if (!other.alive || other.id === actor.id) continue
    if (actor.feral ? other.id === actor.id : other.side === actor.side) continue
    if (!canHit(actor, other)) continue

    const to = { x: other.position.x - actor.position.x, y: 0, z: other.position.z - actor.position.z }
    const dist = Math.hypot(to.x, to.z)
    if (dist > actor.breathRange || dist < 1e-4) continue

    const cos = (to.x * forward.x + to.z * forward.z) / dist
    if (cos < Math.cos(BREATH_CONE_HALF_ANGLE)) continue

    dealDamage(actor, other, actor.breathDamage, rng)
    hitAny = true
  }

  if (hitAny) {
    actor.stamina -= BREATH_STAMINA_COST
    actor.breathCooldown = BREATH_INTERVAL
  }
}

function regenStamina(actor: Actor, dt: number): void {
  if (actor.maxStamina <= 0) return
  const regenRate = actor.flying ? 6 : 18
  actor.stamina = clamp(actor.stamina + regenRate * dt, 0, actor.maxStamina)

  if (actor.kind === 'wyvern') {
    if (actor.flying && actor.stamina <= 5) {
      actor.flying = false
    } else if (!actor.flying && actor.stamina >= actor.maxStamina * 0.65) {
      actor.flying = true
    }
  }
}

// ---------------------------------------------------------------------------
// Piloted flight
// ---------------------------------------------------------------------------

const TURN_RATE = 1.8
const MAX_PITCH = 0.7

function flyPiloted(actor: Actor, input: PilotInput, dt: number, arena: number): void {
  actor.yaw += input.yaw * TURN_RATE * dt

  const pitch = clamp(input.pitch, -1, 1) * MAX_PITCH
  const boosting = input.throttle > 0.2 || input.diving
  const speed = actor.speed * (1 + clamp(input.throttle, -0.6, 1) * 0.6) * (input.diving ? 1.5 : 1)

  const cosP = Math.cos(pitch)
  const forward = {
    x: Math.sin(actor.yaw) * cosP,
    y: Math.sin(pitch) + (input.diving ? -0.5 : 0),
    z: Math.cos(actor.yaw) * cosP,
  }

  actor.velocity = scale(forward, speed)
  applyMotion(actor, dt, arena)

  // Boosting and diving burn stamina faster than the passive regen returns it,
  // so sustained boosting costs you breath attacks later in the fight.
  if (boosting) actor.stamina = Math.max(0, actor.stamina - 16 * dt)
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function buildResult(
  config: EncounterConfig,
  actors: readonly Actor[],
  startStrength: Map<string, number>,
  outcome: Outcome,
  time: number,
  tamed: string | null,
): BattleResult {
  const victory = outcome === 'victory'
  const wyverns: BattleResult['wyverns'] = {}
  const squads: BattleResult['squads'] = {}

  for (const actor of actors) {
    if (actor.side !== 'attacker' || !actor.sourceId) continue

    if (actor.kind === 'wyvern') {
      const hpFraction = clamp(actor.hp / actor.maxHp, 0, 1)
      wyverns[actor.sourceId] = {
        died: !actor.alive,
        injury: Math.round((1 - hpFraction) * 70),
        // Participation XP on top of kills, so a support wyvern still grows.
        xp: actor.kills * CONFIG.battle.xpPerKill + (victory ? 25 : 8),
        bondDelta: victory ? CONFIG.battle.bondOnVictory : CONFIG.battle.bondOnDefeat,
      }
    } else {
      const started = startStrength.get(actor.id) ?? actor.initialStrength
      squads[actor.sourceId] = actor.alive ? Math.min(actor.strength, started) : 0
    }
  }

  const loot: Partial<Resources> = {}
  if (victory) {
    const def = REGIONS[config.regionId]
    for (const id of RESOURCE_IDS) {
      const amount = (def?.yields[id] ?? 0) * 25
      if (amount > 0) loot[id] = Math.round(amount)
    }
  }

  return {
    regionId: config.regionId,
    victory,
    duration: time,
    wyverns,
    squads,
    eggsLooted: victory ? CONFIG.region.eggsOnConquest : 0,
    tamed,
    loot,
  }
}
