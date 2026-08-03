'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import { BootScreen } from '@/ui/BootScreen'

const TitleScene = dynamic(() => import('@/scenes/Title/TitleScene').then((module) => module.TitleScene), {
  ssr: false,
})

/** The menu has no link styling of its own; keep dev links out of the way. */
const DEV_LINK = { color: 'inherit', textDecoration: 'underline' } as const

export default function MenuPage() {
  const [canvasReady, setCanvasReady] = useState(false)
  const [bootComplete, setBootComplete] = useState(false)
  const markCanvasReady = useCallback(() => setCanvasReady(true), [])
  const completeBoot = useCallback(() => setBootComplete(true), [])

  return (
    <main className="title-screen">
      <TitleScene onCanvasReady={markCanvasReady} />
      {bootComplete && (
        <div className="title-menu">
          <section className="title-panel liquid-glass" aria-labelledby="game-title">
            <span className="title-panel__eyebrow">A sanctuary awaits</span>
            <h1 id="game-title">Wyvern3D</h1>
            <p>
              Raise wyverns at your sanctuary, train them until they trust you, and ride them to war. Bond decides
              whether they obey you when the arrows start flying.
            </p>
            <Link className="title-panel__cta" href="/play">
              <span>Enter the sanctuary</span>
              <span aria-hidden="true">→</span>
            </Link>
            {/* Development tools are stripped from production builds, so this link
                is too — otherwise the menu advertises a route that 404s. */}
            {process.env.NODE_ENV !== 'production' && (
              <p className="title-panel__dev">
                dev ·{' '}
                <Link href="/debug/animation" style={DEV_LINK}>
                  flight animation lab
                </Link>{' '}
                ·{' '}
                <Link href="/webgl-probe" style={DEV_LINK}>
                  webgl probe
                </Link>
              </p>
            )}
          </section>
        </div>
      )}
      {!bootComplete && <BootScreen phase="title" armed={canvasReady} onSettled={completeBoot} />}
    </main>
  )
}
