'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import { BootScreen } from '@/ui/BootScreen'
import { TitleWorldMap } from '@/ui/TitleWorldMap'

const TitleScene = dynamic(() => import('@/scenes/Title/TitleScene').then((module) => module.TitleScene), {
  ssr: false,
})

/** The menu has no link styling of its own; keep dev links out of the way. */
const DEV_LINK = { color: 'inherit', textDecoration: 'underline' } as const

/** The parts of the game the menu advertises. All of them live behind /play. */
const SECTIONS = [
  {
    id: 'sanctuary',
    glyph: '🥚',
    name: 'Sanctuary',
    blurb: 'Hatch, feed and train your brood. Place the roosts and stations yourself.',
  },
  {
    id: 'world-map',
    glyph: '🗺️',
    name: 'World Map',
    blurb: 'Twenty-two regions on a conquest graph. Strike only where you already hold ground.',
  },
  {
    id: 'battle',
    glyph: '⚔️',
    name: 'Battle',
    blurb: 'Fly your wyvern in, or let the same simulation resolve the fight for you.',
  },
  {
    id: 'highlands',
    glyph: '🏔️',
    name: 'Highlands',
    blurb: 'Hunt in the open uplands to keep the sanctuary fed between campaigns.',
  },
] as const

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
            <p className="title-panel__dev">
              assets ·{' '}
              <Link href="/models" style={DEV_LINK}>
                model library
              </Link>{' '}
              ·{' '}
              <Link href="/biomes" style={DEV_LINK}>
                biome library
              </Link>
            </p>
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

          <div className="title-aside">
            <section className="title-card title-card--map liquid-glass" aria-labelledby="title-map-heading">
              <header className="title-card__head">
                <span className="title-card__eyebrow">The realm</span>
                <h2 id="title-map-heading">Conquest map</h2>
              </header>
              <div className="title-map">
                <TitleWorldMap />
              </div>
              <p className="title-card__note">
                <span className="title-map__key title-map__key--home" /> Hearthvale, home
                <span className="title-map__key title-map__key--far" /> Duskspire, the last spire
              </p>
            </section>

            <ul className="title-cards">
              {SECTIONS.map((section) => (
                <li key={section.id} className="title-card title-card--section liquid-glass">
                  <span className="title-card__glyph" aria-hidden="true">
                    {section.glyph}
                  </span>
                  <h3>{section.name}</h3>
                  <p>{section.blurb}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!bootComplete && <BootScreen phase="title" armed={canvasReady} onSettled={completeBoot} />}
    </main>
  )
}
