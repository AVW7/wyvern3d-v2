'use client'

/**
 * The 1.75 m figure every prop-review page is scaled against.
 *
 * Shared so the two review surfaces (`/models` sanctuary props and `/biomes`)
 * measure props against the same body — they previously each carried a private
 * copy whose capsule differed in girth, so a prop read slightly heavier on one
 * page than the other.
 */
export function HumanReference({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.24, 1.1, 4, 12]} />
        <meshStandardMaterial color="#4a5a72" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#5d6f8a" roughness={0.9} />
      </mesh>
    </group>
  )
}
