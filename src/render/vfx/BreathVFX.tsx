import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
} from 'three'
import {
  BREATH_VFX_DURATION_SECONDS,
  BREATH_VFX_EMBER_COUNT,
  BREATH_VFX_SMOKE_COUNT,
  breathEnvelope,
  breathRadiusAt,
  breathSeed,
} from './breathVfxMath'

interface BreathVFXProps {
  /** Gameplay range in world metres — the jet uses the same range as the hit cone. */
  range: number
  /** Starts a burst on its rising edge; the VFX owns its short release tail. */
  active: boolean
  /** Retriggers the burst when a new gameplay action begins before the old tail ends. */
  trigger?: number
  /** Actual dragon head on this cloned model instance. */
  socketRef: RefObject<Object3D | null>
  /** The final neck bones establish a stable skull-forward direction. */
  neckRef: RefObject<Object3D[]>
  /** Stable per-actor cosmetic variation; never touches the combat RNG. */
  seed?: number
  /** Optional pre-baked fire jet flipbook sprite atlas. */
  fireAtlasTexture?: Texture | null
  /** Rows and columns in the sprite atlas grid (default [6, 6]). */
  atlasGrid?: [number, number]
}

interface BreathRuntime {
  elapsed: number | null
  envelope: number
  progress: number
}

const JET_FORWARD = new Vector3(0, 0, 1)
const MOUTH_FORWARD_OFFSET = 1.35

/**
 * A reusable breath-effect scaffold.
 *
 * It deliberately contains no hit detection: `core/combat/encounter.ts` remains
 * the sole combat authority. This component only follows the rig, draws the
 * same cone the sim already uses, and exposes an optional trigger for later
 * impact/ability events.
 */
