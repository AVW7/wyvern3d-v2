'use client'

import { useUi } from '@/state/uiStore'
import { CameraSettingsPanel } from './CameraSettingsPanel'
import { EconomyManagementPanel } from '@/scenes/Sanctuary/ui/EconomyManagementPanel'
import { RealmGovernancePanel } from '@/scenes/Sanctuary/ui/RealmGovernancePanel'
import { RosterPanel } from './panels/RosterPanel'
import { TrainingPanel } from './panels/TrainingPanel'
import { HatcheryPanel } from './panels/HatcheryPanel'
import { BreedingPanel } from './panels/BreedingPanel'
import { BarracksPanel } from './panels/BarracksPanel'
import { InfirmaryPanel } from './panels/InfirmaryPanel'
import { WarTablePanel } from './panels/WarTablePanel'
import { HelpPanel } from './panels/HelpPanel'

export {
  Head,
  Cost,
  Bar,
  assignmentLabel,
  WyvernCard,
  BuildingUpgrade,
} from './panels/common'
export { RosterPanel } from './panels/RosterPanel'
export { TrainingPanel } from './panels/TrainingPanel'
export { HatcheryPanel } from './panels/HatcheryPanel'
export { BreedingPanel } from './panels/BreedingPanel'
export { BarracksPanel } from './panels/BarracksPanel'
export { InfirmaryPanel } from './panels/InfirmaryPanel'
export { WarTablePanel } from './panels/WarTablePanel'
export { HelpPanel } from './panels/HelpPanel'

export function Panels() {
  const panel = useUi((s) => s.openPanel)
  if (!panel) return null

  return (
    <div className="panel liquid-glass">
      {panel === 'roster' && <RosterPanel />}
      {panel === 'training' && <TrainingPanel />}
      {panel === 'hatchery' && <HatcheryPanel />}
      {panel === 'breeding' && <BreedingPanel />}
      {panel === 'barracks' && <BarracksPanel />}
      {panel === 'infirmary' && <InfirmaryPanel />}
      {panel === 'warTable' && <WarTablePanel />}
      {panel === 'help' && <HelpPanel />}
      {panel === 'camera' && <CameraSettingsPanel />}
      {panel === 'economy' && <EconomyManagementPanel />}
      {panel === 'realm' && <RealmGovernancePanel />}
    </div>
  )
}
