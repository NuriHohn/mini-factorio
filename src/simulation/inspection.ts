import { expansionProjects } from './homesteadExpansion'
import { DEVELOPMENT_NAMES } from './peteDevelopments'
import { TREASURES } from './peteLeisure'
import { enclosedRun } from './yard'
import { poultryBedtime } from './poultry'
import { PRESS_INPUT_CAPACITY, PRESS_OUTPUT_CAPACITY } from './gearPress'
import type { Personality } from './personality'
import { inspectingCrate, supplyCapacity } from './supplyCrate'
import { dockAtSpot, fishingSpot } from './fishingDock'
import { facesWater } from './waterTerrain'
import { waterwheelWater } from './waterwheel'
import { treeAge, treeStage, treeWood } from './nature'
import type { TreeSpecies, TreeStage } from './nature'
import { sprinklerState, SPRINKLER_RANGE, SPRAY_MS } from './sprinklers'
import { splitterPorts, splitterDirections } from './splitters'
import { splitterBlocked } from './transport'
import type { SplitterPacket } from './world'
import { IMPRISONMENT_MS, RADAR_RANGE, radarPowered } from './police'
import { sabotageRemaining } from './pete'
import { generationKw, ratedGeneration, POLE_COVERAGE_RADIUS, powerRequirement, withinRange } from './power'
import { emptyInventory, ITEMS, inventoryTotal } from './items'
import type { Inventory, Item, Resource } from './items'
import { forestryStatus, FELL_MS } from './forestryStation'
import { assemblerInputCapacity } from './assemblerRecipes'
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
export type Inspection = { kind: 'steamEngine'; fuel: number; cycles: number; progress: number; capacityKw: number; actualKw: number; electrical: ElectricalDetails } | { kind: 'forester'; details: string; progress: number; inventory: Inventory; electrical: ElectricalDetails } | { kind: 'peteDevelopment'; name: string; details: string } | { kind: 'peteTreasure'; treasures: { id: string; label: string; icon: string; comment: string; count: number }[]; carrying: string | null } | { kind: 'peteFlightpad'; practices: number; level: number; activity: string } | { kind: 'petePress'; plates: number; gears: number; inputCapacity: number; outputCapacity: number; pressing: boolean; cooldownMs: number } | { kind: 'peteExperiment'; experimenting: boolean } | { kind: 'peteWorkshop'; hammering: boolean } | { kind: 'peteGarden'; feed?: number } | { kind: 'peteGate'; openMs: number } | { kind: 'peteCampfire'; cooking: boolean } | { kind: 'peteCoop'; run?: string; covered?: boolean; fedUntilMs?: number; inside: number; bedtime: boolean; eaten: number; collected: number; eggs: number; adults: number; chicks: number } | { kind: 'peteFence'; direction: Direction } | { kind: 'supplyCrate'; storeTier?: 0 | 1 | 2; projects?: string[]; wood: number; inventory: Inventory; capacity: number; inspecting: boolean } | { kind: 'footbridge'; direction: Direction } | { kind: 'fishingDock'; direction: Direction; waterAvailable: boolean; accessible: boolean; fishing: boolean } | { kind: 'belt'; bridge?: boolean; direction: Direction; item: Item | null; progress: number } | { kind: 'treehouse'; activity: string; gifts: number; personality: Personality } | { kind: 'tree'; species: TreeSpecies; stage: TreeStage; ageMs: number; wood: number; origin: 'natural' | 'manual' } | InserterInspection | { kind: 'splitter'; direction: Direction; inputDirection: Direction; outputDirections: [Direction, Direction]; ports: ReturnType<typeof splitterPorts>; input: SplitterPacket | null; outputs: [SplitterPacket | null, SplitterPacket | null]; nextOutput: 0 | 1; blocked: [boolean, boolean]; delivered: [number, number]; itemsPerSec: number }
  | { kind: 'prison'; occupied: boolean; elapsedMs: number; remainingMs: number; imprisonedAtMs: number | null; exit: Position }
  | { kind: 'sprinkler'; manualCooldownMs?: number; radius: number; status: ReturnType<typeof sprinklerState>; cooldownMs: number; sprayProgress: number; sprays: number; electrical: ElectricalDetails }
  | { kind: 'radar'; radius: number; active: boolean; operation: string; prison: Position | null; electrical: ElectricalDetails } | { kind: 'storage'; inventory: Inventory }
  | { kind: 'miner'; resource: Resource | null; progress: number; buffered: boolean; electrical: ElectricalDetails }
  | { kind: 'generator' | 'waterwheel'; direction?: Direction; waterAvailable?: boolean; capacityKw: number; actualKw: number; electrical: ElectricalDetails }
  | { kind: 'powerPole'; coverageRadius: number; coveredMachines: number; electrical: ElectricalDetails } | {
  kind: 'furnace' | 'assembler' | 'sawmill'
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
      const recipes = building.recipeId ? [RECIPES[building.recipeId]] : building.kind === 'furnace' ? Object.values(RECIPES).filter(recipe => recipe.machine === building.kind) : []
      const rate = Math.max(0, ...recipes.map(recipe => inventoryTotal(recipe.outputs) * 1000 * MACHINE_DEFINITIONS[building.kind].craftingSpeed / recipe.durationMs))
      if (building.kind === 'furnace') { stats.furnaces++; stats.maxSmeltingPerSec += rate }
      else { stats.assemblers++; stats.maxCraftingPerSec += rate }
    }
    if (building?.kind === 'storage' || building?.kind === 'supplyCrate') {
      for (const item of ITEMS) stats.stored[item] += building.inventory[item]
    }
  }
  return stats
}
export function inspectBuilding(world: World, index: number | null): Inspection | null {
  const building = index === null ? null : world.buildings[index]
  if (building?.kind === 'supplyCrate') return { kind: 'supplyCrate', wood: building.wood, inventory: { ...building.inventory }, capacity: supplyCapacity(building), storeTier: building.storeTier, projects: world.homestead ? expansionProjects(world) : undefined, inspecting: inspectingCrate(world, building) }
  if (building?.kind === 'storage') return { kind: 'storage', inventory: { ...building.inventory } }
  if (!building || index === null) return null
  if (building.kind === 'belt') return { kind: 'belt', ...(building.bridge ? { bridge: true } : {}), direction: building.direction, item: building.item, progress: building.progress }
  if (building.kind === 'peteDevelopment') return { kind: 'peteDevelopment', name: DEVELOPMENT_NAMES[building.development], details: building.development === 'mechanic' ? `${building.gears}/4 gears in · ${building.modules}/4 mechanic modules out. 2 gears → 1 module. Use inserters to collect modules and deliver them to a supply crate for the hoist.` : building.development === 'orchard' ? `${building.fruit}/6 ripe fruit · ${world.developmentLife?.fruit ?? 0}/12 stored at home · ${world.developmentLife?.carriedFruit ?? 0} carried. Pete tends, harvests and cooks fruit at the campfire.` : building.development === 'nursery' ? `${world.developmentLife?.saplings ?? 0}/3 saplings · ${world.developmentLife?.carriedWood ?? 0} supplied Wood carried. 2 supplied Wood grows one sapling for nearby reforestation.` : building.development === 'bicycle' ? 'Pete mounts, rides a short safe round trip and parks again. Roads and factory transport are unchanged.' : building.development === 'house' ? 'An elevated annex with a sheltered seat. Pete occasionally rests here.' : 'Pete operates the hoist occasionally. The hanging load is decorative.' }
  if (building.kind === 'peteGate') return { kind: 'peteGate', openMs: building.openMs }
  if (building.kind === 'peteTreasure') return { kind: 'peteTreasure', treasures: TREASURES.map(t => ({ ...t, count: world.leisure?.collection[t.id] ?? 0 })), carrying: world.leisure?.carried ?? null }
  if (building.kind === 'peteFlightpad') return { kind: 'peteFlightpad', practices: world.leisure?.practices ?? 0, level: world.personality.paths.inventor.level, activity: world.peace.activity }
  if (building.kind === 'petePress') return { kind: 'petePress', plates: building.plates, gears: building.gears, inputCapacity: PRESS_INPUT_CAPACITY, outputCapacity: PRESS_OUTPUT_CAPACITY, pressing: world.peace.activity === 'pressing', cooldownMs: Math.max(0, (world.pressProject?.readyAtMs ?? 0) - world.timeMs) }
  if (building.kind === 'peteExperiment') return { kind: 'peteExperiment', experimenting: world.peace.activity === 'experimenting' }
  if (building.kind === 'peteWorkshop') return { kind: 'peteWorkshop', hammering: world.peace.activity === 'hammering' }
  if (building.kind === 'peteGarden') return { kind: 'peteGarden', feed: building.feed ?? 0 }
  if (building.kind === 'peteCampfire') return { kind: 'peteCampfire', cooking: world.peace.activity === 'cooking' }
  if (building.kind === 'peteCoop') {
    const s = world.poultry?.coop === index ? world.poultry : null
    return { kind: 'peteCoop', covered: s?.cover?.stage === 'covered' || s?.cover?.stage === 'uncovering', run: enclosedRun(world) ? 'Outdoor run complete' : world.chickenRun ? `Outdoor run: ${world.chickenRun.built}/${world.chickenRun.tiles.length} sections` : 'Outdoor run unlocks after the garden gate at Eco level 2', fedUntilMs: Math.max(0, (world.feedingProject?.readyAtMs ?? 0) - world.timeMs), inside: world.poultry?.birds.filter(b => b.tile === null).length ?? 0, bedtime: poultryBedtime(world), eaten: s?.eaten ?? 0, collected: s?.collected ?? 0, eggs: s?.eggs.length ?? 0, adults: s?.birds.filter(b => b.kind === 'adult').length ?? 0, chicks: s?.birds.filter(b => b.kind === 'chick').length ?? 0 }
  }
  if (building.kind === 'peteFence') return { kind: 'peteFence', direction: building.direction }
  if (building.kind === 'footbridge') return { kind: 'footbridge', direction: building.direction }
  if (building.kind === 'fishingDock') return { kind: 'fishingDock', direction: building.direction, waterAvailable: facesWater(world, building, building.direction), accessible: fishingSpot(world, building) !== null, fishing: world.peace.activity === 'fishing' && dockAtSpot(world, world.peace.destination) === building }
  if (building.kind === 'treehouse') return { kind: 'treehouse', activity: world.peace.activity, gifts: world.peace.gifts.length, personality: structuredClone(world.personality) }
  if (building.kind === 'tree') return { kind: 'tree', species: building.species, stage: treeStage(world, building), ageMs: treeAge(world, building), wood: treeWood(world, building), origin: building.origin }
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
  if (building.kind === 'sprinkler') return { kind: 'sprinkler', manualCooldownMs: Math.max(0, (building.manualReadyAtMs ?? 0) - world.timeMs), radius: SPRINKLER_RANGE, status: sprinklerState(world, building), cooldownMs: Math.max(0, building.cooldownUntilMs - world.timeMs), sprayProgress: world.pete.mode === 'SPRAYED' && world.pete.water?.source === index ? 1 - world.pete.water.remainingMs / SPRAY_MS : 0, sprays: building.sprays, electrical }
  if (building.kind === 'radar') {
    const prison = world.buildings.find(b => b?.kind === 'prison')
    return { kind: 'radar', radius: RADAR_RANGE, active: radarPowered(world, index), operation: world.peace.home !== null ? 'Pete is peaceful' : world.police.car?.phase ?? (world.pete.mode === 'IMPRISONED' ? 'Pete in prison' : world.police.retryAtMs > world.timeMs ? 'Waiting for a reachable edge route' : 'Monitoring'), prison: prison ? { x: prison.x, y: prison.y } : null, electrical }
  }
  if (building.kind === 'inserter') {
    const { pickup, drop } = inserterPorts(building)
    return { kind: 'inserter', direction: building.direction, item: building.item, phase: building.phase, status: inserterStatus(world, building), progress: building.phase === 'idle' ? 0 : (building.elapsedMs + (building.phase === 'returning' ? INSERTER_SWING_MS : 0)) / INSERTER_CYCLE_MS, cycleMs: INSERTER_CYCLE_MS, pickup, drop, source: buildingAt(world, pickup.x, pickup.y)?.kind ?? null, target: buildingAt(world, drop.x, drop.y)?.kind ?? null, electrical }
  }
  if (building.kind === 'forester') return { kind: 'forester', details: forestryStatus(world, building), progress: building.elapsed / FELL_MS, inventory: { ...building.output }, electrical }
  if (building.kind === 'miner') return { kind: 'miner', resource: depositAt(world, building.x, building.y), progress: building.elapsed / INTERVAL, buffered: building.item !== null, electrical }
  if (building.kind === 'steamEngine') return { kind: building.kind, fuel: building.fuel, cycles: building.cycles, progress: building.burnRemainingMs ? 1 - building.burnRemainingMs / 10000 : 0, capacityKw: ratedGeneration(building), actualKw: electrical.network?.capacityKw ? electrical.network.suppliedKw * generationKw(world, building) / electrical.network.capacityKw : 0, electrical }
  if (building.kind === 'generator' || building.kind === 'waterwheel') return { kind: building.kind, ...(building.kind === 'waterwheel' ? { direction: building.direction, waterAvailable: waterwheelWater(world, building, building.direction) } : {}), capacityKw: ratedGeneration(building), actualKw: electrical.network?.capacityKw ? electrical.network.suppliedKw * generationKw(world, building) / electrical.network.capacityKw : 0, electrical }
  if (building.kind === 'powerPole') return { kind: 'powerPole', coverageRadius: POLE_COVERAGE_RADIUS, coveredMachines: world.buildings.filter(b => b && powerRequirement(b) > 0 && withinRange(building, b, POLE_COVERAGE_RADIUS)).length, electrical }
  if (building.kind !== 'furnace' && building.kind !== 'assembler' && building.kind !== 'sawmill') return null
  const recipe = building.recipeId ? RECIPES[building.recipeId] : null
  return {
    kind: building.kind, direction: building.direction, recipeMode: building.kind === 'furnace' || building.kind === 'sawmill' ? building.recipeMode : building.recipeMode === 'auto' ? 'auto' : building.recipeId ?? 'auto', recipe: recipe?.label ?? (building.kind === 'furnace' ? 'Waiting for ore' : 'Select a recipe'), recipeId: building.recipeId,
    recipeLocked: building.recipeLocked,
    detectionStatus: building.recipeLocked ? (building.recipeMode === 'auto' ? 'automatic-locked' : 'manual-locked') : building.recipeId ? 'choosing' : 'undetected',
    requirements: { ...recipe?.inputs }, products: { ...recipe?.outputs }, durationMs: recipe?.durationMs ?? 0, recipeChangeError: recipeChangeError(building),
    input: { ...building.input }, output: { ...building.output }, reserved: { ...(building.job?.outputs ?? emptyInventory()) },
    progress: building.job ? building.job.elapsedMs / RECIPES[building.job.recipeId].durationMs : 0,
    inputCapacities: building.kind === 'assembler' ? Object.fromEntries(ITEMS.filter(item => assemblerInputCapacity(building, item) > 0).map(item => [item, assemblerInputCapacity(building, item)])) : {},
    recipeWaitRemainingMs: 0,
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
  else if (!network) { state = 'disconnected'; explanation = building && ratedGeneration(building) > 0 ? 'Generator disconnected. Place a pole within 3 tiles; generators do not power machines directly.' : 'Outside pole coverage. Place a pole within 3 tiles and connect a generator.' }
  else if (building?.kind === 'waterwheel' && !waterwheelWater(world, building, building.direction)) { state = 'idle'; explanation = 'No water on the facing side. Restore adjacent water to resume generation.' }
  else if (building?.kind === 'steamEngine' && !building.fuel && !building.burnRemainingMs) { state = 'idle'; explanation = 'Boiler fuel is empty. Deliver coal to resume shaft work and electricity.' }
  else if (network.capacityKw === 0) { state = 'no-generation'; explanation = 'Assigned network has no generator. Connect a generator within 3 tiles of a pole.' }
  else if (building && generationKw(world, building) > 0 && network.suppliedKw > 0) { state = 'powered'; explanation = 'Supplying the assigned network. Generators share its load in proportion to available capacity.' }
  else if (!consumer || consumer.requestedKw === 0) { state = 'idle'; explanation = requirementKw ? building?.kind === 'inserter' ? 'Connected and available. No power requested while waiting for compatible input or blocked at the drop point.' : 'Connected and available. No power requested while waiting for input or output space.' : 'Connected; unused capacity is available to this network.' }
  else if (consumer.speedFraction < 1) { state = 'reduced'; explanation = 'Network demand exceeds generation. All working machines share power proportionally; add a generator.' }
  else { state = 'powered'; explanation = 'Full requested power supplied.' }
  return {
    sabotageRemainingMs: remaining, networkId, requirementKw, requestedKw: consumer?.requestedKw ?? 0, suppliedKw: consumer?.suppliedKw ?? 0,
    speedFraction: consumer?.speedFraction ?? 0, state, explanation,
    network: network ? { capacityKw: network.capacityKw, requestedKw: network.requestedKw, suppliedKw: network.suppliedKw, poles: network.poleIndices.length, generators: network.generatorIndices.length, activeGenerators: network.generatorIndices.filter(i => generationKw(world, world.buildings[i]!) > 0).length } : null,
  }
}
