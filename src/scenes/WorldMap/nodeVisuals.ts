import { BIOME_PALETTES } from '../BiomeWorld/atmosphere/biomePalettes'

export function nodeRadius(tier: number): number {
  return 3.0 + tier * 0.6
}

export function statusColor(owner: 'player' | 'enemy', isAttackable: boolean): string {
  if (owner === 'player') return '#4ade80' // Emerald / green
  if (isAttackable) return '#fbbf24' // Amber / yellow
  return '#64748b' // Slate / locked
}

export function nodeGroundColor(biome: string): string {
  const palette = BIOME_PALETTES[biome]
  return palette?.groundColor ?? '#475569'
}

export function labelFormatting(name: string, tier: number): { label: string; fontSize: number } {
  return {
    label: `${name} T${tier}`,
    fontSize: 2.2,
  }
}
