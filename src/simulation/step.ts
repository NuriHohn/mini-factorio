import { INTERVAL } from './world'
import type { World } from './world'
import { advanceTransport, outputMachines } from './transport'
import { advanceSmelting } from './smelting'
export const STEP_MS = 50
export function advanceWorld(world: World, delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) return
  world.remainder += delta
  while (world.remainder + 1e-8 >= STEP_MS) {
    world.remainder = Math.max(0, world.remainder - STEP_MS)
    const vacated = advanceTransport(world, STEP_MS)
    outputMachines(world, vacated)
    advanceSmelting(world, STEP_MS)
    for (const miner of world.buildings) {
      if (miner?.kind !== 'miner' || miner.item) continue
      miner.elapsed += STEP_MS
      if (miner.elapsed >= INTERVAL) {
        miner.elapsed -= INTERVAL
        miner.item = 'iron'
        world.ore++
      }
    }
  }
}
