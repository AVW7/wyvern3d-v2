'use client'

import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DirectionalLight, Fog, HemisphereLight } from 'three'
import { useGame } from '@/state/store'
import { SkyDome, SkyDomeHandle } from '../../Sanctuary/atmosphere/SkyDome'
import { mapSkyStateFor } from './mapSky'

const SUN_DISTANCE = 280
const SHADOW_EXTENT = 150

export function MapAtmosphere() {
  const { scene, gl } = useThree()
  const dome = useRef<SkyDomeHandle | null>(null)
  const key = useRef<DirectionalLight>(null)
  const hemisphere = useRef<HemisphereLight>(null)

  const sunColor = useRef(new Color())
  const skyColor = useRef(new Color())
  const groundColor = useRef(new Color())
  const fogColor = useRef(new Color())

  useEffect(() => {
    const previousFog = scene.fog
    const previousBackground = scene.background
    const previousExposure = gl.toneMappingExposure

    scene.fog = new Fog('#12161c', 140, 480)
    scene.background = new Color('#12161c')

    return () => {
      scene.fog = previousFog
      scene.background = previousBackground
      gl.toneMappingExposure = previousExposure
    }
  }, [scene, gl])

  useFrame(() => {
    const tick = useGame.getState().state.tick
    const sky = mapSkyStateFor(tick)

    if (key.current) {
      const [dx, dy, dz] = sky.direction
      key.current.position.set(dx * SUN_DISTANCE, Math.max(dy, 0.05) * SUN_DISTANCE, dz * SUN_DISTANCE)
      sunColor.current.setRGB(sky.sun[0], sky.sun[1], sky.sun[2])
      key.current.color.copy(sunColor.current)
      key.current.intensity = sky.sunIntensity
    }

    if (hemisphere.current) {
      skyColor.current.setRGB(sky.skyFill[0], sky.skyFill[1], sky.skyFill[2])
      groundColor.current.setRGB(sky.groundFill[0], sky.groundFill[1], sky.groundFill[2])
      hemisphere.current.color.copy(skyColor.current)
      hemisphere.current.groundColor.copy(groundColor.current)
    }

    fogColor.current.setRGB(sky.fog[0], sky.fog[1], sky.fog[2])
    if (scene.fog instanceof Fog) {
      scene.fog.color.copy(fogColor.current)
      scene.fog.near = sky.fogNear
      scene.fog.far = sky.fogFar
    }
    if (scene.background instanceof Color) scene.background.copy(fogColor.current)

    gl.toneMappingExposure = sky.exposure
    dome.current?.setColors(sky.horizon, sky.zenith)
  })

  return (
    <>
      <SkyDome handleRef={dome} radius={600} />
      <hemisphereLight ref={hemisphere} intensity={0.6} />
      <directionalLight
        ref={key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={10}
        shadow-camera-far={600}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />
    </>
  )
}
