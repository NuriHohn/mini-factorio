import type { PowerState } from './power'
import { emptyInventory } from './items'
import type { Inventory, Item } from './items'
import type { RecipeId } from './recipes'
export type { Item } from './items'
export const SIZE = 40
export const INTERVAL = 1000
export const DIRECTIONS = ['north', 'east', 'south', 'west'] as const
export type Direction = typeof DIRECTIONS[number]
export type BuildingKind = 'miner' | 'belt' | 'storage' | 'furnace' | 'generator' | 'powerPole'
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
  recipeId: RecipeId
  input: Inventory
  output: Inventory
  job: ProcessingJob | null
}
export interface Generator extends Position { kind: 'generator' }
export interface PowerPole extends Position { kind: 'powerPole' }
export type Building = Miner | Belt | Storage | Furnace | Generator | PowerPole
export interface World { tiles: boolean[]; buildings: (Building | null)[]; ore: number; plates: number; remainder: number; topologyRevision: number; power: PowerState | null }
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
  const tiles = Array.from({ length: SIZE * SIZE }, () => false)
  for (let n = 0; n < 45; n++) {
    const cx = Math.floor(random() * SIZE), cy = Math.floor(random() * SIZE)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy
      if (inside(x, y) && dx * dx + dy * dy <= 5 && random() < .7) tiles[y * SIZE + x] = true
    }
  }
  tiles[20 * SIZE + 20] = true
  return { tiles, buildings: Array.from({ length: SIZE * SIZE }, () => null), ore: 0, plates: 0, remainder: 0, topologyRevision: 0, power: null }
}
export function placementError(world: World, x: number, y: number, kind: BuildingKind = 'miner'): string | null {
  if (!inside(x, y)) return 'Choose a tile inside the world.'
  if (buildingAt(world, x, y)) return 'This tile already has a building.'
  if (kind === 'miner' && !world.tiles[y * SIZE + x]) return 'Place mining machines on iron deposits.'
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
    case 'furnace': building = { kind, x, y, direction, recipeId: 'ironSmelting', input: emptyInventory(), output: emptyInventory(), job: null }; break
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
