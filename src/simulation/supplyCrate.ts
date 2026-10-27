import { inventoryTotal } from './items'
import { neighboringTiles, peteReachableTiles as reachableTiles, serviceCrossing, tilePath } from './navigation'
import type { SupplyCrate, World } from './world'
export const SUPPLY_CRATE_WOOD = 6
export const SUPPLY_CRATE_CAPACITY = 200
export function supplyCapacity(crate: Pick<SupplyCrate, 'storeTier'>): number { return crate.storeTier === 2 ? 600 : crate.storeTier === 1 ? 400 : SUPPLY_CRATE_CAPACITY }
export const SUPPLY_INSPECTION_MS = 4000
// Pete uses adjacent land or his owned service crossing, never the crate itself.
export function crateAtSpot(world: World, spot: number | null): SupplyCrate | null {
  if (spot === null || world.water[spot] || world.buildings[spot] && !serviceCrossing(world, spot) || world.buildings.some(b => b?.kind === 'prison' && b.exit === spot)) return null
  for (const i of neighboringTiles(spot)) {
    const b = world.buildings[i]
    if (b?.kind === 'supplyCrate') return b
  }
  return null
}
export function reachableCrateSpot(world: World): number | null {
  const spots = world.buildings.flatMap((b, i) => b?.kind === 'supplyCrate' ? neighboringTiles(i).filter(i => crateAtSpot(world, i)) : [])
  if (!spots.length) return null
  const parents = reachableTiles(world, world.pete.tile)
  return spots.filter(i => parents.has(i)).sort((a, b) => (tilePath(parents, a)?.length ?? Infinity) - (tilePath(parents, b)?.length ?? Infinity) || a - b)[0] ?? null
}
export function inspectingCrate(world: World, crate: SupplyCrate): boolean {
  return world.peace.activity === 'checkingCrate' && crateAtSpot(world, world.peace.destination) === crate
}

export function supplyWood(world: World, index: number, amount: number): boolean {
  const crate = world.buildings[index]
  if (crate?.kind !== 'supplyCrate' || !Number.isSafeInteger(amount) || amount <= 0 || amount > world.nature.wood || inventoryTotal(crate.inventory) + crate.wood + amount > supplyCapacity(crate)) return false
  world.nature.wood -= amount; crate.wood += amount
  return true
}
