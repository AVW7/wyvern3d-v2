'use client'

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three'
import { MapEdge, edgePoints } from '../mapGraph'
import { REGIONS } from '@/core/data/regions'

interface SupplyLinesProps {
  edges: MapEdge[]
}

const pulseVertexShader = `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aSpeed;
  attribute float aPhase;
  uniform float uTime;
  varying float vOpacity;

  void main() {
    float t = fract(uTime * aSpeed + aPhase);
    vec3 pos = mix(aStart, aEnd, t);
    vOpacity = sin(t * 3.14159265);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (12.0 / -mvPosition.z) * (0.8 + 0.4 * sin(t * 3.14159265));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const cleanPulseFragmentShader = `
  varying float vOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * vOpacity;
    gl_FragColor = vec4(0.29, 0.87, 0.5, alpha * 0.85);
  }
`

export const SupplyLines = React.memo(function SupplyLines({ edges }: SupplyLinesProps) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)

  // Separate edges into locked, owned, and attackable
  const { activeEdges, ownedEdges } = useMemo(() => {
    const active: MapEdge[] = []
    const owned: MapEdge[] = []

    for (const edge of edges) {
      if (edge.status !== 'locked') {
        active.push(edge)
        if (edge.status === 'owned') {
          owned.push(edge)
        }
      }
    }

    return { activeEdges: active, ownedEdges: owned }
  }, [edges])

  // Single Merged LineSegments for locked background edges
  const lockedGeometry = useMemo(() => {
    const coords: number[] = []
    for (const edge of edges) {
      if (edge.status === 'locked') {
        const [pA, pB] = edgePoints(edge)
        const regA = REGIONS[edge.a]
        const regB = REGIONS[edge.b]
        const yA = 0.8 + (regA?.tier ?? 0) * 0.9 + 0.3
        const yB = 0.8 + (regB?.tier ?? 0) * 0.9 + 0.3
        coords.push(pA.x, yA, pA.z, pB.x, yB, pB.z)
      }
    }
    const geom = new BufferGeometry()
    geom.setAttribute('position', new Float32BufferAttribute(coords, 3))
    return geom
  }, [edges])

  // Single Points Draw Call for all owned pulses
  const pulseGeometry = useMemo(() => {
    const numPulsesPerEdge = 3
    const totalPulses = ownedEdges.length * numPulsesPerEdge
    const starts = new Float32Array(totalPulses * 3)
    const ends = new Float32Array(totalPulses * 3)
    const speeds = new Float32Array(totalPulses)
    const phases = new Float32Array(totalPulses)
    const dummyPos = new Float32Array(totalPulses * 3)

    let idx = 0
    for (const edge of ownedEdges) {
      const [pA, pB] = edgePoints(edge)
      const regA = REGIONS[edge.a]
      const regB = REGIONS[edge.b]
      const yA = 0.8 + (regA?.tier ?? 0) * 0.9 + 0.3
      const yB = 0.8 + (regB?.tier ?? 0) * 0.9 + 0.3

      for (let p = 0; p < numPulsesPerEdge; p++) {
        starts[idx * 3] = pA.x
        starts[idx * 3 + 1] = yA
        starts[idx * 3 + 2] = pA.z

        ends[idx * 3] = pB.x
        ends[idx * 3 + 1] = yB
        ends[idx * 3 + 2] = pB.z

        speeds[idx] = 0.5
        phases[idx] = p / numPulsesPerEdge
        idx++
      }
    }

    const geom = new BufferGeometry()
    geom.setAttribute('position', new Float32BufferAttribute(dummyPos, 3))
    geom.setAttribute('aStart', new Float32BufferAttribute(starts, 3))
    geom.setAttribute('aEnd', new Float32BufferAttribute(ends, 3))
    geom.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1))
    geom.setAttribute('aPhase', new Float32BufferAttribute(phases, 1))

    return geom
  }, [ownedEdges])

  useFrame((state) => {
    if (matRef.current && matRef.current.uniforms.uTime) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <group>
      {/* Locked Edges - 1 Draw Call */}
      <lineSegments geometry={lockedGeometry}>
        <lineBasicMaterial color="#334155" opacity={0.3} transparent linewidth={1} />
      </lineSegments>

      {/* Owned & Attackable Frontier Edges - Fat Line per active edge */}
      {activeEdges.map((edge) => {
        const [pA, pB] = edgePoints(edge)
        const regA = REGIONS[edge.a]
        const regB = REGIONS[edge.b]
        const yA = 0.8 + (regA?.tier ?? 0) * 0.9 + 0.3
        const yB = 0.8 + (regB?.tier ?? 0) * 0.9 + 0.3
        const isOwned = edge.status === 'owned'
        const color = isOwned ? '#4ade80' : '#fbbf24'

        return (
          <Line
            key={edge.key}
            points={[
              [pA.x, yA, pA.z],
              [pB.x, yB, pB.z],
            ]}
            color={color}
            lineWidth={isOwned ? 2.5 : 2.0}
            transparent
            opacity={isOwned ? 0.7 : 0.85}
          />
        )
      })}

      {/* Supply Pulses on Owned Edges - 1 Points Draw Call */}
      {ownedEdges.length > 0 && (
        <points ref={pointsRef} geometry={pulseGeometry}>
          <shaderMaterial
            ref={matRef}
            vertexShader={pulseVertexShader}
            fragmentShader={cleanPulseFragmentShader}
            uniforms={{ uTime: { value: 0 } }}
            transparent
            depthWrite={false}
          />
        </points>
      )}
    </group>
  )
})
