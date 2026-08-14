'use client'

import { Bounds, Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { BIOME_PROP_ATLAS } from '@/render/assets/manifest'
import { Prop } from '@/render/assets/props'

/**
 * A 1.6 m stand-in for the player, beside the prop.
 *
 * The whole point of the biome atlas's authored `targetHeight` is that a prop
 * reads at a believable size next to a person, and a preview that frames each
 * prop to fill the viewport hides exactly that. This is the metre stick.
 */
function HumanReference({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.22, 1.0, 4, 12]} />
        <meshStandardMaterial color="#4a5a72" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#5d6f8a" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function BiomePropPreview({ id, height }: { id: string; height: number }) {
  // Stand the reference figure clear of the prop's own footprint.
  const referenceX = Math.max(1.5, height * 0.45)

  return (
    <Canvas
      key={id}
      shadows
      camera={{ position: [height * 1.1 + 3, height * 0.75 + 1.5, height * 1.4 + 4], fov: 40 }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={['#080c12']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 6]} intensity={2.1} castShadow />
      <hemisphereLight args={['#9fb4c9', '#20262f', 0.6]} />

      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.5}>
          <Prop id={id} atlas={BIOME_PROP_ATLAS} position={[0, 0, 0]} />
          <HumanReference x={referenceX} />
        </Bounds>
      </Suspense>

      <Grid
        infiniteGrid
        fadeDistance={Math.max(40, height * 6)}
        fadeStrength={3}
        cellSize={1}
        sectionSize={5}
        cellColor="#243244"
        sectionColor="#5f7898"
      />
      <OrbitControls makeDefault target={[0, height * 0.4, 0]} minDistance={1.2} maxDistance={Math.max(60, height * 8)} />
    </Canvas>
  )
}
