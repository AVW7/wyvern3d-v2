import { describe, expect, it } from 'vitest'
import type { AnimationClip, Object3D } from 'three'
import { getAsset } from '@/render/assets/manifest'
import {
  extraPitchFromSlider,
  gazeBlendFromWeight,
  scaleLegTuck,
  scaleNeckStream,
  tailAggressionFromWave,
  tailSpeedForStiffness,
  verticalSpeedFromPitch,
  wingTurbulenceFromSlider,
  applySpeedPreset,
  DEFAULT_SPEED_DYNAMICS,
} from './labDynamics'
import {
  annotatePresets,
  flightLabAltitude,
  parseLabSearch,
  resolveClipName,
  resolveRequestedState,
  serializeLabSearch,
  speciesIndexFor,
} from './labPresets'
import { composerWingPitch } from './labComposer'
import {
  evaluateLabContract,
  formatPoseExport,
  telemetryChanged,
  EMPTY_TELEMETRY,
} from './labTelemetry'

describe('labPresets', () => {
  it('resolves aliases instead of inventing missing states', () => {
    expect(resolveRequestedState('landing')).toBe('land')
    expect(resolveRequestedState('perched')).toBe('perch')
    expect(resolveRequestedState('not-a-clip')).toBeUndefined()
  })

  it('reads clips from the selected asset, not a hard-coded species', () => {
    expect(resolveClipName('wyvern.gothic', 'sleep')).toBe('rest')
    expect(resolveClipName('wyvern.gothic', 'cruise')).toBe('cruise')
    expect(resolveClipName('wyvern.gothic', 'attack')).toBe('attack')
    const gothic = getAsset('wyvern.gothic')
    expect(gothic).toBeDefined()
    const annotated = annotatePresets('wyvern.gothic')
    const sleep = annotated.find((preset) => preset.id === 'sleep')
    expect(sleep?.clip).toBe('rest')
    expect(sleep?.shared).toBeGreaterThan(1)
  })

  it('drops stale deep-link values instead of remapping them', () => {
    const parsed = parseLabSearch({
      species: 'wyvern.notreal',
      state: 'tpose',
      camera: 'iso',
      theme: 'neon',
      speed: 'nope',
      procedural: 'maybe',
    })
    expect(parsed).toEqual({})
  })

  it('parses and serializes a shareable lab view', () => {
    const parsed = parseLabSearch({
      species: 'wyvern.gothic',
      state: 'cruise',
      procedural: '1',
      auto: 'true',
      speed: '22',
      camera: 'front',
      theme: 'light',
    })
    expect(parsed).toEqual({
      speciesIndex: speciesIndexFor('wyvern.gothic'),
      state: 'cruise',
      procedural: true,
      auto: true,
      speed: 22,
      camera: 'front',
      theme: 'light',
    })
    expect(
      serializeLabSearch({
        speciesIndex: speciesIndexFor('wyvern.gothic'),
        state: 'cruise',
        procedural: true,
        auto: true,
        speed: 22,
        camera: 'front',
        theme: 'light',
      }),
    ).toBe('?species=wyvern.gothic&state=cruise&procedural=1&auto=1&speed=22&camera=front&theme=light')
  })

  it('lifts only airborne states off the floor', () => {
    expect(flightLabAltitude('cruise')).toBe(4)
    expect(flightLabAltitude('climb')).toBe(4)
    expect(flightLabAltitude('idle')).toBe(0)
    expect(flightLabAltitude('walk')).toBe(0)
  })

  it('resolves climb clip to cruise in Gothic V2', () => {
    expect(resolveRequestedState('climb')).toBe('climb')
    expect(resolveClipName('wyvern.gothic', 'climb')).toBe('cruise')
  })
})

