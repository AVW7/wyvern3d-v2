import { CylinderGeometry, MeshStandardMaterial, RingGeometry } from 'three'
import { nodeRadius } from './nodeVisuals'

interface TierResource {
  baseGeometry: CylinderGeometry
  ringGeometry: RingGeometry
}

const resourcesByTier: Record<number, TierResource> = {}
let defaultMaterial: MeshStandardMaterial | null = null

export function getTierGeometries(tier: number): TierResource {
  if (!resourcesByTier[tier]) {
    const r = nodeRadius(tier)
    resourcesByTier[tier] = {
      baseGeometry: new CylinderGeometry(r, r + 0.5, 0.8, 32),
      ringGeometry: new RingGeometry(r + 0.2, r + 0.6, 32),
    }
  }
  return resourcesByTier[tier]
}

export function getSharedNodeMaterial(): MeshStandardMaterial {
  if (!defaultMaterial) {
    defaultMaterial = new MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1,
    })
  }
  return defaultMaterial
}
