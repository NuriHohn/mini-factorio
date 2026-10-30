import { createPetesWorld, advancePetesWorld } from './simulation'
import { configureFactoryState } from '../core/factoryState'
import type { SceneRuntime } from '../core/application'
import { prioritizeProject } from './priorities'
import { peteSave } from './save'

export function peteRuntime(): SceneRuntime {
  return { mode: 'petesWorld', prioritize: prioritizeProject, save: peteSave, createWorld: createPetesWorld, advance: advancePetesWorld, activate: () => configureFactoryState(null) }
}
