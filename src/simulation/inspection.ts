import { emptyInventory } from './items'
import type { Inventory } from './items'
import { furnaceStatus } from './smelting'
import type { FurnaceStatus } from './smelting'
import { RECIPES } from './recipes'
import { outputWaiting } from './transport'
import type { Direction, World } from './world'

export interface WorldStats {
  oreMined: number
  platesSmelted: number
  storedOre: number
  storedPlates: number
  miners: number
  furnaces: number
}
export type Inspection = { kind: 'storage'; inventory: Inventory } | {
  kind: 'furnace'
  direction: Direction
  recipe: string
  input: Inventory
  output: Inventory
  reserved: Inventory
  progress: number
  status: FurnaceStatus
  outputWaiting: boolean
}
export function worldStats(world: World): WorldStats {
  const stats: WorldStats = { oreMined: world.ore, platesSmelted: world.plates, storedOre: 0, storedPlates: 0, miners: 0, furnaces: 0 }
  for (const building of world.buildings) {
    if (building?.kind === 'miner') stats.miners++
    if (building?.kind === 'furnace') stats.furnaces++
    if (building?.kind === 'storage') {
      stats.storedOre += building.inventory.iron
      stats.storedPlates += building.inventory.ironPlate
    }
  }
  return stats
}
export function inspectBuilding(world: World, index: number | null): Inspection | null {
  const building = index === null ? null : world.buildings[index]
  if (building?.kind === 'storage') return { kind: 'storage', inventory: { ...building.inventory } }
  if (building?.kind !== 'furnace') return null
  return {
    kind: 'furnace', direction: building.direction, recipe: RECIPES[building.recipeId].label,
    input: { ...building.input }, output: { ...building.output }, reserved: { ...(building.job?.outputs ?? emptyInventory()) },
    progress: building.job ? building.job.elapsedMs / RECIPES[building.job.recipeId].durationMs : 0,
    status: furnaceStatus(building), outputWaiting: outputWaiting(world, building),
  }
}
