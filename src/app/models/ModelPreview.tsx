'use client'

import { Bounds, Environment, Grid, OrbitControls, useBounds } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback } from 'react'
import type { Group } from 'three'
import { GameModel } from '@/render/assets/GameModel'
import type { AssetId, ModelState } from '@/render/assets/manifest'

function PreviewFallback() {
  return (
    <group position={[0, 0.8, 0]}>
      <mesh castShadow>
        <dodecahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color="#536172" wireframe />
      </mesh>
    </group>
  )
}

/** Refit only after the real GLB has replaced GameModel's small fallback. */
function PreviewAsset({ id, state }: { id: AssetId; state: ModelState }) {
  const bounds = useBounds()
  const fitLoadedModel = useCallback((_root: Group) => {
    requestAnimationFrame(() => bounds.refresh().clip().fit())
  }, [bounds])

  return (
    <GameModel
      id={id}
      state={state}
      fallback={<PreviewFallback />}
      onReady={fitLoadedModel}
    />
  )
}

export function ModelPreview({ id, state }: { id: AssetId; state: ModelState }) {
  return (
    <Canvas key={id} shadows camera={{ position: [5, 3.5, 7], fov: 42 }} dpr={[1, 1.75]}>
      <color attach="background" args={['#080c12']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[7, 10, 5]} intensity={2.2} castShadow />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.45}>
          <PreviewAsset id={id} state={state} />
        </Bounds>
        <Environment preset="warehouse" environmentIntensity={0.4} />
      </Suspense>
      <Grid
        infiniteGrid
        fadeDistance={80}
        fadeStrength={3}
        cellSize={1}
        sectionSize={5}
        cellColor="#243244"
        sectionColor="#5f7898"
      />
      <OrbitControls makeDefault target={[0, 1, 0]} minDistance={1.5} maxDistance={90} />
    </Canvas>
  )
}
