'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Matrix4, Quaternion, Vector3 } from 'three'
import type { BufferGeometry, InstancedMesh, Material, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { BIOME_PROP_ATLAS, FOOD_PROP_ATLAS, PROP_ATLAS } from './manifest'

/**
 * Static scenery props, drawn from a shared prop atlas.
 *
 * An atlas is one GLB in which every prop is a top-level node named by its
 * logical id. That is what makes <PropInstances> worth having — a hundred fir
 * trees are one draw call.
 *
 * There are two: the sanctuary atlas from scripts/extract-assets.py, where
 * every prop additionally shares one material and palette texture so the trees,
 * the walls and the anvil all batch together; and the biome atlas from
 * scripts/build-biome-atlas.mjs, whose sources each bring their own materials,
 * so a prop there can be several primitives and batches only against itself.
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

interface PropPrimitive {
  geometry: BufferGeometry
  material: Material
}

/** One prop: one primitive on the sanctuary atlas, one per material elsewhere. */
interface PropTemplate {
  primitives: PropPrimitive[]
}

/**
 * There is one derived template map per atlas, and it has to outlive any single
 * component. useMemo is local to a component; using it alone would clone all 57
 * sanctuary geometries once per <Prop> and exhaust the WebGL context.
 */
const templateCaches = new Map<string, Map<string, PropTemplate>>()

/**
 * Prop id -> geometry, with the node's own transform baked in.
 *
 * Baking matters: InstancedMesh applies one matrix per instance, so the prop's
 * authored scale and ground-rest offset have to live in the geometry or every
 * caller would have to re-apply them.
 */
function usePropTemplates(atlas: string = PROP_ATLAS): Map<string, PropTemplate> {
  const { scene } = useGLTF(atlas)

  return useMemo(() => {
    const cached = templateCaches.get(atlas)
    if (cached) return cached

    const templates = new Map<string, PropTemplate>()
    scene.updateMatrixWorld(true)

    for (const node of scene.children) {
      // GLTFLoader sanitizes Object3D.name (`prop.keep.wall` becomes
      // `propkeepwall`). It preserves the authored glTF node name verbatim in
      // userData.name, which is the logical id callers use. A multi-material
      // prop arrives as a group of meshes under that one named node.
      const id = typeof node.userData.name === 'string' ? node.userData.name : node.name
      const primitives: PropPrimitive[] = []

      node.traverse((object: Object3D) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        const geometry = mesh.geometry.clone()
        geometry.applyMatrix4(mesh.matrixWorld)
        geometry.computeBoundingSphere()
        primitives.push({ geometry, material: mesh.material as Material })
      })

      if (primitives.length) templates.set(id, { primitives })
    }

    templateCaches.set(atlas, templates)
    return templates
  }, [atlas, scene])
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
  atlas,
  position,
  rotationY = 0,
  scale = 1,
  castShadow = true,
  color,
  emissive,
  wind,
}: PropPlacement & {
  id: string
  /** Defaults to the sanctuary atlas. */
  atlas?: string
  castShadow?: boolean
  color?: string
  emissive?: PropEmissive
  wind?: number
}) {
  const template = usePropTemplates(atlas).get(id)
  const materials = useMemo(
    () => template?.primitives.map((primitive) => propMaterial(primitive.material, color, emissive, wind)),
    [template, color, emissive, wind],
  )
  if (!template || !materials) return null

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {template.primitives.map((primitive, index) => (
        <mesh
          key={index}
          geometry={primitive.geometry}
          material={materials[index] ?? primitive.material}
          castShadow={castShadow}
          receiveShadow
        />
      ))}
    </group>
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
  atlas,
  items,
  castShadow = true,
  color,
  emissive,
  wind,
}: {
  id: string
  /** Defaults to the sanctuary atlas. */
  atlas?: string
  items: PropPlacement[]
  castShadow?: boolean
  color?: string
  emissive?: PropEmissive
  /** Sway amplitude per metre of height. Omit for rigid props. */
  wind?: number
}) {
  const template = usePropTemplates(atlas).get(id)
  const materials = useMemo(
    () => template?.primitives.map((primitive) => propMaterial(primitive.material, color, emissive, wind)),
    [template, color, emissive, wind],
  )

  if (!template || !materials || items.length === 0) return null

  // A prop with several materials is several InstancedMeshes over one matrix
  // list. They are siblings rather than a group with one transform because the
  // placement transform is already baked into each instance matrix.
  return (
    <>
      {template.primitives.map((primitive, index) => (
        <PropInstancedMesh
          key={index}
          geometry={primitive.geometry}
          material={materials[index] ?? primitive.material}
          items={items}
          castShadow={castShadow}
        />
      ))}
    </>
  )
}

function PropInstancedMesh({
  geometry,
  material,
  items,
  castShadow,
}: {
  geometry: BufferGeometry
  material: Material
  items: PropPlacement[]
  castShadow: boolean
}) {
  const ref = useRef<InstancedMesh>(null)

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

  return (
    <instancedMesh
      ref={ref}
      // Remounting on a count change is intentional: InstancedMesh allocates its
      // matrix buffer from args and cannot grow in place.
      key={items.length}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow
    />
  )
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
  useGLTF(BIOME_PROP_ATLAS)
}
