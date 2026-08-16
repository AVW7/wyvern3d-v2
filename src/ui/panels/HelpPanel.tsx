'use client'

import { useGame } from '@/state/store'
import { useUi } from '@/state/uiStore'
import { CONFIG } from '@/core/data/config'
import { Head } from './common'

export function HelpPanel() {
  const reset = useGame((s) => s.reset)
  const exportReplay = useGame((s) => s.exportReplay)
  const close = useUi((s) => s.close)

  return (
    <>
      <Head title="How it works" subtitle="The loop: conquer, collect, raise, conquer harder." />
      <div className="grid">
        <div className="card">
          <h3>The sanctuary</h3>
          <div className="meta">
            Walk with WASD, drag to turn the camera, press E at a station. The keep to the north holds the war
            table; the grounds to the south hold the roosts and training stations.
          </div>
        </div>
        <div className="card">
          <h3>Raising wyverns</h3>
          <div className="meta">
            Eggs come from conquest or breeding. A hatchling needs {CONFIG.wyvern.hatchlingTicks +
              CONFIG.wyvern.juvenileTicks}h to reach adulthood, and only adults can fight.
          </div>
        </div>
        <div className="card">
          <h3>Bond decides battles</h3>
          <div className="meta">
            Training raises bond. A low-bond wyvern may ignore your orders outright, and below{' '}
            {CONFIG.battle.feralBond} it can turn feral and attack anything nearby.
          </div>
        </div>
        <div className="card">
          <h3>Flying an assault</h3>
          <div className="meta">
            Mouse steers, W/S throttle, Space breathes fire, Shift dives. Click one of your wyverns then click an
            enemy to order an attack. T tames a weakened wild wyvern.
          </div>
        </div>
        <div className="card">
          <h3>Armies hold ground</h3>
          <div className="meta">
            Spears and riders cannot reach a flying wyvern — only archers and siege can. Conquered regions build
            unrest and revolt unless you station troops there.
          </div>
        </div>
        <div className="card">
          <h3>Upkeep</h3>
          <div className="meta">
            Wyverns eat food, squads cost gold. Run short and wyverns starve, bond decays and troops desert.
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 14, margin: '18px 0 8px' }}>This run</h3>
      <div className="row">
        <button
          className="danger"
          onClick={() => {
            reset()
            close()
          }}
        >
          Abandon and start over
        </button>
        <button
          onClick={() => {
            // The intent log replays the whole session against the same seed —
            // the fastest way to hand over a reproducible bug.
            const blob = new Blob([exportReplay()], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'wyvern3d-replay.json'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export replay
        </button>
        <span className="cost">a replay reproduces this session exactly from its seed</span>
      </div>
    </>
  )
}
