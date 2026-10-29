import type { World } from '../simulation/world'

export const STEP_MS = 50
export function fixedSteps(world: World, delta: number, step: (world: World) => void): void {
  if (!Number.isFinite(delta) || delta <= 0) return
  world.remainder += delta
  while (world.remainder + 1e-8 >= STEP_MS) {
    world.remainder = Math.max(0, world.remainder - STEP_MS)
    world.timeMs += STEP_MS
    step(world)
  }
}
