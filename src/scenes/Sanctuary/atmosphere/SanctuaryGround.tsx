'use client'

import { useEffect, useMemo } from 'react'
import { BufferAttribute, RingGeometry } from 'three'
import { useSanctuaryColors } from '@/state/sanctuaryColorsStore'
import { GROUND_RADIUS, KEEP } from '../layout'
import {
  OUTER_INNER_RADIUS,
  OUTER_OUTER_RADIUS,
  groundColorFrom,
  groundFactorsAt,
  hexToRgb,
  outerHeightAt,
  type GroundFactors,
} from './terrain'

/**
 * The sanctuary floor.
 *
 * Two meshes: a flat vertex-coloured disc the player walks on, and a displaced
 * annulus beyond it that turns the horizon into a landform instead of a cut-off
 * plate. The disc keeps every vertex at y=0 — three separate ground-plane
 * raycasts and all prop placement depend on that — so the relief starts only
 * where nothing gameplay-facing reads.
 *
 * A `RingGeometry` rather than `circleGeometry` because a circle is a triangle
 * fan: one centre vertex and a rim, with nothing in between to colour.
 */
const DISC_RADIAL = 120
const DISC_RINGS = 44

/**
 * Geometry and the grass-independent shading factors, built once.
 *
 * Keyed on nothing: neither depends on the player's colour choice, and walking
 * every path stone per vertex is far too expensive to redo while a colour
 * picker is being dragged.
 */
function useGroundMesh(inner: number, outer: number, radial: number, rings: number, displace: boolean) {
  return useMemo(() => {
    const geometry = new RingGeometry(inner, outer, radial, rings)
    const position = geometry.attributes.position!
    const factors: GroundFactors[] = []

    for (let i = 0; i < position.count; i++) {
      // The ring is built in the XY plane and rotated flat below, so its local
      // y is the world z and its local z becomes world height.
      const x = position.getX(i)
      const z = position.getY(i)
      if (displace) position.setZ(i, outerHeightAt(x, z))
      factors.push(groundFactorsAt(x, z))
    }

    if (displace) {
      position.needsUpdate = true
      geometry.computeVertexNormals()
    }
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(position.count * 3), 3))
    return { geometry, factors }
  }, [inner, outer, radial, rings, displace])
}

export function SanctuaryGround() {
  const grass = useSanctuaryColors((s) => s.grass)
  const disc = useGroundMesh(0, GROUND_RADIUS, DISC_RADIAL, DISC_RINGS, false)
  const outer = useGroundMesh(OUTER_INNER_RADIUS, OUTER_OUTER_RADIUS, 96, 26, true)

  // Only this re-runs on a recolour, and it is a handful of lerps per vertex.
  useEffect(() => {
    const base = hexToRgb(grass)
    for (const mesh of [disc, outer]) {
      const attribute = mesh.geometry.attributes.color as BufferAttribute
      const array = attribute.array as Float32Array
      for (let i = 0; i < mesh.factors.length; i++) {
        const [r, g, b] = groundColorFrom(mesh.factors[i]!, base)
        array[i * 3] = r
        array[i * 3 + 1] = g
        array[i * 3 + 2] = b
      }
      attribute.needsUpdate = true
    }
  }, [grass, disc, outer])

  useEffect(() => () => disc.geometry.dispose(), [disc])
  useEffect(() => () => outer.geometry.dispose(), [outer])

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={disc.geometry} receiveShadow>
        {/* White base so the vertex colours are the colour, not a tint of one. */}
        <meshStandardMaterial vertexColors color="#ffffff" roughness={1} />
      </mesh>

      {/*
        Outside the shadow frustum by design, so it must not try to receive —
        a receiving mesh beyond the camera's range shows the frustum's edge as
        a hard line across the landscape.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={outer.geometry} receiveShadow={false}>
        <meshStandardMaterial vertexColors color="#ffffff" roughness={1} />
      </mesh>

      {/* Sits under the flagstones and shows through their gaps as grout. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[KEEP.centerX, 0.02, KEEP.centerZ]}
        receiveShadow
      >
        <planeGeometry args={[KEEP.halfW * 2, KEEP.halfD * 2]} />
        <meshStandardMaterial color="#5c554b" roughness={0.9} />
      </mesh>
    </>
  )
}
