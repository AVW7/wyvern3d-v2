'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

/**
 * Diagnostic route for isolating WebGL context problems.
 *
 * Kept in the repo because "the canvas is blank" is otherwise very hard to
 * bisect: this lets you add one feature at a time (lights, text, instancing)
 * and see exactly which one kills the context on a given device or browser.
 */
const Probe = dynamic(() => import('./Probe').then((m) => m.Probe), { ssr: false })

export default function WebglProbePage() {
  const [level, setLevel] = useState(1)
  return (
    <div id="game-root">
      <Probe level={level} />
      <div className="overlay">
        <div className="topbar">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} className={n === level ? 'active' : ''} onClick={() => setLevel(n)}>
              level {n}
            </button>
          ))}
          <span className="tag">
            1 cube · 2 +lights · 3 +text · 4 +instancing
          </span>
        </div>
      </div>
    </div>
  )
}
