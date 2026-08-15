import type { GameState } from '@/core/types'
import type { Interactable } from '../layout'
import type { ContextAction } from '@/state/contextActions'
import { CONFIG } from '@/core/data/config'

export interface ProximityResolverParams {
  playerPosition: [number, number]
  state: GameState
  interactables: Interactable[]
  wyvernPositions: Record<string, [number, number]>
  isEditing?: boolean
  targetMode?: boolean
}

export const SUPPLY_SOURCE_RADIUS = 3.5
export const WYVERN_INTERACT_RADIUS = 5.0

/** Find all placed supply barrels/crates or fallback position */
export function getSupplySourcePositions(state: GameState): Array<{ id: string; label: string; position: [number, number]; radius: number }> {
  const sources: Array<{ id: string; label: string; position: [number, number]; radius: number }> = []

  if (state.sanctuaryLayout?.objects) {
    for (const obj of state.sanctuaryLayout.objects) {
      if (obj.propId === 'prop.barrel' || obj.propId === 'prop.crate') {
        sources.push({
          id: obj.id,
          label: obj.label || (obj.propId === 'prop.barrel' ? 'Supply Barrel' : 'Wooden Crate'),
          position: [obj.position[0], obj.position[2]],
          radius: obj.radius ?? SUPPLY_SOURCE_RADIUS,
        })
      }
    }
  }

  // Fallback if no barrels or crates placed in sanctuary
  if (sources.length === 0) {
    sources.push({
      id: 'default_supply_barrel',
      label: 'Supply Barrel',
      position: [10.3, -29.5],
      radius: SUPPLY_SOURCE_RADIUS,
    })
  }

  return sources
}

/**
 * Resolves the single highest-priority ContextAction for the player based on proximity:
 * Priority Order:
 * 1. Active Delivery Target (if player is carrying a duty item and within range of subject wyvern)
 * 2. Duty Source / Supply Pick-up (if an available duty exists, player is near barrel/crate, not carrying)
 * 3. Placed Station / Interactable (warTable, roster, training stations, etc.)
 * 4. Wyvern Inspection / Interaction (near a wyvern when not delivering)
 */
