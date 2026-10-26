import { advanceSteamWork } from './steamWork'
import { advanceSteam } from './steam'
import { advanceForestry } from './forestryStation'
import { advanceGate } from './gardenGate'
import { advancePoultry } from './poultry'
import { advanceWaterwheels } from './waterwheel'
import { advancePeace } from './peace'
import { advanceNature } from './nature'
import { advanceRevenge } from './revenge'
import { awardResearch } from './research'
import { observeMachines, pruneAnalytics, recordProduction } from './analytics'
import { advanceWebs } from './webs'
import { advanceSprinklers } from './sprinklers'
import { advancePolice } from './police'
import { advancePete } from './pete'
import { depositAt, INTERVAL, SIZE } from './world'
import type { World } from './world'
import { advanceTransport, outputMachines } from './transport'
import { allocatePower } from './power'
import { advanceInserters, createInserterFrame } from './inserters'
import { advanceCrafting } from './crafting'
export const STEP_MS = 50
export function advanceWorld(world: World, delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) return
  world.remainder += delta
  while (world.remainder + 1e-8 >= STEP_MS) {
    world.remainder = Math.max(0, world.remainder - STEP_MS)
    world.timeMs += STEP_MS
    if (world.playfulSpray && world.timeMs >= world.playfulSpray.untilMs) delete world.playfulSpray
    const reactingToWater = world.pete.water !== null
    advanceNature(world)
    advanceGate(world, STEP_MS)
    advancePeace(world, STEP_MS)
    advanceWebs(world)
    advancePete(world, STEP_MS)
    const inserterFrame = createInserterFrame(world)
    const vacated = advanceTransport(world, STEP_MS)
    outputMachines(world, vacated)
    const power = allocatePower(world, inserterFrame)
    advanceRevenge(world, STEP_MS)
    if (world.revenge.blast?.atMs === world.timeMs) allocatePower(world, inserterFrame)
    advanceWaterwheels(world, STEP_MS)
    advancePolice(world, STEP_MS)
    advanceSprinklers(world, STEP_MS, !reactingToWater)
    advanceInserters(world, STEP_MS, inserterFrame)
    observeMachines(world, STEP_MS)
    advanceCrafting(world, STEP_MS)
    advanceForestry(world, STEP_MS)
    for (const miner of world.buildings) {
      if (miner?.kind !== 'miner' || miner.item) continue
      const resource = depositAt(world, miner.x, miner.y)
      if (!resource) continue
      const speed = power.consumers[miner.y * SIZE + miner.x]?.speedFraction ?? 0
      awardResearch(world, 'miner', miner.elapsed, miner.elapsed + STEP_MS * speed)
      miner.elapsed += STEP_MS * speed
      if (miner.elapsed >= INTERVAL - 1e-8) {
        miner.elapsed = Math.max(0, miner.elapsed - INTERVAL)
        miner.item = resource
        world.mined[resource]++
        recordProduction(world, { [resource]: 1 })
      }
    }
    pruneAnalytics(world)
    advanceSteamWork(world, STEP_MS)
    advanceSteam(world, STEP_MS)
    advancePoultry(world, STEP_MS)
  }
}
