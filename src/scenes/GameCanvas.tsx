'use client'

import '@/render/configureThree'
import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { useGame } from '@/state/store'
import { SanctuaryScene } from './Sanctuary/SanctuaryScene'
import { WorldMapScene } from './WorldMap/WorldMapScene'
import { BattleScene } from './Battle/BattleScene'
import { HighlandsScene } from './Highlands/HighlandsScene'
import { usePropAtlas } from '@/render/assets/props'

/**
 * One persistent WebGL canvas for the whole game.
 *
 * Scenes swap on a store field rather than Next routes: routing between them
 * would tear down and rebuild the WebGL context on every transition, and would
 * stop the world clock while the new route mounted.
 */
export function GameCanvas({ onCanvasReady }: { onCanvasReady?: () => void }) {
  const mode = useGame((s) => s.mode)
  usePropAtlas()

  // Canvas' `onCreated` can run while React is still reconciling a suspended
  // tree. Signal the DOM boot screen after this component has committed instead.
  useEffect(() => {
    onCanvasReady?.()
  }, [onCanvasReady])

  return (
    <Canvas
      // R3F's boolean shorthand still selects the now-deprecated
      // PCFSoftShadowMap. "percentage" selects Three's supported PCFShadowMap.
      shadows="percentage"
      // Capped at 1.5 rather than 2: a full-window 2x backbuffer plus shadow
      // maps is enough VRAM to lose the WebGL context outright on integrated
      // and mobile GPUs, and the visual difference at this art style is slight.
      dpr={[1, 1.5]}
      // Depth precision scales with the near plane, and every scene here is
      // third-person: `CAMERA_MIN_DISTANCE` is 4, so the camera never comes
      // within 0.3 of what it orbits. Moving near from 0.1 to 0.3 is a ~3x
      // depth-buffer improvement across the whole scene for one number, which
      // is what stops coplanar ground decals shimmering at the far rim.
      camera={{ fov: 60, near: 0.3, far: 700, position: [0, 12, 24] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      {mode === 'sanctuary' && <SanctuaryScene />}
      {mode === 'worldmap' && <WorldMapScene />}
      {mode === 'battle' && <BattleScene />}
      {mode === 'highlands' && <HighlandsScene />}
    </Canvas>
  )
}