describe('labDynamics', () => {
  it('turns the pitch slider into a climb/sink the director can read', () => {
    expect(verticalSpeedFromPitch(18, 0)).toBeCloseTo(0)
    expect(verticalSpeedFromPitch(18, -25)).toBeLessThan(0)
    expect(verticalSpeedFromPitch(18, 20)).toBeGreaterThan(0)
    expect(extraPitchFromSlider(45)).toBeCloseTo(Math.PI / 4)
  })

  it('scales isolation-adjacent sliders instead of ignoring them', () => {
    expect(gazeBlendFromWeight(0, 10)).toBe(0)
    expect(gazeBlendFromWeight(1, 10)).toBeCloseTo(0.4)
    expect(scaleNeckStream(-0.2, 0)).toBeCloseTo(-0.07)
    expect(scaleNeckStream(-0.2, 1)).toBeCloseTo(-0.2)
    expect(tailSpeedForStiffness(18, 2)).toBe(36)
    expect(tailAggressionFromWave(0.3)).toBe(2)
    expect(scaleLegTuck(0.4, 0)).toBe(0)
    expect(wingTurbulenceFromSlider(0.3, 6)).toBeCloseTo(0.6)
  })

  it('applies named speed presets onto the live dynamics object', () => {
    const dive = applySpeedPreset(DEFAULT_SPEED_DYNAMICS, 'dive')
    expect(dive.airspeed).toBe(50)
    expect(dive.pitchAngle).toBe(-25)
    expect(dive.legTuckWeight).toBe(1.2)

    const speed = applySpeedPreset(DEFAULT_SPEED_DYNAMICS, 'speed')
    expect(speed.airspeed).toBe(42)
    expect(speed.pitchAngle).toBe(-4)
    expect(speed.tailStiffness).toBe(1.6)
    expect(speed.wingFlutterFreq).toBe(3.8)
  })

  it('preserves signed leg tuck for hover drop vs sprint tuck', async () => {
    const { legTuckTarget } = await import('@/render/flightPose')
    // Hover airspeed = 0 must produce negative offset (leg release / drop)
    expect(legTuckTarget(0, 18)).toBeLessThan(0)
    // Cruise airspeed = 18 must produce 0
    expect(legTuckTarget(18, 18)).toBe(0)
    // Sprint airspeed = 42 must produce positive offset (streamlined tuck)
    expect(legTuckTarget(42, 18)).toBeGreaterThan(0)
  })
})

describe('labTelemetry', () => {
  it('fails when core markers are missing', () => {
    const result = evaluateLabContract({
      requestedState: 'cruise',
      resolvedClip: 'cruise',
      clipName: 'cruise',
      markers: { head: false, tail: true, pelvis: false, wingL: true, wingR: true },
      bodyAxisDeg: 0,
      footDropL: 2,
      wingSpan: 10,
      poseComposer: false,
    })
    expect(result.status).toBe('fail')
  })

  it('warns on a grounded wing that is still cruise-open', () => {
    const result = evaluateLabContract({
      requestedState: 'walk',
      resolvedClip: 'walk',
      clipName: 'walk',
      markers: { head: true, tail: true, pelvis: true, wingL: true, wingR: true },
      bodyAxisDeg: 8,
      footDropL: 2.2,
      wingSpan: 22,
      poseComposer: false,
    })
    expect(result.status).toBe('warn')
    expect(result.notes.some((note) => note.includes('Grounded wing span'))).toBe(true)
  })

  it('never reports a green contract from slider fiction', () => {
    const result = evaluateLabContract({
      requestedState: 'cruise',
      resolvedClip: 'cruise',
      clipName: 'cruise',
      markers: { head: true, tail: true, pelvis: true, wingL: true, wingR: true },
      bodyAxisDeg: 4,
      footDropL: 2.4,
      wingSpan: 12,
      poseComposer: false,
    })
    expect(result.status).toBe('pass')
    const exportedTS = formatPoseExport({ ...EMPTY_TELEMETRY, airspeed: 18, clipName: 'cruise' })
    expect(exportedTS).toContain("clipName: 'cruise'")
    expect(exportedTS).toContain("import type { FlightPose, HeadNeckPose } from '@/render/flightPose'")
    expect(exportedTS).toContain('export const SAMPLED_FLIGHT_POSE: FlightPose = {')
    expect(exportedTS).toContain('export const SAMPLED_HEAD_NECK_POSE: HeadNeckPose = {')
    expect(
      telemetryChanged(EMPTY_TELEMETRY, { ...EMPTY_TELEMETRY, airspeed: 22 }),
    ).toBe(true)
  })

  it('calculates loop seam delta across tracks and flags seam violations', async () => {
    const { calculateClipLoopSeam } = await import('./labTelemetry')
    // Synthetic clip with closed seam
    const cleanClip = {
      tracks: [
        {
          name: 'Spine1.quaternion',
          times: [0, 1],
          values: [0, 0, 0, 1, 0, 0, 0, 1],
        },
      ],
    }
    expect(calculateClipLoopSeam(cleanClip)).toBe(0)

    // Synthetic clip with open seam (0.1 rad difference)
    const openClip = {
      tracks: [
        {
          name: 'Spine1.quaternion',
          times: [0, 1],
          values: [0, 0, 0, 1, Math.sin(0.05), 0, 0, Math.cos(0.05)],
        },
      ],
    }
    expect(calculateClipLoopSeam(openClip)).toBeCloseTo(0.1, 3)

    // Contract warns if seam delta exceeds 0.05 rad
    const contractResult = evaluateLabContract({
      requestedState: 'cruise',
      resolvedClip: 'cruise',
      clipName: 'cruise',
      markers: { head: true, tail: true, pelvis: true, wingL: true, wingR: true },
      bodyAxisDeg: 4,
      footDropL: 2.4,
      wingSpan: 12,
      poseComposer: false,
      seamRotationRad: 0.08,
    })
    expect(contractResult.status).toBe('warn')
    expect(contractResult.notes.some((n) => n.includes('Loop seam delta'))).toBe(true)
  })
})

