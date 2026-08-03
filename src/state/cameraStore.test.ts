import { describe, expect, it, beforeEach } from 'vitest'
import { useCameraStore, CAMERA_PRESETS } from './cameraStore'

describe('cameraStore', () => {
  beforeEach(() => {
    useCameraStore.getState().resetDefaults()
  })

  it('has valid default configuration', () => {
    const state = useCameraStore.getState()
    expect(state.sensitivity).toBe(1.0)
    expect(state.zoomSpeed).toBe(1.0)
    expect(state.fov).toBe(60)
    expect(state.preset).toBe('default')
  })

  it('clamps sensitivity and zoomSpeed to valid range', () => {
    const { setSensitivity, setZoomSpeed } = useCameraStore.getState()

    setSensitivity(0.05)
    expect(useCameraStore.getState().sensitivity).toBe(0.2)

    setSensitivity(10)
    expect(useCameraStore.getState().sensitivity).toBe(2.5)

    setZoomSpeed(-1)
    expect(useCameraStore.getState().zoomSpeed).toBe(0.2)
  })

  it('applies presets correctly and updates presetToken', () => {
    const initialToken = useCameraStore.getState().presetToken
    useCameraStore.getState().applyPreset('topDown')

    const state = useCameraStore.getState()
    expect(state.preset).toBe('topDown')
    expect(state.fov).toBe(CAMERA_PRESETS.topDown.fov)
    expect(state.targetPitch).toBe(CAMERA_PRESETS.topDown.pitch)
    expect(state.presetToken).toBeGreaterThan(initialToken)
  })

  it('resets to defaults on resetDefaults()', () => {
    useCameraStore.getState().setSensitivity(2.0)
    useCameraStore.getState().setInvertY(true)
    useCameraStore.getState().setFollowTarget('wyvern')
    useCameraStore.getState().resetDefaults()

    const state = useCameraStore.getState()
    expect(state.sensitivity).toBe(1.0)
    expect(state.invertY).toBe(false)
    expect(state.followTarget).toBe('character')
    expect(state.wyvernTargetPosition).toBeNull()
  })

  it('applies followWyvern preset and sets followTarget to wyvern', () => {
    useCameraStore.getState().applyPreset('followWyvern')

    const state = useCameraStore.getState()
    expect(state.preset).toBe('followWyvern')
    expect(state.followTarget).toBe('wyvern')
    expect(state.fov).toBe(CAMERA_PRESETS.followWyvern.fov)
    expect(state.targetPitch).toBe(CAMERA_PRESETS.followWyvern.pitch)
  })

  it('manages setFollowTarget and setWyvernTargetPosition correctly', () => {
    useCameraStore.getState().setFollowTarget('wyvern')
    expect(useCameraStore.getState().followTarget).toBe('wyvern')

    useCameraStore.getState().setWyvernTargetPosition([10, 25, -15])
    expect(useCameraStore.getState().wyvernTargetPosition).toEqual([10, 25, -15])

    useCameraStore.getState().applyPreset('default')
    expect(useCameraStore.getState().followTarget).toBe('character')
  })
})
