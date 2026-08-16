'use client'

import { Bounds, Environment, Grid, OrbitControls, useBounds } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  AnimationMixer,
  Bone,
  Mesh,
  Object3D,
  type Box3,
  type Group,
  type Material,
  type MeshStandardMaterial,
  type SkinnedMesh,
  type Sphere,
} from 'three'
import { GameModel } from '@/render/assets/GameModel'
import type { AssetId, ModelState } from '@/render/assets/manifest'
import type { PlaybackRate } from './components/StageControls'

export interface ModelStats {
  triangles: number
  bones: number
  materials: number
  boneNames: string[]
}

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
  paused,
  rate,
  wireframe,
  onLoadStats,
}: {
  id: AssetId
  state: ModelState
  paused: boolean
  rate: PlaybackRate
  wireframe: boolean
  onLoadStats?: (stats: ModelStats) => void
}) {
  const bounds = useBounds()
  const modelRoot = useRef<Group | null>(null)
  const mixerRef = useRef<AnimationMixer | null>(null)
  /**
   * Frames left to wait before measuring, counted down in `useFrame`. A
   * `requestAnimationFrame` scheduled from `onReady` lands before R3F has
   * rendered the newly mounted model, so the skeleton has not been posed yet.
   */
  const framesUntilFit = useRef(0)
  /** Bumped on every load so the wireframe effect re-applies to the new root. */
  const [loaded, setLoaded] = useState(0)

  useFrame(() => {
    // Playback rate is applied at the mixer, not per action, so manifest
    // `ClipSpec.timeScale` cadences still apply on top of the preview rate.
    const mixer = mixerRef.current
    if (mixer && mixer.timeScale !== rate) mixer.timeScale = rate

    if (framesUntilFit.current === 0) return
    framesUntilFit.current -= 1
    if (framesUntilFit.current > 0) return

    // three caches a SkinnedMesh's object-level bounding box the first time
    // `Box3.expandByObject` asks for it, and `Bounds` asks on mount — before
    // the skeleton has been posed, which measured the wyvern as a 0.04-unit
    // slab instead of the 15.8 it stands and parked the camera inside the
    // model. Nothing invalidates that cache afterwards, so a later refresh
    // reuses the same wrong box; dropping it forces the skinning-aware
    // recompute in `SkinnedMesh.computeBoundingBox`.
    modelRoot.current?.traverse((child: Object3D) => {
      const skinned = child as SkinnedMesh
      if (!skinned.isSkinnedMesh) return
      // three initialises and invalidates both to null at runtime; only the
      // published types insist they are always present.
      const cache = skinned as unknown as { boundingBox: Box3 | null; boundingSphere: Sphere | null }
      cache.boundingBox = null
      cache.boundingSphere = null
    })
    bounds.refresh().clip().fit()
  })

  // The wireframe toggle only ever touches materials this preview instance
  // owns (cloned at load, below), so the debug view can never leak into the
  // GLTF cache other scenes share.
  useEffect(() => {
    const root = modelRoot.current
    if (!root) return
    root.traverse((child: Object3D) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const paint = (slot: Material) => {
        if ('wireframe' in slot) (slot as MeshStandardMaterial).wireframe = wireframe
      }
      if (Array.isArray(mesh.material)) mesh.material.forEach(paint)
      else paint(mesh.material)
    })
  }, [wireframe, loaded])

  const fitLoadedModel = useCallback((root: Group, mixer: AnimationMixer) => {
    modelRoot.current = root
    mixerRef.current = mixer
    framesUntilFit.current = 2
    setLoaded((tick) => tick + 1)
    let triangles = 0
    let bones = 0
    const boneNames: string[] = []
    const materialsSet = new Set<string>()
    root.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        // Own the materials before any debug view can reach them:
        // SkeletonUtils clones share materials with the cached GLTF scene,
        // and mutating `wireframe` in place would flip the same toggle in
        // every other scene that mounts this file.
        const own = (slot: Material): Material => slot.clone()
        child.material = Array.isArray(child.material)
          ? child.material.map(own)
          : own(child.material)
        const geom = child.geometry
        if (geom) {
          if (geom.index) {
            triangles += geom.index.count / 3
          } else if (geom.attributes?.position) {
            triangles += geom.attributes.position.count / 3
          }
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((m) => {
          if (m.name) materialsSet.add(m.name)
          else if (m.uuid) materialsSet.add(m.uuid)
        })
      }
      if (child instanceof Bone) {
        bones++
        if (child.name) boneNames.push(child.name)
      }
    })
    onLoadStats?.({
      triangles: Math.round(triangles),
      bones,
      materials: materialsSet.size,
      boneNames: boneNames.sort(),
    })
  }, [onLoadStats])

  return (
    <GameModel
      id={id}
      state={state}
      fallback={<PreviewFallback />}
      onReady={fitLoadedModel}
      frozen={paused}
    />
  )
}

export function ModelPreview({
  id,
  state,
  paused = false,
  rate = 1,
  turntable = false,
  wireframe = false,
  onLoadStats,
}: {
  id: AssetId
  state: ModelState
  /** Freezes animation time so a pose can be read at leisure. */
  paused?: boolean
  /** Mixer-level playback multiplier for cycle inspection. */
  rate?: PlaybackRate
  /** Spins the camera around the model. */
  turntable?: boolean
  /** Renders the instance-owned materials as wireframe. */
  wireframe?: boolean
  onLoadStats?: (stats: ModelStats) => void
}) {
  return (
    <Canvas key={id} shadows camera={{ position: [5, 3.5, 7], fov: 42 }} dpr={[1, 1.75]}>
      <color attach="background" args={['#080c12']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[7, 10, 5]} intensity={2.2} castShadow />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.45}>
          <PreviewAsset
            id={id}
            state={state}
            paused={paused}
            rate={rate}
            wireframe={wireframe}
            onLoadStats={onLoadStats}
          />
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
      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        minDistance={1.5}
        maxDistance={90}
        autoRotate={turntable}
        autoRotateSpeed={0.9}
      />
    </Canvas>
  )
}
