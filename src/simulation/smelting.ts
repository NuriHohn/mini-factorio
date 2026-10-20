import { emptyInventory, ITEMS, inventoryTotal } from './items'
import { FURNACE_OUTPUT_CAPACITY, RECIPES } from './recipes'
import { SIZE } from './world'
import type { Furnace, World } from './world'
export type FurnaceStatus = 'processing' | 'waiting-input' | 'output-full'

function hasOutputSpace(furnace: Furnace): boolean {
  const outputs = furnace.job?.outputs ?? RECIPES[furnace.recipeId].outputs
  return inventoryTotal(furnace.output) + ITEMS.reduce((sum, item) => sum + (outputs[item] ?? 0), 0) <= FURNACE_OUTPUT_CAPACITY
}
export function furnaceStatus(furnace: Furnace): FurnaceStatus {
  if (!hasOutputSpace(furnace)) return 'output-full'
  return furnace.job ? 'processing' : 'waiting-input'
}
export function canStartSmelting(furnace: Furnace): boolean {
  const recipe = RECIPES[furnace.recipeId]
  return !furnace.job && hasOutputSpace(furnace) && ITEMS.every(item => furnace.input[item] >= (recipe.inputs[item] ?? 0))
}
export function advanceSmelting(world: World, delta: number): void {
  for (const furnace of world.buildings) {
    if (furnace?.kind !== 'furnace') continue
    const speed = world.power?.consumers[furnace.y * SIZE + furnace.x]?.speedFraction ?? 0
    if (speed <= 0) continue
    const job = furnace.job
    if (job) {
      const recipe = RECIPES[job.recipeId]
      job.elapsedMs = Math.min(recipe.durationMs, job.elapsedMs + delta * speed)
      if (job.elapsedMs >= recipe.durationMs - 1e-8 && hasOutputSpace(furnace)) {
        for (const item of ITEMS) furnace.output[item] += job.outputs[item]
        world.plates += job.outputs.ironPlate
        furnace.job = null
      }
    }
    if (furnace.job) continue
    const recipe = RECIPES[furnace.recipeId]
    if (!canStartSmelting(furnace)) continue
    const inputs = emptyInventory(), outputs = emptyInventory()
    for (const item of ITEMS) {
      inputs[item] = recipe.inputs[item] ?? 0
      outputs[item] = recipe.outputs[item] ?? 0
      furnace.input[item] -= inputs[item]
    }
    // A new job starts at this boundary and receives no elapsed time yet.
    furnace.job = { recipeId: recipe.id, elapsedMs: 0, inputs, outputs }
  }
}
