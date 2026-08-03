'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { Group } from 'three'
import { GameModel } from '@/render/assets/GameModel'
import { PlaceholderWyvern } from '@/render/placeholders/PlaceholderWyvern'
import { Prop, usePropAtlas } from '@/render/assets/props'

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

/** A deliberately passive camera: title-screen motion should never feel like gameplay. */
function TitleCamera() {
  const camera = useThree((state) => state.camera)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (reducedMotion) return
    const t = state.clock.elapsedTime
    camera.position.x = Math.sin(t * 0.075) * 1.2
    camera.position.y = 8.6 + Math.sin(t * 0.12) * 0.35
    camera.lookAt(1.8, 4.5, -2)
  })

  useEffect(() => {
    camera.lookAt(1.8, 4.5, -2)
  }, [camera])

  return null
}

function SanctuaryVignette() {
  // The shared atlas is intentionally used here rather than remaking a fake
  // backdrop in CSS. The title screen should be a truthful glimpse of the game.
  usePropAtlas()
  const wyvern = useRef<Group>(null)
  const reducedMotion = useReducedMotion()

  useFrame((state) => {
    if (reducedMotion || !wyvern.current) return
    wyvern.current.position.y = 6.2 + Math.sin(state.clock.elapsedTime * 0.42) * 0.26
    wyvern.current.rotation.y = -0.44 + Math.sin(state.clock.elapsedTime * 0.1) * 0.035
  })

  return (
    <>
      <color attach="background" args={['#17242d']} />
      <fog attach="fog" args={['#17242d', 28, 96]} />
      <hemisphereLight args={['#c5d3df', '#342d28', 1.25]} />
      <directionalLight position={[-18, 22, 12]} intensity={2.35} color="#ffd7a1" castShadow />
      <pointLight position={[8, 8, 2]} intensity={16} distance={30} color="#f29a56" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -8]} receiveShadow>
        <planeGeometry args={[92, 70]} />
        <meshStandardMaterial color="#263a36" roughness={1} />
      </mesh>
      <mesh position={[-13, 15, -31]}>
        <sphereGeometry args={[6.8, 32, 20]} />
        <meshBasicMaterial color="#f0b86f" transparent opacity={0.68} />
      </mesh>

      <group position={[3.5, 0, -7]} rotation={[0, -0.82, 0]}>
        <Prop id="prop.keep.gate" position={[0, 0, 0]} scale={1.65} castShadow />
        <Prop id="prop.scatter.hill" position={[-19, -0.1, -11]} scale={6.8} castShadow={false} />
        <Prop id="prop.scatter.hill" position={[18, -0.1, -17]} scale={8.5} castShadow={false} />
      </group>

      <group ref={wyvern} position={[6.5, 6.2, -1.5]} rotation={[0.05, -0.44, 0.02]} scale={1.08}>
        <GameModel
          id="wyvern.emberback"
          state="cruise"
          seed={4}
          fallback={<PlaceholderWyvern color="#d4562a" scale={1.08} flapSpeed={2.2} phase={0.7} />}
        />
      </group>
    </>
  )
}

function FallbackSky() {
  return (
    <>
      <color attach="background" args={['#17242d']} />
      <fog attach="fog" args={['#17242d', 28, 96]} />
      <hemisphereLight args={['#c5d3df', '#342d28', 1]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -8]}>
        <planeGeometry args={[92, 70]} />
        <meshStandardMaterial color="#263a36" roughness={1} />
      </mesh>
    </>
  )
}

/** Non-interactive 3D backdrop for the root menu. */
export function TitleScene({ onCanvasReady }: { onCanvasReady: () => void }) {
  // Keep readiness state changes out of R3F's canvas creation phase, which may
  // occur while React is rendering a Suspense fallback.
  useEffect(() => {
    onCanvasReady()
  }, [onCanvasReady])

  return (
    <div className="title-scene" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        shadows="percentage"
        camera={{ fov: 47, near: 0.1, far: 140, position: [0, 8.6, 31] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <TitleCamera />
        <Suspense fallback={<FallbackSky />}>
          <SanctuaryVignette />
        </Suspense>
      </Canvas>
    </div>
  )
}
