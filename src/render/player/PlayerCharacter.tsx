'use client'

import { useRef } from 'react'
import { GameModel, type ModelActionRequest } from '@/render/assets/GameModel'
import type { ModelState } from '@/render/assets/manifest'
import {
  PlaceholderCharacter,
  type CharacterGesture,
} from '@/render/placeholders/PlaceholderProps'

export type PlayerLocomotion = Extract<ModelState, 'idle' | 'walk' | 'run'>

const gestureState: Record<Exclude<CharacterGesture, 'none'>, ModelState> = {
  offer: 'offer',
  pet: 'pet',
  calm: 'calm',
}

/** The real player model, retaining the procedural character as a load fallback. */
export function PlayerCharacter({
  locomotion,
  gesture,
  movingRef,
  gestureRef,
}: {
  locomotion: PlayerLocomotion
  gesture: CharacterGesture
  movingRef: React.RefObject<boolean>
  gestureRef: React.RefObject<CharacterGesture>
}) {
  const previousGesture = useRef<CharacterGesture>('none')
  const actionToken = useRef(0)
  if (gesture !== previousGesture.current) {
    previousGesture.current = gesture
    actionToken.current += 1
  }

  const action: ModelActionRequest | null = gesture === 'none'
    ? null
    : { state: gestureState[gesture], token: actionToken.current }

  return (
    <GameModel
      id="character.player"
      state={locomotion}
      action={action}
      fallback={<PlaceholderCharacter movingRef={movingRef} gestureRef={gestureRef} />}
    />
  )
}
