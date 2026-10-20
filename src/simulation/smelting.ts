import type { Item } from './items'
import { RECIPES } from './recipes'
import type { FurnaceRecipeMode, RecipeId } from './recipes'
import { buildingAt } from './world'
import type { Furnace, World } from './world'
import { recipeChangeError } from './crafting'
// Preserve furnace API names while sharing all processing and reservation logic.
export { advanceCrafting as advanceSmelting, canStartCrafting as canStartSmelting, craftingStatus as furnaceStatus, recipeChangeError } from './crafting'
export type { CraftingStatus as FurnaceStatus } from './crafting'

// A probe is read-only: transport reserves the returned recipe before committing arrivals.
export function incomingRecipe(furnace: Furnace, item: Item): RecipeId | null {
  if (furnace.recipeMode === 'auto' && !furnace.recipeLocked && furnace.recipeId === null && recipeChangeError(furnace) === null) {
    return Object.values(RECIPES).find(recipe => recipe.machine === furnace.kind && (recipe.inputs[item] ?? 0) > 0)?.id ?? null
  }
  return furnace.recipeId
}
export function changeFurnaceRecipe(world: World, x: number, y: number, recipeMode: FurnaceRecipeMode): string | null {
  const furnace = buildingAt(world, x, y)
  if (furnace?.kind !== 'furnace') return 'Select an existing furnace.'
  if (recipeMode !== 'auto' && (!Object.hasOwn(RECIPES, recipeMode) || RECIPES[recipeMode].machine !== furnace.kind)) return 'This recipe is not compatible with this machine.'
  const error = recipeChangeError(furnace)
  if (error) return error
  if (recipeMode === 'auto' && furnace.recipeLocked) return 'Automatic detection is one-time only. Choose a manual recipe to change the locked recipe.'
  furnace.recipeLocked = recipeMode !== 'auto'
  furnace.recipeMode = recipeMode
  furnace.recipeId = recipeMode === 'auto' ? null : recipeMode
  return null
}
