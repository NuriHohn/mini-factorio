import { fixedSteps, STEP_MS } from '../core/clock'
import { productionStep } from '../core/production'
import { advanceNature } from '../simulation/nature'
import { advanceGate } from '../simulation/gardenGate'
import { advancePeace } from '../simulation/peace'
import { advanceWebs } from './webSystem'
import { advancePete } from './peteSystem'
import { advanceRevenge } from './revengeSystem'
import { advancePolice } from './policeSystem'
import { advanceSprinklers } from './sprinklerSystem'
import { awardResearch } from './research'
import { observeMachines } from './analytics'
import { allocatePower } from '../simulation/power'
import { createWorld } from '../simulation/world'
import type { World } from '../simulation/world'

export { createWorld as createFactoryWorld }
export function advanceFactoryWorld(world: World, delta: number): void {
  if (world.miniFactory) throw new Error('Factory simulation requires Factory.')
  fixedSteps(world, delta, world => {
    if (world.playfulSpray && world.timeMs >= world.playfulSpray.untilMs) delete world.playfulSpray
    const reactingToWater = world.pete.water !== null
    advanceNature(world)
    advanceGate(world, STEP_MS)
    advancePeace(world, STEP_MS)
    advanceWebs(world)
    advancePete(world, STEP_MS)
    productionStep(world, {
      afterPower: (world, frame) => {
        advanceRevenge(world, STEP_MS)
        if (world.revenge.blast?.atMs === world.timeMs) allocatePower(world, frame)
      },
      beforeCrafting: world => {
        advancePolice(world, STEP_MS)
        advanceSprinklers(world, STEP_MS, !reactingToWater)
      },
      credit: { research: awardResearch, observe: observeMachines },
    })
  })
}
