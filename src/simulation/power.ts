import { WATERWHEEL_KW, waterwheelRunning } from './waterwheel'
import { SPRINKLER_KW } from './sprinklers'
import { RADAR_KW } from './police'
import { sabotageRemaining } from './pete'
import { placementError, SIZE } from './world'
import type { Building, Position, World } from './world'
import { canStartCrafting, craftingStatus } from './crafting'
import { inserterDemand, INSERTER_KW } from './inserters'
import type { InserterFrame } from './inserters'
import { MACHINE_DEFINITIONS } from './recipes'

export const GENERATOR_KW = 100
export function ratedGeneration(building: Building): number {
  return building.kind === 'generator' ? GENERATOR_KW : building.kind === 'waterwheel' ? WATERWHEEL_KW : 0
}
export function generationKw(world: World, building: Building): number {
  if (sabotageRemaining(world, building) > 0) return 0
  return building.kind === 'waterwheel' ? waterwheelRunning(world, building) ? WATERWHEEL_KW : 0 : ratedGeneration(building)
}
export const MINER_KW = 30
export const FURNACE_KW = MACHINE_DEFINITIONS.furnace.powerKw
export const ASSEMBLER_KW = MACHINE_DEFINITIONS.assembler.powerKw
export const POLE_CONNECTION_RANGE = 6
export const POLE_COVERAGE_RADIUS = 3
export interface ConsumerPower {
  networkId: number | null
  requestedKw: number
  suppliedKw: number
  speedFraction: number
}
export interface PowerNetwork {
  id: number
  poleIndices: number[]
  generatorIndices: number[]
  consumerIndices: number[]
  capacityKw: number
  requestedKw: number
  suppliedKw: number
}
export interface PowerState {
  topologyRevision: number
  networks: PowerNetwork[]
  assignments: Record<number, number>
  consumers: Record<number, ConsumerPower>
  poleConnections: [number, number][]
}
export interface PowerOverview {
  installedKw: number
  connectedKw: number
  requestedKw: number
  suppliedKw: number
  surplusKw: number
  deficitKw: number
  networks: number
}
export function withinRange(a: Position, b: Position, radius: number): boolean {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= radius ** 2
}
export function polesConnect(a: Position, b: Position): boolean {
  return withinRange(a, b, POLE_CONNECTION_RANGE)
}
export interface PolePlacementPreview {
  state: 'connected' | 'disconnected' | 'invalid'
  error: string | null
  connections: number[]
}
// A read-only query: previewing never allocates power or changes topology.
export function polePlacementPreview(world: World, position: Position): PolePlacementPreview {
  const error = placementError(world, position.x, position.y, 'powerPole')
  if (error) return { state: 'invalid', error, connections: [] }
  const connections = world.buildings.flatMap((building, index) =>
    building?.kind === 'powerPole' && polesConnect(position, building) ? [index] : [])
  return { state: connections.length ? 'connected' : 'disconnected', error: null, connections }
}
export function powerRequirement(building: Building): number {
  return building.kind === 'sprinkler' ? SPRINKLER_KW : building.kind === 'radar' ? RADAR_KW : building.kind === 'inserter' ? INSERTER_KW : building.kind === 'forester' ? 30 : building.kind === 'miner' ? MINER_KW : building.kind === 'furnace' || building.kind === 'assembler' || building.kind === 'sawmill' ? MACHINE_DEFINITIONS[building.kind].powerKw : 0
}
export function workingDemand(building: Building, world?: World, frame?: InserterFrame): number {
  if (world && sabotageRemaining(world, building) > 0) return 0
  if (building.kind === 'sprinkler') return SPRINKLER_KW
  if (building.kind === 'radar') return RADAR_KW
  if (building.kind === 'inserter') return world ? inserterDemand(world, building, frame) : 0
  if (building.kind === 'forester') return building.output.wood <= 3 || (building.replant && building.plots.length > 0) ? 30 : 0
  if (building.kind === 'miner') return building.item ? 0 : MINER_KW
  if (building.kind !== 'furnace' && building.kind !== 'assembler' && building.kind !== 'sawmill') return 0
  return (building.job && craftingStatus(building) !== 'output-full') || (!building.job && canStartCrafting(building)) ? powerRequirement(building) : 0
}
function discover(world: World): PowerState {
  const poles = world.buildings.flatMap((b, i) => b?.kind === 'powerPole' ? [i] : [])
  const edges: [number, number][] = []
  const adjacency = new Map(poles.map(i => [i, [] as number[]]))
  for (let a = 0; a < poles.length; a++) for (let b = a + 1; b < poles.length; b++) {
    const i = poles[a], j = poles[b]
    if (!polesConnect(world.buildings[i]!, world.buildings[j]!)) continue
    edges.push([i, j])
    adjacency.get(i)!.push(j)
    adjacency.get(j)!.push(i)
  }
  const assignments: Record<number, number> = {}
  const networks: PowerNetwork[] = []
  for (const root of poles) {
    if (assignments[root] !== undefined) continue
    const members = [root]
    assignments[root] = root
    for (let cursor = 0; cursor < members.length; cursor++) {
      for (const next of adjacency.get(members[cursor])!) {
        if (assignments[next] !== undefined) continue
        assignments[next] = root
        members.push(next)
      }
    }
    networks.push({ id: root, poleIndices: members.sort((a, b) => a - b), generatorIndices: [], consumerIndices: [], capacityKw: 0, requestedKw: 0, suppliedKw: 0 })
  }
  const byId = new Map(networks.map(n => [n.id, n]))
  world.buildings.forEach((building, index) => {
    if (!building || (ratedGeneration(building) === 0 && powerRequirement(building) === 0)) return
    const pole = poles.find(i => withinRange(building, world.buildings[i]!, POLE_COVERAGE_RADIUS))
    if (pole === undefined) return
    const networkId = assignments[pole]
    assignments[index] = networkId
    const network = byId.get(networkId)!
    if (ratedGeneration(building) > 0) network.generatorIndices.push(index)
    else network.consumerIndices.push(index)
  })
  return { topologyRevision: world.topologyRevision, networks, assignments, consumers: {}, poleConnections: edges }
}
export function allocatePower(world: World, frame?: InserterFrame): PowerState {
  if (!world.power || world.power.topologyRevision !== world.topologyRevision) world.power = discover(world)
  const power = world.power
  power.consumers = {}
  for (const network of power.networks) {
    network.capacityKw = network.generatorIndices.reduce((sum, i) => sum + generationKw(world, world.buildings[i]!), 0)
    network.requestedKw = 0
    network.suppliedKw = 0
  }
  const byId = new Map(power.networks.map(n => [n.id, n]))
  world.buildings.forEach((building, index) => {
    if (!building || powerRequirement(building) === 0) return
    const networkId = power.assignments[index] ?? null
    const requestedKw = workingDemand(building, world, frame)
    power.consumers[index] = { networkId, requestedKw, suppliedKw: 0, speedFraction: 0 }
    if (networkId !== null) byId.get(networkId)!.requestedKw += requestedKw
  })
  for (const consumer of Object.values(power.consumers)) {
    const network = consumer.networkId === null ? null : byId.get(consumer.networkId)
    if (!network || consumer.requestedKw === 0) continue
    consumer.speedFraction = Math.min(1, network.capacityKw / network.requestedKw)
    consumer.suppliedKw = consumer.requestedKw * consumer.speedFraction
  }
  for (const network of power.networks) network.suppliedKw = Math.min(network.capacityKw, network.requestedKw)
  return power
}
export function powerOverview(world: World): PowerOverview {
  const power = world.power
  const summary: PowerOverview = { installedKw: world.buildings.reduce((sum, b) => sum + (b ? ratedGeneration(b) : 0), 0), connectedKw: 0, requestedKw: 0, suppliedKw: 0, surplusKw: 0, deficitKw: 0, networks: power?.networks.length ?? 0 }
  for (const network of power?.networks ?? []) {
    summary.connectedKw += network.capacityKw
    summary.suppliedKw += network.suppliedKw
    summary.surplusKw += Math.max(0, network.capacityKw - network.requestedKw)
  }
  for (const consumer of Object.values(power?.consumers ?? {})) {
    summary.requestedKw += consumer.requestedKw
    summary.deficitKw += Math.max(0, consumer.requestedKw - consumer.suppliedKw)
  }
  return summary
}
export function tilePosition(index: number): Position { return { x: index % SIZE, y: Math.floor(index / SIZE) } }
