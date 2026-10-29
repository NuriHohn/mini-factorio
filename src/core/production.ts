import { advanceTransport, outputMachines } from '../simulation/transport'
import { allocatePower } from '../simulation/power'
import { advanceInserters, createInserterFrame } from '../simulation/inserters'
import type { InserterFrame } from '../simulation/inserters'
import { advanceCrafting } from '../simulation/crafting'
import { advanceForestry } from '../simulation/forestryStation'
import { advanceWaterwheels } from '../simulation/waterwheel'
import { advanceSteamWork } from '../simulation/steamWork'
import { advanceSteam } from '../simulation/steam'
import { advancePoultry } from '../simulation/poultry'
import { recordProduction, pruneAnalytics } from '../simulation/analytics'
import { depositAt, INTERVAL, SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import type { ProductionCredit } from './productionCredit'
import { STEP_MS } from './clock'

export interface ProductionHooks {
  afterPower?: (world: World, frame: InserterFrame) => void
  beforeCrafting?: (world: World) => void
  credit?: ProductionCredit
}
export function productionStep(world: World, hooks: ProductionHooks = {}): void {
  const frame = createInserterFrame(world)
  const vacated = advanceTransport(world, STEP_MS)
  outputMachines(world, vacated)
  const power = allocatePower(world, frame)
  hooks.afterPower?.(world, frame)
  advanceWaterwheels(world, STEP_MS)
  // Factory's defense dispatch must precede inserter processing.
  hooks.beforeCrafting?.(world)
  advanceInserters(world, STEP_MS, frame)
  hooks.credit?.observe(world, STEP_MS)
  advanceCrafting(world, STEP_MS, hooks.credit)
  advanceForestry(world, STEP_MS)
  for (const miner of world.buildings) {
    if (miner?.kind !== 'miner' || miner.item) continue
    const resource = depositAt(world, miner.x, miner.y)
    if (!resource) continue
    const speed = power.consumers[miner.y * SIZE + miner.x]?.speedFraction ?? 0
    hooks.credit?.research(world, 'miner', miner.elapsed, miner.elapsed + STEP_MS * speed)
    miner.elapsed += STEP_MS * speed
    if (miner.elapsed >= INTERVAL - 1e-8) {
      miner.elapsed = Math.max(0, miner.elapsed - INTERVAL)
      miner.item = resource
      world.mined[resource]++
      recordProduction(world, { [resource]: 1 })
    }
  }
  // The version-53 rolling ledger remains a shared persistence contract.
  pruneAnalytics(world)
  advanceSteamWork(world, STEP_MS)
  advanceSteam(world, STEP_MS)
  advancePoultry(world, STEP_MS)
}
