import type { Inventory } from './items'
export type FurnaceRecipeMode = 'auto' | RecipeId
export type RecipeId = 'ironSmelting' | 'copperSmelting' | 'ironGear' | 'copperCable' | 'electronicCircuit'
export interface Recipe {
  readonly id: RecipeId
  readonly label: string
  readonly machine: CraftingKind
  readonly inputs: Readonly<Partial<Inventory>>
  readonly outputs: Readonly<Partial<Inventory>>
  readonly durationMs: number
}
export const RECIPES: Readonly<Record<RecipeId, Recipe>> = {
  ironSmelting: { id: 'ironSmelting', label: 'Iron smelting', machine: 'furnace', inputs: { iron: 1 }, outputs: { ironPlate: 1 }, durationMs: 2000 },
  copperSmelting: { id: 'copperSmelting', label: 'Copper smelting', machine: 'furnace', inputs: { copper: 1 }, outputs: { copperPlate: 1 }, durationMs: 2000 },
  ironGear: { id: 'ironGear', label: 'Iron gear', machine: 'assembler', inputs: { ironPlate: 2 }, outputs: { ironGear: 1 }, durationMs: 2000 },
  copperCable: { id: 'copperCable', label: 'Copper cable', machine: 'assembler', inputs: { copperPlate: 1 }, outputs: { copperCable: 2 }, durationMs: 2000 },
  electronicCircuit: { id: 'electronicCircuit', label: 'Electronic circuit', machine: 'assembler', inputs: { ironPlate: 1, copperCable: 3 }, outputs: { electronicCircuit: 1 }, durationMs: 3000 },
}
export const FURNACE_INPUT_CAPACITY = 2
export const FURNACE_OUTPUT_CAPACITY = 2

export type CraftingKind = 'furnace' | 'assembler'
// Data only: shared by simulation, inspection and future offline planning tools.
export const MACHINE_DEFINITIONS = {
  furnace: { craftingSpeed: 1, powerKw: 50, input: { kind: 'total', capacity: FURNACE_INPUT_CAPACITY }, outputCapacity: FURNACE_OUTPUT_CAPACITY, inputSides: ['rear', 'left', 'right'], outputSide: 'front' },
  assembler: { craftingSpeed: 1, powerKw: 60, input: { kind: 'per-ingredient', batches: 2 }, outputCapacity: 4, inputSides: ['rear', 'left', 'right'], outputSide: 'front' },
} as const
