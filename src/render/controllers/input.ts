'use client'

import { useEffect } from 'react'

/**
 * Module-level input state.
 *
 * Deliberately not React state: input is read every frame inside useFrame, and
 * routing it through setState would re-render the tree 60 times a second — the
 * exact pitfall R3F warns about. Components read these objects directly.
 */
export const keys = new Set<string>()

export const pointer = {
  /** -1 (left) .. 1 (right), relative to viewport centre. */
  x: 0,
  /** -1 (bottom) .. 1 (top). */
  y: 0,
  /** Accumulated drag since last read, in pixels. */
  dragX: 0,
  dragY: 0,
  /** Accumulated wheel delta since last read. Positive means zoom out. */
  wheelY: 0,
  dragging: false,
  /** Set on a canvas click (not a drag), cleared once consumed. */
  clicked: false,
  downX: 0,
  downY: 0,
}

export const isDown = (...codes: string[]): boolean => codes.some((c) => keys.has(c))

/** Returns 1/-1/0 for an axis pair. */
export const axis = (positive: string[], negative: string[]): number =>
  (isDown(...positive) ? 1 : 0) - (isDown(...negative) ? 1 : 0)

/** Reads and clears the accumulated drag — call once per frame. */
export function consumeDrag(): { x: number; y: number } {
  const out = { x: pointer.dragX, y: pointer.dragY }
  pointer.dragX = 0
  pointer.dragY = 0
  return out
}

/** Reads and clears accumulated wheel input — call once per frame. */
export function consumeWheel(): number {
  const out = pointer.wheelY
  pointer.wheelY = 0
  return out
}

export function consumeClick(): boolean {
  const was = pointer.clicked
  pointer.clicked = false
  return was
}

export const CONTROLS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  breath: ['Space'],
  dive: ['ShiftLeft', 'ShiftRight'],
  climb: ['KeyR'],
  descend: ['KeyF'],
  command: ['Tab'],
  tame: ['KeyT'],
} as const

/** Installs the global listeners. Mount exactly once, at the app root. */
export const CLICK_SLOP = 6

export function pointerDownPosition(): { x: number; y: number } {
  return { x: pointer.downX, y: pointer.downY }
}

export function useInputListeners(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Tab opens the tactical overlay; letting the browser move focus instead
      // would pull the player out of the game.
      if (e.code === 'Tab') e.preventDefault()
      // Space scrolls the page by default, which fights the breath attack.
      if (e.code === 'Space' && e.target === document.body) e.preventDefault()
      keys.add(e.code)
    }
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)
    // A tab switch drops keyup events, leaving keys stuck down forever.
    const clearKeys = () => keys.clear()

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
      if (pointer.dragging) {
        pointer.dragX += e.movementX
        pointer.dragY += e.movementY
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 && e.target instanceof HTMLCanvasElement) {
        pointer.dragging = true
        pointer.downX = e.clientX
        pointer.downY = e.clientY
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || !pointer.dragging) return

      pointer.dragging = false
      // A short release is a movement order. Larger movements remain camera
      // orbit gestures and must not send the character walking afterwards.
      if (Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) <= CLICK_SLOP) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1
        pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
        pointer.clicked = true
      }
    }
    const onWheel = (e: WheelEvent) => {
      // Keep trackpad/page scrolling from fighting camera zoom over the game.
      if (e.target instanceof Node && document.querySelector('#game-root')?.contains(e.target)) {
        e.preventDefault()
      }
      pointer.wheelY += e.deltaY
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearKeys)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearKeys)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('wheel', onWheel)
      keys.clear()
      pointer.wheelY = 0
    }
  }, [])
}
