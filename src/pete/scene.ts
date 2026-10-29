import { createPetesWorld, advancePetesWorld } from './simulation'
import { configureFactoryState } from '../core/factoryState'
import type { SceneRuntime } from '../core/application'
import { peteSave } from './save'

export function peteRuntime(): SceneRuntime {
  return { mode: 'petesWorld', save: peteSave, createWorld: createPetesWorld, advance: advancePetesWorld, activate: () => configureFactoryState(null) }
}
