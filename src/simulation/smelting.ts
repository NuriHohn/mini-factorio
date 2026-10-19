import { emptyInventory, ITEMS, inventoryTotal } from './items'
import { FURNACE_OUTPUT_CAPACITY, RECIPES } from './recipes'
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
export function advanceSmelting(world: World, delta: number): void {
  for (const furnace of world.buildings) {
    if (furnace?.kind !== 'furnace') continue
    const job = furnace.job
    if (job) {
      const recipe = RECIPES[job.recipeId]
      job.elapsedMs = Math.min(recipe.durationMs, job.elapsedMs + delta)
      if (job.elapsedMs === recipe.durationMs && hasOutputSpace(furnace)) {
        for (const item of ITEMS) furnace.output[item] += job.outputs[item]
        world.plates += job.outputs.ironPlate
        furnace.job = null
      }
    }
    if (furnace.job) continue
    const recipe = RECIPES[furnace.recipeId]
    if (!hasOutputSpace(furnace) || !ITEMS.every(item => furnace.input[item] >= (recipe.inputs[item] ?? 0))) continue
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
