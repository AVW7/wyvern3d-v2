'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CircleGeometry,
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'

interface WaterSurfaceProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  radius?: number
  size?: [number, number]
  colorShallow?: string
  colorDeep?: string
  foamColor?: string
  speed?: number
  opacity?: number
}

const WATER_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform float uTime;
  uniform float uSpeed;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Dual subtle wave displacement
    float w1 = sin(pos.x * 2.5 + uTime * uSpeed * 1.5) * cos(pos.y * 2.0 + uTime * uSpeed * 1.2);
    float w2 = sin(pos.x * 4.0 - uTime * uSpeed * 2.0) * cos(pos.y * 3.5 + uTime * uSpeed * 1.8);
    pos.z += (w1 + w2 * 0.5) * 0.04;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * worldPos;
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const WATER_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  uniform vec3 uColorShallow;
  uniform vec3 uColorDeep;
  uniform vec3 uFoamColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOpacity;

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

    // Edge foam / shoreline ring
    float distFromCenter = length(vUv - vec2(0.5)) * 2.0;
    float foamRing = smoothstep(0.78, 0.98, distFromCenter);

    // Depth color blend
    vec3 waterColor = mix(uColorDeep, uColorShallow, 0.5 + 0.5 * sin(uTime * 0.4 + vUv.x * 3.0));
    waterColor = mix(waterColor, vec3(1.0), caustics * 0.35);
    waterColor = mix(waterColor, uFoamColor, foamRing * 0.6);
    waterColor = mix(waterColor, vec3(0.9, 0.95, 1.0), fresnel * 0.4);

    float alpha = uOpacity * (0.85 + 0.15 * fresnel);
    gl_FragColor = vec4(waterColor, alpha);
  }
`

export function WaterSurface({
  position,
  rotation = [-Math.PI / 2, 0, 0],
  radius,
  size,
  colorShallow = '#38bdf8',
  colorDeep = '#0369a1',
  foamColor = '#e0f2fe',
  speed = 1.0,
  opacity = 0.88,
}: WaterSurfaceProps) {
  const meshRef = useRef<Mesh>(null)

  const geometry = useMemo(() => {
    if (size) {
      return new PlaneGeometry(size[0], size[1], 16, 16)
    }
    return new CircleGeometry(radius ?? 2, 32)
  }, [radius, size])

  const material = useMemo(() => {
    return new ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
        uColorShallow: { value: new Color(colorShallow) },
        uColorDeep: { value: new Color(colorDeep) },
        uFoamColor: { value: new Color(foamColor) },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
  }, [colorShallow, colorDeep, foamColor, speed, opacity])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value += delta
    }
  })

  return <mesh ref={meshRef} position={position} rotation={rotation} geometry={geometry} material={material} />
}

/**
 * Atmospheric Sanctuary water installations:
 * 1. Care Court Serene Spring Pool
 * 2. Infirmary Healing Wash Basin
 * 3. Quenching Trough Water
 * 4. Hatchery Incubation Spring
 */
export function SanctuaryWaterPools() {
  return (
    <group name="sanctuary-water-pools">
      {/* 1. Sheltered Care Court Basin & Spring */}
      <WaterSurface
        position={[-18, 0.04, -8]}
        radius={3.8}
        colorShallow="#38bdf8"
        colorDeep="#0284c7"
        foamColor="#f0f9ff"
        speed={0.8}
        opacity={0.86}
      />

      {/* 2. Infirmary Healing Basin */}
      <WaterSurface
        position={[-11.6, 0.22, -20.6]}
        size={[1.8, 1.2]}
        colorShallow="#67e8f9"
        colorDeep="#0891b2"
        speed={0.5}
        opacity={0.9}
      />

      {/* 3. Forge Quenching Trough Basin */}
      <WaterSurface
        position={[30.3, 0.38, -11.3]}
        size={[2.1, 0.9]}
        colorShallow="#38bdf8"
        colorDeep="#0369a1"
        speed={0.6}
        opacity={0.92}
      />

      {/* 4. Hatchery Warm Mineral Spring */}
      <WaterSurface
        position={[14.2, 0.04, 2.2]}
        radius={2.6}
        colorShallow="#7dd3fc"
        colorDeep="#075985"
        foamColor="#bae6fd"
        speed={0.6}
        opacity={0.84}
      />
    </group>
  )
}
