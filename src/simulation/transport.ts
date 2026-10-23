import { PRESS_INPUT_CAPACITY } from './gearPress'
import { SUPPLY_CRATE_CAPACITY } from './supplyCrate'
import { SPLITTER_STAGE_MS, splitterDirections } from './splitters'
import type { SplitterOutput } from './splitters'
import { buildingAt, offsets, opposite, SIZE } from './world'
import type { Belt, Building, Direction, Furnace, Splitter, World } from './world'
import { emptyInventory, ITEMS, inventoryTotal } from './items'
import type { Inventory, Item } from './items'
import { MACHINE_DEFINITIONS, RECIPES } from './recipes'
import type { RecipeId } from './recipes'
import { assemblerInputCapacity } from './assemblerRecipes'
import { incomingRecipe } from './smelting'
export const BELT_TRAVEL_MS = 500

function receiver(world: World, source: Building, direction: Direction): Building | null {
  const offset = offsets[direction]
  return buildingAt(world, source.x + offset.x, source.y + offset.y)
}
export function canReceive(target: Building, item: Item, travel: Direction, reserved: Readonly<Partial<Inventory>> = {}, recipeId: RecipeId | null = target.kind === 'furnace' ? incomingRecipe(target, item) : target.kind === 'assembler' ? target.recipeId : null): boolean {
  switch (target.kind) {
    case 'splitter': return travel === target.direction && target.input === null && inventoryTotal(reserved) === 0
    case 'peteDevelopment': return target.development === 'mechanic' && item === 'ironGear' && target.gears + (reserved.ironGear ?? 0) < 4
    case 'petePress': return item === 'ironGear' && target.gears + (reserved.ironGear ?? 0) < PRESS_INPUT_CAPACITY
    case 'supplyCrate': return inventoryTotal(target.inventory) + target.wood + inventoryTotal(reserved) < SUPPLY_CRATE_CAPACITY
    case 'storage': return true
    case 'belt': return !target.item && inventoryTotal(reserved) === 0 && (target.bridge ? target.direction === travel : target.direction !== opposite(travel))
    case 'assembler': return target.direction !== opposite(travel)
      && target.input[item] + (reserved[item] ?? 0) < assemblerInputCapacity(target, item)
    case 'furnace': return target.direction !== opposite(travel)
      && recipeId !== null && (RECIPES[recipeId].inputs[item] ?? 0) > 0
      && inventoryTotal(target.input) + inventoryTotal(reserved) < MACHINE_DEFINITIONS.furnace.input.capacity
    default: return false
  }
}
function accept(target: Building, item: Item, direction: Direction): void {
  switch (target.kind) {
    case 'splitter': target.input = { item, progress: 0 }; break
    case 'peteDevelopment': target.gears++; break
    case 'petePress': target.gears++; break
    case 'supplyCrate':
    case 'storage': target.inventory[item]++; break
    case 'furnace': {
      const recipeId = incomingRecipe(target, item)
      if (recipeId) { target.recipeId = recipeId; target.recipeLocked = true }
      target.input[item]++
      break
    }
    case 'assembler': target.input[item]++; break
    case 'belt':
      target.item = item
      target.progress = 0
      target.entry = opposite(direction)
      break
  }
}
// Shared atomic delivery for inserters, using the same ports, capacities and recipe locks.
export function deliverItem(target: Building, item: Item, direction: Direction): boolean {
  if (!canReceive(target, item, direction)) return false
  accept(target, item, direction)
  return true
}
// Shared source/target reservations: belts and splitter outputs commit against one snapshot.
export function advanceTransport(world: World, delta: number): Set<Building> {
  const transfers: { source: Belt | Splitter; output?: SplitterOutput; target: Building; item: Item; direction: Direction }[] = []
  const readySplitters: Splitter[] = []
  const routes: { splitter: Splitter; output: SplitterOutput; item: Item }[] = []
  const reserved = new Map<Building, Inventory>()
  const recipes = new Map<Furnace, RecipeId>()
  const reserve = (source: Belt | Splitter, direction: Direction, item: Item, output?: SplitterOutput): void => {
    const target = receiver(world, source, direction)
    if (!target) return
    const recipeId = target.kind === 'furnace' ? recipes.get(target) ?? incomingRecipe(target, item) : target.kind === 'assembler' ? target.recipeId : null
    if (!canReceive(target, item, direction, reserved.get(target) ?? {}, recipeId)) return
    if (target.kind === 'furnace' && recipeId) recipes.set(target, recipeId)
    transfers.push({ source, output, target, item, direction })
    const inventory = reserved.get(target) ?? emptyInventory()
    inventory[item]++
    reserved.set(target, inventory)
  }
  for (const source of world.buildings) {
    if (source?.kind === 'belt' && source.item) {
      source.progress = Math.min(1, source.progress + delta / BELT_TRAVEL_MS)
      if (source.progress >= 1 - 1e-8) { source.progress = 1; reserve(source, source.direction, source.item) }
    } else if (source?.kind === 'splitter') {
      if (source.input) {
        source.input.progress = Math.min(1, source.input.progress + delta / SPLITTER_STAGE_MS)
        if (source.input.progress >= 1 - 1e-8) readySplitters.push(source)
      }
      for (const output of [0, 1] as const) {
        const packet = source.outputs[output]
        if (!packet) continue
        packet.progress = Math.min(1, packet.progress + delta / SPLITTER_STAGE_MS)
        if (packet.progress >= 1 - 1e-8) { packet.progress = 1; reserve(source, splitterDirections(source.direction)[output], packet.item, output) }
      }
    }
  }
  // Routing uses only old input/empty output slots. Newly delivered input cannot move again.
  for (const splitter of readySplitters) {
    if (!splitter.input) continue
    const preference: SplitterOutput[] = [splitter.nextOutput, splitter.nextOutput === 0 ? 1 : 0]
    const output = preference.find(output => !splitter.outputs[output] && splitterRouteAvailable(world, splitter, output, splitter.input!.item, reserved))
    if (output !== undefined) routes.push({ splitter, output, item: splitter.input.item })
  }
  for (const [furnace, recipeId] of recipes) furnace.recipeId = recipeId
  for (const { source, output, target, item, direction } of transfers) {
    accept(target, item, direction)
    if (source.kind === 'belt') { source.item = null; source.progress = 0 }
    else { source.outputs[output!] = null; source.delivered[output!]++ }
  }
  for (const { splitter, output, item } of routes) {
    splitter.input = null
    splitter.outputs[output] = { item, progress: 0 }
    splitter.nextOutput = output === 0 ? 1 : 0
  }
  return new Set(transfers.map(({ source }) => source))
}
function splitterRouteAvailable(world: World, splitter: Splitter, output: SplitterOutput, item: Item, reserved?: ReadonlyMap<Building, Inventory>): boolean {
  const direction = splitterDirections(splitter.direction)[output]
  const target = receiver(world, splitter, direction)
  // A front-facing inserter can extract the outgoing slot; it never takes queued intake.
  if (target?.kind === 'inserter') return target.direction === direction
  return !!target && canReceive(target, item, direction, reserved?.get(target) ?? {})
}
export function splitterBlocked(world: World, splitter: Splitter, output: SplitterOutput): boolean {
  const direction = splitterDirections(splitter.direction)[output], target = receiver(world, splitter, direction)
  const packet = splitter.outputs[output]
  if (target?.kind === 'inserter') return target.direction !== direction || target.phase !== 'idle' || (packet?.progress === 1 && !(world.power?.consumers[target.y * SIZE + target.x]?.speedFraction))
  const item = packet?.item ?? splitter.input?.item
  return item ? !splitterRouteAvailable(world, splitter, output, item) : !ITEMS.some(item => splitterRouteAvailable(world, splitter, output, item))
}
export function outputMachines(world: World, vacated: ReadonlySet<Building>): void {
  for (const source of world.buildings) {
    if (source?.kind !== 'miner' && source?.kind !== 'furnace' && source?.kind !== 'assembler') continue
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
  if ((source.kind !== 'furnace' && source.kind !== 'assembler') || inventoryTotal(source.output) === 0) return false
  const item = ITEMS.find(item => source.output[item] > 0)
  if (!item) return false
  const target = receiver(world, source, source.direction)
  return target?.kind !== 'belt' || !canReceive(target, item, source.direction)
}
