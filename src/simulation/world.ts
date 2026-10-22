import { SUPPLY_CRATE_WOOD } from './supplyCrate'
import { footbridgeBank, footbridgeRemovalError, removeFootbridge } from './footbridge'
import { dockAtSpot, FISHING_DOCK_WOOD } from './fishingDock'
import { facesWater } from './waterTerrain'
import { WATERWHEEL_WOOD, waterwheelWater } from './waterwheel'
import { bridgeCrossing, generateWater, isWater } from './waterTerrain'
import { beginPeace, refreshSupplyVisit, createPeace, endPeace, refreshFishing, TREEHOUSE_WOOD } from './peace'
import type { PeaceState } from './peace'
import { createNature, generateNature, MATURE_TREE_MS, REPRODUCTION_MS } from './nature'
import type { NatureState, TreeSpecies } from './nature'
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
export type BuildingKind = 'supplyCrate' | 'footbridge' | 'fishingDock' | 'waterwheel' | 'treehouse' | 'tree' | 'miner' | 'belt' | 'storage' | 'furnace' | 'assembler' | 'inserter' | 'generator' | 'powerPole' | 'radar' | 'prison' | 'splitter' | 'sprinkler'
export interface Position { x: number; y: number }
export interface BuildingPosition extends Position { sabotageUntilMs?: number }
export interface Miner extends BuildingPosition { kind: 'miner'; direction: Direction; elapsed: number; item: Item | null }
export interface Belt extends BuildingPosition { kind: 'belt'; bridge?: true; direction: Direction; item: Item | null; progress: number; entry: Direction }
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
export interface SupplyCrate extends BuildingPosition { kind: 'supplyCrate'; inventory: Inventory }
export interface Footbridge extends BuildingPosition { kind: 'footbridge'; direction: 'east' | 'south' }
export interface FishingDock extends BuildingPosition { kind: 'fishingDock'; direction: Direction }
export interface Waterwheel extends BuildingPosition { kind: 'waterwheel'; direction: Direction; rotationMs: number }
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
export interface Tree extends Position { kind: 'tree'; species: TreeSpecies; origin: 'natural' | 'manual'; bornAtMs: number; nextReproductionAtMs: number; sabotageUntilMs?: never }
export interface Treehouse extends Position { kind: 'treehouse'; placedAtMs: number; sabotageUntilMs?: never }
export type Building = SupplyCrate | Footbridge | FishingDock | Waterwheel | Treehouse | Tree | Sprinkler | Splitter | Radar | Prison | Miner | Belt | Storage | Furnace | Assembler | Inserter | Generator | PowerPole
export interface World { peace: PeaceState; nature: NatureState; revenge: RevengeState; research: ResearchState; analytics: AnalyticsState; webs: WebState; timeMs: number; pete: Pete; police: PoliceState; water: boolean[]; tiles: (Resource | null)[]; buildings: (Building | null)[]; mined: Inventory; produced: Inventory; remainder: number; topologyRevision: number; power: PowerState | null }
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
export function createWorld(random = Math.random, options: { nature?: boolean; water?: boolean } = {}): World {
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
  const world: World = { peace: createPeace(), nature: createNature(), revenge: createRevenge(), research: createResearch(), analytics: createAnalytics(), webs: createWebs(), timeMs: 0, pete: createPete(), police: createPolice(), water: Array<boolean>(SIZE * SIZE).fill(false), tiles, buildings: Array.from({ length: SIZE * SIZE }, () => null), mined: emptyInventory(), produced: emptyInventory(), remainder: 0, topologyRevision: 0, power: null }
  const seed = Math.floor(random() * 4294967296)
  if (options.water !== false) generateWater(world, seed)
  if (options.nature !== false) generateNature(world, seed)
  return world
}
export function depositAt(world: World, x: number, y: number): Resource | null {
  return inside(x, y) ? world.tiles[y * SIZE + x] : null
}

