'use client'

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, PointLight, Sprite } from 'three'
import { REGION_LIST } from '@/core/data/regions'
import { useGameState } from '@/state/store'
import { mapHeightAt } from '../terrain/mapTerrain'
import { mapSkyStateFor } from './mapSky'

const LIGHT_BUDGET = 3

export function MapBeacons() {
  const state = useGameState()
  const tick = state.tick

  const beaconSources = useMemo(() => {
    const list: { id: string; position: [number, number, number] }[] = []
    for (const def of REGION_LIST) {
      const reg = state.regions[def.id]
      const isPlayer = reg?.owner === 'player'
      const isTier4 = def.tier === 4

      if (isPlayer || isTier4) {
        const h = mapHeightAt(def.position.x, def.position.z)
        list.push({
          id: def.id,
          position: [def.position.x, h + 1.8, def.position.z],
        })
      }
    }
    return list
  }, [state.regions])

  const lights = useRef<(PointLight | null)[]>([])
  const sprites = useRef<(Sprite | null)[]>([])

  const flameColor = useMemo(() => new Color('#ffaa44'), [])
  const lastSelectTime = useRef(0)
  const activeIndices = useRef<number[]>([])

  useFrame((frameState) => {
    const sky = mapSkyStateFor(tick)
    const opacity = 0.4 + sky.nightBoost * 0.5
    const t = frameState.clock.elapsedTime

    if (t - lastSelectTime.current > 0.25) {
      lastSelectTime.current = t
      activeIndices.current = beaconSources.slice(0, LIGHT_BUDGET).map((_, i) => i)
    }

    beaconSources.forEach((src, i) => {
      const sprite = sprites.current[i]
      if (sprite) {
        sprite.position.set(...src.position)
        sprite.scale.set(3.5, 4.5, 1)
        const mat = sprite.material
        if (mat) mat.opacity = opacity
      }
    })

    for (let i = 0; i < LIGHT_BUDGET; i++) {
      const light = lights.current[i]
      const srcIdx = activeIndices.current[i]
      if (light) {
        if (srcIdx !== undefined && beaconSources[srcIdx]) {
          const src = beaconSources[srcIdx]!
          light.position.set(...src.position)
          light.intensity = (1.5 + Math.sin(t * 8 + i) * 0.3) * sky.nightBoost
          light.visible = sky.nightBoost > 0.05
        } else {
          light.visible = false
        }
      }
    }
  })

  return (
    <group>
      {beaconSources.map((src, i) => (
        <sprite
          key={src.id}
          ref={(el) => {
            sprites.current[i] = el
          }}
          position={src.position}
        >
          <spriteMaterial color={flameColor} blending={AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}

      {Array.from({ length: LIGHT_BUDGET }).map((_, i) => (
        <pointLight
          key={`beacon-light-${i}`}
          ref={(el) => {
            lights.current[i] = el
          }}
          color="#ffaa44"
          distance={40}
          decay={2}
        />
      ))}
    </group>
  )
}
