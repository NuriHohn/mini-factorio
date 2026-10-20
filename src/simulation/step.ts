import { depositAt, INTERVAL, SIZE } from './world'
import type { World } from './world'
import { advanceTransport, outputMachines } from './transport'
import { allocatePower } from './power'
import { prepareAssemblerRecipes } from './assemblerRecipes'
import { advanceInserters, createInserterFrame } from './inserters'
import { advanceCrafting } from './crafting'
export const STEP_MS = 50
export function advanceWorld(world: World, delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) return
  world.remainder += delta
  while (world.remainder + 1e-8 >= STEP_MS) {
    world.remainder = Math.max(0, world.remainder - STEP_MS)
    const inserterFrame = createInserterFrame(world)
    const vacated = advanceTransport(world, STEP_MS)
    outputMachines(world, vacated)
    prepareAssemblerRecipes(world, STEP_MS)
    const power = allocatePower(world, inserterFrame)
    advanceInserters(world, STEP_MS, inserterFrame)
    advanceCrafting(world, STEP_MS)
    for (const miner of world.buildings) {
      if (miner?.kind !== 'miner' || miner.item) continue
      const resource = depositAt(world, miner.x, miner.y)
      if (!resource) continue
      const speed = power.consumers[miner.y * SIZE + miner.x]?.speedFraction ?? 0
      miner.elapsed += STEP_MS * speed
      if (miner.elapsed >= INTERVAL - 1e-8) {
        miner.elapsed = Math.max(0, miner.elapsed - INTERVAL)
        miner.item = resource
        world.mined[resource]++
      }
    }
  }
}
