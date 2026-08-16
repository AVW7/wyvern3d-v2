import { useCallback, useEffect, useRef } from 'react'
import { Box3, PerspectiveCamera, Sphere, Vector3 } from 'three'
import type { Camera, Group } from 'three'
import { CAMERAS } from '../constants'
import type { LabCamera } from '../FlightLab'

interface LabCameraControls {
  target: Vector3
  update: () => void
  minDistance?: number
  maxDistance?: number
}

export function useLabCamera({
  modelRoot,
  box,
  cameraPreset,
  threeCamera,
  threeControls,
  centerTrigger,
  zoomFitTrigger,
  zoomInTrigger,
  zoomOutTrigger,
  resetCamTrigger,
}: {
  modelRoot: { current: Group | null }
  box: Box3
  cameraPreset: LabCamera
  threeCamera: Camera
  threeControls: unknown
  centerTrigger: number
  zoomFitTrigger: number
  zoomInTrigger: number
  zoomOutTrigger: number
  resetCamTrigger: number
}): void {
  const lastCenter = useRef(centerTrigger)
  const lastZoomFit = useRef(zoomFitTrigger)
  const lastZoomIn = useRef(zoomInTrigger)
  const lastZoomOut = useRef(zoomOutTrigger)
  const lastResetCam = useRef(resetCamTrigger)

  const getModelCenter = useCallback((): Vector3 => {
    const center = new Vector3()
    if (modelRoot.current) {
      modelRoot.current.updateWorldMatrix(true, true)
      const liveBox = new Box3().setFromObject(modelRoot.current, true)
      if (!liveBox.isEmpty()) {
        liveBox.getCenter(center)
        return center
      }
    }
    if (!box.isEmpty()) {
      box.getCenter(center)
      return center
    }
    return new Vector3(0, 25, 0)
  }, [box, modelRoot])

  useEffect(() => {
    const controls = threeControls as LabCameraControls | null
    if (!controls) return
    let updated = false

    if (centerTrigger > lastCenter.current) {
      lastCenter.current = centerTrigger
      const center = getModelCenter()
      const delta = new Vector3().subVectors(center, controls.target)
      controls.target.copy(center)
      threeCamera.position.add(delta)
      updated = true
    }

    if (zoomFitTrigger > lastZoomFit.current) {
      lastZoomFit.current = zoomFitTrigger
      const center = getModelCenter()
      let radius = 35
      if (modelRoot.current) {
        modelRoot.current.updateWorldMatrix(true, true)
        const liveBox = new Box3().setFromObject(modelRoot.current, true)
        if (!liveBox.isEmpty()) {
          const sphere = new Sphere()
          liveBox.getBoundingSphere(sphere)
          radius = Math.max(sphere.radius, 12)
        }
      }
      const perspCamera = threeCamera as PerspectiveCamera
      const fovRad = ((perspCamera.fov ?? 35) * Math.PI) / 180
      const fitDistance = (radius / Math.sin(fovRad / 2)) * 1.15
      const dir = new Vector3().subVectors(perspCamera.position, controls.target)
      if (dir.lengthSq() < 0.0001) dir.set(0, 0.5, 1)
      dir.normalize()
      controls.target.copy(center)
      perspCamera.position.copy(center).addScaledVector(dir, fitDistance)
      updated = true
    }

    if (zoomInTrigger > lastZoomIn.current) {
      lastZoomIn.current = zoomInTrigger
      const center = getModelCenter()
      controls.target.copy(center)
      const dir = new Vector3().subVectors(threeCamera.position, center)
      const newDist = Math.max(dir.length() * 0.75, controls.minDistance ?? 20)
      dir.normalize().multiplyScalar(newDist)
      threeCamera.position.copy(center).add(dir)
      updated = true
    }

    if (zoomOutTrigger > lastZoomOut.current) {
      lastZoomOut.current = zoomOutTrigger
      const center = getModelCenter()
      controls.target.copy(center)
      const dir = new Vector3().subVectors(threeCamera.position, center)
      const newDist = Math.min(dir.length() * 1.35, controls.maxDistance ?? 600)
      dir.normalize().multiplyScalar(newDist)
      threeCamera.position.copy(center).add(dir)
      updated = true
    }

    if (resetCamTrigger > lastResetCam.current) {
      lastResetCam.current = resetCamTrigger
      const preset = CAMERAS[cameraPreset] ?? CAMERAS.side
      if (preset) {
        controls.target.set(preset.target[0], preset.target[1], preset.target[2])
        threeCamera.position.set(preset.position[0], preset.position[1], preset.position[2])
        updated = true
      }
    }

    if (updated) controls.update()
  }, [
    centerTrigger,
    zoomFitTrigger,
    zoomInTrigger,
    zoomOutTrigger,
    resetCamTrigger,
    cameraPreset,
    threeCamera,
    threeControls,
    getModelCenter,
    modelRoot,
  ])

  useEffect(() => {
    const controls = threeControls as LabCameraControls | null
    if (!controls) return
    const preset = CAMERAS[cameraPreset] ?? CAMERAS.side
    if (!preset) return
    controls.target.set(preset.target[0], preset.target[1], preset.target[2])
    threeCamera.position.set(preset.position[0], preset.position[1], preset.position[2])
    controls.update()
  }, [cameraPreset, threeCamera, threeControls])
}
