import type { PowerState } from './power'
import { emptyInventory, RESOURCES } from './items'
import type { Inventory, Item, Resource } from './items'
import type { FurnaceRecipeMode, RecipeId } from './recipes'
export type { Item } from './items'
export const SIZE = 40
export const INTERVAL = 1000
export const DIRECTIONS = ['north', 'east', 'south', 'west'] as const
export type Direction = typeof DIRECTIONS[number]
export type BuildingKind = 'miner' | 'belt' | 'storage' | 'furnace' | 'assembler' | 'generator' | 'powerPole'
export interface Position { x: number; y: number }
export interface Miner extends Position { kind: 'miner'; direction: Direction; elapsed: number; item: Item | null }
export interface Belt extends Position { kind: 'belt'; direction: Direction; item: Item | null; progress: number; entry: Direction }
export interface Storage extends Position { kind: 'storage'; inventory: Inventory }
export interface ProcessingJob {
  recipeId: RecipeId
  elapsedMs: number
  inputs: Inventory
  // Explicitly reserved output slots; consumed inputs remain accountable in the job.
  outputs: Inventory
}
export interface Furnace extends Position {
  kind: 'furnace'
  direction: Direction
  recipeMode: FurnaceRecipeMode
  recipeId: RecipeId | null
  input: Inventory
  output: Inventory
  job: ProcessingJob | null
}
export interface Assembler extends Position {
  kind: 'assembler'
  direction: Direction
  recipeId: RecipeId
  input: Inventory
  output: Inventory
  job: ProcessingJob | null
}
export type CraftingMachine = Furnace | Assembler
export interface Generator extends Position { kind: 'generator' }
export interface PowerPole extends Position { kind: 'powerPole' }
export type Building = Miner | Belt | Storage | Furnace | Assembler | Generator | PowerPole
export interface World { tiles: (Resource | null)[]; buildings: (Building | null)[]; mined: Inventory; produced: Inventory; remainder: number; topologyRevision: number; power: PowerState | null }
export const offsets: Record<Direction, Position> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
}
export function rotate(direction: Direction): Direction {
  return DIRECTIONS[(DIRECTIONS.indexOf(direction) + 1) % 4]
}
export function opposite(direction: Direction): Direction { return rotate(rotate(direction)) }
export function inside(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE
}
export function buildingAt(world: World, x: number, y: number): Building | null {
  return inside(x, y) ? world.buildings[y * SIZE + x] : null
}
export function createWorld(random = Math.random): World {
  const tiles: (Resource | null)[] = Array.from({ length: SIZE * SIZE }, () => null)
  for (const resource of RESOURCES) for (let n = 0; n < 35; n++) {
    const cx = Math.floor(random() * SIZE), cy = Math.floor(random() * SIZE)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy
      if (inside(x, y) && dx * dx + dy * dy <= 5 && random() < .7 && tiles[y * SIZE + x] === null) tiles[y * SIZE + x] = resource
    }
  }
  // Starter clusters ensure both resources are reachable, even for degenerate RNGs.
  for (const [cx, cy, resource] of [[20, 20, 'iron'], [26, 20, 'copper']] as const) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 5) tiles[(cy + dy) * SIZE + cx + dx] = resource
    }
  }
  return { tiles, buildings: Array.from({ length: SIZE * SIZE }, () => null), mined: emptyInventory(), produced: emptyInventory(), remainder: 0, topologyRevision: 0, power: null }
}
export function depositAt(world: World, x: number, y: number): Resource | null {
  return inside(x, y) ? world.tiles[y * SIZE + x] : null
}

export function placementError(world: World, x: number, y: number, kind: BuildingKind = 'miner'): string | null {
  if (!inside(x, y)) return 'Choose a tile inside the world.'
  if (buildingAt(world, x, y)) return 'This tile already has a building.'
  if (kind === 'miner' && !depositAt(world, x, y)) return 'Place mining machines on ore deposits.'
  return null
}
export function placeBuilding(world: World, x: number, y: number, kind: BuildingKind, direction: Direction): boolean {
  if (placementError(world, x, y, kind)) return false
  let building: Building
  switch (kind) {
    case 'generator': building = { kind, x, y }; break
    case 'powerPole': building = { kind, x, y }; break
    case 'storage': building = { kind, x, y, inventory: emptyInventory() }; break
    case 'miner': building = { kind, x, y, direction, elapsed: 0, item: null }; break
    case 'belt': building = { kind, x, y, direction, item: null, progress: 0, entry: opposite(direction) }; break
    case 'assembler': building = { kind, x, y, direction, recipeId: 'ironGear', input: emptyInventory(), output: emptyInventory(), job: null }; break
    case 'furnace': building = { kind, x, y, direction, recipeMode: 'auto', recipeId: null, input: emptyInventory(), output: emptyInventory(), job: null }; break
  }
  world.buildings[y * SIZE + x] = building
  world.topologyRevision++
  return true
}
export function removalError(world: World, x: number, y: number): string | null {
  const building = buildingAt(world, x, y)
  if (!building) return 'Choose a building to remove.'
  return null
}
export function removeBuilding(world: World, x: number, y: number): boolean {
  if (removalError(world, x, y)) return false
  world.buildings[y * SIZE + x] = null
  world.topologyRevision++
  return true
}
