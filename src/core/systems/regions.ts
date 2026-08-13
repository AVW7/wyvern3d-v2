import type { GameState } from '../types'
import { CONFIG } from '../data/config'
import { REGIONS } from '../data/regions'
import { log } from '../state/game'
import { clamp } from '../math/vec'

/**
 * Unrest is the pressure valve. Without it the game is monotone growth: take a
 * region, bank the income, repeat. With it, holding ground costs troops, which
 * is the only reason armies matter outside of an assault.
 */
export function regionTick(state: GameState): void {
  for (const region of Object.values(state.regions)) {
    if (region.owner !== 'player') continue

    // The starting region is the player's seat, not a conquered territory — it
    // never grows unrest and can never revolt. Without this the home region
    // eventually flips, and because an attack requires an adjacent held region
    // that leaves the player with zero regions and no legal move: a soft-lock.
    if (REGIONS[region.id]?.starting) {
      region.unrest = 0
      continue
    }

    const edict = state.realm?.ruler?.edict
    const edictMult = edict === 'royal_garrison' ? 0.5 : edict === 'grand_taxation' ? 1.1 : 1.0
    const hasDominion = state.realm?.philosophies?.unlocked?.includes('dominion')
    const suppressionMult = hasDominion ? 1.1 : 1.0

    const garrison = Object.values(state.squads)
      .filter((s) => s.stationedAt === region.id)
      .reduce((sum, s) => sum + s.strength, 0)

    const suppression = (garrison / 10) * CONFIG.region.unrestPerGarrison * suppressionMult
    region.unrest = clamp(
      region.unrest + CONFIG.region.unrestPerTick * edictMult - suppression,
      0,
      CONFIG.region.revoltAt,
    )

    if (region.unrest >= CONFIG.region.revoltAt) {
      revolt(state, region.id)
    }
  }
}

function revolt(state: GameState, regionId: string): void {
  const region = state.regions[regionId]
  const def = REGIONS[regionId]
  if (!region || !def) return

  region.owner = 'enemy'
  region.unrest = 0
  region.conqueredAtTick = null
  region.garrison = def.garrison.map((g) => ({ ...g }))
  region.eggsAvailable = CONFIG.region.eggsOnConquest

  // Any squad stationed there is lost with the region.
  for (const squad of Object.values(state.squads)) {
    if (squad.stationedAt === regionId) delete state.squads[squad.id]
  }

  log(state, 'bad', `${def.name} has risen in revolt and thrown you out.`)
  if (state.realm?.history) {
    state.realm.history.unshift({
      tick: state.tick,
      title: `Revolt at ${def.name}`,
      description: `High unrest caused ${def.name} to rise up against player rule.`,
      category: 'revolt',
    })
  }
}
