import { GENERATOR_KW, POLE_COVERAGE_RADIUS, powerRequirement, withinRange } from './power'
import { emptyInventory } from './items'
import type { Inventory } from './items'
import { furnaceStatus } from './smelting'
import type { FurnaceStatus } from './smelting'
import { RECIPES } from './recipes'
import { outputWaiting } from './transport'
import { INTERVAL } from './world'
import type { Direction, World } from './world'

export interface WorldStats {
  oreMined: number
  platesSmelted: number
  storedOre: number
  storedPlates: number
  miners: number
  furnaces: number
}
export type Inspection = { kind: 'storage'; inventory: Inventory }
  | { kind: 'miner'; progress: number; buffered: boolean; electrical: ElectricalDetails }
  | { kind: 'generator'; capacityKw: number; actualKw: number; electrical: ElectricalDetails }
  | { kind: 'powerPole'; coverageRadius: number; coveredMachines: number; electrical: ElectricalDetails } | {
  kind: 'furnace'
  direction: Direction
  recipe: string
  input: Inventory
  output: Inventory
  reserved: Inventory
  progress: number
  status: FurnaceStatus
  outputWaiting: boolean
  electrical: ElectricalDetails
}
export function worldStats(world: World): WorldStats {
  const stats: WorldStats = { oreMined: world.ore, platesSmelted: world.plates, storedOre: 0, storedPlates: 0, miners: 0, furnaces: 0 }
  for (const building of world.buildings) {
    if (building?.kind === 'miner') stats.miners++
    if (building?.kind === 'furnace') stats.furnaces++
    if (building?.kind === 'storage') {
      stats.storedOre += building.inventory.iron
      stats.storedPlates += building.inventory.ironPlate
    }
  }
  return stats
}
export function inspectBuilding(world: World, index: number | null): Inspection | null {
  const building = index === null ? null : world.buildings[index]
  if (building?.kind === 'storage') return { kind: 'storage', inventory: { ...building.inventory } }
  if (!building || index === null) return null
  const electrical = electricalDetails(world, index)
  if (building.kind === 'miner') return { kind: 'miner', progress: building.elapsed / INTERVAL, buffered: building.item !== null, electrical }
  if (building.kind === 'generator') return { kind: 'generator', capacityKw: GENERATOR_KW, actualKw: electrical.network ? electrical.network.suppliedKw / electrical.network.generators : 0, electrical }
  if (building.kind === 'powerPole') return { kind: 'powerPole', coverageRadius: POLE_COVERAGE_RADIUS, coveredMachines: world.buildings.filter(b => b && powerRequirement(b) > 0 && withinRange(building, b, POLE_COVERAGE_RADIUS)).length, electrical }
  if (building.kind !== 'furnace') return null
  return {
    kind: 'furnace', direction: building.direction, recipe: RECIPES[building.recipeId].label,
    input: { ...building.input }, output: { ...building.output }, reserved: { ...(building.job?.outputs ?? emptyInventory()) },
    progress: building.job ? building.job.elapsedMs / RECIPES[building.job.recipeId].durationMs : 0,
    electrical, status: furnaceStatus(building), outputWaiting: outputWaiting(world, building),
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
  else if (!consumer || consumer.requestedKw === 0) { state = 'idle'; explanation = requirementKw ? 'Connected and available. No power requested while waiting for input or output space.' : 'Connected; unused capacity is available to this network.' }
  else if (consumer.speedFraction < 1) { state = 'reduced'; explanation = 'Network demand exceeds generation. All working machines share power proportionally; add a generator.' }
  else { state = 'powered'; explanation = 'Full requested power supplied.' }
  return {
    networkId, requirementKw, requestedKw: consumer?.requestedKw ?? 0, suppliedKw: consumer?.suppliedKw ?? 0,
    speedFraction: consumer?.speedFraction ?? 0, state, explanation,
    network: network ? { capacityKw: network.capacityKw, requestedKw: network.requestedKw, suppliedKw: network.suppliedKw, poles: network.poleIndices.length, generators: network.generatorIndices.length } : null,
  }
}
