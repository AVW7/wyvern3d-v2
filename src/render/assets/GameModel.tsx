'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import { LoopOnce, LoopRepeat } from 'three'
// From `three` directly, not three-stdlib: pnpm's strict node_modules does not
// hoist drei's transitive deps, so three-stdlib is not importable from here.
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import {
  getAsset,
  type AssetEntry,
  type ClipSpec,
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
  id: string
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
   * Receives this instance's cloned hierarchy after it has mounted, plus the
   * mixer driving it. Most callers only want the root — the mixer is there for
   * the development flight lab, which scrubs and reports playback time.
   */
  onReady?: (root: Group, mixer: AnimationMixer) => void
  /** Fires after the requested one-shot reaches its authored final frame. */
  onActionFinished?: (request: ModelActionRequest) => void
  /**
   * Mixer LOD: stops advancing this instance's clip playback entirely (the
   * pose holds at whatever frame it was on) without unmounting it. For
   * distant or culled instances in a large battle — never for anything the
   * player is actively looking at.
   */
  frozen?: boolean
  children?: React.ReactNode
}) {
  const { url, scale: fit, ...rest } = getAsset(id)

  if (!url) return <>{fallback}</>

  return (
    <Suspense fallback={fallback}>
      <LoadedModel
        url={url}
        scale={fit * scale}
        {...rest}
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
  const { scene, animations } = useGLTF(url)
  const { animations: sidecarAnimations } = useGLTF(animationUrl ?? url)
  const availableAnimations = useMemo(
    () => (animationUrl ? [...animations, ...sidecarAnimations] : animations),
    [animationUrl, animations, sidecarAnimations],
  )

  // SkeletonUtils' clone is mandatory here. A plain scene.clone() silently
  // breaks skinned meshes — every copy ends up sharing (and fighting over) one
  // skeleton, which is the classic "why is my second dragon inside-out" bug.
  const cloned = useMemo(() => {
    const copy = cloneSkinned(scene) as Group
    if (material) repaint(copy, material)
    return copy
  }, [scene, material])

  // The mixer binds to the wrapper group, so it resolves tracks against this
  // instance's cloned bones rather than the shared cached ones.
  const root = useRef<Group>(null)
  const relevantAnimations = useMemo(() => {
    if (!clips) return []
    const names = new Set<string>()
    for (const entry of Object.values(clips)) {
      if (!entry) continue
      const specs = Array.isArray(entry) ? entry : [entry]
      for (const item of specs) names.add(item.clip)
    }
    return availableAnimations.filter((clip: AnimationClip) => names.has(clip.name))
  }, [availableAnimations, clips])
  const { actions, mixer } = useAnimations(relevantAnimations, root)
  const currentAction = useRef<AnimationAction | null>(null)
  const currentSpec = useRef<ClipSpec | null>(null)

  // Mixer LOD: drei's useAnimations unconditionally calls mixer.update(delta)
  // every frame for every mounted instance. Gating timeScale to 0 is the
  // cheapest way to stop a distant/culled instance's pose from advancing
  // without unmounting (and thus losing) it.
  useEffect(() => {
    mixer.timeScale = frozen ? 0 : 1
  }, [mixer, frozen])

  // The state actually playing, which is not always the one gameplay asked for:
  // a one-shot with a `next` hands off when it finishes, so `fly` plays the
  // takeoff and then runs on as `airborne`. Gameplay stays unaware of the
  // transition; asking again for the same state re-enters at the takeoff.
  const [active, setActive] = useState<ModelState>(state)
  const [override, setOverride] = useState<ModelActionRequest | null>(null)
  const requestedState = useRef(state)
  requestedState.current = state
  useEffect(() => setActive(state), [state])
  useEffect(() => {
    if (commandAction) setOverride(commandAction)
  }, [commandAction])

  useEffect(() => {
    if (root.current) onReady?.(root.current, mixer)
  }, [cloned, mixer, onReady])

  const spec = useMemo(() => {
    const entry = clips?.[override?.state ?? active]
    if (!entry) return undefined
    if (!Array.isArray(entry)) return entry
    return entry[Math.abs(Math.trunc(seed)) % entry.length]
  }, [clips, active, override, seed])

  useEffect(() => {
    if (!spec) {
      currentAction.current?.fadeOut(FADE)
      currentAction.current = null
      currentSpec.current = null
      return
    }
    const action = actions[spec.clip]
    if (!action) {
      // Worth shouting about: a renamed clip fails silently otherwise, and the
      // model just stands frozen with no hint as to why.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[GameModel] ${url} has no clip "${spec.clip}". Available: ${Object.keys(actions).join(', ')}`,
        )
      }
      return
    }

    // A command action always plays exactly once, even when its normal state is
    // a training loop (eat/attack). The token can restart it at any time.
    const once = override !== null || spec.loop === false
    const previous = currentAction.current
    const previousSpec = currentSpec.current
    if (
      override === null &&
      !once &&
      previous === action &&
      previousSpec?.phaseGroup === spec.phaseGroup
    ) {
      action.timeScale = spec.timeScale ?? 1
      currentSpec.current = spec
      return
    }

    const previousDuration = previous?.getClip().duration ?? 0
    const synchronizedPhase =
      !once &&
      previous &&
      previousSpec &&
      previousSpec.loop !== false &&
      spec.phaseGroup !== undefined &&
      previousSpec.phaseGroup === spec.phaseGroup &&
      previousDuration > 0
        ? (previous.time % previousDuration) / previousDuration
        : null

    action.reset()
    if (synchronizedPhase !== null) {
      action.time = synchronizedPhase * action.getClip().duration
    }
    action.timeScale = spec.timeScale ?? 1
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
    // Without this a one-shot snaps back to frame 0 on its last tick, which on a
    // death is a corpse standing up again.
    action.clampWhenFinished = once
    const fade = spec.fadeIn ?? FADE
    action.play()
    if (previous && previous !== action) {
      action.crossFadeFrom(previous, fade, true)
    } else {
      action.fadeIn(fade)
    }
    currentAction.current = action
    currentSpec.current = spec

    const chained = override === null && once ? spec.next : undefined
    if (!chained && override === null) return

    // A mixer event, not a per-frame one: it fires once when the clip ends, so
    // this is not the useFrame setState trap.
    const advance = (event: { action: unknown }) => {
      if (event.action !== action) return
      if (override) {
        const completed = override
        setOverride(null)
        onActionFinished?.(completed)
      }
      // Do not let a just-finished transition overwrite a newer director
      // state (for example fly -> airborne arriving on the final takeoff frame).
      else if (chained && requestedState.current === active) setActive(chained)
    }
    mixer.addEventListener('finished', advance)
    return () => {
      mixer.removeEventListener('finished', advance)
    }
  }, [actions, active, mixer, onActionFinished, override, spec, url])

  return (
    // yOffset scales with the model: it corrects for where the rig's origin
    // sits relative to its feet, which is a distance in model units, so a
    // half-size juvenile needs half the correction. The playing clip's own
    // offset wins, since each pose reaches a different distance below the rig.
    <group ref={root} position={[0, (spec?.yOffset ?? yOffset) * scale, 0]} scale={scale}>
      <primitive object={cloned} />
      {children}
    </group>
  )
}

/** Warms the cache for models that are about to be needed. */
export function preloadAsset(id: string): void {
  const entry = getAsset(id)
  if (entry.url) useGLTF.preload(entry.url)
  if (entry.animationUrl) useGLTF.preload(entry.animationUrl)
}
