import { recordProduction } from './analytics'
import { emptyInventory, ITEMS, inventoryTotal } from './items'
import { hasRecipeInputs, MACHINE_DEFINITIONS, RECIPES } from './recipes'
import { buildingAt, SIZE } from './world'
import type { FurnaceRecipeMode } from './recipes'
import type { CraftingMachine, World } from './world'
export type CraftingStatus = 'processing' | 'waiting-input' | 'output-full' | 'waiting-recipe'

function hasOutputSpace(machine: CraftingMachine): boolean {
  const outputs = machine.job?.outputs ?? (machine.recipeId ? RECIPES[machine.recipeId].outputs : {})
  return inventoryTotal(machine.output) + ITEMS.reduce((sum, item) => sum + (outputs[item] ?? 0), 0) <= MACHINE_DEFINITIONS[machine.kind].outputCapacity
}
export function craftingStatus(machine: CraftingMachine): CraftingStatus {
  if (!hasOutputSpace(machine)) return 'output-full'
  return machine.job ? 'processing' : 'waiting-input'
}
export function canStartCrafting(machine: CraftingMachine): boolean {
  const recipe = machine.recipeId ? RECIPES[machine.recipeId] : null
  return recipe !== null && machine.recipeLocked && recipe.machine === machine.kind && !machine.job && hasOutputSpace(machine) && hasRecipeInputs(machine.input, recipe)
}
export function advanceCrafting(world: World, delta: number): void {
  for (const machine of world.buildings) {
    if (machine?.kind !== 'furnace' && machine?.kind !== 'assembler') continue
    const speed = world.power?.consumers[machine.y * SIZE + machine.x]?.speedFraction ?? 0
    if (speed <= 0) continue
    const job = machine.job
    if (job) {
      const recipe = RECIPES[job.recipeId]
      job.elapsedMs = Math.min(recipe.durationMs, job.elapsedMs + delta * speed * MACHINE_DEFINITIONS[machine.kind].craftingSpeed)
      if (job.elapsedMs >= recipe.durationMs - 1e-8 && hasOutputSpace(machine)) {
        for (const item of ITEMS) {
          machine.output[item] += job.outputs[item]
          world.produced[item] += job.outputs[item]
        }
        recordProduction(world, job.outputs)
        machine.job = null
      }
    }
    if (machine.job) continue
    if (!machine.recipeId || !canStartCrafting(machine)) continue
    const recipe = RECIPES[machine.recipeId]
    const inputs = emptyInventory(), outputs = emptyInventory()
    for (const item of ITEMS) {
      inputs[item] = recipe.inputs[item] ?? 0
      outputs[item] = recipe.outputs[item] ?? 0
      machine.input[item] -= inputs[item]
    }
    // A new job starts at this boundary and receives no elapsed time yet.
    recordProduction(world, {}, inputs)
    machine.job = { recipeId: recipe.id, elapsedMs: 0, inputs, outputs }
  }
}

export function recipeChangeError(machine: CraftingMachine): string | null {
  if (machine.job) return 'Finish the active batch before changing recipes, including any reserved materials.'
  if ((inventoryTotal(machine.input) && (machine.kind !== 'assembler' || machine.recipeLocked)) || inventoryTotal(machine.output)) return 'Empty both input and output buffers before changing recipes.'
  return null
}
// Mode changes and manual selection cannot bypass compatibility or material locks.
export function changeCraftingRecipe(world: World, x: number, y: number, recipeId: FurnaceRecipeMode): string | null {
  const machine = buildingAt(world, x, y)
  if (machine?.kind !== 'assembler') return 'Select an existing assembler.'
  if (recipeId !== 'auto' && (!Object.hasOwn(RECIPES, recipeId) || RECIPES[recipeId].machine !== machine.kind)) return 'This recipe is not compatible with this machine.'
  const error = recipeChangeError(machine)
  if (error) return error
  if (recipeId === 'auto') return 'Assemblers require explicit manual recipe selection.'
  const recipe = RECIPES[recipeId]
  if (ITEMS.some(item => machine.input[item] > (recipe.inputs[item] ?? 0) * MACHINE_DEFINITIONS.assembler.input.batches)) return 'Buffered ingredients are incompatible with this recipe.'
  delete world.analytics.machines[y * SIZE + x]
  machine.recipeLocked = true
  machine.recipeMode = 'manual'
  machine.recipeId = recipeId
  machine.autoWaitElapsedMs = null
  return null
}
