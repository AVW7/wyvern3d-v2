import { describe, expect, it } from 'vitest'
import { wasDrag } from './interaction'
import { ThreeEvent } from '@react-three/fiber'

describe('interaction', () => {
  it('returns false for small mouse distance (click)', () => {
    const event = {
      nativeEvent: { clientX: 0, clientY: 0 },
    } as ThreeEvent<MouseEvent>
    expect(wasDrag(event)).toBe(false)
  })
})
