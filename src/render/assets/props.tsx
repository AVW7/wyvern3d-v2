'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Matrix4, Quaternion, Vector3 } from 'three'
import type { BufferGeometry, InstancedMesh, Material, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { FOOD_PROP_ATLAS, PROP_ATLAS } from './manifest'

/**
 * Static scenery props, drawn from the shared prop atlas.
 *
 * The atlas is one GLB built by scripts/extract-assets.py: every prop is a
 * top-level node named by its logical id, and all of them share a single
 * material and palette texture. That is what makes <PropInstances> worth
 * having — a hundred fir trees are one draw call, and the trees, the walls and
 * the anvil all batch against the same material.
 *
 * This and GameModel.tsx are the only files that call useGLTF. They exist
 * separately because they solve opposite problems: GameModel clones skinned
 * creature rigs one at a time, these are static geometry drawn en masse.
 */

export interface PropPlacement {
  /** World position, in metres. Props are anchored centred and resting on y=0. */
  position: [number, number, number]
  /** Yaw, radians. Props have no meaningful pitch or roll. */
  rotationY?: number
  scale?: number
}

interface PropTemplate {
  geometry: BufferGeometry
  material: Material
}

/**
 * There is one static atlas for this module, so there must also be exactly one
 * derived template map. useMemo is local to a component; using it alone would
 * clone all 57 geometries once per <Prop> and exhaust the WebGL context.
 */
let templateCache: Map<string, PropTemplate> | null = null

/**
 * Prop id -> geometry, with the node's own transform baked in.
 *
 * Baking matters: InstancedMesh applies one matrix per instance, so the prop's
 * authored scale and ground-rest offset have to live in the geometry or every
 * caller would have to re-apply them.
 */
function usePropTemplates(): Map<string, PropTemplate> {
  const { scene } = useGLTF(PROP_ATLAS)

  return useMemo(() => {
    if (templateCache) return templateCache

    const templates = new Map<string, PropTemplate>()
    scene.updateMatrixWorld(true)

    scene.traverse((object: Object3D) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return

      const geometry = mesh.geometry.clone()
      geometry.applyMatrix4(mesh.matrixWorld)
      geometry.computeBoundingSphere()
      // GLTFLoader sanitizes Object3D.name (`prop.keep.wall` becomes
      // `propkeepwall`). It preserves the authored glTF node name verbatim in
      // userData.name, which is the logical id callers use.
      const id = typeof mesh.userData.name === 'string' ? mesh.userData.name : mesh.name
      templates.set(id, { geometry, material: mesh.material as Material })
    })

    templateCache = templates
    return templates
  }, [scene])
}

/**
 * All props share one material, so changing the look of one prop id must clone
 * that material rather than mutate it in place — otherwise every other prop
 * drawn from the atlas changes too. Cached per (source material, variant key)
 * so repeated instances of the same variant still share one clone, and so the
 * number of shader programs stays bounded no matter how many props ask.
 */
const variantCache = new Map<Material, Map<string, Material>>()

function variantMaterial(
  base: Material,
  key: string,
  apply: (material: MeshStandardMaterial) => void,
): Material {
  let byKey = variantCache.get(base)
  if (!byKey) {
    byKey = new Map()
    variantCache.set(base, byKey)
  }
  let variant = byKey.get(key)
  if (!variant) {
    variant = base.clone()
    apply(variant as MeshStandardMaterial)
    byKey.set(key, variant)
  }
  return variant
}

/**
 * Shared wind clock, in seconds.
 *
 * One object, referenced by every swaying material's shader uniform, advanced
 * once per frame by <SanctuaryWind>. This is the whole reason foliage motion is
 * affordable: `PropInstances` writes its matrices once on mount and must keep
 * doing so — pushing a few hundred instance matrices per frame would cost more
 * than the rest of the scene, so the sway lives in the vertex shader instead.
 */
export const WIND_CLOCK = { value: 0 }

/**
 * Adds a root-planted sway to a material.
 *
 * Displacement scales with the vertex's height above the prop's own base, so
 * roots stay planted and tips move most — every atlas prop rests on y=0, which
 * is what makes local `y` usable directly. Each instance takes its phase from
 * its own translation column, so a field of grass ripples rather than pulsing
 * in unison.
 *
 * Known limitation: three renders the shadow pass with its own depth material,
 * which does not carry this `onBeforeCompile`, so a swaying prop casts a static
 * shadow. That is why the amplitudes in `WIND_STRENGTH` are small and why grass
 * — the strongest sway by far — is excluded from the shadow pass entirely. Only
 * the firs both sway and cast, and at ~0.2m of crown travel against a 6cm
 * shadow texel the mismatch is not readable. Raise those amplitudes and it will
 * become so.
 */
