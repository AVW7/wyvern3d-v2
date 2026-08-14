'use client'

import { useMemo } from 'react'
import { REGIONS, REGION_LIST } from '@/core/data/regions'

/**
 * A flat, non-interactive rendering of the conquest graph for the title screen.
 * It reads the same `REGIONS` data the 3D map is built from, so it can never
 * drift into advertising a map layout the game does not have — but it is plain
 * SVG, so the title screen keeps exactly one WebGL context.
 */

const PAD = 7
const TIER_FILL = ['#f5c46a', '#8fd0b6', '#79b6e0', '#c79bea', '#ef8f6a'] as const

type Point = { x: number; y: number }

function project(): Record<string, Point> {
  const xs = REGION_LIST.map((r) => r.position.x)
  const zs = REGION_LIST.map((r) => r.position.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)

  const out: Record<string, Point> = {}
  for (const region of REGION_LIST) {
    out[region.id] = {
      // +z is south in world space, so it maps to the bottom of the card.
      x: PAD + ((region.position.x - minX) / (maxX - minX)) * (100 - PAD * 2),
      y: 100 - PAD - ((region.position.z - minZ) / (maxZ - minZ)) * (100 - PAD * 2),
    }
  }
  return out
}

export function TitleWorldMap() {
  const points = useMemo(project, [])

  const edges = useMemo(() => {
    const seen = new Set<string>()
    const list: Array<{ key: string; a: Point; b: Point }> = []
    for (const region of REGION_LIST) {
      const a = points[region.id]
      if (!a) continue
      for (const neighborId of region.neighbors) {
        const key = [region.id, neighborId].sort().join('~')
        const b = points[neighborId]
        if (seen.has(key) || !b || !REGIONS[neighborId]) continue
        seen.add(key)
        list.push({ key, a, b })
      }
    }
    return list
  }, [points])

  return (
    <svg className="title-map__svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="title-map__edges">
        {edges.map((edge) => (
          <line key={edge.key} x1={edge.a.x} y1={edge.a.y} x2={edge.b.x} y2={edge.b.y} />
        ))}
      </g>
      {REGION_LIST.map((region) => {
        const point = points[region.id]
        if (!point) return null
        const fill = TIER_FILL[Math.min(region.tier, TIER_FILL.length - 1)]
        return (
          <g key={region.id} className={region.starting ? 'title-map__node is-home' : 'title-map__node'}>
            {region.starting && <circle cx={point.x} cy={point.y} r={4.6} className="title-map__halo" />}
            <circle cx={point.x} cy={point.y} r={region.starting ? 2.3 : 1.5 + region.tier * 0.18} fill={fill} />
          </g>
        )
      })}
    </svg>
  )
}
