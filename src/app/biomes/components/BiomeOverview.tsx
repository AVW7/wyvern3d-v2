'use client'

import { useState } from 'react'
import styles from '../biomes.module.css'
import { labelFor, type BiomeSummary } from '../catalog'
import { REGION_LIST } from '@/core/data/regions'
import { getRegionBiomeModifiers } from '@/scenes/BiomeWorld/terrain/regionModifiers'

/**
 * The per-biome view: every biome, the layers it dresses with, and region-specific
 * composition modifier diagnostics.
 */
export function BiomeOverview({
  summaries,
  onSelectProp,
}: {
  summaries: BiomeSummary[]
  onSelectProp: (id: string) => void
}) {
  const [selectedRegions, setSelectedRegions] = useState<Record<string, string>>({})

  return (
    <section className={styles.overview} aria-label="Biome dressing overview">
      {summaries.map((summary) => {
        const biomeRegions = REGION_LIST.filter((r) => r.biome === summary.biome)
        const activeRegionId = selectedRegions[summary.biome] ?? biomeRegions[0]?.id
        const activeRegion = biomeRegions.find((r) => r.id === activeRegionId)
        const modifiers = activeRegionId ? getRegionBiomeModifiers(activeRegionId, 42) : null

        return (
          <article className={styles.biomeCard} key={summary.biome}>
            <header>
              <h3>{summary.biome}</h3>
              <span>
                {summary.props} layers · {summary.instances} base props
                {summary.missing.length ? ` · ${summary.missing.length} missing` : ''}
              </span>
            </header>

            {/* Region Variance Diagnostic Bar */}
            {biomeRegions.length > 0 && (
              <div style={{ padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Compare Region:</span>
                  {biomeRegions.map((reg) => (
                    <button
                      key={reg.id}
                      onClick={() => setSelectedRegions((prev) => ({ ...prev, [summary.biome]: reg.id }))}
                      style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        background: activeRegionId === reg.id ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                        color: activeRegionId === reg.id ? '#fff' : 'rgba(255,255,255,0.8)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {reg.name}
                    </button>
                  ))}
                </div>
                {modifiers && activeRegion && (
                  <div style={{ display: 'flex', gap: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                    <span>Tag: <strong>{activeRegion.compositionTag ?? 'standard'}</strong></span>
                    <span>Density: <strong>{(modifiers.densityMultiplier * 100).toFixed(0)}%</strong></span>
                    <span>Terrain Rot: <strong>{((modifiers.terrainRotation * 180) / Math.PI).toFixed(0)}°</strong></span>
                    <span>Scatter Rot: <strong>{((modifiers.scatterRotation * 180) / Math.PI).toFixed(0)}°</strong></span>
                    <span>Radius Shift: <strong>{modifiers.radiusBandShift > 0 ? `+${modifiers.radiusBandShift.toFixed(1)}` : modifiers.radiusBandShift.toFixed(1)}m</strong></span>
                  </div>
                )}
              </div>
            )}

            <table className={styles.layerTable}>
              <thead>
                <tr>
                  <th scope="col">Prop</th>
                  <th scope="col">Base</th>
                  <th scope="col">{activeRegion ? `${activeRegion.name} Effective` : 'Effective'}</th>
                  <th scope="col">Radius</th>
                  <th scope="col">Scale</th>
                  <th scope="col">Wind</th>
                </tr>
              </thead>
              <tbody>
                {summary.layers.map((layer, index) => {
                  const effectiveCount = modifiers
                    ? Math.max(0, Math.round(layer.count * modifiers.densityMultiplier))
                    : layer.count

                  return (
                    <tr key={`${layer.prop}:${index}`}>
                      <td>
                        {layer.color ? <i className={styles.swatch} style={{ background: layer.color }} /> : null}
                        <button onClick={() => onSelectProp(layer.prop)}>{labelFor(layer.prop)}</button>
                        {summary.missing.includes(layer.prop) ? <span className={styles.missing}> · not built</span> : null}
                      </td>
                      <td>{layer.count}</td>
                      <td style={{ fontWeight: modifiers && effectiveCount !== layer.count ? 'bold' : 'normal', color: modifiers && effectiveCount !== layer.count ? '#60a5fa' : 'inherit' }}>
                        {effectiveCount}
                      </td>
                      <td>
                        {layer.radius[0]}–{layer.radius[1]} m
                      </td>
                      <td>
                        {layer.scale[0]}–{layer.scale[1]}×
                      </td>
                      <td>{layer.wind ? layer.wind.toFixed(3) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </article>
        )
      })}
    </section>
  )
}