describe('labComposer', () => {
  it('folds on shoulder pitch (X), not a Z sweep', () => {
    expect(composerWingPitch(1, 0, 0)).toBeCloseTo(-0.9)
    expect(composerWingPitch(0, 0.2, 0.1)).toBeCloseTo(0.3)
  })

  it('articulates Gothic V2 hand, digits, and membrane panels under fold and billow', async () => {
    const { applyComposerWings } = await import('./labComposer')
    const { Object3D } = await import('three')
    const { NEUTRAL_POSE_EDITS } = await import('./constants')

    const bones = new Map<string, Object3D>()
    const trackedNames = [
      'L_WingShoulder',
      'R_WingShoulder',
      'L_WingHand',
      'R_WingHand',
      'L_WingD0P2',
      'R_WingD0P2',
      'L_WingPanel0_0',
      'R_WingPanel0_0',
    ]
    for (const name of trackedNames) {
      bones.set(name, new Object3D())
    }

    applyComposerWings(bones, {
      ...NEUTRAL_POSE_EDITS,
      wingFold: 0.8,
      membraneBillow: 0.5,
    })

    // Spar D0 tip and panel 0 must have received rotations
    expect(bones.get('L_WingHand')?.quaternion.x).not.toBe(0)
    expect(bones.get('L_WingD0P2')?.quaternion.x).not.toBe(0)
    expect(bones.get('L_WingPanel0_0')?.quaternion.x).not.toBe(0)
    expect(bones.get('R_WingD0P2')?.quaternion.x).not.toBe(0)
  })
})

describe('labBones Gothic V2 resolution', () => {
  it('prioritizes Gothic V2 terminal bones in MARKER_ALIASES', async () => {
    const { MARKER_ALIASES } = await import('./labBones')
    expect(MARKER_ALIASES.tail?.[0]).toBe('Tail10')
    expect(MARKER_ALIASES.wingL?.[0]).toBe('L_WingD0P2')
    expect(MARKER_ALIASES.wingR?.[0]).toBe('R_WingD0P2')
    expect(MARKER_ALIASES.footL?.[0]).toBe('L_Foot')
    expect(MARKER_ALIASES.footR?.[0]).toBe('R_Foot')
    expect(MARKER_ALIASES.head?.[0]).toBe('Head')
    expect(MARKER_ALIASES.pelvis?.[0]).toBe('Body')
  })

  it('selects the full Gothic V2 chain over a partial legacy match', async () => {
    const { resolveBoneChain } = await import('./labBones')
    const { Object3D } = await import('three')

    const root = new Object3D()
    // Simulate Gothic V2 rig nodes
    const gothicBones = [
      'L_WingShoulder',
      'L_WingElbow',
      'L_WingWrist',
      'L_WingHand',
      'L_WingD0P0',
      'L_WingD0P1',
      'L_WingD0P2',
    ]
    for (const name of gothicBones) {
      const bone = new Object3D()
      bone.name = name
      root.add(bone)
    }

    const resolved = resolveBoneChain(root, [
      // Partial legacy match (only first 3 match):
      ['L_WingShoulder', 'L_WingElbow', 'L_WingWrist', 'L_WingFinger1', 'L_WingFinger2'],
      // Full Gothic V2 match (all 7 match):
      gothicBones,
    ])

    expect(resolved.length).toBe(7)
    expect(resolved.map((b) => b.name)).toEqual(gothicBones)
  })
})

