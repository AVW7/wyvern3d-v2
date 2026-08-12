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
import { useModelLibraryStore } from '@/state/modelLibraryStore'

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
  manualMixer = false,
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
  /** When true, parent container updates mixer manually before applying bone offsets. */
  manualMixer?: boolean
  children?: React.ReactNode
}) {
  const entry = getAsset(id)
  const enabled = useModelLibraryStore((library) => library.disabled[id] !== true)

  // Placeholder mode
  if (!enabled || !entry || !entry.url) {
    return <>{fallback}</>
  }

  return (
    <Suspense fallback={fallback}>
      <LoadedModel
        url={entry.url}
        animationUrl={entry.animationUrl}
        animationUrls={entry.animationUrls}
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
        manualMixer={manualMixer}
      >
        {children}
      </LoadedModel>
    </Suspense>
  )
}

function LoadedModel({
  url,
  animationUrl,
  animationUrls,
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
  manualMixer,
  children,
}: Omit<AssetEntry, 'url'> & {
  url: string
  state: ModelState
  commandAction?: ModelActionRequest | null
  seed: number
  onReady?: (root: Group, mixer: AnimationMixer) => void
  onActionFinished?: (request: ModelActionRequest) => void
  frozen: boolean
  manualMixer?: boolean
  children?: React.ReactNode
}) {
  const { scene, animations } = useGLTF(url) as { scene: Group; animations: AnimationClip[] }
  const animGltf = animationUrl ? (useGLTF(animationUrl) as { animations: AnimationClip[] }) : null
  const animGltfs = useGLTF(animationUrls ?? []) as { animations: AnimationClip[] }[]
  const ref = useRef<Group>(null)

  const cloned = useMemo(() => {
    const root = cloneSkinned(scene) as Group
    if (material) repaint(root, material)
    return root
  }, [scene, material])

  // The mixer must bind directly to this instance's SkeletonUtils clone. Binding
  // to null makes clipAction throw in three.js; binding to the cached source
  // would animate the shared GLTF rather than this mounted wyvern.
  const mixer = useMemo(() => new AnimationMixer(cloned), [cloned])

  const animsByName = useMemo(() => {
    // GLTFLoader returns animations on the GLTF payload, never on `scene`.
    const source = animationUrls?.length
      ? animGltfs.flatMap((gltf) => gltf.animations)
      : animGltf
        ? animGltf.animations
        : animations
    const map = new Map<string, AnimationClip>()
    for (const clip of source) {
      map.set(clip.name, clip)
    }
    return map
  }, [animations, animationUrls, animGltf, animGltfs])

  const stateWithFallback = state
  const stateSpec = clips?.[stateWithFallback]

  /**
   * The spec whose pose is actually on screen — a one-shot action overrides the
   * base state for as long as it plays. Resolved here, rather than only inside
   * the effects below, because the render needs its `yOffset`. The two branches
   * mirror how each effect picks from a clip pool, so the offset always belongs
   * to the clip the mixer is playing.
   */
  const playingSpec = useMemo(() => {
    const override = commandAction ? clips?.[commandAction.state] : undefined
    if (override) return Array.isArray(override) ? override[0] : override
    if (!stateSpec) return undefined
    return Array.isArray(stateSpec) ? stateSpec[seed % stateSpec.length] : stateSpec
  }, [clips, commandAction, stateSpec, seed])

  const [, setBaseAction] = useState<AnimationAction | null>(null)
  const [activeAction, setActiveAction] = useState<AnimationAction | null>(null)
  const [lastActionToken, setLastActionToken] = useState<number | null>(null)
  const prevActionRef = useRef<AnimationAction | null>(null)

  useEffect(() => {
    const spec =
      !stateSpec || Array.isArray(stateSpec)
        ? Array.isArray(stateSpec)
          ? stateSpec[seed % stateSpec.length]
          : undefined
        : stateSpec

    if (!spec) {
      if (prevActionRef.current) prevActionRef.current.stop()
      prevActionRef.current = null
      setBaseAction(null)
      return
    }

    const clip = animsByName.get(spec.clip)
    if (!clip) {
      if (prevActionRef.current) prevActionRef.current.stop()
      prevActionRef.current = null
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
    const prev = prevActionRef.current
    if (prev && prev !== action) {
      prev.crossFadeTo(action, fadeIn, true)
    }
    action.reset().play()

    prevActionRef.current = action
    setBaseAction(action)
  }, [stateWithFallback, stateSpec, seed, animsByName, mixer])

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
    if (frozen || manualMixer) return
    mixer.update(dt)
  })

  useEffect(() => {
    if (ref.current && onReady) onReady(ref.current, mixer)
  }, [cloned, onReady, mixer])

  return (
    // The offset is multiplied by `scale` because it corrects for where the
    // rig's origin sits relative to its feet — a distance in model units, so a
    // half-size juvenile needs half the correction. `position` is in the
    // parent's space, so this group's own `scale` does not apply to it and the
    // multiply has to be explicit. The playing clip's offset wins over the
    // asset's, since each pose reaches a different distance below the origin.
    <group ref={ref} scale={scale} position={[0, (playingSpec?.yOffset ?? yOffset ?? 0) * scale, 0]}>
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
  if (entry.animationUrls) useGLTF.preload(entry.animationUrls)
}