export function BreathVFX({
  range,
  active,
  trigger = 0,
  socketRef,
  neckRef,
  seed = 0,
  fireAtlasTexture,
  atlasGrid = [6, 6],
}: BreathVFXProps) {
  const groupRef = useRef<Group>(null)
  const lightRef = useRef<PointLight>(null)
  const impactRef = useRef<Group>(null)
  const emberRef = useRef<InstancedMesh>(null)
  const smokeRef = useRef<InstancedMesh>(null)
  const runtime = useRef<BreathRuntime>({ elapsed: null, envelope: 0, progress: 0 })
  const socketWorld = useRef(new Vector3())
  const neckWorld = useRef(new Vector3())
  const forwardWorld = useRef(new Vector3())
  const parentWorldRotation = useRef(new Quaternion())
  const jetWorldRotation = useRef(new Quaternion())
  const particleDummy = useMemo(() => new Object3D(), [])
  const emberGeometry = useMemo(() => new SphereGeometry(0.12, 6, 4), [])
  const smokeGeometry = useMemo(() => new SphereGeometry(0.32, 7, 5), [])
  const emberMaterial = useMemo(
    () => new MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.92, depthWrite: false, blending: AdditiveBlending }),
    [],
  )
  const smokeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: '#5b3428', transparent: true, opacity: 0.18, depthWrite: false, blending: AdditiveBlending }),
    [],
  )
  const emberSeeds = useMemo(
    () => Array.from({ length: BREATH_VFX_EMBER_COUNT }, (_, index) => particleSeed(index, seed)),
    [seed],
  )
  const smokeSeeds = useMemo(
    () => Array.from({ length: BREATH_VFX_SMOKE_COUNT }, (_, index) => particleSeed(index, seed + 71)),
    [seed],
  )

  useEffect(
    () => () => {
      emberGeometry.dispose()
      smokeGeometry.dispose()
      emberMaterial.dispose()
      smokeMaterial.dispose()
    }, [emberGeometry, emberMaterial, smokeGeometry, smokeMaterial])

  useEffect(() => {
    if (active) runtime.current.elapsed = 0
  }, [active, trigger])

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    const socket = socketRef.current
    if (!group || !socket) return

    const parent = group.parent
    if (!parent) return

    // The head is a stable attachment point; the tangent from the final neck
    // link to that head is the dragon's actual fire direction, independent of
    // the lower jaw opening or an artist's helper bones.
    socket.getWorldPosition(socketWorld.current)
    const neck = neckRef.current.at(-1)
    if (neck) {
      neck.getWorldPosition(neckWorld.current)
      forwardWorld.current.copy(socketWorld.current).sub(neckWorld.current)
    } else {
      socket.getWorldDirection(forwardWorld.current)
    }
    if (forwardWorld.current.lengthSq() < 1e-6) forwardWorld.current.copy(JET_FORWARD)
    forwardWorld.current.normalize()
    socketWorld.current.addScaledVector(forwardWorld.current, MOUTH_FORWARD_OFFSET)

    parent.updateWorldMatrix(true, false)
    parent.worldToLocal(socketWorld.current)
    group.position.copy(socketWorld.current)
    jetWorldRotation.current.setFromUnitVectors(JET_FORWARD, forwardWorld.current)
    parent.getWorldQuaternion(parentWorldRotation.current)
    group.quaternion.copy(parentWorldRotation.current).invert().multiply(jetWorldRotation.current)

    // Geometry is authored in world metres while the dragon asset has its own
    // scale. Counter-scale the VFX root so a 26-unit breath remains 26 units.
    const parentScale = parent.getWorldScale(forwardWorld.current).length() / Math.sqrt(3)
    group.scale.setScalar(parentScale > 1e-6 ? 1 / parentScale : 1)

    const elapsed = runtime.current.elapsed
    if (elapsed === null) {
      group.visible = false
      return
    }

    const nextElapsed = elapsed + Math.min(rawDelta, 0.05)
    runtime.current.elapsed = nextElapsed
    runtime.current.progress = Math.min(nextElapsed / BREATH_VFX_DURATION_SECONDS, 1)
    runtime.current.envelope = breathEnvelope(nextElapsed)
    if (runtime.current.progress >= 1) {
      if (active) {
        runtime.current.elapsed = 0
        runtime.current.progress = 0
      } else {
        group.visible = false
        runtime.current.elapsed = null
        return
      }
    }

    const envelope = runtime.current.envelope
    group.visible = envelope > 0.001
    updateParticles(
      emberRef.current,
      emberSeeds,
      particleDummy,
      runtime.current.progress,
      envelope,
      range,
      false,
    )
    updateParticles(
      smokeRef.current,
      smokeSeeds,
      particleDummy,
      runtime.current.progress,
      envelope,
      range,
      true,
    )
    if (lightRef.current) {
      lightRef.current.intensity = envelope * (4.5 + Math.sin(nextElapsed * 42) * 1.2)
    }
    if (impactRef.current) {
      const impactScale = 0.65 + envelope * (0.5 + Math.sin(nextElapsed * 30) * 0.08)
      impactRef.current.scale.setScalar(impactScale)
    }
  })

  const terminalRadius = breathRadiusAt(range)

  return (
    <group ref={groupRef} visible={false}>
      {fireAtlasTexture ? (
        <>
          <FireAtlasSheet runtime={runtime} width={terminalRadius * 1.5} length={range} texture={fireAtlasTexture} grid={atlasGrid} rotation={0} />
          <FireAtlasSheet runtime={runtime} width={terminalRadius * 1.4} length={range * 0.95} texture={fireAtlasTexture} grid={atlasGrid} rotation={Math.PI / 3} />
          <FireAtlasSheet runtime={runtime} width={terminalRadius * 1.4} length={range * 0.95} texture={fireAtlasTexture} grid={atlasGrid} rotation={-Math.PI / 3} />
        </>
      ) : (
        <>
          <FireSheet runtime={runtime} width={terminalRadius * 0.44} length={range * 0.94} color="#fff3c1" core />
          <FireSheet runtime={runtime} width={terminalRadius * 1.6} length={range} color="#ff7a18" rotation={0} />
          <FireSheet runtime={runtime} width={terminalRadius * 1.45} length={range * 0.96} color="#ef3d08" rotation={Math.PI / 3} />
          <FireSheet runtime={runtime} width={terminalRadius * 1.2} length={range * 0.9} color="#ff9b2f" rotation={-Math.PI / 3} />
        </>
      )}

      <instancedMesh ref={emberRef} args={[emberGeometry, emberMaterial, BREATH_VFX_EMBER_COUNT]} frustumCulled={false} />
      <instancedMesh ref={smokeRef} args={[smokeGeometry, smokeMaterial, BREATH_VFX_SMOKE_COUNT]} frustumCulled={false} />

      {/* Temporary range-end impact. Future combat events can replace this with
          the exact struck target/terrain position without changing the jet. */}
      <group ref={impactRef} position={[0, 0, range]}>
        <mesh>
          <sphereGeometry args={[terminalRadius * 0.16, 12, 8]} />
          <meshBasicMaterial color="#ffde91" transparent opacity={0.66} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
        <mesh scale={1.7}>
          <sphereGeometry args={[terminalRadius * 0.12, 10, 7]} />
          <meshBasicMaterial color="#ff5a10" transparent opacity={0.32} depthWrite={false} blending={AdditiveBlending} wireframe />
        </mesh>
      </group>

      <pointLight ref={lightRef} color="#ff7a18" intensity={0} distance={12} decay={2} position={[0, 0, 2]} />
    </group>
  )
}

