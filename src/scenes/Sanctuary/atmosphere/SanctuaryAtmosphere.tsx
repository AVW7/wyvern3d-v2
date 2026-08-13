'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Fog } from 'three'
import type { DirectionalLight, HemisphereLight } from 'three'
import { useGame } from '@/state/store'
import { skyStateFor } from './palette'
import { SkyDome, type SkyDomeHandle } from './SkyDome'

/**
 * Distance the key light's shadow frustum has to cover.
 *
 * The shipped rig used +/-70 at 1024px, which is 13.7cm per texel — the reason
 * contact shadows read as blobs. The walkable disc is 60 units, so +/-64 covers
 * everything the player can reach with a margin, at 2048px, for 6.3cm per
 * texel. Roughly 16MB of shadow memory buys what a postprocessing pass could
 * not, and stays well inside the VRAM budget `GameCanvas` is protecting.
 *
 * The frustum is centred on the light's target, which stays at the origin —
 * the walkable disc is centred there, and the keep at z=-26 is well inside.
 */
const SHADOW_EXTENT = 64
const SUN_DISTANCE = 120

/**
 * Sun, fill, sky and fog for the sanctuary, driven from the world clock.
 *
 * Every per-frame value is written straight onto the light, fog and renderer
 * objects. Nothing here touches React state — the scene re-rendering once a
 * frame would defeat the whole point.
 */
export function SanctuaryAtmosphere() {
  const key = useRef<DirectionalLight>(null)
  const fill = useRef<DirectionalLight>(null)
  const hemisphere = useRef<HemisphereLight>(null)
  const dome = useRef<SkyDomeHandle | null>(null)

  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)

  const sunColor = useRef(new Color())
  const fillColor = useRef(new Color())
  const skyColor = useRef(new Color())
  const groundColor = useRef(new Color())
  const fogColor = useRef(new Color())

  // The scene's own fog object, created once. `<fog attach="fog">` would be
  // replaced on every prop change; mutating one instance costs nothing.
  useEffect(() => {
    const previousFog = scene.fog
    const previousBackground = scene.background
    scene.fog = new Fog('#c3cbd4', 52, 190)
    scene.background = new Color('#c3cbd4')
    return () => {
      // The canvas is persistent and shared with the world map, battle and
      // highlands scenes, so this must hand back what it found.
      scene.fog = previousFog
      scene.background = previousBackground
    }
  }, [scene])

  useFrame(() => {
    const sky = skyStateFor(useGame.getState().state.tick)

    if (key.current) {
      const [dx, dy, dz] = sky.direction
      key.current.position.set(dx * SUN_DISTANCE, Math.max(dy, 0.05) * SUN_DISTANCE, dz * SUN_DISTANCE)
      sunColor.current.setRGB(sky.sun[0], sky.sun[1], sky.sun[2])
      key.current.color.copy(sunColor.current)
      key.current.intensity = sky.sunIntensity
    }

    if (fill.current) {
      const [dx, , dz] = sky.direction
      // Opposite quadrant and low, so it reads as cool sky bounce filling the
      // shadow side rather than as a second sun.
      fill.current.position.set(-dx * SUN_DISTANCE, 34, -dz * SUN_DISTANCE)
      fillColor.current.setRGB(sky.skyFill[0], sky.skyFill[1], sky.skyFill[2])
      fill.current.color.copy(fillColor.current)
      fill.current.intensity = sky.fillIntensity
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
    // The background matches the fog so the horizon dissolves rather than
    // meeting the sky at a visible line.
    if (scene.background instanceof Color) scene.background.copy(fogColor.current)

    gl.toneMappingExposure = sky.exposure
    dome.current?.setColors(sky.horizon, sky.zenith)
  })

  return (
    <>
      <SkyDome handleRef={dome} />
      <hemisphereLight ref={hemisphere} intensity={0.55} />
      <directionalLight
        ref={key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE * 2.2}
        // Without these the 2048 map shows acne on the flagstones and
        // peter-panning under the props; normalBias is the one that matters for
        // the instanced scenery, whose geometry is baked at odd angles.
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight ref={fill} />
    </>
  )
}
