'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'
import { consumeDrag, consumeWheel, isDown } from '@/render/controllers/input'
import { useCameraStore } from '@/state/cameraStore'
import { useGame } from '@/state/store'
import { REGIONS } from '@/core/data/regions'
import { clampPitch, clampDistance, calculateOrbitPosition } from '../camera/mapCameraRig'
import { MAP_CAMERA_PRESETS } from '../camera/mapPresets'

export function MapCamera() {
  const camera = useThree((s) => s.camera)
  const selectedRegion = useGame((s) => s.selectedRegion)
  const preset = useCameraStore((s) => s.preset)
  const presetToken = useCameraStore((s) => s.presetToken)

  const defaultPreset = MAP_CAMERA_PRESETS.default ?? { pitch: 0.85, distance: 200 }
  const yaw = useRef(0)
  const pitch = useRef(defaultPreset.pitch)
  const distance = useRef(defaultPreset.distance)
  const target = useMemo(() => new Vector3(0, 0.8, -15), [])
  const desired = useRef(new Vector3())

  useEffect(() => {
    if (presetToken === 0) return
    const mapPreset = MAP_CAMERA_PRESETS[preset] ?? defaultPreset
    pitch.current = mapPreset.pitch
    distance.current = mapPreset.distance
    if (mapPreset.yawOffset !== undefined) {
      yaw.current += mapPreset.yawOffset
    }
  }, [presetToken, preset, defaultPreset])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const camSettings = useCameraStore.getState()

    if ('fov' in camera && typeof camera.fov === 'number' && camera.fov !== camSettings.fov) {
      camera.fov = camSettings.fov
      camera.updateProjectionMatrix()
    }

    if (selectedRegion && REGIONS[selectedRegion]) {
      const reg = REGIONS[selectedRegion]
      const targetHeight = 0.8 + reg.tier * 0.9
      target.x = MathUtils.lerp(target.x, reg.position.x, dt * 4)
      target.y = MathUtils.lerp(target.y, targetHeight, dt * 4)
      target.z = MathUtils.lerp(target.z, reg.position.z, dt * 4)
    } else {
      target.x = MathUtils.lerp(target.x, 0, dt * 2)
      target.y = MathUtils.lerp(target.y, 0.8, dt * 2)
      target.z = MathUtils.lerp(target.z, -15, dt * 2)
    }

    const drag = consumeDrag()
    const dragXMultiplier = (camSettings.invertX ? -1 : 1) * camSettings.sensitivity
    const dragYMultiplier = (camSettings.invertY ? 1 : -1) * camSettings.sensitivity

    yaw.current += drag.x * 0.004 * dragXMultiplier
    pitch.current = clampPitch(pitch.current + drag.y * 0.003 * dragYMultiplier)

    if (isDown('KeyW', 'Equal')) distance.current -= 70 * dt * camSettings.zoomSpeed
    if (isDown('KeyS', 'Minus')) distance.current += 70 * dt * camSettings.zoomSpeed
    distance.current += consumeWheel() * 0.14 * camSettings.zoomSpeed
    distance.current = clampDistance(distance.current)

    desired.current = calculateOrbitPosition(target, yaw.current, pitch.current, distance.current)
    camera.position.lerp(desired.current, 1 - Math.exp(-camSettings.smoothing * dt))
    camera.lookAt(target)
  })

  return null
}
