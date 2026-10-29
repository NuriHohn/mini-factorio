import { emptyInventory, ITEMS, inventoryTotal } from '../simulation/items'
import type { Inventory } from '../simulation/items'
import { craftingStatus } from '../simulation/crafting'
import { hasRecipeInputs, RECIPES } from '../simulation/recipes'
import { sabotageRemaining } from '../simulation/pete'
import type { World } from '../simulation/world'
import { productionTask, RATE_WINDOW_MS, BOTTLENECK_MS } from '../simulation/analytics'
import type { Problem, ProductionBucket } from '../simulation/analytics'
// Observe the same allocation/readiness used by this step, before production changes buffers.
export function observeMachines(world: World, delta: number): void {
  const machines = world.analytics.machines
  for (const key of Object.keys(machines)) {
    const index = Number(key)
    if (!productionTask(world, world.buildings[index])) delete machines[index]
  }
  world.buildings.forEach((building, index) => {
    const task = productionTask(world, building)
    if (!task || !building) return
    let diagnostic = machines[index]
    if (!diagnostic || diagnostic.task !== task) diagnostic = machines[index] = { task, observedMs: 0, productiveMs: 0, cause: null, sinceMs: null }
    const consumer = world.power?.consumers[index]
    const network = world.power?.networks.find(n => n.id === consumer?.networkId)
    let cause: Problem | null = null, productive = false
    if (sabotageRemaining(world, building) > 0) cause = 'Sabotaged'
    else if (!network || network.capacityKw === 0) cause = 'No Power'
    else if (building.kind === 'miner') {
      if (building.item) cause = 'Output Blocked'
      else productive = (consumer?.speedFraction ?? 0) > 0
    } else if (building.kind === 'sawmill' || building.kind === 'assembler' || building.kind === 'furnace') {
      if (craftingStatus(building) === 'output-full') cause = 'Output Blocked'
      else if (!building.job && !hasRecipeInputs(building.input, RECIPES[building.recipeId!])) cause = 'Missing Input'
      else productive = building.job !== null && (consumer?.speedFraction ?? 0) > 0
    }
    diagnostic.observedMs += delta
    if (productive) diagnostic.productiveMs += delta
    if (diagnostic.cause !== cause) diagnostic.sinceMs = cause ? world.timeMs - delta : null
    diagnostic.cause = cause
  })
}
export interface Bottleneck { index: number; kind: string; cause: Problem; durationMs: number }
export interface AnalyticsSnapshot {
  timeMs: number
  produced: Inventory
  consumed: Inventory
  totalPerMinute: number
  utilization: number
  configuredMachines: number
  problems: Bottleneck[]
  history: ProductionBucket[]
  recentItems: (keyof Inventory)[]
}
export function analyticsSnapshot(world: World): AnalyticsSnapshot {
  const produced = emptyInventory(), consumed = emptyInventory()
  for (const sample of world.analytics.samples) {
    if (sample.timeMs <= world.timeMs - RATE_WINDOW_MS) continue
    for (const item of ITEMS) { produced[item] += sample.produced[item]; consumed[item] += sample.consumed[item] }
  }
  const problems: Bottleneck[] = []
  let configuredMachines = 0, utilization = 0
  world.buildings.forEach((building, index) => {
    const task = productionTask(world, building)
    if (!task) return
    configuredMachines++
    const m = world.analytics.machines[index]
    if (!m || m.task !== task) return
    utilization += m.observedMs ? m.productiveMs / m.observedMs : 0
    if (m.cause && m.sinceMs !== null && world.timeMs - m.sinceMs >= BOTTLENECK_MS) problems.push({ index, kind: building!.kind, cause: m.cause, durationMs: world.timeMs - m.sinceMs })
  })
  problems.sort((a, b) => b.durationMs - a.durationMs || a.index - b.index)
  const recentItems = ITEMS.filter(item => world.analytics.lastProducedAt[item] > 0).sort((a, b) => world.analytics.lastProducedAt[b] - world.analytics.lastProducedAt[a] || ITEMS.indexOf(a) - ITEMS.indexOf(b)).slice(0, 3)
  return { timeMs: world.timeMs, produced, consumed, totalPerMinute: inventoryTotal(produced), utilization: configuredMachines ? utilization / configuredMachines : 0, configuredMachines, problems, history: world.analytics.buckets.map(b => ({ startMs: b.startMs, produced: { ...b.produced }, consumed: { ...b.consumed } })), recentItems }
}
