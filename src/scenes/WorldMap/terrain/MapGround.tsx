'use client'

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RingGeometry, Mesh, Float32BufferAttribute } from 'three'
import { mapHeightAt, mapColorAt, LAND_RADIUS, SEA_RADIUS } from './mapTerrain'

export function MapGround() {
  const seaRef = useRef<Mesh>(null)

  // Displaced Land Geometry
  const landGeometry = useMemo(() => {
    const geom = new RingGeometry(0, LAND_RADIUS, 180, 70)
    const pos = geom.attributes.position!
    const colors: number[] = []

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getY(i)
      const y = mapHeightAt(x, z)
      pos.setXYZ(i, x, y, -z)

      const col = mapColorAt(x, z)
      colors.push(col.r, col.g, col.b)
    }

    geom.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geom.computeVertexNormals()
    return geom
  }, [])

  // Flat Sea Geometry overlapping land rim
  const seaGeometry = useMemo(() => {
    return new RingGeometry(LAND_RADIUS - 6, SEA_RADIUS, 96, 8)
  }, [])

  useFrame((state) => {
    if (seaRef.current) {
      seaRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.25 - 0.5
    }
  })

  return (
    <group>
      {/* Land Mass */}
      <mesh geometry={landGeometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Sea Surface */}
      <mesh
        ref={seaRef}
        geometry={seaGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#0f2133"
          roughness={0.2}
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}
