'use client'

import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { PATROL } from '../layout'

export function AttackTargetReticle() {
  const point = useSanctuaryCommands((state) => state.targetPoint)
  const active = useSanctuaryCommands((state) => state.targetMode)
  const valid = useSanctuaryCommands((state) => state.targetValid)
  if (!active || !point) return null
  return (
    <group position={[point[0], 0.12, point[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 2.1, 40]} />
        <meshBasicMaterial
          color={valid ? '#6fbf7f' : '#d1685a'}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color={valid ? '#6fbf7f' : '#d1685a'} />
      </mesh>
    </group>
  )
}

export function PatrolMarkers() {
  return (
    <group>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2
        return (
          <mesh
            key={index}
            position={[
              PATROL.center[0] + Math.cos(angle) * PATROL.radiusX,
              PATROL.altitude,
              PATROL.center[1] + Math.sin(angle) * PATROL.radiusZ,
            ]}
          >
            <sphereGeometry args={[0.22, 8, 6]} />
            <meshBasicMaterial color="#d9b268" transparent opacity={0.32} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}
