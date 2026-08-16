'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import type { BiomeWaterBody } from '../terrain/biomeWater'
import { biomeHeightAt } from './BiomeTerrain'
import type { BiomePalette } from '../atmosphere/biomePalettes'

/**
 * Animated water for biome regions (coast sea, marsh/swamp bog, ashland lava).
 *
 * Generalizes the sanctuary's stylized water shader with two biome-specific
 * upgrades: shoreline foam driven by the *real* terrain depth under each
 * vertex (sampled from the same pure height field the collision and scatter
 * use, so the foam line follows the actual shoreline), and scene fog support
 * (the sanctuary version ignored it, which reads fine at 4 m and wrong at
 * 100 m). Weather wind speed modulates wave churn.
 *
 * Per-frame work is one uniform update — no React state, no allocations. The
 * mesh itself is static; only `uTime` advances.
 */

const WATER_VERTEX_SHADER = /* glsl */ `
  attribute float aDepth;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vDepth;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uWaveAmp;
  uniform float uChurn;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Dual subtle wave displacement, scaled by the biome's wave amplitude and
    // the active weather's churn.
    float churn = uSpeed * (1.0 + uChurn);
    float w1 = sin(pos.x * 2.5 + uTime * churn * 1.5) * cos(pos.y * 2.0 + uTime * churn * 1.2);
    float w2 = sin(pos.x * 4.0 - uTime * churn * 2.0) * cos(pos.y * 3.5 + uTime * churn * 1.8);
    pos.z += (w1 + w2 * 0.5) * 0.04 * uWaveAmp;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * worldPos;
    vViewPosition = -mvPosition.xyz;
    vDepth = aDepth;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const WATER_FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vDepth;

  uniform vec3 uColorShallow;
  uniform vec3 uColorDeep;
  uniform vec3 uColorFoam;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform float uGlow;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  // Simple procedural noise for caustics and ripples
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 norm = normalize(vNormal);

    // Fresnel reflection
    float fresnel = pow(1.0 - max(dot(viewDir, norm), 0.0), 2.5);

    // Dual scrolling ripple pattern
    vec2 uv1 = vUv * 6.0 + vec2(uTime * 0.08 * uSpeed, uTime * 0.05 * uSpeed);
    vec2 uv2 = vUv * 8.0 - vec2(uTime * 0.06 * uSpeed, -uTime * 0.07 * uSpeed);
    float n1 = noise(uv1);
    float n2 = noise(uv2);
    float caustics = smoothstep(0.45, 0.75, n1 * n2 * 2.0);

    // Depth-driven shoreline foam: vDepth is metres of water under this
    // vertex (negative above the shoreline); foam swells in the shallows.
    float shoreFoam = smoothstep(-0.05, 0.55, vDepth) * (1.0 - smoothstep(0.55, 1.6, vDepth));
    float foamNoise = 0.7 + 0.6 * noise(vUv * 40.0 + vec2(uTime * 0.35 * uSpeed));
    float foam = clamp(shoreFoam * foamNoise, 0.0, 1.0);

    // Depth colour: shallow near the shore, deep offshore
    float depthMix = clamp(vDepth / 2.5, 0.0, 1.0);
    vec3 waterColor = mix(uColorShallow, uColorDeep, depthMix);
    waterColor = mix(waterColor, vec3(1.0), caustics * 0.35);
    waterColor = mix(waterColor, uColorFoam, foam * 0.85);
    waterColor = mix(waterColor, vec3(0.9, 0.95, 1.0), fresnel * 0.4);

    // Lava replaces reflection language with emissive crust: hot seams pulse
    // where the foam term picks out the shallows of the flow.
    vec3 lavaColor = uColorDeep + uColorShallow * foamNoise * 0.8;
    lavaColor += uColorFoam * 0.6 * smoothstep(0.4, 1.0, foam);
    waterColor = mix(waterColor, lavaColor, uGlow);

    float alpha = uOpacity * (0.85 + 0.15 * fresnel);
    // Foam is opaque regardless of body opacity
    alpha = mix(alpha, 0.95, foam * (1.0 - uGlow * 0.3));

    // Scene fog, matched to the biome atmosphere so the water plane joins
    // the horizon instead of cutting a hard line through it.
    float fogFactor = smoothstep(uFogNear, uFogFar, length(vViewPosition));
    waterColor = mix(waterColor, uFogColor, fogFactor);

    gl_FragColor = vec4(waterColor, alpha);
  }
`

interface BiomeWaterSurfaceProps {
  body: BiomeWaterBody
  biome: string
  regionId?: string
  seed?: number
  /** Half-extent of the water plane, in metres. */
  radius: number
  /** Effective (weather-blended) palette driving the fog. */
  palette: BiomePalette
  /** Weather wind speed, driving extra churn (default: calm). */
  windSpeed?: number
}

export function BiomeWaterSurface({
  body,
  biome,
  regionId,
  seed = 42,
  radius,
  palette,
  windSpeed = 1,
}: BiomeWaterSurfaceProps) {
  const meshRef = useRef<Mesh>(null)

  const geometry = useMemo(() => {
    // Plane local XZ; rotated -PI/2 about X so local +Y becomes world -Z.
    const plane = new PlaneGeometry(radius * 2, radius * 2, body.segments, body.segments)
    const positions = plane.attributes.position!
    const depths = new Float32Array(positions.count)

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      // World position: x stays, plane local y maps to world -z.
      const ground = biomeHeightAt(biome, x, -y, regionId, seed)
      depths[i] = body.level - ground
    }

    plane.setAttribute('aDepth', new BufferAttribute(depths, 1))
    return plane
  }, [biome, regionId, seed, radius, body.level, body.segments])

  const material = useMemo(() => {
    return new ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: body.speed },
        uWaveAmp: { value: body.waveAmp },
        uChurn: { value: Math.max(0, windSpeed - 1) },
        uOpacity: { value: body.opacity },
        uColorShallow: { value: new Color(body.colorShallow) },
        uColorDeep: { value: new Color(body.colorDeep) },
        uColorFoam: { value: new Color(body.colorFoam) },
        uGlow: { value: body.glow },
        uFogColor: { value: new Color(palette.fogColor) },
        uFogNear: { value: palette.fogNear },
        uFogFar: { value: palette.fogFar },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
  }, [body, palette.fogColor, palette.fogNear, palette.fogFar, windSpeed])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    const u = material.uniforms.uTime
    if (u) u.value += delta
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, body.level, 0]}
    />
  )
}
