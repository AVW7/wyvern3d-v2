'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, LoopOnce, LoopRepeat } from 'three'
// From `three` directly, not three-stdlib: pnpm's strict node_modules does not
// hoist drei's transitive deps, so three-stdlib is not importable from here.
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type {
  AnimationAction,
  AnimationClip,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import {
  getAsset,
  type AssetEntry,
  type AssetId,
  type MaterialOverride,
  type ModelState,
} from './manifest'

/** Crossfade length between two states, in seconds. */
const FADE = 0.25

export interface ModelActionRequest {
  /** State whose mapped clip should interrupt the current base state once. */
  state: ModelState
  /** Changing this value retriggers the action, even for the same state. */
  token: number
}

/**
 * Repaints a cloned model's surfaces from the manifest's cosmetic override.
 *
 * The materials have to be cloned first: SkeletonUtils' clone copies the
 * hierarchy but keeps pointing at the cached source scene's materials, so
 * assigning to them in place would repaint every other model sharing that GLB
 * — which, since all five species share one file, means all of them.
 */
function repaint(root: Group, override: MaterialOverride): void {
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    const paint = (slot: Material): MeshStandardMaterial => {
      const material = slot.clone() as MeshStandardMaterial
      if (override.color) material.color.set(override.color)
      if (override.emissive) material.emissive.set(override.emissive)
      if (override.roughness !== undefined) material.roughness = override.roughness
      if (override.metalness !== undefined) material.metalness = override.metalness
      return material
    }
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(paint)
      : paint(mesh.material)
  })
}

/**
 * Resolves a logical asset id to a model, falling back to whatever placeholder
 * the caller supplies when no GLB is wired up yet.
 *
 * This component is the single seam between gameplay and art. Nothing else in
 * the codebase should call useGLTF.
 */
export function GameModel({
  id,
  fallback,
  state = 'idle',
  action,
  scale = 1,
  seed = 0,
  onReady,
  onActionFinished,
  frozen = false,
  children,
}: {
  id: AssetId
  /** Rendered when the manifest has no url for this id. */
  fallback: React.ReactNode
  /** Which clip from the manifest's animation map to play. */
  state?: ModelState
  /** A retriggerable one-shot that returns to the latest `state` when done. */
  action?: ModelActionRequest | null
  /**
   * Picks between interchangeable clips for a state. Pass anything stable and
   * per-entity — a roster index will do — so two wyverns on neighbouring
   * perches do not idle in lockstep.
   */
  seed?: number
  /**
   * Gameplay-driven size multiplier — life stage, for instance. Multiplies the
   * manifest's cosmetic fit rather than replacing it, so callers never need to
   * know how big the underlying model happens to be.
   */
  scale?: number
  /**
   * Fired once the model is loaded and its animations are ready. The passed
   * Object3D is the cloned mesh: it has the global transform and can be walked
   * for named bones, but all of its methods are synchronous and it is missing
   * the `.parent` pointer because `cloneSkinned` detaches it. Adding it to a
   * scene plugs `.parent` back in.
   */
  onReady?: (root: Group, mixer: AnimationMixer) => void
  /** Fired when an action clip finishes playing. */
  onActionFinished?: (request: ModelActionRequest) => void
  /** Freezes animation time for debugging. */
  frozen?: boolean
  children?: React.ReactNode
}) {
  const entry = getAsset(id)

  // Placeholder mode
  if (!entry || !entry.url) {
    return <>{fallback}</>
  }

  return (
    <Suspense fallback={fallback}>
      <LoadedModel
        url={entry.url}
        animationUrl={entry.animationUrl}
        scale={entry.scale * scale}
        yOffset={entry.yOffset}
        material={entry.material}
        animations={entry.animations}
        state={state}
        commandAction={action}
        seed={seed}
        onReady={onReady}
        onActionFinished={onActionFinished}
        frozen={frozen}
      >
        {children}
      </LoadedModel>
    </Suspense>
  )
}

