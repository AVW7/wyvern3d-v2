'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'
import { consumeDrag, consumeWheel, isDown } from '@/render/controllers/input'
import { useCameraStore } from '@/state/cameraStore'
import { useGame } from '@/state/store'
import { REGIONS } from '@/core/data/regions'

/** Orbit-and-zoom camera driven by drag and W/S with smooth region targeting */
export function MapCamera() {
  const camera = useThree((s) => s.camera)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const yaw = useRef(0)
  const pitch = useRef(0.85)
  const distance = useRef(220)
  const target = useMemo(() => new Vector3(0, 0, -15), [])
  const desired = useRef(new Vector3())

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const camSettings = useCameraStore.getState()

    if ('fov' in camera && typeof camera.fov === 'number' && camera.fov !== camSettings.fov) {
      camera.fov = camSettings.fov
      camera.updateProjectionMatrix()
    }

    // Target position lerp toward selected region
    if (selectedRegion && REGIONS[selectedRegion]) {
      const reg = REGIONS[selectedRegion]
      target.x = MathUtils.lerp(target.x, reg.position.x, dt * 4)
      target.z = MathUtils.lerp(target.z, reg.position.z, dt * 4)
    } else {
      target.x = MathUtils.lerp(target.x, 0, dt * 2)
      target.z = MathUtils.lerp(target.z, -15, dt * 2)
    }

    const drag = consumeDrag()
    const dragXMultiplier = (camSettings.invertX ? -1 : 1) * camSettings.sensitivity
    const dragYMultiplier = (camSettings.invertY ? 1 : -1) * camSettings.sensitivity

    yaw.current += drag.x * 0.004 * dragXMultiplier
    pitch.current = Math.max(0.35, Math.min(1.25, pitch.current + drag.y * 0.003 * dragYMultiplier))

    if (isDown('KeyW', 'Equal')) distance.current -= 70 * dt * camSettings.zoomSpeed
    if (isDown('KeyS', 'Minus')) distance.current += 70 * dt * camSettings.zoomSpeed
    distance.current += consumeWheel() * 0.14 * camSettings.zoomSpeed
    distance.current = Math.max(80, Math.min(300, distance.current))

    desired.current.set(
      target.x + Math.sin(yaw.current) * distance.current * Math.cos(pitch.current),
      target.y + distance.current * Math.sin(pitch.current),
      target.z + Math.cos(yaw.current) * distance.current * Math.cos(pitch.current),
    )
    camera.position.lerp(desired.current, 1 - Math.exp(-camSettings.smoothing * dt))
    camera.lookAt(target)
  })

  return null
}
