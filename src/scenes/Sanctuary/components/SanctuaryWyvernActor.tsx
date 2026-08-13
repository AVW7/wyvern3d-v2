'use client'

import type { Group, Object3D } from 'three'
import type { WyvernInstance } from '@/core/types'
import { SPECIES } from '@/core/data/species'
import { GameModel, type ModelActionRequest } from '@/render/assets/GameModel'
import { type ModelState } from '@/render/assets/manifest'
import {
  HEAD_BONE,
  HIND_LEG_CHAINS,
  JAW_BONE,
  NECK_CHAIN,
  SPINE_CHAIN,
  TAIL_CHAIN,
  findBone,
  findChain,
} from '@/render/rigBones'
import { PlaceholderWyvern } from '@/render/placeholders/PlaceholderWyvern'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { FoodProp } from '@/render/assets/props'

const JAW = JAW_BONE
const HEAD = HEAD_BONE
const TRANSIT_ALTITUDE = 22

export interface VisualState {
  state: ModelState
  action: ModelActionRequest | null
  showFood: boolean
}

export function stageScale(wyvern: WyvernInstance): number {
  if (wyvern.stage === 'hatchling') return 0.28
  if (wyvern.stage === 'juvenile') return 0.6
  return 1
}

/** Adult crown height in metres: the `idle` pose measures 10.7 at manifest fit. */
const ADULT_HEIGHT = 11

export function modelHeight(wyvern: WyvernInstance): number {
  return stageScale(wyvern) * ADULT_HEIGHT
}

function SelectionRing({ scale, airborne }: { scale: number; airborne: boolean }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, airborne ? -TRANSIT_ALTITUDE + 0.2 : 0.08, 0]}
    >
      <ringGeometry args={[4.8 * scale, 5.4 * scale, 48]} />
      <meshBasicMaterial color="#f0d9a8" transparent opacity={0.75} depthWrite={false} />
    </mesh>
  )
}

function FoodOffering({ scale }: { scale: number }) {
  return (
    <FoodProp id="prop.food.meat" position={[0, 0, 4.5 * scale]} scale={scale} />
  )
}

const setCursor = (cursor: 'pointer' | 'auto'): void => {
  document.body.style.cursor = cursor
}

export interface SanctuaryWyvernActorProps {
  wyvern: WyvernInstance
  visual: VisualState
  selected: boolean
  airborne: boolean
  onGroupReady: (group: Group) => void
  onJawReady: (jaw: Object3D | null) => void
  onHeadReady: (head: Object3D | null) => void
  onNeckBonesReady?: (neckBones: Object3D[]) => void
  onSpineBonesReady?: (spineBones: Object3D[]) => void
  onLegBonesReady?: (legBones: Object3D[][]) => void
  onTailBonesReady?: (tailBones: Object3D[]) => void
  onActionFinished?: (request: ModelActionRequest) => void
  onSelect: () => void
}

export function SanctuaryWyvernActor({
  wyvern,
  visual,
  selected,
  airborne,
  onGroupReady,
  onJawReady,
  onHeadReady,
  onNeckBonesReady,
  onSpineBonesReady,
  onLegBonesReady,
  onTailBonesReady,
  onActionFinished,
  onSelect,
}: SanctuaryWyvernActorProps) {
  const species = SPECIES[wyvern.speciesId]
  const scale = stageScale(wyvern)

  return (
    <group
      ref={onGroupReady}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setCursor('pointer')
      }}
      onPointerOut={() => setCursor('auto')}
    >
      <GameModel
        id={`wyvern.${wyvern.speciesId}`}
        state={visual.state}
        action={visual.action}
        seed={wyvern.name.charCodeAt(0) ?? 0}
        scale={scale}
        onReady={(root) => {
          onJawReady(findBone(root, JAW))
          onHeadReady(findBone(root, HEAD))
          onNeckBonesReady?.(findChain(root, NECK_CHAIN))
          onSpineBonesReady?.(findChain(root, SPINE_CHAIN))

          onLegBonesReady?.(
            HIND_LEG_CHAINS.map((chain) => findChain(root, chain)),
          )

          onTailBonesReady?.(findChain(root, TAIL_CHAIN))
        }}
        onActionFinished={onActionFinished}
        fallback={<PlaceholderWyvern color={species?.color} scale={scale} />}
      />

      <WorldLabel
        position={[0, modelHeight(wyvern) + (airborne ? 4 : 2), 0]}
        text={`${wyvern.name} (${species?.name ?? 'Wyvern'})`}
        color={species?.color ?? '#d4af37'}
      />

      {selected && <SelectionRing scale={scale} airborne={airborne} />}
      {visual.showFood && <FoodOffering scale={scale} />}
    </group>
  )
}
