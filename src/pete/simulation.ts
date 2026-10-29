import { fixedSteps, STEP_MS } from '../core/clock'
import { productionStep } from '../core/production'
import { advanceNature } from '../simulation/nature'
import { advanceGate } from '../simulation/gardenGate'
import { advancePeace } from '../simulation/peace'
import { createPetesWorld } from '../simulation/petesWorld'
import type { World } from '../simulation/world'

export { createPetesWorld }
export function advancePetesWorld(world: World, delta: number): void {
  if (!world.miniFactory) throw new Error('Pete simulation requires Petes Welt.')
  fixedSteps(world, delta, world => {
    if (world.playfulSpray && world.timeMs >= world.playfulSpray.untilMs) delete world.playfulSpray
    advanceNature(world)
    advanceGate(world, STEP_MS)
    advancePeace(world, STEP_MS)
    productionStep(world)
  })
}
