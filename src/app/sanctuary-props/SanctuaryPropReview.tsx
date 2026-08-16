'use client'

import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Grid, OrbitControls } from '@react-three/drei'
import { Prop } from '@/render/assets/props'
import { PROP_ATLAS } from '@/render/assets/manifest'
import styles from './sanctuaryProps.module.css'
import { HumanReference } from '@/render/preview/HumanReference'

export interface SanctuaryPropSpec {
  id: string
  pack: string
  sourceNode: string
  category: 'structure' | 'utility' | 'furniture' | 'scenery' | 'scatter'
  targetHeight: number
  footprint: { halfW: number; halfD: number }
  clearance: number
  materialClass: string
  shadowClass: string
  maxTriangles: number
  sockets?: Record<string, [number, number, number]>
  license: {
    status: string
    evidence: string
  }
}

function SocketMarkers({ sockets }: { sockets?: Record<string, [number, number, number]> }) {
  if (!sockets) return null
  return (
    <group>
      {Object.entries(sockets).map(([name, pos]) => (
        <group key={name} position={pos}>
          <mesh>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function SanctuaryPropReview({ props }: { props: SanctuaryPropSpec[] }) {
  const [selectedId, setSelectedId] = useState<string>(props[0]?.id ?? 'prop.warTable')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const selectedProp = props.find((p) => p.id === selectedId) || props[0]
  const filteredProps = props.filter((p) => (categoryFilter === 'all' ? true : p.category === categoryFilter))

  const height = selectedProp?.targetHeight ?? 2.0
  const refX = Math.max(1.6, (selectedProp?.footprint.halfW ?? 1) + 0.8)

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <h1>Sanctuary Prop Review</h1>
          <p>Inspect true scale, bounds, pivots, sockets, and polygon budgets for all 57 atlas props.</p>
        </div>

        <div className={styles.filterBar}>
          {['all', 'structure', 'utility', 'furniture', 'scenery', 'scatter'].map((cat) => (
            <button
              key={cat}
              className={`${styles.filterBtn} ${categoryFilter === cat ? styles.filterBtnActive : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={styles.propList}>
          {filteredProps.map((p) => {
            const isSelected = p.id === selectedId
            const badgeClass =
              p.category === 'structure'
                ? styles.badgeStructure
                : p.category === 'utility'
                  ? styles.badgeUtility
                  : p.category === 'furniture'
                    ? styles.badgeFurniture
                    : p.category === 'scenery'
                      ? styles.badgeScenery
                      : styles.badgeScatter

            return (
              <div
                key={p.id}
                className={`${styles.propItem} ${isSelected ? styles.propItemActive : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <div className={styles.propInfo}>
                  <div className={styles.propId}>{p.id}</div>
                  <div className={styles.propMeta}>
                    <span>{p.targetHeight}m H</span>
                    <span>•</span>
                    <span>≤{p.maxTriangles} tris</span>
                  </div>
                </div>
                <span className={`${styles.badge} ${badgeClass}`}>{p.category}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.viewport}>
        {selectedProp && (
          <div className={styles.detailOverlay}>
            <div className={styles.detailTitle}>{selectedProp.id}</div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Category</span>
              <span className={styles.metricValue}>{selectedProp.category}</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Target Height</span>
              <span className={styles.metricValue}>{selectedProp.targetHeight} m</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Footprint (W × D)</span>
              <span className={styles.metricValue}>
                {(selectedProp.footprint.halfW * 2).toFixed(2)} × {(selectedProp.footprint.halfD * 2).toFixed(2)} m
              </span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Clearance Radius</span>
              <span className={styles.metricValue}>{selectedProp.clearance} m</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Material Class</span>
              <span className={styles.metricValue}>{selectedProp.materialClass}</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Budget Cap</span>
              <span className={styles.metricValue}>≤ {selectedProp.maxTriangles} tris</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>License</span>
              <span className={styles.metricValue}>{selectedProp.license.status}</span>
            </div>

            {selectedProp.sockets && (
              <div className={styles.socketsList}>
                <div className={styles.socketsTitle}>Named Sockets:</div>
                {Object.entries(selectedProp.sockets).map(([name, pos]) => (
                  <div key={name} className={styles.metricRow}>
                    <span className={styles.metricLabel}>{name}</span>
                    <span className={styles.metricValue}>[{pos.join(', ')}]</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Canvas
          key={selectedId}
          shadows
          camera={{ position: [height * 1.2 + 2.5, height * 0.7 + 1.2, height * 1.5 + 3.0], fov: 40 }}
          dpr={[1, 1.75]}
        >
          <color attach="background" args={['#080c12']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[8, 14, 8]} intensity={2.0} castShadow />
          <hemisphereLight args={['#9fb4c9', '#1e2430', 0.6]} />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.4}>
              <Prop id={selectedId} atlas={PROP_ATLAS} position={[0, 0, 0]} />
              <HumanReference x={refX} />
              <SocketMarkers sockets={selectedProp?.sockets} />
            </Bounds>
          </Suspense>

          <Grid
            infiniteGrid
            fadeDistance={Math.max(30, height * 6)}
            fadeStrength={3}
            cellSize={1}
            sectionSize={5}
            cellColor="#1e293b"
            sectionColor="#475569"
          />
          <OrbitControls makeDefault target={[0, height * 0.4, 0]} minDistance={1.0} maxDistance={Math.max(50, height * 8)} />
        </Canvas>
      </div>
    </div>
  )
}
