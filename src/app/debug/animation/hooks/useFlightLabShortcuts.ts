import { useEffect } from 'react'

interface UseFlightLabShortcutsOptions {
  step: (delta: number) => void
  setAuto: (auto: boolean) => void
  setFrozen: React.Dispatch<React.SetStateAction<boolean>>
  setCenterTrigger: React.Dispatch<React.SetStateAction<number>>
  setZoomFitTrigger: React.Dispatch<React.SetStateAction<number>>
  setZoomInTrigger: React.Dispatch<React.SetStateAction<number>>
  setZoomOutTrigger: React.Dispatch<React.SetStateAction<number>>
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  setHideUI?: React.Dispatch<React.SetStateAction<boolean>>
}

export function useFlightLabShortcuts({
  step,
  setAuto,
  setFrozen,
  setCenterTrigger,
  setZoomFitTrigger,
  setZoomInTrigger,
  setZoomOutTrigger,
  setPanelOpen,
  setHideUI,
}: UseFlightLabShortcutsOptions) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }
      if (event.key === 'ArrowRight') {
        step(1)
        setAuto(false)
      } else if (event.key === 'ArrowLeft') {
        step(-1)
        setAuto(false)
      } else if (event.code === 'Space') {
        event.preventDefault()
        setFrozen((value) => !value)
      } else if (event.key === 'c' || event.key === 'C') {
        setCenterTrigger((trig) => trig + 1)
      } else if (event.key === 'f' || event.key === 'F') {
        setZoomFitTrigger((trig) => trig + 1)
      } else if (event.key === '+' || event.key === '=') {
        setZoomInTrigger((trig) => trig + 1)
      } else if (event.key === '-' || event.key === '_') {
        setZoomOutTrigger((trig) => trig + 1)
      } else if (event.key === 'p' || event.key === 'P') {
        setPanelOpen((open) => !open)
      } else if (event.key === 'h' || event.key === 'H') {
        setHideUI?.((hidden) => !hidden)
      } else if (event.key === 'Escape') {
        setHideUI?.(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, setAuto, setFrozen, setCenterTrigger, setZoomFitTrigger, setZoomInTrigger, setZoomOutTrigger, setPanelOpen, setHideUI])
}