function applyWind(material: MeshStandardMaterial, strength: number): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = WIND_CLOCK
    shader.uniforms.uWindStrength = { value: strength }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime;
        uniform float uWindStrength;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 windOrigin = vec3(0.0);
          #ifdef USE_INSTANCING
            windOrigin = instanceMatrix[3].xyz;
          #endif
          float phase = windOrigin.x * 0.31 + windOrigin.z * 0.27;
          float gust = 0.65 + 0.35 * sin(uWindTime * 0.37 + windOrigin.x * 0.05);
          float sway = sin(uWindTime * 1.6 + phase);
          float reach = max(transformed.y, 0.0) * uWindStrength * gust;
          transformed.x += sway * reach;
          transformed.z += cos(uWindTime * 1.1 + phase) * reach * 0.55;
        }`,
      )
  }
  // Without a distinct cache key this variant would reuse the base material's
  // compiled program and the sway would silently never appear.
  material.customProgramCacheKey = () => `wind:${strength}`
}

/** Self-illumination for props that are meant to be a light source. */
export interface PropEmissive {
  color: string
  intensity: number
}

function propMaterial(
  base: Material,
  color?: string,
  emissive?: PropEmissive,
  wind?: number,
): Material {
  if (!color && !emissive && !wind) return base
  const key = `c:${color ?? ''}|e:${
    emissive ? `${emissive.color}:${emissive.intensity}` : ''
  }|w:${wind ?? ''}`
  return variantMaterial(base, key, (material) => {
    if (color) material.color?.set(color)
    if (emissive) {
      material.emissive?.set(emissive.color)
      material.emissiveIntensity = emissive.intensity
    }
    if (wind) applyWind(material, wind)
  })
}

/** A single prop. For more than a handful of copies, use <PropInstances>. */
export function Prop({
  id,
  position,
  rotationY = 0,
  scale = 1,
  castShadow = true,
  color,
  emissive,
  wind,
}: PropPlacement & {
  id: string
  castShadow?: boolean
  color?: string
  emissive?: PropEmissive
  wind?: number
}) {
  const template = usePropTemplates().get(id)
  const material = useMemo(
    () => (template ? propMaterial(template.material, color, emissive, wind) : undefined),
    [template, color, emissive, wind],
  )
  if (!template) return null

  return (
    <mesh
      geometry={template.geometry}
      material={material}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
      castShadow={castShadow}
      receiveShadow
    />
  )
}

export type FoodPropId = 'prop.food.meat' | 'prop.food.carcass'

/** A static food model from the compact original food atlas. */
export function FoodProp({
  id,
  position,
  rotationY = 0,
  scale = 1,
  castShadow = true,
}: PropPlacement & { id: FoodPropId; castShadow?: boolean }) {
  const { scene } = useGLTF(FOOD_PROP_ATLAS)
  const model = useMemo(() => {
    let source: Object3D | null = null
    scene.traverse((object) => {
      if (object.userData.name === id) source = object
    })
    if (!source) return null
    const clone = (source as Object3D).clone(true)
    clone.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = castShadow
        mesh.receiveShadow = true
      }
    })
    return clone
  }, [castShadow, id, scene])
  if (!model) return null

  return (
    <primitive
      object={model}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    />
  )
}

const MATRIX = new Matrix4()
const POSITION = new Vector3()
const ROTATION = new Quaternion()
const SCALE = new Vector3()
const UP = new Vector3(0, 1, 0)

/**
 * Many copies of one prop in a single draw call.
 *
 * Placements are static, so matrices are written once on mount rather than in
 * useFrame — nothing here animates, and per-frame matrix churn on a few hundred
 * instances would cost more than the whole rest of the scene.
 */
export function PropInstances({
  id,
  items,
  castShadow = true,
  color,
  emissive,
  wind,
}: {
  id: string
  items: PropPlacement[]
  castShadow?: boolean
  color?: string
  emissive?: PropEmissive
  /** Sway amplitude per metre of height. Omit for rigid props. */
  wind?: number
}) {
  const ref = useRef<InstancedMesh>(null)
  const template = usePropTemplates().get(id)
  const material = useMemo(
    () => (template ? propMaterial(template.material, color, emissive, wind) : undefined),
    [template, color, emissive, wind],
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return

    items.forEach((item, i) => {
      POSITION.set(...item.position)
      ROTATION.setFromAxisAngle(UP, item.rotationY ?? 0)
      SCALE.setScalar(item.scale ?? 1)
      mesh.setMatrixAt(i, MATRIX.compose(POSITION, ROTATION, SCALE))
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  if (!template || items.length === 0) return null

  return (
    <instancedMesh
      ref={ref}
      // Remounting on a count change is intentional: InstancedMesh allocates its
      // matrix buffer from args and cannot grow in place.
      key={items.length}
      args={[template.geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow
    />
  )
}

export function preloadProps(): void {
  useGLTF.preload(PROP_ATLAS)
  useGLTF.preload(FOOD_PROP_ATLAS)
}

/**
 * Suspends the DOM-side GameCanvas component until the atlas is cached.
 *
 * Loading it for the first time from inside an already-mounted R3F root tears
 * down the WebGL context on affected browsers. Calling this immediately before
 * creating <Canvas> keeps that suspension outside WebGL.
 */
export function usePropAtlas(): void {
  useGLTF(PROP_ATLAS)
  useGLTF(FOOD_PROP_ATLAS)
}