export function placementError(world: World, x: number, y: number, kind: BuildingKind = 'miner', direction?: Direction, bridge = false): string | null {
  if (kind === 'footbridge') return 'Drag a straight footbridge between two dry shores.'
  const technologyError = buildingTechnologyError(world.research, kind)
  if (technologyError) return technologyError
  if (kind === 'treehouse') {
    if (world.peace.home !== null) return 'Only one treehouse may exist. Remove the current home first.'
    if (!world.buildings.some((b, i) => !b && !world.water[i] && i !== y * SIZE + x)) return 'Keep a free tile for Pete to leave custody.'
    if (world.nature.wood < TREEHOUSE_WOOD) return `Pete’s Treehouse costs ${TREEHOUSE_WOOD} Wood · ${world.nature.wood} available.`
  }
  if (!inside(x, y)) return 'Choose a tile inside the world.'
  if (walkerOccupiesTile(world, y * SIZE + x)) return 'The walker is occupying this tile.'
  if (policeOccupiesTile(world, x, y)) return 'Keep the police route and prison exit clear.'
  if (kind === 'prison' && (!edgeTile(y * SIZE + x) || !neighboringTiles(y * SIZE + x).some(tile => !world.buildings[tile] && !world.water[tile] && !peteOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE)) && !policeOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE))))) return 'Prisons need an edge tile and an empty exit.'
  if (footbridgeBank(world, y * SIZE + x)) return 'Keep footbridge landings clear. Remove the footbridge first.'
  if (peteOccupiesTile(world, x, y)) return 'Pete is walking through this tile.'
  const existing = buildingAt(world, x, y)
  if (isWater(world, x, y) && !(kind === 'belt' && bridge)) return 'Water needs a complete belt bridge. Drag from land to land.'
  if (kind === 'belt' && direction && existing?.kind === 'belt') return !!offsets[direction].x === !!offsets[existing.direction].x ? null : 'Existing belt blocks this route. Perpendicular crossings are not allowed.'
  if (existing?.kind === 'tree') return 'A tree occupies this tile. Use the Axe to clear it.'
  if (buildingAt(world, x, y)) return 'This tile already has a building.'
  if (kind === 'supplyCrate' && world.nature.wood < SUPPLY_CRATE_WOOD) return `Pete’s Supply Crate costs ${SUPPLY_CRATE_WOOD} Wood · ${world.nature.wood} available.`
  if (kind === 'fishingDock') {
    if (!facesWater(world, { x, y }, direction ?? 'east')) return 'Face the fishing side toward directly adjacent water.'
    if (world.nature.wood < FISHING_DOCK_WOOD) return `Fishing Dock costs ${FISHING_DOCK_WOOD} Wood · ${world.nature.wood} available.`
  }
  if (kind === 'waterwheel') {
    if (!waterwheelWater(world, { x, y }, direction ?? 'east')) return 'Face the waterwheel toward directly adjacent water.'
    if (world.nature.wood < WATERWHEEL_WOOD) return `Waterwheel costs ${WATERWHEEL_WOOD} Wood · ${world.nature.wood} available.`
  }
  if (kind === 'miner' && !depositAt(world, x, y)) return 'Place mining machines on ore deposits.'
  return null
}
export function placeBuilding(world: World, x: number, y: number, kind: BuildingKind, direction: Direction): boolean {
  if (placementError(world, x, y, kind, kind === 'waterwheel' || kind === 'fishingDock' ? direction : undefined)) return false
  const previousDock = dockAtSpot(world, world.peace.destination)
  let building: Building
  switch (kind) {
    case 'footbridge': return false
    case 'fishingDock': building = { kind, x, y, direction }; break
    case 'waterwheel': building = { kind, x, y, direction, rotationMs: 0 }; break
    case 'treehouse': building = { kind, x, y, placedAtMs: world.timeMs }; break
    case 'tree': building = { kind, x, y, species: 'oak', origin: 'manual', bornAtMs: world.timeMs, nextReproductionAtMs: world.timeMs + MATURE_TREE_MS + REPRODUCTION_MS }; break
    case 'splitter': building = { kind, x, y, direction, input: null, outputs: [null, null], nextOutput: 0, delivered: [0, 0], placedAtMs: world.timeMs }; break
    case 'sprinkler': building = { kind, x, y, cooldownUntilMs: 0, sprays: 0 }; break
    case 'radar': building = { kind, x, y }; break
    case 'prison': building = { kind, x, y, exit: neighboringTiles(y * SIZE + x).find(tile => !world.buildings[tile] && !world.water[tile] && !peteOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE)) && !policeOccupiesTile(world, tile % SIZE, Math.floor(tile / SIZE)))! }; break
    case 'inserter': building = { kind, x, y, direction, phase: 'idle', item: null, elapsedMs: 0 }; break
    case 'generator': building = { kind, x, y }; break
    case 'powerPole': building = { kind, x, y }; break
    case 'supplyCrate': building = { kind, x, y, inventory: emptyInventory() }; break
    case 'storage': building = { kind, x, y, inventory: emptyInventory() }; break
    case 'miner': building = { kind, x, y, direction, elapsed: 0, item: null }; break
    case 'belt': building = { kind, x, y, direction, item: null, progress: 0, entry: opposite(direction) }; break
    case 'assembler': building = { kind, x, y, direction, recipeMode: 'manual', recipeId: null, recipeLocked: false, autoWaitElapsedMs: null, input: emptyInventory(), output: emptyInventory(), job: null }; break
    case 'furnace': building = { kind, x, y, direction, recipeMode: 'auto', recipeId: null, recipeLocked: false, input: emptyInventory(), output: emptyInventory(), job: null }; break
  }
  world.buildings[y * SIZE + x] = building
  world.topologyRevision++
  if (building.kind === 'supplyCrate') world.nature.wood -= SUPPLY_CRATE_WOOD
  if (building.kind === 'fishingDock') world.nature.wood -= FISHING_DOCK_WOOD
  if (building.kind === 'waterwheel') world.nature.wood -= WATERWHEEL_WOOD
  if (building.kind === 'treehouse') { world.nature.wood -= TREEHOUSE_WOOD; beginPeace(world, y * SIZE + x) }
  refreshFishing(world, previousDock)
  refreshSupplyVisit(world)
  if (building.kind === 'tree') world.nature.nextAttemptAtMs = Math.min(world.nature.nextAttemptAtMs ?? Infinity, building.nextReproductionAtMs)
  return true
}
export function removalError(world: World, x: number, y: number): string | null {
  const building = buildingAt(world, x, y)
  if (!building) return 'Choose a building to remove.'
  if (building.kind === 'footbridge') return footbridgeRemovalError(world, y * SIZE + x)
  if (building.kind === 'tree') return 'Use the Axe to chop trees. Demolition only removes factory buildings.'
  return null
}
export function removeBuilding(world: World, x: number, y: number): boolean {
  if (removalError(world, x, y)) return false
  const previousDock = dockAtSpot(world, world.peace.destination)
  const removed = world.buildings[y * SIZE + x]
  if (removed?.kind === 'footbridge') { removeFootbridge(world, y * SIZE + x); return true }
  if (removed?.kind === 'belt' && removed.bridge) {
    for (const i of bridgeCrossing(world, x, y, removed.direction) ?? [y * SIZE + x]) if (world.buildings[i]?.kind === 'belt') world.buildings[i] = null
    world.topologyRevision++
    return true
  }
  removePoliceBuilding(world, world.buildings[y * SIZE + x]!)
  removeSprinkler(world, world.buildings[y * SIZE + x]!)
  delete world.analytics.machines[y * SIZE + x]
  if (world.buildings[y * SIZE + x]?.kind === 'treehouse') endPeace(world)
  world.buildings[y * SIZE + x] = null
  refreshFishing(world, previousDock)
  refreshSupplyVisit(world)
  world.topologyRevision++
  return true
}
