// Compatibility dispatcher for cross-mode callers/tests. Applications import their own orchestrator.
import { advancePetesWorld } from '../pete/simulation'
import { advanceFactoryWorld } from '../factory/simulation'
import type { World } from './world'
export { STEP_MS } from '../core/clock'

export function advanceWorld(world: World, delta: number): void {
  if (world.miniFactory) advancePetesWorld(world, delta)
  else advanceFactoryWorld(world, delta)
}
