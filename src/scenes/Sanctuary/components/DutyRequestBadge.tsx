import { useMemo } from 'react'
import { WorldLabel } from '@/render/labels/WorldLabel'
import { useGameState } from '@/state/store'

export interface DutyRequestBadgeProps {
  wyvernId: string
  height: number
  airborne: boolean
}

export function DutyRequestBadge({ wyvernId, height, airborne }: DutyRequestBadgeProps) {
  const state = useGameState()
  const activeDuty = useMemo(() => {
    return state.duties?.active.find(
      (d) => d.subjectId === wyvernId && (d.status === 'available' || d.status === 'carrying'),
    )
  }, [state.duties?.active, wyvernId])

  if (!activeDuty) return null

  const isCarrying = activeDuty.status === 'carrying'
  let text = '🍖 HUNGRY'
  let subtitle = isCarrying ? 'DELIVER RATION (E)' : 'SUPPLY BARREL (E)'
  let color = isCarrying ? '#60a5fa' : '#f59e0b'

  if (activeDuty.kind === 'medicine') {
    text = '🌿 INJURED'
    subtitle = isCarrying ? 'ADMINISTER SALVE (E)' : 'INFIRMARY SALVE (E)'
    color = isCarrying ? '#60a5fa' : '#ef4444'
  } else if (activeDuty.kind === 'companionship') {
    text = '💛 COMPANIONSHIP'
    subtitle = 'BOND / REASSURE (E)'
    color = '#ec4899'
  } else if (activeDuty.kind === 'flightExercise') {
    text = '🪽 FLIGHT EXERCISE'
    subtitle = 'START DRILL (E)'
    color = '#38bdf8'
  }

  return (
    <group position={[0, height + (airborne ? 6.5 : 4.5), 0]}>
      <WorldLabel
        text={text}
        subtitle={subtitle}
        color={color}
        size={0.9}
        variant="wyvern"
      />
    </group>
  )
}
