import type { GameState } from '../types'
import type { Intent } from '../intents'
import { log, nextId } from '../state/game'
import {
  cloneSanctuaryLayout,
  createDefaultSanctuaryLayout,
  ensureSanctuaryLayout,
} from '../state/sanctuaryLayout'

export function addSanctuaryObject(
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

export function moveSanctuaryObject(
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

export function rotateSanctuaryObject(state: GameState, id: string, rotationY: number): void {
  const layout = ensureSanctuaryLayout(state)
  const obj = layout.objects.find((o) => o.id === id)
  if (!obj) return
  obj.rotationY = rotationY
}

export function storeSanctuaryObject(state: GameState, id: string): void {
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

export function resetSanctuaryLayout(state: GameState): void {
  state.sanctuaryLayout = createDefaultSanctuaryLayout()
  log(state, 'info', 'Sanctuary layout reset to default.')
}

export function restoreSanctuaryLayout(state: GameState, layout: GameState['sanctuaryLayout']): void {
  state.sanctuaryLayout = cloneSanctuaryLayout(layout)
  log(state, 'info', 'Sanctuary layout restored.')
}
