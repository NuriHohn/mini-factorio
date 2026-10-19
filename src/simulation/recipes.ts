import type { Inventory } from './items'
export type RecipeId = 'ironSmelting'
export interface Recipe {
  readonly id: RecipeId
  readonly label: string
  readonly inputs: Readonly<Partial<Inventory>>
  readonly outputs: Readonly<Partial<Inventory>>
  readonly durationMs: number
}
export const RECIPES: Readonly<Record<RecipeId, Recipe>> = {
  ironSmelting: { id: 'ironSmelting', label: 'Iron smelting', inputs: { iron: 1 }, outputs: { ironPlate: 1 }, durationMs: 2000 },
}
export const FURNACE_INPUT_CAPACITY = 2
export const FURNACE_OUTPUT_CAPACITY = 2
