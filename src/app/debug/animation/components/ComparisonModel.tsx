'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Group, Matrix4, Vector3 } from 'three'
import type { AnimationMixer } from 'three'
import { GameModel } from '@/render/assets/GameModel'
import type { AssetId, ModelState } from '@/render/assets/manifest'
import { scrubMixerActions } from '../labMixer'
import { resolveClipName } from '../labPresets'

/**
 * A second model beside the rig under review, for A/B against v1.
 *
 * Switching the species picker back and forth compares two things from memory,
 * which is exactly the review that let a cruise loop with a 5.3-degree stroke
 * ship past a reviewed contact sheet. Two models on screen at once compares them
 * structurally instead.
 *
 * Deliberately inert: no telemetry, no camera, no prey field, no breath VFX, and
 * no procedural attitude. `FlightLabRigContainer` owns all of that for the rig
 * under review, and a comparison that also drove them would either fight it or
 * silently report the wrong model's numbers. This mounts geometry playing a clip
 * and nothing else — plus scrub parity, without which a frozen lab could only
 * ever compare the main rig's chosen frame against whatever frame the
 * comparison happened to be on.
 *
 * The clip is resolved through `resolveClipName` the same way the main rig does,
 * so a state maps to whatever that asset actually calls it -- v1's clips are
 * named `SKM_DaenerysDragon|...` and the gothic model's are not, so a shared
 * literal would leave one of the two standing in its bind pose.
 */
export function ComparisonModel({
  id,
  state,
  scale,
  frozen,
  scrub,
  offset,
}: {
  id: AssetId
  state: ModelState
  scale: number
  frozen: boolean
  /** Cycle fraction (0-1) applied when frozen, mirroring the rig's scrub. */
  scrub: number | null
  /**
   * Separation from the rig, in world units, applied along the camera's own
   * right vector rather than a fixed axis.
   *
   * A fixed axis cannot work here, and both choices were tried. The lab's `side`
   * camera sits on +X looking back along it and `front` sits on +Z, so an X
   * offset puts the comparison straight down the lens of one preset and a Z
   * offset down the lens of the other. Down the lens it is not beside the rig at
   * all -- it is in front of it, and perspective renders it two to three times
   * the size, which reads as a broken model rather than a camera artefact.
   *
   * Tracking the camera keeps the pair broadside from every preset, which is the
   * only arrangement in which their silhouettes can be compared at all.
   */
  offset: number
}) {
  // `resolveClipName` reports the clip this asset maps the state to; GameModel
  // does its own mapping from the same manifest, so passing the state through is
  // correct -- this call is what makes an unmapped state visible as a fallback
  // rather than as a mystery bind pose.
  const mapped = resolveClipName(id, state)
  const group = useRef<Group>(null)
  const mixerRef = useRef<AnimationMixer | null>(null)
  const camera = useThree((three) => three.camera)
  const right = useRef(new Vector3())
  const inverse = useRef(new Matrix4())

  // Hold the latest frozen/scrub in refs so a scrub drag does not re-render the
  // R3F subtree (the same anti-flicker pattern the container uses for poseEdits).
  const frozenRef = useRef(frozen)
  frozenRef.current = frozen
  const scrubRef = useRef(scrub)
  scrubRef.current = scrub

  useEffect(
    () => () => {
      mixerRef.current = null
    },
    [],
  )

  useFrame(() => {
    const mixer = mixerRef.current
    if (mixer && frozenRef.current && scrubRef.current !== null) {
      scrubMixerActions(mixer, scrubRef.current)
    }

    const node = group.current
    if (!node?.parent) return
    // Column 0 of the's world matrix is its right vector.
    const e = camera.matrixWorld.elements
    right.current.set(e[0]!, e[1]!, e[2]!).normalize()
    // The parent is the rig's attitude group, which pitches and banks, so the
    // world-space right has to come back into that group's local space or the
    // comparison would swing with the rig's roll instead of holding station.
    node.parent.updateWorldMatrix(true, false)
    inverse.current.copy(node.parent.matrixWorld).invert()
    node.position
      .copy(right.current.transformDirection(inverse.current))
      .multiplyScalar(offset)
  })

  return (
    <group ref={group} name={`comparison:${id}:${mapped ?? 'unmapped'}`}>
      <GameModel
        id={id}
        state={state}
        scale={scale}
        frozen={frozen}
        manualMixer={false}
        onReady={(_, mixer) => {
          mixerRef.current = mixer
        }}
        fallback={null}
      />
    </group>
  )
}
