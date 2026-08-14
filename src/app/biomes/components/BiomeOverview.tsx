'use client'

import styles from '../biomes.module.css'
import { labelFor, type BiomeSummary } from '../catalog'

/**
 * The per-biome view: every biome and the layers it dresses with.
 *
 * This is the readable form of src/render/assets/biomeLibrary.ts — the same
 * data the scene reads, so a biome that looks empty in game shows an empty or
 * short table here rather than needing the file opened.
 */
export function BiomeOverview({
  summaries,
  onSelectProp,
}: {
  summaries: BiomeSummary[]
  onSelectProp: (id: string) => void
}) {
  return (
    <section className={styles.overview} aria-label="Biome dressing overview">
      {summaries.map((summary) => (
        <article className={styles.biomeCard} key={summary.biome}>
          <header>
            <h3>{summary.biome}</h3>
            <span>
              {summary.props} layers · {summary.instances} props
              {summary.missing.length ? ` · ${summary.missing.length} missing` : ''}
            </span>
          </header>

          <table className={styles.layerTable}>
            <thead>
              <tr>
                <th scope="col">Prop</th>
                <th scope="col">Count</th>
                <th scope="col">Radius</th>
                <th scope="col">Scale</th>
                <th scope="col">Wind</th>
              </tr>
            </thead>
            <tbody>
              {summary.layers.map((layer, index) => (
                <tr key={`${layer.prop}:${index}`}>
                  <td>
                    {layer.color ? <i className={styles.swatch} style={{ background: layer.color }} /> : null}
                    <button onClick={() => onSelectProp(layer.prop)}>{labelFor(layer.prop)}</button>
                    {summary.missing.includes(layer.prop) ? <span className={styles.missing}> · not built</span> : null}
                  </td>
                  <td>{layer.count}</td>
                  <td>
                    {layer.radius[0]}–{layer.radius[1]} m
                  </td>
                  <td>
                    {layer.scale[0]}–{layer.scale[1]}×
                  </td>
                  <td>{layer.wind ? layer.wind.toFixed(3) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  )
}
