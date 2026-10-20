import type { Inventory } from './items'
export type RecipeId = 'ironSmelting' | 'copperSmelting'
export interface Recipe {
  readonly id: RecipeId
  readonly label: string
  readonly machine: 'furnace'
  readonly inputs: Readonly<Partial<Inventory>>
  readonly outputs: Readonly<Partial<Inventory>>
  readonly durationMs: number
}
export const RECIPES: Readonly<Record<RecipeId, Recipe>> = {
  ironSmelting: { id: 'ironSmelting', label: 'Iron smelting', machine: 'furnace', inputs: { iron: 1 }, outputs: { ironPlate: 1 }, durationMs: 2000 },
  copperSmelting: { id: 'copperSmelting', label: 'Copper smelting', machine: 'furnace', inputs: { copper: 1 }, outputs: { copperPlate: 1 }, durationMs: 2000 },
}
export const FURNACE_INPUT_CAPACITY = 2
export const FURNACE_OUTPUT_CAPACITY = 2
