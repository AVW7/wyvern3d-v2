'use client'

import { useEffect, useRef, useState } from 'react'
import { DefaultLoadingManager } from 'three'

type BootPhase = 'title' | 'sanctuary'

const COPY: Record<BootPhase, { eyebrow: string; loading: string; ready: string }> = {
  title: {
    eyebrow: 'Wyvern3D',
    loading: 'Gathering the sanctuary',
    ready: 'The sanctuary is ready',
  },
  sanctuary: {
    eyebrow: 'Sanctuary',
    loading: 'Waking the wyverns',
    ready: 'Entering the sanctuary',
  },
}

type LoadingSnapshot = {
  active: boolean
  errors: string[]
  item: string
  loaded: number
  progress: number
  total: number
}

let loadingSnapshot: LoadingSnapshot = {
  active: false,
  errors: [],
  item: '',
  loaded: 0,
  progress: 0,
  total: 0,
}

const loadingListeners = new Set<() => void>()
let notificationQueued = false

/**
 * Three may invoke LoadingManager handlers while React is rendering a component
 * that suspended on an asset. Queue observer notifications so a boot-screen
 * rerender cannot become a render-time update of a different component.
 */
function notifyLoadingListeners() {
  if (notificationQueued) return
  notificationQueued = true
  queueMicrotask(() => {
    notificationQueued = false
    loadingListeners.forEach((listener) => listener())
  })
}

const previousOnStart = DefaultLoadingManager.onStart
const previousOnProgress = DefaultLoadingManager.onProgress
const previousOnError = DefaultLoadingManager.onError
const previousOnLoad = DefaultLoadingManager.onLoad

DefaultLoadingManager.onStart = (url, loaded, total) => {
  previousOnStart?.(url, loaded, total)
  loadingSnapshot = {
    ...loadingSnapshot,
    active: true,
    item: url,
    loaded,
    progress: total > 0 ? (loaded / total) * 100 : 0,
    total,
  }
  notifyLoadingListeners()
}

DefaultLoadingManager.onProgress = (url, loaded, total) => {
  previousOnProgress?.(url, loaded, total)
  loadingSnapshot = {
    ...loadingSnapshot,
    active: loaded < total,
    item: url,
    loaded,
    progress: total > 0 ? (loaded / total) * 100 : 0,
    total,
  }
  notifyLoadingListeners()
}

DefaultLoadingManager.onError = (url) => {
  previousOnError?.(url)
  loadingSnapshot = { ...loadingSnapshot, errors: [...loadingSnapshot.errors, url] }
  notifyLoadingListeners()
}

DefaultLoadingManager.onLoad = () => {
  previousOnLoad?.()
  loadingSnapshot = { ...loadingSnapshot, active: false, progress: 100 }
  notifyLoadingListeners()
}

function useAssetProgress(): LoadingSnapshot {
  const [snapshot, setSnapshot] = useState(() => loadingSnapshot)

  useEffect(() => {
    const update = () => setSnapshot(loadingSnapshot)
    loadingListeners.add(update)
    update()
    return () => {
      loadingListeners.delete(update)
    }
  }, [])

  return snapshot
}

/**
 * A DOM-side loading surface for any R3F canvas. It observes Three's shared
 * LoadingManager, so progress follows real model and texture requests.
 */
export function BootScreen({
  phase,
  armed,
  onSettled,
}: {
  phase: BootPhase
  /** Canvas creation arms completion, preventing a cached empty manager from settling too early. */
  armed: boolean
  onSettled: () => void
}) {
  const { active, errors, item, loaded, progress, total } = useAssetProgress()
  const [leaving, setLeaving] = useState(false)
  const settled = useRef(false)
  const copy = COPY[phase]
  const hasExactProgress = total > 0
  const error = errors.length > 0

  useEffect(() => {
    if (!armed || settled.current || active) return
    if (!error && hasExactProgress && loaded < total) return

    // A brief settle window prevents a cached manager from disappearing in the
    // same frame that the canvas begins a new request, while keeping the boot
    // screen responsive when every asset is already cached.
    const timer = window.setTimeout(() => {
      settled.current = true
      setLeaving(true)
      window.setTimeout(onSettled, 180)
    }, error ? 0 : 240)

    return () => window.clearTimeout(timer)
  }, [active, armed, error, hasExactProgress, loaded, onSettled, total])

  const status = error ? 'A visual asset could not be loaded. Continuing with a safe fallback.' : copy.loading
  const detail = error
    ? 'The menu remains available.'
    : hasExactProgress
      ? `${Math.round(progress)}% · ${item ? 'Loading world detail' : 'Preparing the scene'}`
      : 'Preparing the scene'

  return (
    <div className={`boot-screen${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite">
      <div className="boot-screen__core">
        <span className="boot-screen__eyebrow">{copy.eyebrow}</span>
        <span className="boot-screen__mark" aria-hidden="true" />
        <strong>{leaving ? copy.ready : status}</strong>
        <span className="boot-screen__detail">{detail}</span>
        <span
          className="boot-screen__track"
          aria-hidden="true"
          style={{ '--boot-progress': `${hasExactProgress ? Math.max(5, Math.min(progress, 100)) : 28}%` } as React.CSSProperties}
        />
      </div>
    </div>
  )
}
