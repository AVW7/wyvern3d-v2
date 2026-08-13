'use client'

import { Bounds, Environment, Grid, OrbitControls, useBounds } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback } from 'react'
import { Bone, Mesh, Object3D, type Group } from 'three'
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
function PreviewAsset({
  id,
  state,
  onLoadStats,
}: {
  id: AssetId
  state: ModelState
  onLoadStats?: (stats: { triangles: number; bones: number; materials: number; boneNames: string[] }) => void
}) {
  const bounds = useBounds()
  const fitLoadedModel = useCallback((root: Group) => {
    requestAnimationFrame(() => bounds.refresh().clip().fit())
    if (onLoadStats) {
      let triangles = 0
      let bones = 0
      const boneNames: string[] = []
      const materialsSet = new Set<string>()
      root.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          const geom = child.geometry
          if (geom) {
            if (geom.index) {
              triangles += geom.index.count / 3
            } else if (geom.attributes?.position) {
              triangles += geom.attributes.position.count / 3
            }
          }
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((m) => {
              if (m.name) materialsSet.add(m.name)
              else if (m.uuid) materialsSet.add(m.uuid)
            })
          }
        }
        if (child instanceof Bone) {
          bones++
          if (child.name) {
            boneNames.push(child.name)
          }
        }
      })
      onLoadStats({
        triangles: Math.round(triangles),
        bones,
        materials: materialsSet.size,
        boneNames: boneNames.sort(),
      })
    }
  }, [bounds, onLoadStats])

  return (
    <GameModel
      id={id}
      state={state}
      fallback={<PreviewFallback />}
      onReady={fitLoadedModel}
    />
  )
}

export function ModelPreview({
  id,
  state,
  onLoadStats,
}: {
  id: AssetId
  state: ModelState
  onLoadStats?: (stats: { triangles: number; bones: number; materials: number; boneNames: string[] }) => void
}) {
  return (
    <Canvas key={id} shadows camera={{ position: [5, 3.5, 7], fov: 42 }} dpr={[1, 1.75]}>
      <color attach="background" args={['#080c12']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[7, 10, 5]} intensity={2.2} castShadow />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.45}>
          <PreviewAsset id={id} state={state} onLoadStats={onLoadStats} />
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
