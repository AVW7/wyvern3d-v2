import { useMemo } from 'react'
import { useGameState } from '@/state/store'
import { useSanctuaryCommands } from '@/state/sanctuaryCommands'
import { useUi } from '@/state/uiStore'

/**
 * Compact HUD widget displaying up to 3 active sanctuary duties.
 * Shows wyvern name, need, carrying status, and allows quick selection/focus.
 */
export function SanctuaryDutiesHud() {
  const state = useGameState()
  const activeDuties = state.duties?.active ?? []
  const carriedDutyId = state.duties?.carriedDutyId

  const dutiesWithWyverns = useMemo(() => {
    return activeDuties.slice(0, 3).map((duty) => {
      const wyvern = state.wyverns[duty.subjectId]
      const isCarried = duty.id === carriedDutyId

      let icon = '🍖'
      let instruction = 'Feed Wyvern'
      let statusClass = 'status-available'

      if (duty.kind === 'feed') {
        const hasFood = state.resources.food >= 25
        icon = '🍖'
        instruction = isCarried
          ? 'Carrying Ration → Deliver (E)'
          : hasFood
          ? 'Hungry → Supply Barrel (E)'
          : 'Need Food'
        statusClass = isCarried ? 'status-carrying' : hasFood ? 'status-available' : 'status-disabled'
      } else if (duty.kind === 'medicine') {
        const hasSupplies = state.resources.water >= 15 && state.resources.arcane >= 2
        icon = '🌿'
        instruction = isCarried
          ? 'Carrying Salve → Administer (E)'
          : hasSupplies
          ? 'Injured → Infirmary Salve (E)'
          : 'Need Water/Arcane'
        statusClass = isCarried ? 'status-carrying' : hasSupplies ? 'status-available' : 'status-disabled'
      } else if (duty.kind === 'companionship') {
        icon = '💛'
        instruction = 'Low Bond → Reassure (E)'
        statusClass = 'status-available'
      } else if (duty.kind === 'flightExercise') {
        icon = '🪽'
        instruction = 'Flight Drill → Exercise (E)'
        statusClass = 'status-available'
      }

      return {
        duty,
        wyvern,
        icon,
        instruction,
        statusClass,
      }
    })
  }, [activeDuties, carriedDutyId, state.wyverns, state.resources])

  if (dutiesWithWyverns.length === 0) return null

  return (
    <div className="sanctuary-duties-hud liquid-glass" role="region" aria-label="Sanctuary Duties">
      <div className="duties-header">
        <span className="duties-icon">✦</span>
        <span className="duties-title">SANCTUARY DUTIES</span>
      </div>
      <div className="duties-list">
        {dutiesWithWyverns.map(({ duty, wyvern, icon, instruction, statusClass }) => {
          const wyvernName = wyvern ? wyvern.name : `Wyvern (${duty.subjectId})`

          return (
            <button
              key={duty.id}
              type="button"
              className={`duty-chip ${statusClass}`}
              onClick={() => {
                if (wyvern) {
                  useSanctuaryCommands.getState().select(wyvern.id)
                  useUi.getState().notify({
                    tone: 'status',
                    message: `${instruction} for ${wyvernName}.`,
                  })
                }
              }}
              title="Click to select wyvern"
            >
              <div className="duty-icon-badge">{icon}</div>
              <div className="duty-details">
                <div className="duty-subject">{wyvernName}</div>
                <div className="duty-instruction">{instruction}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
