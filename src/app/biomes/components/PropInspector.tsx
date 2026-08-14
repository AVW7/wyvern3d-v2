'use client'

import shell from '../../models/models.module.css'
import styles from '../biomes.module.css'
import type { BiomePropEntry } from '../catalog'

/**
 * Everything known about one prop: what it was built from, what the builder
 * measured, and which biomes scatter it.
 *
 * The measured column is the authority — a manifest number without a
 * measurement behind it is provisional, which is why the two are shown side by
 * side rather than merged.
 */
export function PropInspector({ prop }: { prop: BiomePropEntry }) {
  const { entry, measured, usedBy } = prop
  const status = !measured ? 'disabled' : usedBy.length ? 'ready' : 'pending'
  const instances = usedBy.reduce((total, { layer }) => total + layer.count, 0)

  return (
    <aside className={shell.inspector} aria-label={`${prop.label} details`}>
      <div className={shell.inspectorHead}>
        <div className={shell.inspectorHeading}>
          <h2>{prop.label}</h2>
          <code>{prop.id}</code>
        </div>

        <div className={shell.statusCard} data-status={status}>
          <span>{measured ? 'In the built atlas' : 'Not in the built atlas'}</span>
          <strong>
            {status === 'ready' ? `Used by ${usedBy.length} biome${usedBy.length === 1 ? '' : 's'}` : null}
            {status === 'pending' ? 'Built · unused' : null}
            {status === 'disabled' ? 'Rebuild needed' : null}
          </strong>
        </div>
      </div>

      <div className={shell.tabPanel}>
        <div className={shell.sectionHeading}>
          <h3>Measured</h3>
          <span>{measured ? 'built' : '—'}</span>
        </div>
        <dl className={shell.details}>
          <div>
            <dt>Height</dt>
            <dd>
              {measured ? `${measured.height.toFixed(2)} m` : '—'}
              {measured && Math.abs(measured.height - entry.targetHeight) > 0.05 ? ` (authored ${entry.targetHeight} m)` : ''}
            </dd>
          </div>
          <div>
            <dt>Footprint</dt>
            <dd>{measured ? `${measured.footprint[0].toFixed(2)} × ${measured.footprint[1].toFixed(2)} m` : '—'}</dd>
          </div>
          <div>
            <dt>Triangles</dt>
            <dd>
              {measured ? measured.triangles.toLocaleString() : '—'}
              {entry.maxTriangles ? ` / ${entry.maxTriangles.toLocaleString()}` : ''}
            </dd>
          </div>
          <div>
            <dt>Source tris</dt>
            <dd>{measured ? measured.sourceTriangles.toLocaleString() : '—'}</dd>
          </div>
          <div>
            <dt>Rests at</dt>
            <dd>{entry.sink ? `${-entry.sink} m (sunk)` : 'y = 0'}</dd>
          </div>
          <div>
            <dt>Fit scale</dt>
            <dd>{measured ? `×${measured.scale}` : '—'}</dd>
          </div>
        </dl>

        <div className={shell.animationMap}>
          <div className={shell.sectionHeading}>
            <h3>Source</h3>
            <span>{measured?.nodes ?? entry.nodes?.length ?? 'all'}</span>
          </div>
          <dl className={shell.details}>
            <div>
              <dt>File</dt>
              <dd>{entry.source.file}</dd>
            </div>
            <div>
              <dt>Root</dt>
              <dd>{entry.source.root}</dd>
            </div>
            <div>
              <dt>Nodes</dt>
              <dd>{entry.nodes?.join(', ') ?? 'every mesh node'}</dd>
            </div>
            <div>
              <dt>Licence</dt>
              <dd>{entry.license.status}</dd>
            </div>
          </dl>
          {entry.license.evidence ? <p className={shell.safety}>{entry.license.evidence}</p> : null}
        </div>

        <div className={shell.animationMap}>
          <div className={shell.sectionHeading}>
            <h3>Dressed into</h3>
            <span>{instances || 0}</span>
          </div>
          {usedBy.length === 0 ? (
            <p className={shell.emptyNote}>
              No biome scatters this prop yet. Add a layer for it in <code>src/render/assets/biomeLibrary.ts</code>.
            </p>
          ) : (
            <ul className={styles.usageList}>
              {usedBy.map(({ biome, layer }) => (
                <li key={`${biome}:${layer.prop}:${layer.count}`}>
                  {layer.color ? <i className={styles.swatch} style={{ background: layer.color }} /> : null}
                  {biome}
                  <span>×{layer.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={shell.inspectorFoot}>
        <p className={shell.safety}>
          Cosmetic only. Collision radii, ranges and speeds live in <code>src/core/**</code> and are never read from a
          mesh. Rebuild with <code>pnpm assets:biome-atlas</code>; see <code>docs/BIOME_LIBRARY.md</code>.
        </p>
      </div>
    </aside>
  )
}
