import { buildingAt, offsets, opposite } from './world'
import type { Belt, Building, Direction, Furnace, World } from './world'
import { ITEMS, inventoryTotal } from './items'
import type { Item } from './items'
import { FURNACE_INPUT_CAPACITY, RECIPES } from './recipes'
import type { RecipeId } from './recipes'
import { incomingRecipe } from './smelting'
export const BELT_TRAVEL_MS = 500

function receiver(world: World, source: Building, direction: Direction): Building | null {
  const offset = offsets[direction]
  return buildingAt(world, source.x + offset.x, source.y + offset.y)
}
function canReceive(target: Building, item: Item, travel: Direction, reserved = 0, recipeId: RecipeId | null = target.kind === 'furnace' ? target.recipeId : null): boolean {
  switch (target.kind) {
    case 'storage': return true
    case 'belt': return !target.item && reserved === 0 && target.direction !== opposite(travel)
    case 'furnace': return target.direction !== opposite(travel)
      && recipeId !== null && (RECIPES[recipeId].inputs[item] ?? 0) > 0
      && inventoryTotal(target.input) + reserved < FURNACE_INPUT_CAPACITY
    default: return false
  }
}
function accept(target: Building, item: Item, direction: Direction): void {
  switch (target.kind) {
    case 'storage': target.inventory[item]++; break
    case 'furnace': target.input[item]++; break
    case 'belt':
      target.item = item
      target.progress = 0
      target.entry = opposite(direction)
      break
  }
}
export function advanceTransport(world: World, delta: number): Set<Building> {
  const transfers: { source: Belt; target: Building; item: Item }[] = []
  const reserved = new Map<Building, number>()
  const recipes = new Map<Furnace, RecipeId>()
  // Reserve against unchanged occupancy/input buffers before committing any moves.
  for (const source of world.buildings) {
    if (source?.kind !== 'belt' || !source.item) continue
    source.progress = Math.min(1, source.progress + delta / BELT_TRAVEL_MS)
    if (source.progress < 1 - 1e-8) continue
    source.progress = 1
    const target = receiver(world, source, source.direction)
    if (!target) continue
    const recipeId = target.kind === 'furnace' ? recipes.get(target) ?? incomingRecipe(target, source.item) : null
    if (!canReceive(target, source.item, source.direction, reserved.get(target) ?? 0, recipeId)) continue
    // Tile order chooses the first compatible arrival; later arrivals share its recipe lock.
    if (target.kind === 'furnace' && recipeId) recipes.set(target, recipeId)
    transfers.push({ source, target, item: source.item })
    reserved.set(target, (reserved.get(target) ?? 0) + 1)
  }
  for (const [furnace, recipeId] of recipes) furnace.recipeId = recipeId
  for (const { source, target, item } of transfers) {
    accept(target, item, source.direction)
    source.item = null
    source.progress = 0
  }
  return new Set(transfers.map(({ source }) => source))
}
export function outputMachines(world: World, vacated: ReadonlySet<Building>): void {
  for (const source of world.buildings) {
    if (source?.kind !== 'miner' && source?.kind !== 'furnace') continue
    const item = source.kind === 'miner' ? source.item : ITEMS.find(item => source.output[item] > 0)
    if (!item) continue
    const target = receiver(world, source, source.direction)
    // Machines only output to belts, and cannot reuse a tile vacated this step.
    if (target?.kind !== 'belt' || vacated.has(target) || !canReceive(target, item, source.direction)) continue
    accept(target, item, source.direction)
    if (source.kind === 'miner') source.item = null
    else source.output[item]--
  }
}
export function outputWaiting(world: World, source: Building): boolean {
  if (source.kind !== 'furnace' || inventoryTotal(source.output) === 0) return false
  const item = ITEMS.find(item => source.output[item] > 0)
  if (!item) return false
  const target = receiver(world, source, source.direction)
  return target?.kind !== 'belt' || !canReceive(target, item, source.direction)
}
