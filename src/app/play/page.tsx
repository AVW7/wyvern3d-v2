'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import { GameClock } from '@/state/GameClock'
import { Hud } from '@/ui/Hud'
import { BootScreen } from '@/ui/BootScreen'
import { useInputListeners } from '@/render/controllers/input'

// The canvas must never render on the server — WebGL has no SSR equivalent,
// and three.js touches `window` on import.
const GameCanvas = dynamic(() => import('@/scenes/GameCanvas').then((m) => m.GameCanvas), {
  ssr: false,
  loading: () => null,
})

export default function PlayPage() {
  useInputListeners()
  const [canvasReady, setCanvasReady] = useState(false)
  const [bootComplete, setBootComplete] = useState(false)
  const markCanvasReady = useCallback(() => setCanvasReady(true), [])
  const completeBoot = useCallback(() => setBootComplete(true), [])

  return (
    <div id="game-root">
      <GameClock />
      <GameCanvas onCanvasReady={markCanvasReady} />
      <Hud />
      {!bootComplete && (
        <BootScreen phase="sanctuary" armed={canvasReady} onSettled={completeBoot} />
      )}
    </div>
  )
}