export function resolveContextAction({
  playerPosition,
  state,
  interactables,
  wyvernPositions,
  isEditing = false,
  targetMode = false,
}: ProximityResolverParams): ContextAction | null {
  if (isEditing || targetMode) {
    return null
  }

  const [px, pz] = playerPosition
  const dutiesState = state.duties
  const carriedDuty = dutiesState.carriedDutyId !== null
    ? dutiesState.active.find((d) => d.id === dutiesState.carriedDutyId && d.status === 'carrying')
    : null

  // 1. DELIVERY / COMPLETION PRIORITY: Active duty target
  if (carriedDuty) {
    const targetWyvern = state.wyverns[carriedDuty.subjectId]
    const targetPos = wyvernPositions[carriedDuty.subjectId]

    if (targetWyvern && targetPos) {
      const dist = Math.hypot(px - targetPos[0], pz - targetPos[1])
      if (dist <= WYVERN_INTERACT_RADIUS) {
        if (carriedDuty.kind === 'feed') {
          return {
            id: `deliver_duty_${carriedDuty.id}`,
            label: `Feed ${targetWyvern.name}`,
            priority: 'delivery',
            intent: { type: 'COMPLETE_DUTY', dutyId: carriedDuty.id },
          }
        }
        if (carriedDuty.kind === 'medicine') {
          return {
            id: `deliver_duty_${carriedDuty.id}`,
            label: `Treat ${targetWyvern.name}`,
            priority: 'delivery',
            intent: { type: 'COMPLETE_DUTY', dutyId: carriedDuty.id },
          }
        }
      }
    }
  }

  // 1b. Direct (non-carried) duties: Companionship / Flight Exercise when close to wyvern
  const availableDirectDuty = dutiesState.active.find(
    (d) =>
      d.status === 'available' &&
      (d.kind === 'companionship' || d.kind === 'flightExercise') &&
      !carriedDuty,
  )
  if (availableDirectDuty) {
    const targetWyvern = state.wyverns[availableDirectDuty.subjectId]
    const targetPos = wyvernPositions[availableDirectDuty.subjectId]
    if (targetWyvern && targetPos) {
      const dist = Math.hypot(px - targetPos[0], pz - targetPos[1])
      if (dist <= WYVERN_INTERACT_RADIUS) {
        if (availableDirectDuty.kind === 'companionship') {
          return {
            id: `direct_duty_${availableDirectDuty.id}`,
            label: `Bond with ${targetWyvern.name}`,
            priority: 'delivery',
            intent: { type: 'COMPLETE_DUTY', dutyId: availableDirectDuty.id },
          }
        }
        if (availableDirectDuty.kind === 'flightExercise') {
          return {
            id: `direct_duty_${availableDirectDuty.id}`,
            label: `Exercise ${targetWyvern.name}`,
            priority: 'delivery',
            intent: { type: 'COMPLETE_DUTY', dutyId: availableDirectDuty.id },
          }
        }
      }
    }
  }

  // 2. DUTY SOURCE PRIORITY: Available feed/medicine duty and player is near supply point
  const availableCarriedDuty = dutiesState.active.find(
    (d) => d.status === 'available' && (d.kind === 'feed' || d.kind === 'medicine'),
  )

  if (availableCarriedDuty && !carriedDuty) {
    const supplySources = getSupplySourcePositions(state)
    let closestSource: (typeof supplySources)[number] | null = null
    let closestDist = Infinity

    for (const source of supplySources) {
      const dist = Math.hypot(px - source.position[0], pz - source.position[1])
      if (dist <= source.radius && dist < closestDist) {
        closestDist = dist
        closestSource = source
      }
    }

    if (closestSource) {
      const targetWyvern = state.wyverns[availableCarriedDuty.subjectId]
      const targetName = targetWyvern ? targetWyvern.name : 'Wyvern'

      if (availableCarriedDuty.kind === 'feed') {
        const hasFood = state.resources.food >= CONFIG.wyvern.feedCost
        return {
          id: `take_duty_${availableCarriedDuty.id}`,
          label: `Take Ration (for ${targetName})`,
          priority: 'dutySource',
          disabledReason: hasFood ? undefined : 'No Food Available',
          intent: hasFood ? { type: 'TAKE_DUTY_ITEM', dutyId: availableCarriedDuty.id } : undefined,
        }
      }

      if (availableCarriedDuty.kind === 'medicine') {
        const hasSupplies =
          state.resources.water >= CONFIG.duties.medicine.costWater &&
          state.resources.arcane >= CONFIG.duties.medicine.costArcane
        return {
          id: `take_duty_${availableCarriedDuty.id}`,
          label: `Take Salve (for ${targetName})`,
          priority: 'dutySource',
          disabledReason: hasSupplies ? undefined : 'Need Water & Arcane',
          intent: hasSupplies ? { type: 'TAKE_DUTY_ITEM', dutyId: availableCarriedDuty.id } : undefined,
        }
      }
    }
  }

  // 3. STATION PRIORITY: Nearby interactable station
  let closestStation: Interactable | null = null
  let closestStationDist = Infinity

  for (const station of interactables) {
    const dist = Math.hypot(px - station.position[0], pz - station.position[1])
    if (dist <= station.radius && dist < closestStationDist) {
      closestStationDist = dist
      closestStation = station
    }
  }

  if (closestStation) {
    return {
      id: closestStation.id,
      label: closestStation.label,
      priority: 'station',
      panel: closestStation.panel,
      station: closestStation.station,
    }
  }

  // 4. WYVERN PRIORITY: General wyvern inspection when close
  let closestWyvernId: string | null = null
  let closestWyvernDist = Infinity

  for (const [wyvernId, pos] of Object.entries(wyvernPositions)) {
    const dist = Math.hypot(px - pos[0], pz - pos[1])
    if (dist <= WYVERN_INTERACT_RADIUS && dist < closestWyvernDist) {
      closestWyvernDist = dist
      closestWyvernId = wyvernId
    }
  }

  if (closestWyvernId) {
    const wyvern = state.wyverns[closestWyvernId]
    if (wyvern) {
      return {
        id: `wyvern_${wyvern.id}`,
        label: `Inspect ${wyvern.name}`,
        priority: 'wyvern',
        panel: 'roster',
        station: wyvern.id,
      }
    }
  }

  return null
}