function LoadedModel({
  url,
  animationUrl,
  scale,
  yOffset,
  animations: clips,
  material,
  state,
  commandAction,
  seed,
  onReady,
  onActionFinished,
  frozen,
  children,
}: Omit<AssetEntry, 'url'> & {
  url: string
  state: ModelState
  commandAction?: ModelActionRequest | null
  seed: number
  onReady?: (root: Group, mixer: AnimationMixer) => void
  onActionFinished?: (request: ModelActionRequest) => void
  frozen: boolean
  children?: React.ReactNode
}) {
  const { scene } = useGLTF(url) as { scene: Group }
  const animGltf = animationUrl ? useGLTF(animationUrl) : null
  const ref = useRef<Group>(null)

  const [mixer] = useState(() => new AnimationMixer(null!))

  const cloned = useMemo(() => {
    const root = cloneSkinned(scene) as Group
    if (material) repaint(root, material)
    return root
  }, [scene, material])

  const animsByName = useMemo(() => {
    const source = animGltf ? (animGltf.animations ?? []) : (scene.animations ?? [])
    const map = new Map<string, AnimationClip>()
    for (const clip of source) {
      map.set(clip.name, clip)
    }
    return map
  }, [scene.animations, animGltf])

  const stateWithFallback = state
  const stateSpec = clips?.[stateWithFallback]

  const [baseAction, setBaseAction] = useState<AnimationAction | null>(null)
  const [activeAction, setActiveAction] = useState<AnimationAction | null>(null)
  const [lastActionToken, setLastActionToken] = useState<number | null>(null)

  useEffect(() => {
    const spec =
      !stateSpec || Array.isArray(stateSpec)
        ? Array.isArray(stateSpec)
          ? stateSpec[seed % stateSpec.length]
          : undefined
        : stateSpec

    if (!spec) {
      if (baseAction) baseAction.stop()
      setBaseAction(null)
      return
    }

    const clip = animsByName.get(spec.clip)
    if (!clip) {
      if (baseAction) baseAction.stop()
      setBaseAction(null)
      return
    }

    const action = mixer.clipAction(clip)
    if (spec.loop === false) {
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
    } else {
      action.setLoop(LoopRepeat, Infinity)
    }

    const fadeIn = spec.fadeIn ?? FADE
    if (baseAction) baseAction.crossFadeTo(action, fadeIn, true)
    action.reset().play()

    setBaseAction(action)
  }, [stateWithFallback, stateSpec, seed, animsByName, mixer, baseAction])

  useEffect(() => {
    if (!commandAction) {
      if (activeAction) {
        activeAction.fadeOut(0.2)
        setActiveAction(null)
        setLastActionToken(null)
      }
      return
    }

    if (commandAction.token === lastActionToken) return
    setLastActionToken(commandAction.token)

    const spec = clips?.[commandAction.state]
    if (!spec) return

    const specResolved = (Array.isArray(spec) ? spec[0] : spec)!
    const clip = animsByName.get(specResolved.clip)
    if (!clip) return

    const action = mixer.clipAction(clip)
    const specObj = specResolved

    if (specObj.loop === false) {
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
    } else {
      action.setLoop(LoopRepeat, Infinity)
    }

    action.reset().play()
    if (activeAction) activeAction.crossFadeTo(action, 0.2, true)
    setActiveAction(action)
  }, [commandAction, clips, animsByName, mixer, lastActionToken, activeAction])

  useEffect(() => {
    const onFinished = () => {
      if (!activeAction || !onActionFinished || !lastActionToken || !commandAction) return
      const spec = clips?.[commandAction.state]
      if (!spec) return

      const specObj = (Array.isArray(spec) ? spec[0] : spec)!
      if (specObj.loop === false) {
        onActionFinished({ state: commandAction.state, token: lastActionToken })
      }
    }
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
  }, [activeAction, onActionFinished, lastActionToken, clips, commandAction])

  useFrame((_, dt) => {
    if (frozen) return
    mixer.update(dt)
  })

  useEffect(() => {
    if (ref.current && onReady) onReady(ref.current, mixer)
  }, [cloned, onReady, mixer])

  return (
    <group ref={ref} scale={scale} position={[0, yOffset ?? 0, 0]}>
      <primitive object={cloned} dispose={null} />
      {children}
    </group>
  )
}

import { useFrame } from '@react-three/fiber'

export function preloadAsset(id: AssetId): void {
  const entry = getAsset(id)
  if (!entry?.url) return
  useGLTF.preload(entry.url)
  if (entry.animationUrl) useGLTF.preload(entry.animationUrl)
}
