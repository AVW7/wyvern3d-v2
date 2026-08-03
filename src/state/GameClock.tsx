'use client'

import { useEffect, useRef } from 'react'
import { useGame } from './store'
import { CONFIG } from '@/core/data/config'

const AUTOSAVE_EVERY_TICKS = 10

/**
 * Drives the world tick.
 *
 * Deliberately a plain requestAnimationFrame loop at the app root rather than a
 * useFrame inside the Canvas: the world must keep simulating no matter which
 * scene is mounted, and the sanctuary economy should not pause because the
 * player is looking at the world map.
 *
 * Fixed timestep with an accumulator — a variable dt would make tick outcomes
 * depend on frame rate, which would destroy determinism.
 */
export function GameClock() {
  const raf = useRef<number>(0)
  const accumulator = useRef(0)
  const lastTime = useRef<number | null>(null)
  const sinceSave = useRef(0)

  useEffect(() => {
    const store = useGame.getState()
    // Resume a save if one exists; otherwise keep the fresh state we booted with.
    if (!store.loaded) {
      const restored = store.load()
      if (!restored) useGame.setState({ loaded: true })
    }

    const step = CONFIG.secondsPerTick

    const loop = (now: number) => {
      raf.current = requestAnimationFrame(loop)

      if (lastTime.current === null) {
        lastTime.current = now
        return
      }
      const dt = (now - lastTime.current) / 1000
      lastTime.current = now

      // Clamp so a backgrounded tab doesn't dump a hundred ticks at once when
      // it wakes — offline catch-up is the save layer's job, not the clock's.
      accumulator.current = Math.min(accumulator.current + dt, step * 5)

      while (accumulator.current >= step) {
        accumulator.current -= step
        useGame.getState().tick()
        sinceSave.current += 1
      }

      if (sinceSave.current >= AUTOSAVE_EVERY_TICKS) {
        sinceSave.current = 0
        useGame.getState().save()
      }
    }

    raf.current = requestAnimationFrame(loop)

    const onHide = () => useGame.getState().save()
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)

    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
      useGame.getState().save()
    }
  }, [])

  return null
}
