'use client'

import { useEffect, useRef } from 'react'
import type { GameEvent } from '@/core/types'
import { useGameState } from '@/state/store'

export interface EventStreamHandler {
  onEvent?: (event: GameEvent) => void
  onEvents?: (events: GameEvent[]) => void
}

/**
 * Drains render-side GameEvents by monotonic sequence cursor.
 *
 * Jumps to `nextEventSeq` on first mount so offline catch-up (which runs up to
 * 24 ticks in core) does not cause a burst of old flourishes on load.
 */
export function useGameEventStream(handlers: EventStreamHandler): void {
  const state = useGameState()
  const lastSeqRef = useRef<number>(state.nextEventSeq)
  const isInitialized = useRef<boolean>(false)

  useEffect(() => {
    if (!isInitialized.current) {
      lastSeqRef.current = state.nextEventSeq
      isInitialized.current = true
      return
    }

    const currentSeq = state.nextEventSeq
    const lastSeq = lastSeqRef.current

    if (currentSeq > lastSeq && state.events.length > 0) {
      const newEvents = state.events.filter((e) => e.seq >= lastSeq && e.seq < currentSeq)
      lastSeqRef.current = currentSeq

      if (newEvents.length > 0) {
        if (handlers.onEvents) {
          handlers.onEvents(newEvents)
        }
        if (handlers.onEvent) {
          for (const ev of newEvents) {
            handlers.onEvent(ev)
          }
        }
      }
    } else {
      lastSeqRef.current = currentSeq
    }
  }, [state.nextEventSeq, state.events, state.tick, handlers])
}