function FireSheet({
  runtime,
  width,
  length,
  color,
  rotation = 0,
  core = false,
}: {
  runtime: RefObject<BreathRuntime>
  width: number
  length: number
  color: string
  rotation?: number
  core?: boolean
}) {
  const material = useMemo(() => createFlameMaterial(color, core), [color, core])

  useEffect(() => () => material.dispose(), [material])
  useFrame((state) => {
    const current = runtime.current
    material.uniforms.uTime!.value = state.clock.elapsedTime
    material.uniforms.uAlpha!.value = current.envelope
  })

  return (
    <mesh position={[0, 0, length / 2]} rotation={[Math.PI / 2, rotation, 0]}>
      <planeGeometry args={[width, length, 1, 12]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function createFlameMaterial(color: string, core: boolean): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uColor: { value: new Color(color) },
      uCore: { value: core ? 1 : 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        float along = uv.y;
        float flutter = sin(uTime * 19.0 + along * 15.0) * 0.08
          + sin(uTime * 7.0 + along * 31.0) * 0.05;
        transformed.x *= mix(0.16, 1.0, along);
        transformed.x += flutter * (0.15 + along * 0.85);
        transformed.z += sin(uTime * 13.0 + along * 24.0) * 0.12 * along;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor;
      uniform float uCore;
      varying vec2 vUv;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(41.23, 289.17))) * 38191.517);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float edge = 1.0 - smoothstep(0.18, 1.0, abs(vUv.x - 0.5) * 2.0);
        float tip = 1.0 - smoothstep(0.68, 1.0, vUv.y);
        float turbulence = noise(vec2(vUv.y * 8.0 - uTime * 3.6, vUv.x * 5.0));
        float brokenEdge = smoothstep(0.06, 0.88, turbulence + edge * 0.78);
        float alpha = edge * tip * brokenEdge * uAlpha * mix(0.82, 1.0, uCore);
        vec3 hot = mix(uColor, vec3(1.0, 0.92, 0.67), uCore * (1.0 - vUv.y));
        gl_FragColor = vec4(hot, alpha);
      }
    `,
  })
}

function FireAtlasSheet({
  runtime,
  width,
  length,
  texture,
  grid,
  rotation = 0,
}: {
  runtime: RefObject<BreathRuntime>
  width: number
  length: number
  texture: Texture
  grid: [number, number]
  rotation?: number
}) {
  const material = useMemo(
    () => createAtlasFlameMaterial(texture, grid),
    [texture, grid],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const current = runtime.current
    material.uniforms.uProgress!.value = current.progress
    material.uniforms.uAlpha!.value = current.envelope
  })

  return (
    <mesh position={[0, 0, length / 2]} rotation={[Math.PI / 2, rotation, 0]}>
      <planeGeometry args={[width, length, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function createAtlasFlameMaterial(texture: Texture, grid: [number, number]): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: {
      uAtlas: { value: texture },
      uGrid: { value: new Vector2(grid[1], grid[0]) },
      uProgress: { value: 0 },
      uAlpha: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        transformed.x *= mix(0.2, 1.0, uv.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform vec2 uGrid;
      uniform float uProgress;
      uniform float uAlpha;
      varying vec2 vUv;

      void main() {
        float totalFrames = uGrid.x * uGrid.y;
        float currentFrame = uProgress * (totalFrames - 1.0);
        float frame1 = floor(currentFrame);
        float frame2 = min(frame1 + 1.0, totalFrames - 1.0);
        float mixFactor = fract(currentFrame);

        float col1 = mod(frame1, uGrid.x);
        float row1 = floor(frame1 / uGrid.x);
        vec2 uv1 = vec2(
          (vUv.x + col1) / uGrid.x,
          (1.0 - (vUv.y + row1 + 1.0) / uGrid.y)
        );

        float col2 = mod(frame2, uGrid.x);
        float row2 = floor(frame2 / uGrid.x);
        vec2 uv2 = vec2(
          (vUv.x + col2) / uGrid.x,
          (1.0 - (vUv.y + row2 + 1.0) / uGrid.y)
        );

        vec4 tex1 = texture2D(uAtlas, uv1);
        vec4 tex2 = texture2D(uAtlas, uv2);
        vec4 sampled = mix(tex1, tex2, mixFactor);

        gl_FragColor = vec4(sampled.rgb, sampled.a * uAlpha);
      }
    `,
  })
}

function particleSeed(index: number, seed: number): [number, number, number, number] {
  return [
    breathSeed(index, 0, seed),
    breathSeed(index, 1, seed),
    breathSeed(index, 2, seed),
    breathSeed(index, 3, seed),
  ]
}

function updateParticles(
  mesh: InstancedMesh | null,
  seeds: readonly [number, number, number, number][],
  dummy: Object3D,
  progress: number,
  envelope: number,
  range: number,
  smoke: boolean,
): void {
  if (!mesh) return
  for (let index = 0; index < seeds.length; index += 1) {
    const [spread, rise, speed, size] = seeds[index]!
    const localProgress = Math.max(0, Math.min((progress - speed * 0.22) / (smoke ? 0.95 : 0.72), 1))
    const radius = breathRadiusAt(range * localProgress) * (smoke ? 0.3 : 0.62) * spread
    const angle = (index * 2.399 + progress * (smoke ? -3 : 8))
    dummy.position.set(
      Math.cos(angle) * radius,
      (smoke ? 0.6 : 0.18) + rise * (smoke ? 2.5 : 1.2) * localProgress,
      range * localProgress,
    )
    const scale = envelope * (smoke ? 0.8 + size * 1.5 : 0.35 + size * 0.8) * (1 - localProgress * 0.45)
    dummy.scale.setScalar(Math.max(scale, 0.0001))
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}
