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
        <div className="boot-screen__map-preview" aria-hidden="true">
          <svg viewBox="-115 -140 230 230" className="boot-screen__map-svg">
            <defs>
              <linearGradient id="boot-map-edge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#eb9a50" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#4a6572" stopOpacity="0.15" />
              </linearGradient>
              <filter id="boot-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Static grid / radar rings */}
            <circle cx="0" cy="-25" r="95" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 6" />
            <circle cx="0" cy="-25" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <circle cx="0" cy="-25" r="25" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <line x1="0" y1="-125" x2="0" y2="75" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 4" />
            <line x1="-100" y1="-25" x2="100" y2="-25" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 4" />

            {/* Supply line connections between regions */}
            <g opacity="0.45" stroke="url(#boot-map-edge)" strokeWidth="1.2">
              {/* Hearthvale (0, 75) links */}
              <line x1="0" y1="75" x2="-35" y2="52" />
              <line x1="0" y1="75" x2="35" y2="52" />
              <line x1="0" y1="75" x2="0" y2="30" />
              <line x1="0" y1="75" x2="-60" y2="30" />
              <line x1="0" y1="75" x2="60" y2="30" />

              {/* Tier 1 connections */}
              <line x1="-35" y1="52" x2="-60" y2="30" />
              <line x1="-35" y1="52" x2="-95" y2="-5" />
              <line x1="35" y1="52" x2="60" y2="30" />
              <line x1="35" y1="52" x2="92" y2="30" />
              <line x1="0" y1="30" x2="-30" y2="-10" />
              <line x1="0" y1="30" x2="0" y2="-10" />
              <line x1="0" y1="30" x2="30" y2="-10" />
              <line x1="-60" y1="30" x2="-60" y2="-15" />
              <line x1="60" y1="30" x2="60" y2="-15" />

              {/* Mid tier connections */}
              <line x1="-95" y1="-5" x2="-60" y2="-15" />
              <line x1="-60" y1="-15" x2="0" y2="-40" />
              <line x1="-30" y1="-10" x2="0" y2="-40" />
              <line x1="0" y1="-10" x2="0" y2="-40" />
              <line x1="30" y1="-10" x2="0" y2="-40" />
              <line x1="60" y1="-15" x2="0" y2="-40" />
              <line x1="95" y1="-5" x2="60" y2="-15" />

              {/* Upper tier & climax spires */}
              <line x1="0" y1="-40" x2="0" y2="-70" />
              <line x1="0" y1="-40" x2="-80" y2="-55" />
              <line x1="0" y1="-40" x2="80" y2="-55" />
              <line x1="-80" y1="-55" x2="-45" y2="-75" />
              <line x1="80" y1="-55" x2="45" y2="-75" />
              <line x1="0" y1="-70" x2="0" y2="-95" />
              <line x1="-45" y1="-75" x2="0" y2="-95" />
              <line x1="45" y1="-75" x2="0" y2="-95" />
              <line x1="0" y1="-95" x2="0" y2="-125" />
              <line x1="-45" y1="-75" x2="0" y2="-125" />
              <line x1="45" y1="-75" x2="0" y2="-125" />
            </g>

            {/* Region Nodes */}
            {/* Hearthvale (Home Sanctuary) */}
            <g transform="translate(0, 75)">
              <circle r="7" fill="none" stroke="#ffe1a4" strokeWidth="1.5" className="boot-map-pulse" />
              <circle r="4" fill="#eb9a50" filter="url(#boot-glow)" />
            </g>

            {/* Tier 1 Nodes */}
            <circle cx="-35" cy="52" r="3" fill="#8cb3c9" opacity="0.8" />
            <circle cx="35" cy="52" r="3" fill="#8cb3c9" opacity="0.8" />
            <circle cx="0" cy="30" r="3.5" fill="#8cb3c9" opacity="0.85" />
            <circle cx="-60" cy="30" r="3" fill="#8cb3c9" opacity="0.75" />
            <circle cx="60" cy="30" r="3" fill="#8cb3c9" opacity="0.75" />

            {/* Tier 2 Nodes */}
            <circle cx="-95" cy="-5" r="3" fill="#678396" opacity="0.7" />
            <circle cx="-60" cy="-15" r="3" fill="#678396" opacity="0.7" />
            <circle cx="-30" cy="-10" r="3" fill="#678396" opacity="0.7" />
            <circle cx="0" cy="-10" r="3.5" fill="#678396" opacity="0.75" />
            <circle cx="30" cy="-10" r="3" fill="#678396" opacity="0.7" />
            <circle cx="60" cy="-15" r="3" fill="#678396" opacity="0.7" />
            <circle cx="95" cy="-5" r="3" fill="#678396" opacity="0.7" />
            <circle cx="92" cy="30" r="3" fill="#678396" opacity="0.7" />

            {/* Tier 3 & Strategic Emberwaste */}
            <circle cx="0" cy="-40" r="4.5" fill="none" stroke="#e06e3b" strokeWidth="1" opacity="0.9" />
            <circle cx="0" cy="-40" r="2.5" fill="#e06e3b" />
            <circle cx="-80" cy="-55" r="3" fill="#678396" opacity="0.6" />
            <circle cx="80" cy="-55" r="3" fill="#678396" opacity="0.6" />
            <circle cx="0" cy="-70" r="3" fill="#678396" opacity="0.65" />
            <circle cx="-45" cy="-75" r="3" fill="#678396" opacity="0.6" />
            <circle cx="45" cy="-75" r="3" fill="#678396" opacity="0.6" />

            {/* Tier 4 Shadow Citadel & Duskspire */}
            <g transform="translate(0, -95)">
              <polygon points="0,-4 3.5,3 -3.5,3" fill="#d24d4d" opacity="0.85" />
            </g>
            <g transform="translate(0, -125)">
              <polygon points="0,-6 5,4 -5,4" fill="#f44336" filter="url(#boot-glow)" />
              <circle r="9" fill="none" stroke="#f44336" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            </g>
          </svg>
        </div>

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
