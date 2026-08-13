import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./GameModel.tsx', import.meta.url), 'utf8')

describe('GameModel GLTF animation runtime contract', () => {
  it('reads GLTF animations from the loader payload and binds its mixer to the cloned skeleton', () => {
    // GLTFLoader exposes AnimationClip[] on the GLTF result, not on scene.
    // The mixer must be rooted at the per-instance SkeletonUtils clone so that
    // tracks resolve against this wyvern's bones rather than a null/shared tree.
    expect(source).toContain('const { scene, animations } = useGLTF(url)')
    expect(source).not.toContain('scene.animations')
    expect(source).toContain('new AnimationMixer(cloned)')
  })

  it('honours the model-library world toggle before loading a GLB', () => {
    expect(source).toContain('library.disabled[id] !== true')
    expect(source).toContain('if (!enabled || !entry || !entry.url)')
  })

  it('honours manifest transitions, phase families, playback rate, and exact finish events', () => {
    expect(source).toContain('setActive(chained)')
    expect(source).toContain('const chainedFrom = override === null ? active : null')
    expect(source).toContain('previousSpec?.phaseGroup === playingSpec.phaseGroup')
    expect(source).toContain('synchronizedPhase * clip.duration')
    expect(source).toContain('action.timeScale = playingSpec.timeScale ?? 1')
    expect(source).toContain('event.action !== action')
    expect(source).toContain('onActionFinished?.(completed)')
  })
})
