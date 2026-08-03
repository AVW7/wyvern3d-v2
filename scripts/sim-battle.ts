/**
 * Headless balance harness.
 *
 * Runs every region against a reference player force at several strength
 * levels and reports win rates. This exists only because src/core is pure:
 * there is no browser, no canvas and no React anywhere in this path, so a few
 * thousand battles run in under a second.
 *
 *   pnpm sim:battle           # default 60 runs per matchup
 *   pnpm sim:battle 200       # more runs, tighter confidence
 */
import { autoResolveConfig } from '../src/core/combat/autoResolve'
import type { EncounterConfig } from '../src/core/combat/types'
import { REGION_LIST } from '../src/core/data/regions'
import { SPECIES } from '../src/core/data/species'
import { deriveSeed } from '../src/core/math/rng'

const RUNS = Number(process.argv[2] ?? 60)

/** A player roster at a given power level, standing in for "typical progress". */
interface Loadout {
  name: string
  wyverns: number
  /** Multiplier on base species stats, standing in for levels and training. */
  quality: number
  squads: { unitId: string; strength: number }[]
}

const LOADOUTS: Loadout[] = [
  { name: 'early', wyverns: 1, quality: 1.0, squads: [{ unitId: 'spearman', strength: 40 }] },
  {
    name: 'mid',
    wyverns: 2,
    quality: 1.5,
    squads: [
      { unitId: 'archer', strength: 60 },
      { unitId: 'spearman', strength: 60 },
    ],
  },
  {
    name: 'late',
    wyverns: 4,
    quality: 2.2,
    squads: [
      { unitId: 'archer', strength: 90 },
      { unitId: 'rider', strength: 60 },
      { unitId: 'siege', strength: 40 },
    ],
  },
]

function buildConfig(regionId: string, loadout: Loadout, seed: number): EncounterConfig {
  const region = REGION_LIST.find((r) => r.id === regionId)!
  const base = SPECIES.emberback!.baseStats

  return {
    regionId,
    seed,
    attackers: {
      wyverns: Array.from({ length: loadout.wyverns }, (_, i) => ({
        sourceId: `w${i}`,
        speciesId: 'emberback',
        name: `W${i}`,
        bond: 75,
        stats: {
          power: base.power * loadout.quality,
          speed: base.speed * loadout.quality,
          stamina: base.stamina * loadout.quality,
          firepower: base.firepower * loadout.quality,
          armor: base.armor * loadout.quality,
        },
      })),
      squads: loadout.squads.map((s, i) => ({ sourceId: `s${i}`, ...s })),
    },
    defenders: {
      squads: region.garrison.map((g) => ({ ...g })),
      wyverns: region.defenders.map((speciesId) => ({ speciesId, tier: region.tier })),
    },
    pilotedSourceId: null,
  }
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(4)

console.log(`\nWyvern3D balance harness — ${RUNS} runs per matchup\n`)
console.log(
  ['region'.padEnd(13), 'tier', ...LOADOUTS.map((l) => l.name.padStart(6))].join('  ') +
    '   avg duration',
)
console.log('-'.repeat(66))

let anomalies = 0

for (const region of REGION_LIST) {
  if (region.starting) continue

  const cells: string[] = []
  let totalDuration = 0
  let totalRuns = 0

  for (const loadout of LOADOUTS) {
    let wins = 0
    for (let i = 0; i < RUNS; i++) {
      const result = autoResolveConfig(
        buildConfig(region.id, loadout, deriveSeed(i + 1, `${region.id}:${loadout.name}`)),
      )
      if (result.victory) wins++
      totalDuration += result.duration
      totalRuns++
    }
    cells.push(pct(wins / RUNS).padStart(6))
  }

  console.log(
    [region.name.padEnd(13), String(region.tier).padEnd(4), ...cells].join('  ') +
      `   ${(totalDuration / totalRuns).toFixed(0)}s`,
  )

  // A tier-1 region the early loadout cannot beat, or a tier-4 region the early
  // loadout walks over, means the curve is broken.
  const early = Number(cells[0]!.replace('%', ''))
  if (region.tier <= 1 && early < 40) anomalies++
  if (region.tier >= 4 && early > 40) anomalies++
}

console.log(
  `\nLoadouts: ${LOADOUTS.map((l) => `${l.name}=${l.wyverns} wyvern(s) @${l.quality}x`).join(', ')}`,
)
console.log(
  anomalies === 0
    ? 'Difficulty curve looks monotonic.\n'
    : `WARNING: ${anomalies} region(s) sit outside the expected difficulty band.\n`,
)
