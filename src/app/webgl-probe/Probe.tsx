'use client'

import '@/render/configureThree'
import { Canvas, useFrame } from '@react-three/fiber'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { useMemo, useRef } from 'react'
import { InstancedMesh, Object3D, type Mesh } from 'three'

export function Probe({ level }: { level: number }) {
  return (
    <Canvas camera={{ position: [0, 3, 8], fov: 60 }}>
      <color attach="background" args={['#1d232b']} />
      <Spinner />
      {level >= 2 && (
        <>
          <hemisphereLight args={['#bcd4e6', '#4a4034', 0.9]} />
          <directionalLight position={[5, 8, 4]} intensity={1.5} />
        </>
      )}
      {level >= 3 && <WorldLabel text="text works" position={[0, 2.4, 0]} size={0.7} color="#f0d9a8" />}
      {level >= 4 && <Instances />}
    </Canvas>
  )
}

function Spinner() {
  const mesh = useRef<Mesh>(null)
  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt
  })
  return (
    <mesh ref={mesh}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#c9773a" />
    </mesh>
  )
}

function Instances() {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame(() => {
    if (!mesh.current) return
    for (let i = 0; i < 10; i++) {
      dummy.position.set(Math.cos(i) * 4, 0, Math.sin(i) * 4)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 10]}>
      <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
      <meshStandardMaterial color="#6f8a5c" />
    </instancedMesh>
  )
}
