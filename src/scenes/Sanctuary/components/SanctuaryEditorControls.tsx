'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { Prop } from '@/render/assets/props'
import { consumeClick, pointer } from '@/render/controllers/input'
import { dispatch, useGameState } from '@/state/store'
import { useSanctuaryEditor } from '@/state/sanctuaryEditorStore'
import { useUi } from '@/state/uiStore'
import { GROUND_DECAL } from '../groundDecal'
import { GROUND_RADIUS } from '../layout'

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0)

export function SanctuaryEditorControls() {
  const state = useGameState()
  const isEditing = useSanctuaryEditor((s) => s.isEditing)
  const selectedObjectId = useSanctuaryEditor((s) => s.selectedObjectId)
  const placingItem = useSanctuaryEditor((s) => s.placingItem)
  const gridSnap = useSanctuaryEditor((s) => s.gridSnap)
  const snapSize = useSanctuaryEditor((s) => s.snapSize)
  const dragRotationY = useSanctuaryEditor((s) => s.dragRotationY)
  const selectObject = useSanctuaryEditor((s) => s.selectObject)
  const cancelPlacing = useSanctuaryEditor((s) => s.cancelPlacing)
  const setDragPosition = useSanctuaryEditor((s) => s.setDragPosition)

  const raycaster = useRef(new Raycaster())
  const mouseNdc = useRef(new Vector2())
  const hoverPoint = useRef<[number, number, number] | null>(null)

  const objects = state.sanctuaryLayout?.objects ?? []
  const selectedObject = objects.find((o) => o.id === selectedObjectId)

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isEditing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return
      const editor = useSanctuaryEditor.getState()
      if (e.key === 'q' || e.key === 'Q') {
        editor.rotateActive(-Math.PI / 4)
      } else if (e.key === 'e' || e.key === 'E') {
        editor.rotateActive(Math.PI / 4)
      } else if (e.key === 'Escape' || e.code === 'Space') {
        if (editor.placingItem) {
          e.preventDefault()
          editor.cancelPlacing()
          useUi.getState().notify({ tone: 'warning', message: 'Placement cancelled.' })
        } else if (editor.selectedObjectId) {
          e.preventDefault()
          editor.selectObject(null)
        } else if (e.key === 'Escape') {
          editor.exitEditMode()
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'x' || e.key === 'X') {
        if (editor.selectedObjectId) {
          dispatch({ type: 'STORE_SANCTUARY_OBJECT', id: editor.selectedObjectId })
          editor.selectObject(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing])

  const camera = useThree((s) => s.camera)

  useFrame(() => {
    if (!isEditing) return

    mouseNdc.current.set(pointer.x, pointer.y)
    raycaster.current.setFromCamera(mouseNdc.current, camera)
    const hit = new Vector3()

    if (raycaster.current.ray.intersectPlane(GROUND_PLANE, hit)) {
      const dist = Math.hypot(hit.x, hit.z)
      if (dist < GROUND_RADIUS) {
        let x = hit.x
        let z = hit.z

        if (gridSnap) {
          x = Math.round(x / snapSize) * snapSize
          z = Math.round(z / snapSize) * snapSize
        }

        hoverPoint.current = [x, 0, z]
        setDragPosition([x, 0, z])
      }
    }

    // Process canvas click in edit mode
    if (consumeClick() && hoverPoint.current) {
      const [x, y, z] = hoverPoint.current

      if (placingItem) {
        const undoToken = useSanctuaryEditor
          .getState()
          .stageUndo(state.sanctuaryLayout, `Placing ${placingItem.label}`)
        // Confirm adding object from catalog
        dispatch({
          type: 'ADD_SANCTUARY_OBJECT',
          propId: placingItem.propId,
          position: [x, y, z],
          rotationY: dragRotationY,
          category: placingItem.category,
          label: placingItem.label,
          interactableId: placingItem.isStructure ? placingItem.propId.replace('prop.', '') : undefined,
          station: placingItem.station,
          panel: placingItem.panel,
          radius: placingItem.radius,
        })
        cancelPlacing()
        useUi.getState().notify({
          tone: 'success',
          message: `${placingItem.label} placed in the sanctuary.`,
          undoToken,
        })
      } else if (selectedObjectId && selectedObject) {
        const undoToken = useSanctuaryEditor
          .getState()
          .stageUndo(state.sanctuaryLayout, `Moving ${selectedObject.label}`)
        // Move existing selected object to new position
        dispatch({
          type: 'MOVE_SANCTUARY_OBJECT',
          id: selectedObjectId,
          position: [x, y, z],
          rotationY: dragRotationY !== 0 ? dragRotationY : selectedObject.rotationY,
        })
        selectObject(null)
        useUi.getState().notify({
          tone: 'success',
          message: `${selectedObject.label} moved.`,
          undoToken,
        })
      } else {
        // Check if user clicked on an existing object in 3D
        let closest: (typeof objects)[number] | null = null
        let closestDist = 2.5

        for (const obj of objects) {
          const d = Math.hypot(x - obj.position[0], z - obj.position[2])
          if (d < closestDist) {
            closestDist = d
            closest = obj
          }
        }

        if (closest) {
          selectObject(closest.id)
          useSanctuaryEditor.getState().setDragRotationY(closest.rotationY)
        } else {
          selectObject(null)
        }
      }
    }
  })

  if (!isEditing) return null

  const ghostPropId = placingItem?.propId ?? selectedObject?.propId
  const ghostScale = placingItem?.defaultScale ?? selectedObject?.scale ?? 1

  return (
    <group>
      {/* Visual Placement Grid Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} renderOrder={1}>
        <ringGeometry args={[0, GROUND_RADIUS, 64, 32]} />
        <meshBasicMaterial {...GROUND_DECAL} color="#38bdf8" opacity={0.06} wireframe />
      </mesh>

      {/* Selected Object Highlight Circle */}
      {selectedObject && (
        <group position={selectedObject.position}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} renderOrder={5}>
            <ringGeometry args={[(selectedObject.radius ?? 2) - 0.2, (selectedObject.radius ?? 2) + 0.2, 32]} />
            <meshBasicMaterial {...GROUND_DECAL} color="#fbbf24" opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Active Placement Ghost Preview */}
      {hoverPoint.current && ghostPropId && (
        <group position={hoverPoint.current} rotation={[0, dragRotationY, 0]}>
          <Prop id={ghostPropId} position={[0, 0, 0]} scale={ghostScale} castShadow={false} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={4}>
            <circleGeometry args={[2, 32]} />
            <meshBasicMaterial {...GROUND_DECAL} color={placingItem ? '#22c55e' : '#38bdf8'} opacity={0.32} />
          </mesh>
        </group>
      )}
    </group>
  )
}
