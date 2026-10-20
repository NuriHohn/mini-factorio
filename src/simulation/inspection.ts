import { GENERATOR_KW, POLE_COVERAGE_RADIUS, powerRequirement, withinRange } from './power'
import { emptyInventory, ITEMS, inventoryTotal } from './items'
import type { Inventory, Item, Resource } from './items'
import { assemblerInputCapacity, assemblerWaitRemaining } from './assemblerRecipes'
import { inserterPorts, inserterStatus, INSERTER_CYCLE_MS, INSERTER_SWING_MS } from './inserters'
import type { InserterStatus } from './inserters'
import { craftingStatus, recipeChangeError } from './crafting'
import type { CraftingStatus } from './crafting'
import type { FurnaceRecipeMode, RecipeId } from './recipes'
import { MACHINE_DEFINITIONS, RECIPES } from './recipes'
import { outputWaiting } from './transport'
import { buildingAt, depositAt, INTERVAL } from './world'
import type { BuildingKind, Direction, Position, World } from './world'

export interface WorldStats {
  mined: Inventory
  produced: Inventory
  stored: Inventory
  maxMiningPerSec: number
  maxSmeltingPerSec: number
  miners: number
  furnaces: number
  assemblers: number
  inserters: number
  maxCraftingPerSec: number
}
export interface InserterInspection {
  kind: 'inserter'
  direction: Direction
  item: Item | null
  phase: 'idle' | 'carrying' | 'returning'
  status: InserterStatus
  progress: number
  cycleMs: number
  pickup: Position
  drop: Position
  source: BuildingKind | null
  target: BuildingKind | null
  electrical: ElectricalDetails
}
export type Inspection = InserterInspection | { kind: 'storage'; inventory: Inventory }
  | { kind: 'miner'; resource: Resource | null; progress: number; buffered: boolean; electrical: ElectricalDetails }
  | { kind: 'generator'; capacityKw: number; actualKw: number; electrical: ElectricalDetails }
  | { kind: 'powerPole'; coverageRadius: number; coveredMachines: number; electrical: ElectricalDetails } | {
  kind: 'furnace' | 'assembler'
  direction: Direction
  recipe: string
  recipeMode: FurnaceRecipeMode
  recipeLocked: boolean
  detectionStatus: 'undetected' | 'choosing' | 'automatic-locked' | 'manual-locked'
  recipeId: RecipeId | null
  requirements: Readonly<Partial<Inventory>>
  products: Readonly<Partial<Inventory>>
  durationMs: number
  recipeChangeError: string | null
  input: Inventory
  output: Inventory
  reserved: Inventory
  progress: number
  status: CraftingStatus
  inputCapacities: Readonly<Partial<Inventory>>
  inputCapacity: number | null
  outputCapacity: number
  craftingSpeed: number
  recipeWaitRemainingMs: number
  outputWaiting: boolean
  electrical: ElectricalDetails
}
export function worldStats(world: World): WorldStats {
  const stats: WorldStats = { mined: { ...world.mined }, produced: { ...world.produced }, stored: emptyInventory(), maxMiningPerSec: 0, maxSmeltingPerSec: 0, miners: 0, furnaces: 0, assemblers: 0, inserters: 0, maxCraftingPerSec: 0 }
  for (const building of world.buildings) {
    if (building?.kind === 'inserter') stats.inserters++
    if (building?.kind === 'miner') { stats.miners++; stats.maxMiningPerSec += 1000 / INTERVAL }
    if (building?.kind === 'furnace' || building?.kind === 'assembler') {
      const recipes = building.recipeId ? [RECIPES[building.recipeId]] : Object.values(RECIPES).filter(recipe => recipe.machine === building.kind)
      const rate = Math.max(0, ...recipes.map(recipe => inventoryTotal(recipe.outputs) * 1000 * MACHINE_DEFINITIONS[building.kind].craftingSpeed / recipe.durationMs))
      if (building.kind === 'furnace') { stats.furnaces++; stats.maxSmeltingPerSec += rate }
      else { stats.assemblers++; stats.maxCraftingPerSec += rate }
    }
    if (building?.kind === 'storage') {
      for (const item of ITEMS) stats.stored[item] += building.inventory[item]
    }
  }
  return stats
}
export function inspectBuilding(world: World, index: number | null): Inspection | null {
  const building = index === null ? null : world.buildings[index]
  if (building?.kind === 'storage') return { kind: 'storage', inventory: { ...building.inventory } }
  if (!building || index === null) return null
  const electrical = electricalDetails(world, index)
  if (building.kind === 'inserter') {
    const { pickup, drop } = inserterPorts(building)
    return { kind: 'inserter', direction: building.direction, item: building.item, phase: building.phase, status: inserterStatus(world, building), progress: building.phase === 'idle' ? 0 : (building.elapsedMs + (building.phase === 'returning' ? INSERTER_SWING_MS : 0)) / INSERTER_CYCLE_MS, cycleMs: INSERTER_CYCLE_MS, pickup, drop, source: buildingAt(world, pickup.x, pickup.y)?.kind ?? null, target: buildingAt(world, drop.x, drop.y)?.kind ?? null, electrical }
  }
  if (building.kind === 'miner') return { kind: 'miner', resource: depositAt(world, building.x, building.y), progress: building.elapsed / INTERVAL, buffered: building.item !== null, electrical }
  if (building.kind === 'generator') return { kind: 'generator', capacityKw: GENERATOR_KW, actualKw: electrical.network ? electrical.network.suppliedKw / electrical.network.generators : 0, electrical }
  if (building.kind === 'powerPole') return { kind: 'powerPole', coverageRadius: POLE_COVERAGE_RADIUS, coveredMachines: world.buildings.filter(b => b && powerRequirement(b) > 0 && withinRange(building, b, POLE_COVERAGE_RADIUS)).length, electrical }
  if (building.kind !== 'furnace' && building.kind !== 'assembler') return null
  const recipe = building.recipeId ? RECIPES[building.recipeId] : null
  return {
    kind: building.kind, direction: building.direction, recipeMode: building.kind === 'furnace' ? building.recipeMode : building.recipeMode === 'auto' ? 'auto' : building.recipeId ?? 'auto', recipe: recipe?.label ?? (building.kind === 'furnace' ? 'Waiting for ore' : 'Waiting for ingredients'), recipeId: building.recipeId,
    recipeLocked: building.recipeLocked,
    detectionStatus: building.recipeLocked ? (building.recipeMode === 'auto' ? 'automatic-locked' : 'manual-locked') : building.recipeId ? 'choosing' : 'undetected',
    requirements: { ...recipe?.inputs }, products: { ...recipe?.outputs }, durationMs: recipe?.durationMs ?? 0, recipeChangeError: recipeChangeError(building),
    input: { ...building.input }, output: { ...building.output }, reserved: { ...(building.job?.outputs ?? emptyInventory()) },
    progress: building.job ? building.job.elapsedMs / RECIPES[building.job.recipeId].durationMs : 0,
    inputCapacities: building.kind === 'assembler' ? Object.fromEntries(ITEMS.filter(item => assemblerInputCapacity(building, item) > 0).map(item => [item, assemblerInputCapacity(building, item)])) : {},
    recipeWaitRemainingMs: building.kind === 'assembler' ? assemblerWaitRemaining(building) : 0,
    inputCapacity: building.kind === 'furnace' ? MACHINE_DEFINITIONS.furnace.input.capacity : null,
    outputCapacity: MACHINE_DEFINITIONS[building.kind].outputCapacity, craftingSpeed: MACHINE_DEFINITIONS[building.kind].craftingSpeed,
    electrical, status: craftingStatus(building), outputWaiting: outputWaiting(world, building),
  }
}

