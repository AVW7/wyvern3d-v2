'use client'

import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'

// Prevent Drei's useGLTF from garbage collecting during Next.js fast-refresh.
// When components unmount and remount in Strict Mode, it clears the cache and revokes blob: URLs.
if (process.env.NODE_ENV === 'development') {
  useGLTF.clear = () => {}
}

import { useFrame } from '@react-three/fiber'
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
  type ClipSpec,
  type MaterialOverride,
  type ModelState,
} from './manifest'
import {
  canReuseLoopAction,
  normalizedPlaybackPhase,
  resolveClipSpec,
  resolvePlantSpec,
  shouldApplyNext,
} from './gameModelPlayback'
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
    <ModelErrorBoundary assetId={id} fallback={fallback}>
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
    </ModelErrorBoundary>
  )
}

/**
 * A missing or malformed GLB throws while rendering, and `Suspense` only
 * catches promises — so without this the whole persistent canvas unmounts and
 * the screen goes blank. Every asset slot already has a procedural fallback for
 * the `url: null` case; this routes a failed *load* to that same fallback, so a
 * manifest entry pointing at an asset that has not been produced yet degrades
 * to a placeholder instead of taking down the game.
 */
class ModelErrorBoundary extends Component<
  { assetId: AssetId; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[GameModel] "${this.props.assetId}" failed to load; using placeholder.`, error, info)
  }

  override render() {
    return this.state.failed ? <>{this.props.fallback}</> : <>{this.props.children}</>
  }
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

  const currentAction = useRef<AnimationAction | null>(null)
  const currentSpec = useRef<ClipSpec | null>(null)
  const currentWasOverride = useRef(false)

  // The base state actually playing can differ from gameplay's request: a
  // takeoff with `next: 'cruise'` hands off cosmetically while gameplay remains
  // in `fly`. A command action temporarily overrides this base, then returns to
  // the latest controlled state when its exact mixer action finishes.
  const [active, setActive] = useState<ModelState>(state)
  const [override, setOverride] = useState<ModelActionRequest | null>(null)
  const requestedState = useRef(state)
  requestedState.current = state
  useEffect(() => setActive(state), [state])
  useEffect(() => {
    if (!commandAction) {
      setOverride(null)
      return
    }
    setOverride((current) => current?.token === commandAction.token ? current : commandAction)
  }, [commandAction])

  /** The one manifest spec whose pose is on screen. */
  const playingState = override?.state ?? active
  const chainedFrom = override === null ? active : null
  const playingSpec = useMemo(() => {
    return resolveClipSpec(clips?.[playingState], seed)
  }, [clips, playingState, seed])

  /** Where the model is planted — see `resolvePlantSpec` for why this is the
   * base state's offset and not the playing tell's. */
  const plantSpec = useMemo(() => {
    return resolvePlantSpec(playingSpec, resolveClipSpec(clips?.[active], seed), override !== null)
  }, [active, clips, override, playingSpec, seed])

  useEffect(() => {
    if (!playingSpec) {
      currentAction.current?.fadeOut(FADE)
      currentAction.current = null
      currentSpec.current = null
      currentWasOverride.current = false
      return
    }
    const clip = animsByName.get(playingSpec.clip)
    if (!clip) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[GameModel] ${url} has no clip "${playingSpec.clip}". Available: ${[...animsByName.keys()].join(', ')}`,
        )
      }
      return
    }

    const action = mixer.clipAction(clip)
    // Command actions always interrupt once, even if their ordinary base-state
    // mapping is a loop. Manifest one-shots behave the same way.
    const once = override !== null || playingSpec.loop === false
    const previous = currentAction.current
    const previousSpec = currentSpec.current

    // Alias states can resolve to the same loop. Do not reset it just because
    // gameplay changed the label from cruise to huntCarry, for example.
    if (
      override === null &&
      !once &&
      previous === action &&
      canReuseLoopAction(
        currentWasOverride.current,
        override !== null,
        previousSpec?.phaseGroup,
        playingSpec.phaseGroup,
      )
    ) {
      action.timeScale = playingSpec.timeScale ?? 1
      currentSpec.current = playingSpec
      return
    }

    const previousDuration = previous?.getClip().duration ?? 0
    const synchronizedPhase =
      !once &&
      previous &&
      previousSpec?.loop !== false &&
      playingSpec.phaseGroup !== undefined &&
      previousSpec?.phaseGroup === playingSpec.phaseGroup &&
      previousDuration > 0
        ? normalizedPlaybackPhase(previous.time, previousDuration)
        : null

    action.reset()
    if (synchronizedPhase !== null) action.time = synchronizedPhase * clip.duration
    action.timeScale = playingSpec.timeScale ?? 1
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
    action.clampWhenFinished = once
    const fade = playingSpec.fadeIn ?? FADE
    action.play()
    if (previous && previous !== action) action.crossFadeFrom(previous, fade, true)
    else action.fadeIn(fade)
    currentAction.current = action
    currentSpec.current = playingSpec
    currentWasOverride.current = override !== null

    const chained = chainedFrom !== null && once ? playingSpec.next : undefined
    if (!chained && override === null) return

    // Mixer events fire once and outside useFrame. Filtering by action identity
    // prevents an unrelated base one-shot from completing the command channel.
    const advance = (event: { action: AnimationAction }) => {
      if (event.action !== action) return
      if (override) {
        const completed = override
        setOverride(null)
        onActionFinished?.(completed)
      } else if (chained && chainedFrom && shouldApplyNext(requestedState.current, chainedFrom)) {
        setActive(chained)
      }
    }
    mixer.addEventListener('finished', advance)
    return () => mixer.removeEventListener('finished', advance)
  }, [animsByName, chainedFrom, mixer, onActionFinished, override, playingSpec, url])

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
    // multiply has to be explicit. The planting clip's offset wins over the
    // asset's, since each pose reaches a different distance below the origin —
    // see `plantSpec` for why that is the base state's clip, not the tell's.
    <group ref={ref} scale={scale} position={[0, (plantSpec?.yOffset ?? yOffset ?? 0) * scale, 0]}>
      <primitive object={cloned} dispose={null} />
      {children}
    </group>
  )
}
