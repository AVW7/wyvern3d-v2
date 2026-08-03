/**
 * Every tunable number in one place. Balance work should never require a code
 * change anywhere else — that is the point of keeping the core data-driven.
 */
export const CONFIG = {
  /** Real seconds per simulation tick. One tick ≈ one in-game hour. */
  secondsPerTick: 1,
  /** Cap on offline catch-up so a week away doesn't fast-forward the whole game. */
  maxOfflineTicks: 24,

  starting: {
    resources: { food: 400, gold: 250, ore: 80, timber: 120, arcane: 10 },
    /** Species ids the player begins with, already adult. */
    wyverns: ['emberback'],
    squads: [{ unitId: 'spearman', strength: 40 }],
  },

  wyvern: {
    /** Ticks an egg spends in a hatchery slot before it hatches. */
    incubationTicks: 50,
    /** Ticks at each stage before promotion. */
    hatchlingTicks: 60,
    juvenileTicks: 120,
    /** Food cost and hunger removed by one hand-feeding. */
    feedCost: 25,
    feedRelief: 35,
    /** Sanctuary hunting rewards, by prey class, and the per-wyvern recovery time. */
    huntFood: { deer: 80, bird: 20 },
    huntCooldownTicks: 45,
    /** Food eaten per tick, scaled by stage. */
    upkeepByStage: { hatchling: 0.4, juvenile: 0.9, adult: 1.6 },
    /** Hunger gained per tick when food is short; lost per tick when fed. */
    hungerRise: 2.5,
    hungerFall: 6,
    /** Above this hunger, bond decays and the wyvern fights worse. */
    starvingAt: 60,
    bondDecayWhenStarving: 0.6,
    /** Injury healed per tick at the sanctuary, per infirmary level. */
    healPerTick: 0.35,
    /** Wyverns above this injury cannot be deployed. */
    maxDeployInjury: 60,
    /** Bond required to breed. */
    breedBond: 55,
    breedDuration: 40,
    breedCooldown: 200,
    maxBond: 100,
    maxLevel: 20,
    xpPerLevel: 100,
  },

  battle: {
    /** Fixed step the encounter sim advances by, in seconds. Both the live and
     *  auto-resolve paths use this — identical stepping is what keeps them equal. */
    step: 1 / 30,
    /** Auto-resolve gives up past this many sim seconds and calls it a loss. */
    maxDuration: 240,
    /** World-space extent of a battle arena. */
    arenaRadius: 120,
    /** Chance a wyvern ignores an order, scaled by (1 - bond/100). */
    disobedienceAtZeroBond: 0.55,
    /** Below this bond a disobeying wyvern may go feral and attack anything. */
    feralBond: 25,
    /** XP awarded per enemy killed. */
    xpPerKill: 18,
    /** Bond gained for surviving a victory / lost for a rout. */
    bondOnVictory: 4,
    bondOnDefeat: -3,
    /** Wild wyvern must be below this hp fraction before taming can be attempted. */
    tameHpThreshold: 0.3,
    /** Base taming chance at max bond of the piloted wyvern. */
    tameBaseChance: 0.45,
  },

  region: {
    /** Unrest gained per tick in a held region with no garrison. */
    unrestPerTick: 0.35,
    /** Unrest suppressed per tick per 10 garrisoned troops. */
    unrestPerGarrison: 0.12,
    /** At 100 unrest the region revolts back to the enemy. */
    revoltAt: 100,
    /** Yield multiplier falls linearly to this floor as unrest hits 100. */
    minYieldMultiplier: 0.2,
    /** Eggs a region drops on conquest. */
    eggsOnConquest: 2,
  },

  army: {
    /** Gold upkeep is unit.upkeep per 10 troops per tick. */
    upkeepDivisor: 10,
    /** Troops deserted per tick per squad when gold is negative. */
    desertionPerTick: 1.5,
    /** Max squads, per barracks level. */
    squadsPerBarracksLevel: 2,
  },

  /** Ring buffer size for the in-game event feed. */
  logLimit: 60,
} as const

export const SAVE_VERSION = 3
