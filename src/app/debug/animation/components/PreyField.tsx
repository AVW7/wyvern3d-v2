'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Mesh, Vector3 } from 'three'
import type { PropBase } from '../props/PropBase'
import type { PreyDoe } from '../props/PreyDoe'
import type { PreyBird } from '../props/PreyBird'
import type { PropManager } from '../systems/PropManager'

interface PreyFieldProps {
  propManager: PropManager
  propsList: PropBase[]
  wyvernPosition: Vector3
}

function doeColor(prop: PreyDoe): string {
  if (prop.isDead) return '#3f2a1d'
  if (prop.isRoasting) return '#7c2d12'
  if (prop.state === 'fleeing') return '#b45309'
  if (prop.state === 'alert') return '#ca8a04'
  return '#92400e'
}

function birdColor(prop: PreyBird): string {
  if (prop.isDead) return '#1f2937'
  if (prop.isRoasting) return '#9a3412'
  if (prop.state === 'evasion') return '#38bdf8'
  return '#64748b'
}

export function PreyField({ propManager, propsList, wyvernPosition }: PreyFieldProps) {
  const nodes = useRef(new Map<string, Mesh>())
  const scratch = useMemo(() => new Vector3(), [])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    scratch.copy(wyvernPosition)
    propManager.update(dt, scratch)
    for (const prop of propManager.getAllProps()) {
      const mesh = nodes.current.get(prop.id)
      if (!mesh) continue
      mesh.position.copy(prop.position)
      mesh.rotation.y = prop.rotation.y
      const material = mesh.material
      if (material && 'color' in material) {
        const hex = prop.type === 'prey_doe' ? doeColor(prop as PreyDoe) : birdColor(prop as PreyBird)
        ;(material.color as Color).set(hex)
      }
    }
  })

  return (
    <group>
      {propsList.map((prop) => (
        <mesh
          key={prop.id}
          ref={(node) => {
            if (node) nodes.current.set(prop.id, node)
            else nodes.current.delete(prop.id)
          }}
          position={prop.position.toArray()}
          castShadow
        >
          {prop.type === 'prey_doe' ? (
            <capsuleGeometry args={[0.7, 1.6, 4, 8]} />
          ) : (
            <sphereGeometry args={[0.45, 10, 10]} />
          )}
          <meshStandardMaterial
            color={prop.type === 'prey_doe' ? doeColor(prop as PreyDoe) : birdColor(prop as PreyBird)}
          />
        </mesh>
      ))}
    </group>
  )
}
