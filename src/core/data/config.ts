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
    resources: { food: 400, gold: 250, ore: 80, timber: 120, arcane: 10, water: 150, hide: 20, iron: 15 },
    population: 10,
    livestock: { deer: 4, boar: 2, goat: 3, bird: 8 },
    /** Species ids the player begins with, already adult. */
    wyverns: ['emberback'],
    squads: [{ unitId: 'spearman', strength: 40 }],
  },

  economy: {
    /** Water gathered per tick per aqueduct level. */
    waterPerAqueductLevel: 4,
    /** Food produced per tick per assigned farm worker (requires 0.5 water per worker). */
    foodPerFarmWorker: 1.5,
    waterPerFarmWorker: 0.5,
    /** Livestock breeding ticks per species. */
    breedingTicks: { deer: 30, boar: 25, goat: 20, bird: 15 },
    /** Harvest rewards per animal slaughtered. */
    harvestYields: {
      deer: { food: 40, hide: 5 },
      boar: { food: 50, hide: 8 },
      goat: { food: 30, hide: 4 },
      bird: { food: 15, hide: 1 },
    },
    /** Smelting: ore + workers -> iron + gold. */
    orePerSmelt: 2,
    ironPerSmelt: 1,
    goldPerSmelt: 2,
    /** Sawmill: timber + workers -> bonus timber output. */
    timberBonusPerWorker: 1.2,
    /** Population capacity per housing level. */
    populationPerHousingLevel: 8,
    /** Villager food & water consumption per tick per 5 workers. */
    foodPerPerson: 0.1,
    waterPerPerson: 0.15,
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
    /** Ticks for a garrisoned matching wyvern to regenerate 1 egg. */
    eggRegenTicks: 60,
    /** Max eggs a region can hold in reserve. */
    maxEggsHeld: 3,
  },

  army: {
    /** Gold upkeep is unit.upkeep per 10 troops per tick. */
    upkeepDivisor: 10,
    /** Troops deserted per tick per squad when gold is negative. */
    desertionPerTick: 1.5,
    /** Max squads, per barracks level. */
    squadsPerBarracksLevel: 2,
  },

  grandMaster: {
    maxMasteryLevel: 5,
    costPerLevel: [
      { arcane: 40, gold: 50 },
      { arcane: 100, gold: 120 },
      { arcane: 200, gold: 250 },
      { arcane: 380, gold: 500 },
      { arcane: 600, gold: 900 },
    ],
    /** Multipliers per mastery level. */
    fireBonusPerLevel: 0.08, // +8% firepower per level
    waterBonusPerLevel: 0.10, // +10% healing and water yield
    earthBonusPerLevel: 0.08, // +8% defense and iron yield
    airBonusPerLevel: 0.08,   // +8% speed and stamina
  },

  crafting: {
    equipmentCosts: {
      wyvern_armor: { iron: 30, hide: 20, gold: 50 },
      flame_spears: { timber: 40, iron: 25, gold: 40 },
      iron_shields: { iron: 35, timber: 20, gold: 30 },
    },
    elixirCosts: {
      vitality_salve: { water: 30, food: 20, arcane: 5 },
      dragon_tonic: { water: 50, food: 40, arcane: 15 },
      growth_elixir: { water: 80, food: 60, arcane: 30 },
    },
  },

  duties: {
    /** Maximum active duties at any one time. */
    maxActive: 3,
    feed: {
      /** Minimum hunger for a wyvern to trigger a feed duty. */
      threshold: 30,
      /** Bonus bond granted when completing a feed duty. */
      bondBonus: 1,
    },
    medicine: {
      /** Minimum injury for a wyvern to trigger a medicine duty. */
      injuryThreshold: 30,
      /** Resource costs for preparing medicinal salve. */
      costWater: 15,
      costArcane: 2,
      /** Injury relieved upon administering medicine. */
      injuryRelief: 30,
      /** Bonus bond granted when completing a medicine duty. */
      bondBonus: 1,
    },
    companionship: {
      /** Maximum bond above which wyverns do not trigger companionship duties. */
      maxBondThreshold: 70,
      /** Bonus bond granted upon completing companionship routine. */
      bondBonus: 2,
    },
    flightExercise: {
      /** Bonus bond granted upon completing flight ring exercise. */
      bondBonus: 2,
      /** Stamina stat gain upon completing flight exercise. */
      staminaGain: 1,
    },
    /** Minimum hunger for a wyvern to trigger a feed duty (legacy/direct lookup). */
    feedThreshold: 30,
    /** Bonus bond granted when completing a feed duty (legacy/direct lookup). */
    feedBondBonus: 1,
  },

  /** Ring buffer size for the in-game event feed. */
  logLimit: 60,

  /** Ring buffer size for discrete game events. */
  eventLimit: 64,
} as const

export const SAVE_VERSION = 11

