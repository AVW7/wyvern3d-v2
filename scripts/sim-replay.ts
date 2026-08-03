/**
 * Replays a recorded session and verifies it is reproducible.
 *
 * Export a replay from the in-game Help panel, then:
 *   pnpm sim:replay wyvern3d-replay.json
 *   pnpm sim:replay wyvern3d-replay.json 500     # run on for 500 extra ticks
 *
 * Because the core is deterministic, `(seed, intentLog)` fully determines the
 * end state — which turns any bug report into a reproducible test case.
 */
import { readFileSync } from 'node:fs'
import type { IntentLog } from '../src/core/intents'
import type { GameState } from '../src/core/types'
import { createInitialState } from '../src/core/state/game'
import { executeNextTick } from '../src/core/state/tick'
import { REGIONS } from '../src/core/data/regions'

const [, , file, extraArg] = process.argv

if (!file) {
  console.error('usage: pnpm sim:replay <replay.json> [extraTicks]')
  process.exit(1)
}

const log = JSON.parse(readFileSync(file, 'utf8')) as IntentLog
const extraTicks = Number(extraArg ?? 0)

if (typeof log.seed !== 'number' || !Array.isArray(log.entries)) {
  console.error(`${file} is not a replay: expected { seed, entries }`)
  process.exit(1)
}

const lastTick = log.entries.reduce((max, e) => Math.max(max, e.tick), 0)
const totalTicks = lastTick + 1 + extraTicks

function run(): GameState {
  const state = createInitialState(log.seed)
  // Bucket by tick so each tick receives exactly the intents recorded for it.
  const byTick = new Map<number, typeof log.entries>()
  for (const entry of log.entries) {
    const bucket = byTick.get(entry.tick) ?? []
    bucket.push(entry)
    byTick.set(entry.tick, bucket)
  }

  for (let tick = 0; tick < totalTicks; tick++) {
    executeNextTick(state, (byTick.get(tick) ?? []).map((e) => e.intent))
  }
  return state
}

const first = run()
const second = run()

const identical = JSON.stringify(first) === JSON.stringify(second)

console.log(`\nReplay: ${file}`)
console.log(`  seed          ${log.seed}`)
console.log(`  intents       ${log.entries.length}`)
console.log(`  ticks         ${totalTicks}`)
console.log(`  deterministic ${identical ? 'yes' : 'NO — the core has a nondeterminism bug'}`)

console.log('\nFinal state')
console.log(`  day           ${Math.floor(first.tick / 24) + 1}`)
console.log(
  `  regions held  ${Object.values(first.regions)
    .filter((r) => r.owner === 'player')
    .map((r) => REGIONS[r.id]?.name ?? r.id)
    .join(', ') || 'none'}`,
)
console.log(`  wyverns       ${Object.keys(first.wyverns).length}`)
console.log(`  eggs          ${Object.keys(first.eggs).length}`)
console.log(`  squads        ${Object.keys(first.squads).length}`)
console.log(
  `  resources     ${Object.entries(first.resources)
    .map(([k, v]) => `${k} ${Math.floor(v)}`)
    .join(' · ')}`,
)

console.log('\nLast events')
for (const entry of first.log.slice(-8)) {
  console.log(`  [${entry.tick}] ${entry.message}`)
}
console.log()

process.exit(identical ? 0 : 1)
