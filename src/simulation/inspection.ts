import { sprinklerState, SPRINKLER_RANGE, SPRAY_MS } from './sprinklers'
import { splitterPorts, splitterDirections } from './splitters'
import { splitterBlocked } from './transport'
import type { SplitterPacket } from './world'
import { IMPRISONMENT_MS, RADAR_RANGE, radarPowered } from './police'
import { sabotageRemaining } from './pete'
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
import { buildingAt, depositAt, INTERVAL, SIZE, opposite } from './world'
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
export type Inspection = InserterInspection | { kind: 'splitter'; direction: Direction; inputDirection: Direction; outputDirections: [Direction, Direction]; ports: ReturnType<typeof splitterPorts>; input: SplitterPacket | null; outputs: [SplitterPacket | null, SplitterPacket | null]; nextOutput: 0 | 1; blocked: [boolean, boolean]; delivered: [number, number]; itemsPerSec: number }
  | { kind: 'prison'; occupied: boolean; elapsedMs: number; remainingMs: number; imprisonedAtMs: number | null; exit: Position }
  | { kind: 'sprinkler'; radius: number; status: ReturnType<typeof sprinklerState>; cooldownMs: number; sprayProgress: number; sprays: number; electrical: ElectricalDetails }
  | { kind: 'radar'; radius: number; active: boolean; operation: string; prison: Position | null; electrical: ElectricalDetails } | { kind: 'storage'; inventory: Inventory }
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
  if (building.kind === 'splitter') return {
    kind: 'splitter', direction: building.direction, inputDirection: opposite(building.direction), outputDirections: splitterDirections(building.direction), ports: splitterPorts(building),
    input: building.input ? { ...building.input } : null, outputs: [building.outputs[0] ? { ...building.outputs[0] } : null, building.outputs[1] ? { ...building.outputs[1] } : null],
    nextOutput: building.nextOutput, blocked: [splitterBlocked(world, building, 0), splitterBlocked(world, building, 1)], delivered: [...building.delivered],
    itemsPerSec: world.timeMs > building.placedAtMs ? (building.delivered[0] + building.delivered[1]) * 1000 / (world.timeMs - building.placedAtMs) : 0,
  }
  if (building.kind === 'prison') {
    const occupied = world.pete.mode === 'IMPRISONED' && world.pete.prison === building
    const elapsedMs = occupied ? world.timeMs - world.pete.imprisonedAtMs! : 0
    return { kind: 'prison', occupied, elapsedMs, remainingMs: occupied ? Math.max(0, IMPRISONMENT_MS - elapsedMs) : 0, imprisonedAtMs: occupied ? world.pete.imprisonedAtMs : null, exit: { x: building.exit % SIZE, y: Math.floor(building.exit / SIZE) } }
  }
  const electrical = electricalDetails(world, index)
  if (building.kind === 'sprinkler') return { kind: 'sprinkler', radius: SPRINKLER_RANGE, status: sprinklerState(world, building), cooldownMs: Math.max(0, building.cooldownUntilMs - world.timeMs), sprayProgress: world.pete.mode === 'SPRAYED' && world.pete.water?.source === index ? 1 - world.pete.water.remainingMs / SPRAY_MS : 0, sprays: building.sprays, electrical }
  if (building.kind === 'radar') {
    const prison = world.buildings.find(b => b?.kind === 'prison')
    return { kind: 'radar', radius: RADAR_RANGE, active: radarPowered(world, index), operation: world.police.car?.phase ?? (world.pete.mode === 'IMPRISONED' ? 'Pete in prison' : world.pete.graceUntilMs > world.timeMs ? 'Release grace period' : world.police.retryAtMs > world.timeMs ? 'Waiting for a reachable edge route' : 'Monitoring'), prison: prison ? { x: prison.x, y: prison.y } : null, electrical }
  }
  if (building.kind === 'inserter') {
    const { pickup, drop } = inserterPorts(building)
    return { kind: 'inserter', direction: building.direction, item: building.item, phase: building.phase, status: inserterStatus(world, building), progress: building.phase === 'idle' ? 0 : (building.elapsedMs + (building.phase === 'returning' ? INSERTER_SWING_MS : 0)) / INSERTER_CYCLE_MS, cycleMs: INSERTER_CYCLE_MS, pickup, drop, source: buildingAt(world, pickup.x, pickup.y)?.kind ?? null, target: buildingAt(world, drop.x, drop.y)?.kind ?? null, electrical }
  }
  if (building.kind === 'miner') return { kind: 'miner', resource: depositAt(world, building.x, building.y), progress: building.elapsed / INTERVAL, buffered: building.item !== null, electrical }
  if (building.kind === 'generator') return { kind: 'generator', capacityKw: GENERATOR_KW, actualKw: electrical.sabotageRemainingMs === 0 && electrical.network?.activeGenerators ? electrical.network.suppliedKw / electrical.network.activeGenerators : 0, electrical }
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
  sabotageRemainingMs: number
  state: 'sabotaged' | 'disconnected' | 'no-generation' | 'idle' | 'reduced' | 'powered'
  explanation: string
  network: { capacityKw: number; requestedKw: number; suppliedKw: number; poles: number; generators: number; activeGenerators: number } | null
}
export function electricalDetails(world: World, index: number): ElectricalDetails {
  const building = world.buildings[index]
  const consumer = world.power?.consumers[index]
  const networkId = world.power?.assignments[index] ?? null
  const network = world.power?.networks.find(n => n.id === networkId)
  const requirementKw = building ? powerRequirement(building) : 0
  let state: ElectricalDetails['state']
  let explanation: string
  const remaining = building ? sabotageRemaining(world, building) : 0
  if (remaining > 0) { state = 'sabotaged'; explanation = 'Sabotaged by Pete. Operation is paused without consuming power; buffers and progress are preserved.' }
  else if (!network) { state = 'disconnected'; explanation = building?.kind === 'generator' ? 'Generator disconnected. Place a pole within 3 tiles; generators do not power machines directly.' : 'Outside pole coverage. Place a pole within 3 tiles and connect a generator.' }
  else if (network.capacityKw === 0) { state = 'no-generation'; explanation = 'Assigned network has no generator. Connect a generator within 3 tiles of a pole.' }
  else if (building?.kind === 'generator' && network.suppliedKw > 0) { state = 'powered'; explanation = 'Supplying the assigned network. Generators share its load equally.' }
  else if (!consumer || consumer.requestedKw === 0) { state = 'idle'; explanation = requirementKw ? building?.kind === 'inserter' ? 'Connected and available. No power requested while waiting for compatible input or blocked at the drop point.' : 'Connected and available. No power requested while waiting for input or output space.' : 'Connected; unused capacity is available to this network.' }
  else if (consumer.speedFraction < 1) { state = 'reduced'; explanation = 'Network demand exceeds generation. All working machines share power proportionally; add a generator.' }
  else { state = 'powered'; explanation = 'Full requested power supplied.' }
  return {
    sabotageRemainingMs: remaining, networkId, requirementKw, requestedKw: consumer?.requestedKw ?? 0, suppliedKw: consumer?.suppliedKw ?? 0,
    speedFraction: consumer?.speedFraction ?? 0, state, explanation,
    network: network ? { capacityKw: network.capacityKw, requestedKw: network.requestedKw, suppliedKw: network.suppliedKw, poles: network.poleIndices.length, generators: network.generatorIndices.length, activeGenerators: network.generatorIndices.filter(i => sabotageRemaining(world, world.buildings[i]!) === 0).length } : null,
  }
}
