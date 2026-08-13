'use client'

import { useMemo, useState } from 'react'
import { Line } from '@react-three/drei'
import { Vector3 } from 'three'
import { REGIONS, REGION_LIST } from '@/core/data/regions'
import { isAttackable } from '@/core/state/game'
import { useGame, useGameState } from '@/state/store'
import { useUi } from '@/state/uiStore'

import { MapCamera } from './components/MapCamera'
import { RegionNode } from './components/RegionNode'
import { RegionHoverCard } from './components/RegionHoverCard'
import { SupplyPulse } from './components/SupplyPulse'
import { WorldEnvironmentDecor } from './components/WorldEnvironmentDecor'
import { WorldConquestHeader } from './components/WorldConquestHeader'
import {
  OWNED_COLOR,
  ATTACKABLE_COLOR,
  LOCKED_COLOR,
  BIOME_COLORS,
  type EdgeInfo,
} from './types'

/**
 * The world map: an interactive 3D tactical board with 21 regions across 5 tiers.
 * Modular orchestrator delegating camera, nodes, hover cards, supply pulses, and environment.
 */
export function WorldMapScene() {
  const state = useGameState()
  const selected = useGame((s) => s.selectedRegion)
  const selectRegion = useGame((s) => s.selectRegion)
  const openPanel = useUi((s) => s.open)
  const [hovered, setHovered] = useState<string | null>(null)

  // Adjacency edges with ownership & attackability status
  const edges = useMemo<EdgeInfo[]>(() => {
    const seen = new Set<string>()
    const out: EdgeInfo[] = []

    for (const region of REGION_LIST) {
      const regState = state.regions[region.id]
      const rOwned = regState?.owner === 'player'
      const rY = 0.8 + region.tier * 0.9

      for (const targetId of region.neighbors) {
        const key = [region.id, targetId].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)

        const other = REGIONS[targetId]
        if (!other) continue
        const oState = state.regions[targetId]
        const oOwned = oState?.owner === 'player'
        const oY = 0.8 + other.tier * 0.9

        let status: 'owned' | 'attackable' | 'locked' = 'locked'
        if (rOwned && oOwned) {
          status = 'owned'
        } else if (
          (rOwned && isAttackable(state, targetId)) ||
          (oOwned && isAttackable(state, region.id))
        ) {
          status = 'attackable'
        }

        out.push({
          key,
          points: [
            new Vector3(region.position.x, rY + 0.4, region.position.z),
            new Vector3(other.position.x, oY + 0.4, other.position.z),
          ],
          status,
        })
      }
    }
    return out
  }, [state])

  return (
    <>
      <MapCamera />
      <hemisphereLight args={['#dbe4ee', '#23272e', 1.0]} />
      <directionalLight position={[60, 90, 40]} intensity={1.6} castShadow />
      <directionalLight position={[-60, 40, -40]} intensity={0.5} color="#5577aa" />
      <color attach="background" args={['#12161c']} />
      <fog attach="fog" args={['#12161c', 200, 380]} />

      {/* Main Sea Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -20]} receiveShadow>
        <planeGeometry args={[360, 340]} />
        <meshStandardMaterial color="#13202e" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Layered Map Continent Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, -20]} receiveShadow>
        <planeGeometry args={[280, 260]} />
        <meshStandardMaterial color="#212c24" roughness={0.9} />
      </mesh>

      {/* Decorative World Environment (Mountains, Pines, Spire Peaks) */}
      <WorldEnvironmentDecor />

      {/* World Conquest Statistics Board */}
      <WorldConquestHeader />

      {/* Adjacency / Supply Lines */}
      {edges.map((edge) => {
        const color =
          edge.status === 'owned'
            ? '#4ade80'
            : edge.status === 'attackable'
              ? '#fb923c'
              : '#334155'
        const lineWidth = edge.status === 'owned' ? 2.5 : edge.status === 'attackable' ? 2.0 : 1.2

        return (
          <group key={edge.key}>
            <Line
              points={edge.points}
              color={color}
              lineWidth={lineWidth}
              opacity={edge.status === 'locked' ? 0.4 : 0.95}
              transparent
            />
            {edge.status === 'owned' && <SupplyPulse points={edge.points} color="#86efac" />}
            {edge.status === 'attackable' && (
              <SupplyPulse points={edge.points} color="#fdba74" speed={1.5} />
            )}
          </group>
        )
      })}

      {/* Region Nodes */}
      {REGION_LIST.map((def) => {
        const region = state.regions[def.id]
        if (!region) return null

        const owned = region.owner === 'player'
        const attackable = isAttackable(state, def.id)
        const nodeColor = owned ? OWNED_COLOR : attackable ? ATTACKABLE_COLOR : LOCKED_COLOR
        const biomeColor = BIOME_COLORS[def.biome] ?? '#555'

        return (
          <RegionNode
            key={def.id}
            def={def}
            color={nodeColor}
            biomeColor={biomeColor}
            owned={owned}
            attackable={attackable}
            unrest={region.unrest}
            selected={selected === def.id}
            isHovered={hovered === def.id}
            onPointerOver={() => setHovered(def.id)}
            onPointerOut={() => setHovered((h) => (h === def.id ? null : h))}
            onSelect={() => {
              selectRegion(def.id)
              openPanel('warTable')
            }}
          />
        )
      })}

      {/* Dynamic Hover Card Overlay */}
      {hovered && REGIONS[hovered] && (
        <RegionHoverCard def={REGIONS[hovered]} state={state.regions[hovered]} />
      )}
    </>
  )
}
