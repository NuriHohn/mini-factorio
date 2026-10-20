import { createRevenge, walkerOccupiesTile } from './revenge'
import type { RevengeState } from './revenge'
import { buildingTechnologyError, createResearch } from './research'
import type { ResearchState } from './research'
import { createAnalytics } from './analytics'
import type { AnalyticsState } from './analytics'
import { createWebs } from './webs'
import type { WebState } from './webs'
import { removeSprinkler } from './sprinklers'
import { createPolice, policeOccupiesTile, removePoliceBuilding } from './police'
import type { PoliceState } from './police'
import { edgeTile, neighboringTiles } from './navigation'
import { createPete, peteOccupiesTile } from './pete'
import type { Pete } from './pete'
import type { PowerState } from './power'
import { emptyInventory, RESOURCES } from './items'
import type { Inventory, Item, Resource } from './items'
import type { FurnaceRecipeMode, RecipeId } from './recipes'
export type { Item } from './items'
export const SIZE = 40
export const INTERVAL = 1000
export const DIRECTIONS = ['north', 'east', 'south', 'west'] as const
export type Direction = typeof DIRECTIONS[number]
export type BuildingKind = 'miner' | 'belt' | 'storage' | 'furnace' | 'assembler' | 'inserter' | 'generator' | 'powerPole' | 'radar' | 'prison' | 'splitter' | 'sprinkler'
export interface Position { x: number; y: number }
export interface BuildingPosition extends Position { sabotageUntilMs?: number }
export interface Miner extends BuildingPosition { kind: 'miner'; direction: Direction; elapsed: number; item: Item | null }
export interface Belt extends BuildingPosition { kind: 'belt'; direction: Direction; item: Item | null; progress: number; entry: Direction }
export interface Storage extends BuildingPosition { kind: 'storage'; inventory: Inventory }
export interface ProcessingJob {
  recipeId: RecipeId
  elapsedMs: number
  inputs: Inventory
  // Explicitly reserved output slots; consumed inputs remain accountable in the job.
  outputs: Inventory
}
export interface Furnace extends BuildingPosition {
  kind: 'furnace'
  direction: Direction
  recipeMode: FurnaceRecipeMode
  recipeId: RecipeId | null
  recipeLocked: boolean
  input: Inventory
  output: Inventory
  job: ProcessingJob | null
}
export interface Assembler extends BuildingPosition {
  kind: 'assembler'
  direction: Direction
  recipeMode: 'auto' | 'manual'
  recipeId: RecipeId | null
  recipeLocked: boolean
  autoWaitElapsedMs: number | null
  input: Inventory
  output: Inventory
  job: ProcessingJob | null
}
export type CraftingMachine = Furnace | Assembler
export interface Inserter extends BuildingPosition {
  kind: 'inserter'
  direction: Direction
  phase: 'idle' | 'carrying' | 'returning'
  item: Item | null
  elapsedMs: number
}
export interface Generator extends BuildingPosition { kind: 'generator' }
export interface PowerPole extends BuildingPosition { kind: 'powerPole' }
export interface Sprinkler extends BuildingPosition { kind: 'sprinkler'; cooldownUntilMs: number; sprays: number }
export interface Radar extends BuildingPosition { kind: 'radar' }
export interface Prison extends BuildingPosition { kind: 'prison'; exit: number }
export interface SplitterPacket { item: Item; progress: number }
export interface Splitter extends BuildingPosition {
  kind: 'splitter'
  direction: Direction
  input: SplitterPacket | null
  outputs: [SplitterPacket | null, SplitterPacket | null]
  nextOutput: 0 | 1
  delivered: [number, number]
  placedAtMs: number
}
export type Building = Sprinkler | Splitter | Radar | Prison | Miner | Belt | Storage | Furnace | Assembler | Inserter | Generator | PowerPole
export interface World { revenge: RevengeState; research: ResearchState; analytics: AnalyticsState; webs: WebState; timeMs: number; pete: Pete; police: PoliceState; tiles: (Resource | null)[]; buildings: (Building | null)[]; mined: Inventory; produced: Inventory; remainder: number; topologyRevision: number; power: PowerState | null }
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
  return { revenge: createRevenge(), research: createResearch(), analytics: createAnalytics(), webs: createWebs(), timeMs: 0, pete: createPete(), police: createPolice(), tiles, buildings: Array.from({ length: SIZE * SIZE }, () => null), mined: emptyInventory(), produced: emptyInventory(), remainder: 0, topologyRevision: 0, power: null }
}
export function depositAt(world: World, x: number, y: number): Resource | null {
  return inside(x, y) ? world.tiles[y * SIZE + x] : null
}

export function placementError(world: World, x: number, y: number, kind: BuildingKind = 'miner'): string | null {
  const technologyError = buildingTechnologyError(world.research, kind)
  if (technologyError) return technologyError
  if (!inside(x, y)) return 'Choose a tile inside the world.'
  if (walkerOccupiesTile(world, y * SIZE + x)) return 'The walker is occupying this tile.'
  if (policeOccupiesTile(world, x, y)) return 'Keep the police route and prison exit clear.'
  if (kind === 'prison' && (!edgeTile(y * SIZE + x) || !neighboringTiles(y * SIZE + x).some(tile => !world.buildings[tile] && !peteOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE)) && !policeOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE))))) return 'Prisons need an edge tile and an empty exit.'
  if (peteOccupiesTile(world, x, y)) return 'Pete is walking through this tile.'
  if (buildingAt(world, x, y)) return 'This tile already has a building.'
  if (kind === 'miner' && !depositAt(world, x, y)) return 'Place mining machines on ore deposits.'
  return null
}
export function placeBuilding(world: World, x: number, y: number, kind: BuildingKind, direction: Direction): boolean {
  if (placementError(world, x, y, kind)) return false
  let building: Building
  switch (kind) {
    case 'splitter': building = { kind, x, y, direction, input: null, outputs: [null, null], nextOutput: 0, delivered: [0, 0], placedAtMs: world.timeMs }; break
    case 'sprinkler': building = { kind, x, y, cooldownUntilMs: 0, sprays: 0 }; break
    case 'radar': building = { kind, x, y }; break
    case 'prison': building = { kind, x, y, exit: neighboringTiles(y * SIZE + x).find(tile => !world.buildings[tile] && !peteOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE)) && !policeOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE)))! }; break
    case 'inserter': building = { kind, x, y, direction, phase: 'idle', item: null, elapsedMs: 0 }; break
    case 'generator': building = { kind, x, y }; break
    case 'powerPole': building = { kind, x, y }; break
    case 'storage': building = { kind, x, y, inventory: emptyInventory() }; break
    case 'miner': building = { kind, x, y, direction, elapsed: 0, item: null }; break
    case 'belt': building = { kind, x, y, direction, item: null, progress: 0, entry: opposite(direction) }; break
    case 'assembler': building = { kind, x, y, direction, recipeMode: 'manual', recipeId: null, recipeLocked: false, autoWaitElapsedMs: null, input: emptyInventory(), output: emptyInventory(), job: null }; break
    case 'furnace': building = { kind, x, y, direction, recipeMode: 'auto', recipeId: null, recipeLocked: false, input: emptyInventory(), output: emptyInventory(), job: null }; break
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
  removePoliceBuilding(world, world.buildings[y * SIZE + x]!)
  removeSprinkler(world, world.buildings[y * SIZE + x]!)
  delete world.analytics.machines[y * SIZE + x]
  world.buildings[y * SIZE + x] = null
  world.topologyRevision++
  return true
}
