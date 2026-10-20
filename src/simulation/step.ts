import { depositAt, INTERVAL, SIZE } from './world'
import type { World } from './world'
import { advanceTransport, outputMachines } from './transport'
import { allocatePower } from './power'
import { advanceSmelting } from './smelting'
export const STEP_MS = 50
export function advanceWorld(world: World, delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) return
  world.remainder += delta
  while (world.remainder + 1e-8 >= STEP_MS) {
    world.remainder = Math.max(0, world.remainder - STEP_MS)
    const vacated = advanceTransport(world, STEP_MS)
    outputMachines(world, vacated)
    const power = allocatePower(world)
    advanceSmelting(world, STEP_MS)
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
