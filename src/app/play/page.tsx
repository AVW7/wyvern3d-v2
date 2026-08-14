'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { GameClock } from '@/state/GameClock'
import { Hud } from '@/ui/Hud'
import { BootScreen } from '@/ui/BootScreen'
import { useInputListeners } from '@/render/controllers/input'
import { useModelLibraryHydration } from '@/state/modelLibraryStore'
import { useSanctuaryColorsHydration } from '@/state/sanctuaryColorsStore'
import { useGame, type SceneMode } from '@/state/store'
import { useHighlandsHunt } from '@/state/highlandsHuntStore'
import { useUi } from '@/state/uiStore'

// The canvas must never render on the server — WebGL has no SSR equivalent,
// and three.js touches `window` on import.
const GameCanvas = dynamic(() => import('@/scenes/GameCanvas').then((m) => m.GameCanvas), {
  ssr: false,
  loading: () => null,
})

export default function PlayPage() {
  useInputListeners()
  useModelLibraryHydration()
  useSanctuaryColorsHydration()
  const [canvasReady, setCanvasReady] = useState(false)
  const [bootComplete, setBootComplete] = useState(false)
  const markCanvasReady = useCallback(() => setCanvasReady(true), [])
  const completeBoot = useCallback(() => setBootComplete(true), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const targetMode = params.get('mode')
    if (
      targetMode === 'sanctuary' ||
      targetMode === 'worldmap' ||
      targetMode === 'battle' ||
      targetMode === 'highlands' ||
      targetMode === 'biome'
    ) {
      if (targetMode === 'highlands') {
        useHighlandsHunt.getState().open()
      }
      if (targetMode === 'battle' && !useGame.getState().state.pendingBattle) {
        useGame.getState().setMode('worldmap')
        useUi.getState().open('warTable')
        useUi.getState().notify({
          tone: 'status',
          message: 'Select a region on the conquest map to plan an assault.',
        })
      } else {
        useGame.getState().setMode(targetMode as SceneMode)
      }
    }
  }, [])

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