describe('Gothic V2 live GLB telemetry & contract validation', () => {
  it('resolves all markers and satisfies contracts on real wyvern-gothic.glb', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { AnimationMixer, LoopOnce, Vector3 } = await import('three')
    const { MARKERS } = await import('./constants')
    const { MARKER_ALIASES, resolveFirstBone, resolveBoneChain } = await import('./labBones')
    const { evaluateLabContract } = await import('./labTelemetry')

    const glbPath = path.resolve(process.cwd(), 'public/models/wyvern-gothic.glb')
    const buf = fs.readFileSync(glbPath)

    // Strip textures for fast headless loading in node
    let offset = 12
    let json: {
      images?: unknown[]
      textures?: unknown[]
      samplers?: unknown[]
      materials?: unknown[]
      meshes?: { primitives?: { material?: unknown }[] }[]
    } | null = null
    let bin: Buffer | null = null
    while (offset < buf.length) {
      const size = buf.readUInt32LE(offset)
      const kind = buf.readUInt32LE(offset + 4)
      const body = buf.subarray(offset + 8, offset + 8 + size)
      if (kind === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
      else if (kind === 0x004e4942) bin = body
      offset += 8 + size
    }
    if (!json) throw new Error('Failed to parse GLTF header')
    delete json.images
    delete json.textures
    delete json.samplers
    delete json.materials
    for (const m of json.meshes || []) for (const p of m.primitives || []) delete p.material
    const jbuf = Buffer.from(JSON.stringify(json), 'utf8')
    const jpad = (4 - (jbuf.length % 4)) % 4
    const bpad = bin ? (4 - (bin.length % 4)) % 4 : 0
    const total = 12 + 8 + jbuf.length + jpad + (bin ? 8 + bin.length + bpad : 0)
    const out = Buffer.alloc(total)
    out.write('glTF', 0, 'ascii')
    out.writeUInt32LE(2, 4)
    out.writeUInt32LE(total, 8)
    let cur = 12
    out.writeUInt32LE(jbuf.length + jpad, cur)
    out.writeUInt32LE(0x4e4f534a, cur + 4)
    jbuf.copy(out, cur + 8)
    out.fill(0x20, cur + 8 + jbuf.length, cur + 8 + jbuf.length + jpad)
    cur += 8 + jbuf.length + jpad
    if (bin) {
      out.writeUInt32LE(bin.length + bpad, cur)
      out.writeUInt32LE(0x004e4942, cur + 4)
      bin.copy(out, cur + 8)
    }

    const gltf = (await new Promise((res, rej) =>
      new GLTFLoader().parse(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength), '', res, rej)
    )) as { scene: Object3D; animations: AnimationClip[] }
    const root = gltf.scene

    // 1. Assert all 5 markers resolve to real bones
    const resolvedMarkers = new Map<string, Object3D>()
    for (const marker of MARKERS) {
      const candidates = MARKER_ALIASES[marker.key] ?? [marker.bone]
      const bone = resolveFirstBone(root, candidates)
      expect(bone, `Marker ${marker.key} must resolve`).not.toBeNull()
      if (bone) resolvedMarkers.set(marker.key, bone)
    }

    // 2. Assert tail chain resolves full 10 bones
    const tailBones = resolveBoneChain(root, [
      ['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5', 'Tail6', 'Tail7', 'Tail8', 'Tail9', 'Tail10'],
    ])
    expect(tailBones.length).toBe(10)

    // 3. Assert spine resolves Spine1..3
    const spineBones = resolveBoneChain(root, [['Spine1', 'Spine2', 'Spine3']])
    expect(spineBones.length).toBe(3)

    // 4. Test evaluateLabContract on cruise and idle
    const mixer = new AnimationMixer(root)
    const FIT = 0.0072

    const sampleState = (clipName: string) => {
      const clip = gltf.animations.find((a) => a.name === clipName)
      expect(clip).toBeDefined()
      mixer.stopAllAction()
      const act = mixer.clipAction(clip as AnimationClip)
      act.setLoop(LoopOnce, 1)
      act.clampWhenFinished = true
      act.reset().play()
      act.time = 0
      mixer.update(0)
      root.updateMatrixWorld(true)

      const pts = {
        head: new Vector3(),
        tail: new Vector3(),
        pelvis: new Vector3(),
        footL: new Vector3(),
        wingL: new Vector3(),
        wingR: new Vector3(),
      }
      resolvedMarkers.get('head')?.getWorldPosition(pts.head)
      resolvedMarkers.get('tail')?.getWorldPosition(pts.tail)
      resolvedMarkers.get('pelvis')?.getWorldPosition(pts.pelvis)
      resolvedMarkers.get('footL')?.getWorldPosition(pts.footL)
      resolvedMarkers.get('wingL')?.getWorldPosition(pts.wingL)
      resolvedMarkers.get('wingR')?.getWorldPosition(pts.wingR)

      const bodyAxisDeg =
        (Math.atan2(pts.head.y - pts.tail.y, Math.hypot(pts.head.x - pts.tail.x, pts.head.z - pts.tail.z)) * 180) /
        Math.PI
      const footDropL = pts.pelvis.y - pts.footL.y
      const wingSpan = pts.wingL.distanceTo(pts.wingR) * FIT

      return { bodyAxisDeg, footDropL, wingSpan }
    }

    // Cruise
    const cruise = sampleState('cruise')
    expect(cruise.wingSpan).toBeGreaterThan(30)
    const cruiseContract = evaluateLabContract({
      requestedState: 'cruise',
      resolvedClip: 'cruise',
      clipName: 'cruise',
      markers: { head: true, tail: true, pelvis: true, wingL: true, wingR: true },
      bodyAxisDeg: cruise.bodyAxisDeg,
      footDropL: cruise.footDropL,
      wingSpan: cruise.wingSpan,
      poseComposer: false,
    })
    expect(cruiseContract.status).toBe('pass')

    // Idle
    const idle = sampleState('idle')
    expect(idle.wingSpan).toBeLessThan(18)
    const idleContract = evaluateLabContract({
      requestedState: 'idle',
      resolvedClip: 'idle',
      clipName: 'idle',
      markers: { head: true, tail: true, pelvis: true, wingL: true, wingR: true },
      bodyAxisDeg: idle.bodyAxisDeg,
      footDropL: idle.footDropL,
      wingSpan: idle.wingSpan,
      poseComposer: false,
    })
    expect(idleContract.status).toBe('pass')

    // 5. Assert Gothic V2 membrane panels resolve and flutter
    const {
      GOTHIC_LEFT_WING_PANEL_NAMES,
      GOTHIC_RIGHT_WING_PANEL_NAMES,
      applyMembranePanelFlutter,
    } = await import('@/render/wingRefinement')
    const panelsL: Object3D[] = []
    for (const name of GOTHIC_LEFT_WING_PANEL_NAMES) {
      const b = root.getObjectByName(name)
      expect(b, `Panel ${name} must exist on live GLTF`).toBeDefined()
      if (b) panelsL.push(b)
    }
    const panelsR: Object3D[] = []
    for (const name of GOTHIC_RIGHT_WING_PANEL_NAMES) {
      const b = root.getObjectByName(name)
      expect(b, `Panel ${name} must exist on live GLTF`).toBeDefined()
      if (b) panelsR.push(b)
    }
    expect(panelsL.length).toBe(8)
    expect(panelsR.length).toBe(8)

    // Apply membrane panel flutter
    applyMembranePanelFlutter(panelsL, panelsR, 25, 0.2, 0, 1.0, 3.0)
    expect(panelsL[0]!.quaternion.x).not.toBe(0)
    expect(panelsR[0]!.quaternion.x).not.toBe(0)

    // 6. Assert Gothic V2 3-joint spine maintains Spine1 leg base stability
    const { propagateSpineWave } = await import('@/render/spineWave')
    // Reset spine bone rotations
    for (const b of spineBones) b.quaternion.set(0, 0, 0, 1)
    propagateSpineWave(spineBones, 0.25, 30, 0)
    const spineRot0 = Math.abs(spineBones[0]!.quaternion.x)
    const spineRot1 = Math.abs(spineBones[1]!.quaternion.x)
    const spineRot2 = Math.abs(spineBones[2]!.quaternion.x)
    expect(spineRot0).toBeLessThan(spineRot1)
    expect(spineRot0).toBeLessThan(spineRot2)

    // 7. Assert Gothic V2 live clip loop seams are tightly closed
    const { calculateClipLoopSeam } = await import('./labTelemetry')
    const cruiseClip = gltf.animations.find((a) => a.name === 'cruise')
    expect(cruiseClip).toBeDefined()
    const cruiseSeam = calculateClipLoopSeam(cruiseClip!)
    expect(cruiseSeam).toBeLessThan(0.005)
  })
})
