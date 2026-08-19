'use client'

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Mesh } from 'three'
import type { SettlementDef, SettlementReading } from '@/core/types'
import { SETTLEMENT_COLORS, SETTLEMENT_HEARTH, settlementBuildings } from '../settlementVisuals'

export interface SettlementClusterProps {
  regionId: string
  settlement: SettlementDef
  reading: SettlementReading
  /** Y of the node cap surface these buildings stand on. */
  baseY: number
  /** Node cap radius. Everything the cluster draws is a fraction of it. */
  nodeRadius: number
}

/**
 * The visible answer to "who lives here?".
 *
 * Purely cosmetic: it reads an already-derived `SettlementReading` and draws
 * it. No thresholds, no game rules, and no writes anywhere.
 */
export function SettlementCluster({
  regionId,
  settlement,
  reading,
  baseY,
  nodeRadius,
}: SettlementClusterProps) {
  const buildings = useMemo(
    () => settlementBuildings(regionId, settlement, nodeRadius),
    [regionId, settlement, nodeRadius],
  )
  const bannerRef = useRef<Mesh>(null)

  const color = SETTLEMENT_COLORS[reading.condition]
  const hearth = SETTLEMENT_HEARTH[reading.condition]
  const bannerHeight = nodeRadius * (0.55 + settlement.tier * 0.16)

  useFrame((frameState) => {
    // A revolting settlement's banner is being torn at; a prospering one hangs
    // steady. Cheap motion, and the only thing that moves in the cluster.
    if (!bannerRef.current) return
    const t = frameState.clock.elapsedTime
    const agitation = reading.condition === 'revolting' ? 0.5 : reading.condition === 'resentful' ? 0.22 : 0.06
    bannerRef.current.rotation.z = Math.sin(t * (1.4 + agitation * 5)) * agitation * 0.35
  })

  return (
    <group position={[settlement.offset.x * nodeRadius, baseY, settlement.offset.z * nodeRadius]}>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]}>
          {/* Wall mass */}
          <mesh position={[0, b.height / 2, 0]} castShadow>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshStandardMaterial color="#3f3730" roughness={0.9} />
          </mesh>
          {/* Roof, tinted by condition — the colour signal at distance */}
          <mesh position={[0, b.height + nodeRadius * 0.07, 0]} castShadow>
            <coneGeometry args={[Math.max(b.width, b.depth) * 0.8, nodeRadius * 0.16, 4]} />
            <meshStandardMaterial
              color={color}
              roughness={0.65}
              emissive={color}
              emissiveIntensity={MathUtils.lerp(0.05, 0.5, hearth)}
            />
          </mesh>
          {/* Hearth light in the windows — goes cold as unrest climbs */}
          {hearth > 0.15 && (
            <mesh position={[0, b.height * 0.45, b.depth / 2 + 0.005]}>
              <planeGeometry args={[b.width * 0.42, b.height * 0.3]} />
              <meshBasicMaterial color="#ffd9a0" opacity={hearth} transparent />
            </mesh>
          )}
        </group>
      ))}

      {/* Banner mast — one per settlement, carrying the condition colour */}
      <mesh position={[0, bannerHeight / 2, 0]}>
        <cylinderGeometry args={[nodeRadius * 0.018, nodeRadius * 0.018, bannerHeight, 6]} />
        <meshStandardMaterial color="#2a2420" roughness={0.8} />
      </mesh>
      <mesh ref={bannerRef} position={[nodeRadius * 0.1, bannerHeight * 0.78, 0]}>
        <planeGeometry args={[nodeRadius * 0.2, nodeRadius * 0.24]} />
        <meshBasicMaterial color={color} side={2} transparent opacity={0.92} />
      </mesh>
    </group>
  )
}
