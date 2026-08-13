import { ThreeEvent } from '@react-three/fiber'
import { CLICK_SLOP, pointerDownPosition } from '../../render/controllers/input'

export function wasDrag(event: ThreeEvent<MouseEvent>): boolean {
  const native = event.nativeEvent
  if (!native) return false
  const down = pointerDownPosition()
  const dist = Math.hypot(native.clientX - down.x, native.clientY - down.y)
  return dist > CLICK_SLOP
}
