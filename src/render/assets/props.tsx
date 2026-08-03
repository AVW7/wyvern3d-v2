'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Matrix4, Quaternion, Vector3 } from 'three'
import type { BufferGeometry, InstancedMesh, Material, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { PROP_ATLAS } from './manifest'

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
 * All props share one material, so tinting one prop id must clone that
 * material rather than mutate it in place — otherwise every other prop
 * drawn from the atlas repaints too. Cached per (source material, color) so
 * repeated instances of the same tinted prop still share one clone.
 */
const tintCache = new Map<Material, Map<string, Material>>()

function tintedMaterial(base: Material, color: string): Material {
  let byColor = tintCache.get(base)
  if (!byColor) {
    byColor = new Map()
    tintCache.set(base, byColor)
  }
  let tinted = byColor.get(color)
  if (!tinted) {
    tinted = base.clone()
    ;(tinted as MeshStandardMaterial).color?.set(color)
    byColor.set(color, tinted)
  }
  return tinted
}

/** A single prop. For more than a handful of copies, use <PropInstances>. */
export function Prop({
  id,
  position,
  rotationY = 0,
  scale = 1,
  castShadow = true,
  color,
}: PropPlacement & { id: string; castShadow?: boolean; color?: string }) {
  const template = usePropTemplates().get(id)
  const material = useMemo(
    () => (template && color ? tintedMaterial(template.material, color) : template?.material),
    [template, color],
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
}: {
  id: string
  items: PropPlacement[]
  castShadow?: boolean
  color?: string
}) {
  const ref = useRef<InstancedMesh>(null)
  const template = usePropTemplates().get(id)
  const material = useMemo(
    () => (template && color ? tintedMaterial(template.material, color) : template?.material),
    [template, color],
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
}
