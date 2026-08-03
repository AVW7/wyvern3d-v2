'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import type { ReactNode } from 'react'
import type { LabCamera, LabTheme } from '../FlightLab'
import { CAMERAS, WYVERN_MODEL, WYVERN_ANIMATIONS } from '../constants'

interface FlightLabCanvasProps {
  camera: LabCamera
  theme?: LabTheme
  children: ReactNode
}

export function FlightLabCanvas({ camera, theme = 'dark', children }: FlightLabCanvasProps) {
  const view = CAMERAS[camera] ?? CAMERAS.side

  // Warm model assets before canvas mounts
  useGLTF(WYVERN_MODEL)
  useGLTF(WYVERN_ANIMATIONS)

  return (
    <Canvas
      key={camera}
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ position: view.position, fov: view.fov, near: 1, far: 2000 }}
    >
      <color
        attach="background"
        args={[
          theme === 'light'
            ? '#f1f5f9'
            : theme === 'monochrome'
              ? '#0d0d0d'
              : '#0f141c',
        ]}
      />
      <hemisphereLight
        args={
          theme === 'light'
            ? ['#ffffff', '#94a3b8', 1.0]
            : theme === 'monochrome'
              ? ['#ffffff', '#222222', 0.85]
              : ['#bcd4e6', '#4a4034', 0.85]
        }
      />
      <directionalLight position={[60, 90, 40]} intensity={theme === 'light' ? 1.8 : 1.6} castShadow />
      <gridHelper
        args={[
          400,
          40,
          theme === 'light'
            ? '#cbd5e1'
            : theme === 'monochrome'
              ? '#1c1c1c'
              : '#2a3644',
          theme === 'light'
            ? '#cbd5e1'
            : theme === 'monochrome'
              ? '#1c1c1c'
              : '#182029',
        ]}
      />
      <OrbitControls
        target={view.target}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={20}
        maxDistance={600}
      />
      {children}
    </Canvas>
  )
}
