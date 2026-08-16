import type { GameState } from '../types'
import type { Intent } from '../intents'

import {
  recordRegionVisit,
  discoverLandmark,
  observePhenomenon,
  completeExpeditionActivity,
} from './atlasExecutions'

import {
  takeDutyItem,
  abandonDutyItem,
  completeDuty,
  assignTraining,
  cancelAssignment,
  garrisonWyvern,
  collectRegionEggs,
  startBreeding,
  incubateEgg,
  feedWyvern,
  huntWildlife,
  setWyvernPerch,
  renameWyvern,
  releaseWyvern,
} from './sanctuaryExecutions'

import {
  addSanctuaryObject,
  moveSanctuaryObject,
  rotateSanctuaryObject,
  storeSanctuaryObject,
  resetSanctuaryLayout,
  restoreSanctuaryLayout,
} from './sanctuaryLayoutExecutions'

import {
  recruitSquad,
  disbandSquad,
  stationSquad,
  upgradeBuilding,
  setAssignedWorkers,
  setRulerTitle,
  setRulerEdict,
  upgradeElementalMastery,
  researchPhilosophy,
  craftEquipment,
  brewElixir,
  useElixir,
} from './economyExecutions'

import {
  launchAttack,
  resolveBattle,
} from './militaryExecutions'

export * from './atlasExecutions'
export * from './sanctuaryExecutions'
export * from './sanctuaryLayoutExecutions'
export * from './economyExecutions'
export * from './militaryExecutions'

/**
 * Executions are the ONLY code permitted to mutate GameState. Every one of
 * them re-validates its intent — intents arriving from a replay or a future
 * server are untrusted, and a rejected intent must leave state untouched.
 */
export function execute(state: GameState, intent: Intent): void {
  switch (intent.type) {
    case 'RECORD_REGION_VISIT':
      return recordRegionVisit(state, intent.regionId)
    case 'DISCOVER_LANDMARK':
      return discoverLandmark(state, intent.regionId, intent.landmarkId)
    case 'OBSERVE_PHENOMENON':
      return observePhenomenon(state, intent.regionId, intent.phenomenonId)
    case 'COMPLETE_EXPEDITION_ACTIVITY':
      return completeExpeditionActivity(state, intent.regionId, intent.activityId)
    case 'TAKE_DUTY_ITEM':
      return takeDutyItem(state, intent.dutyId)
    case 'ABANDON_DUTY_ITEM':
      return abandonDutyItem(state, intent.dutyId)
    case 'COMPLETE_DUTY':
      return completeDuty(state, intent.dutyId)
    case 'ASSIGN_TRAINING':
      return assignTraining(state, intent.wyvernId, intent.stationId)
    case 'CANCEL_ASSIGNMENT':
      return cancelAssignment(state, intent.wyvernId)
    case 'GARRISON_WYVERN':
      return garrisonWyvern(state, intent.wyvernId, intent.regionId)
    case 'COLLECT_REGION_EGGS':
      return collectRegionEggs(state, intent.regionId)
    case 'START_BREEDING':
      return startBreeding(state, intent.aId, intent.bId)
    case 'INCUBATE_EGG':
      return incubateEgg(state, intent.eggId)
    case 'FEED_WYVERN':
      return feedWyvern(state, intent.wyvernId)
    case 'HUNT_WILDLIFE':
      return huntWildlife(state, intent.wyvernId, intent.prey)
    case 'SET_WYVERN_PERCH':
      return setWyvernPerch(state, intent.wyvernId, intent.perchIndex)
    case 'RENAME_WYVERN':
      return renameWyvern(state, intent.wyvernId, intent.name)
    case 'RELEASE_WYVERN':
      return releaseWyvern(state, intent.wyvernId)
    case 'RECRUIT_SQUAD':
      return recruitSquad(state, intent.unitId, intent.strength)
    case 'DISBAND_SQUAD':
      return disbandSquad(state, intent.squadId)
    case 'STATION_SQUAD':
      return stationSquad(state, intent.squadId, intent.regionId)
    case 'UPGRADE_BUILDING':
      return upgradeBuilding(state, intent.buildingId)
    case 'SET_ASSIGNED_WORKERS':
      return setAssignedWorkers(state, intent.buildingId, intent.count)
    case 'SET_RULER_TITLE':
      return setRulerTitle(state, intent.title)
    case 'SET_RULER_EDICT':
      return setRulerEdict(state, intent.edict)
    case 'UPGRADE_ELEMENTAL_MASTERY':
      return upgradeElementalMastery(state, intent.element)
    case 'RESEARCH_PHILOSOPHY':
      return researchPhilosophy(state, intent.philosophyId)
    case 'CRAFT_EQUIPMENT':
      return craftEquipment(state, intent.equipmentType)
    case 'BREW_ELIXIR':
      return brewElixir(state, intent.elixirType)
    case 'USE_ELIXIR':
      return useElixir(state, intent.elixirType, intent.wyvernId)
    case 'LAUNCH_ATTACK':
      return launchAttack(state, intent)
    case 'RESOLVE_BATTLE':
      return resolveBattle(state, intent.result)
    case 'ABORT_BATTLE':
      state.pendingBattle = null
      return
    case 'ADD_SANCTUARY_OBJECT':
      return addSanctuaryObject(state, intent)
    case 'MOVE_SANCTUARY_OBJECT':
      return moveSanctuaryObject(state, intent.id, intent.position, intent.rotationY)
    case 'ROTATE_SANCTUARY_OBJECT':
      return rotateSanctuaryObject(state, intent.id, intent.rotationY)
    case 'STORE_SANCTUARY_OBJECT':
      return storeSanctuaryObject(state, intent.id)
    case 'RESET_SANCTUARY_LAYOUT':
      return resetSanctuaryLayout(state)
    case 'RESTORE_SANCTUARY_LAYOUT':
      return restoreSanctuaryLayout(state, intent.layout)
  }
}
