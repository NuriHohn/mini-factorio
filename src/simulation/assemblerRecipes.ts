import type { Item } from './items'
import { MACHINE_DEFINITIONS, RECIPES } from './recipes'
import type { Assembler } from './world'

// Legacy Auto fields remain readable in old saves; runtime selection is always explicit.
export function assemblerInputCapacity(machine: Assembler, item: Item): number {
  if (!machine.recipeLocked || !machine.recipeId) return 0
  return (RECIPES[machine.recipeId].inputs[item] ?? 0) * MACHINE_DEFINITIONS.assembler.input.batches
}
