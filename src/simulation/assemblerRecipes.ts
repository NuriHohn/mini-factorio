import { ITEMS, inventoryTotal } from './items'
import type { Item } from './items'
import { hasRecipeInputs, MACHINE_DEFINITIONS, RECIPES } from './recipes'
import type { Recipe } from './recipes'
import type { Assembler, World } from './world'

export const ASSEMBLER_AUTO_WAIT_MS = 2000
const recipes = Object.values(RECIPES).filter(recipe => recipe.machine === 'assembler')
function ingredientTypes(recipe: Recipe): number { return ITEMS.filter(item => (recipe.inputs[item] ?? 0) > 0).length }

// Only undecided Auto machines accept all recipe ingredients; locks narrow future deliveries.
export function assemblerInputCapacity(machine: Assembler, item: Item): number {
  if (machine.recipeMode === 'auto' && machine.recipeLocked && (!machine.recipeId || !(RECIPES[machine.recipeId].inputs[item] ?? 0))) return 0
  const compatible = machine.recipeMode === 'auto' ? recipes : machine.recipeId ? [RECIPES[machine.recipeId]] : []
  return Math.max(0, ...compatible.map(recipe => recipe.inputs[item] ?? 0)) * MACHINE_DEFINITIONS.assembler.input.batches
}
export function assemblerWaitRemaining(machine: Assembler): number {
  if (machine.recipeMode !== 'auto' || machine.recipeLocked || machine.job || !machine.recipeId || ingredientTypes(RECIPES[machine.recipeId]) > 1) return 0
  return Math.max(0, ASSEMBLER_AUTO_WAIT_MS - (machine.autoWaitElapsedMs ?? 0))
}
export function selectAssemblerRecipe(machine: Assembler, delta: number): void {
  if (machine.recipeMode !== 'auto' || machine.recipeLocked) return
  if (machine.job) {
    machine.recipeId = machine.job.recipeId
    machine.recipeLocked = true
    return
  }
  const craftable = recipes.filter(recipe => hasRecipeInputs(machine.input, recipe))
  const singleReady = craftable.some(recipe => ingredientTypes(recipe) === 1)
  // Start at zero on the first ready boundary. Arrivals, power and backpressure never reset it.
  machine.autoWaitElapsedMs = singleReady ? machine.autoWaitElapsedMs === null ? 0 : Math.min(ASSEMBLER_AUTO_WAIT_MS, machine.autoWaitElapsedMs + delta) : null
  craftable.sort((a, b) => ingredientTypes(b) - ingredientTypes(a))
  const selected = craftable.find(recipe => inventoryTotal(machine.output) + inventoryTotal(recipe.outputs) <= MACHINE_DEFINITIONS.assembler.outputCapacity) ?? craftable[0]
  machine.recipeId = selected?.id ?? null
  if (selected && (ingredientTypes(selected) > 1 || machine.autoWaitElapsedMs === ASSEMBLER_AUTO_WAIT_MS)) {
    machine.recipeLocked = true
    machine.autoWaitElapsedMs = null
  }
}
export function prepareAssemblerRecipes(world: World, delta: number): void {
  for (const machine of world.buildings) if (machine?.kind === 'assembler') selectAssemblerRecipe(machine, delta)
}