export interface ElectricalDetails {
  networkId: number | null
  requirementKw: number
  requestedKw: number
  suppliedKw: number
  speedFraction: number
  state: 'disconnected' | 'no-generation' | 'idle' | 'reduced' | 'powered'
  explanation: string
  network: { capacityKw: number; requestedKw: number; suppliedKw: number; poles: number; generators: number } | null
}
export function electricalDetails(world: World, index: number): ElectricalDetails {
  const building = world.buildings[index]
  const consumer = world.power?.consumers[index]
  const networkId = world.power?.assignments[index] ?? null
  const network = world.power?.networks.find(n => n.id === networkId)
  const requirementKw = building ? powerRequirement(building) : 0
  let state: ElectricalDetails['state']
  let explanation: string
  if (!network) { state = 'disconnected'; explanation = building?.kind === 'generator' ? 'Generator disconnected. Place a pole within 3 tiles; generators do not power machines directly.' : 'Outside pole coverage. Place a pole within 3 tiles and connect a generator.' }
  else if (network.capacityKw === 0) { state = 'no-generation'; explanation = 'Assigned network has no generator. Connect a generator within 3 tiles of a pole.' }
  else if (building?.kind === 'generator' && network.suppliedKw > 0) { state = 'powered'; explanation = 'Supplying the assigned network. Generators share its load equally.' }
  else if (!consumer || consumer.requestedKw === 0) { state = 'idle'; explanation = requirementKw ? building?.kind === 'inserter' ? 'Connected and available. No power requested while waiting for compatible input or blocked at the drop point.' : 'Connected and available. No power requested while waiting for input or output space.' : 'Connected; unused capacity is available to this network.' }
  else if (consumer.speedFraction < 1) { state = 'reduced'; explanation = 'Network demand exceeds generation. All working machines share power proportionally; add a generator.' }
  else { state = 'powered'; explanation = 'Full requested power supplied.' }
  return {
    networkId, requirementKw, requestedKw: consumer?.requestedKw ?? 0, suppliedKw: consumer?.suppliedKw ?? 0,
    speedFraction: consumer?.speedFraction ?? 0, state, explanation,
    network: network ? { capacityKw: network.capacityKw, requestedKw: network.requestedKw, suppliedKw: network.suppliedKw, poles: network.poleIndices.length, generators: network.generatorIndices.length } : null,
  }
}
