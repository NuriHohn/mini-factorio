import { emptyInventory, ITEMS, inventoryTotal } from './items'
import type { Inventory } from './items'
import { craftingStatus } from './crafting'
import { hasRecipeInputs, RECIPES } from './recipes'
import { sabotageRemaining } from './pete'
import { depositAt } from './world'
import type { Building, World } from './world'

export const RATE_WINDOW_MS = 60000
export const HISTORY_MS = 600000
export const BOTTLENECK_MS = 10000
export const PROBLEMS = ['Sabotaged', 'No Power', 'Output Blocked', 'Missing Input'] as const
export type Problem = typeof PROBLEMS[number]
export interface ProductionSample { timeMs: number; produced: Inventory; consumed: Inventory }
export interface ProductionBucket { startMs: number; produced: Inventory; consumed: Inventory }
export interface MachineDiagnostic {
  task: string
  observedMs: number
  productiveMs: number
  cause: Problem | null
  sinceMs: number | null
}
export interface AnalyticsState {
  startedAtMs: number
  samples: ProductionSample[]
  buckets: ProductionBucket[]
  lastProducedAt: Inventory
  machines: Record<number, MachineDiagnostic>
}
export function createAnalytics(timeMs = 0): AnalyticsState {
  return { startedAtMs: timeMs, samples: [], buckets: [], lastProducedAt: emptyInventory(), machines: {} }
}
export function productionTask(world: World, building: Building | null): string | null {
  if (building?.kind === 'miner') return depositAt(world, building.x, building.y)
  if (building?.kind === 'sawmill' || building?.kind === 'furnace' || building?.kind === 'assembler') return building.recipeLocked ? building.recipeId : null
  return null
}
// Called only at actual creation/commit boundaries. Relocation and deletion never call this.
export function recordProduction(world: World, produced: Readonly<Partial<Inventory>>, consumed: Readonly<Partial<Inventory>> = {}): void {
  if (inventoryTotal(produced) + inventoryTotal(consumed) === 0) return
  const a = world.analytics
  let sample = a.samples.at(-1)
  if (sample?.timeMs !== world.timeMs) {
    sample = { timeMs: world.timeMs, produced: emptyInventory(), consumed: emptyInventory() }
    a.samples.push(sample)
  }
  // Events at a minute boundary belong to the new, half-open minute bucket.
  const startMs = Math.floor(world.timeMs / RATE_WINDOW_MS) * RATE_WINDOW_MS
  let bucket = a.buckets.at(-1)
  if (bucket?.startMs !== startMs) {
    bucket = { startMs, produced: emptyInventory(), consumed: emptyInventory() }
    a.buckets.push(bucket)
  }
  for (const item of ITEMS) {
    const made = produced[item] ?? 0, used = consumed[item] ?? 0
    sample.produced[item] += made; sample.consumed[item] += used
    bucket.produced[item] += made; bucket.consumed[item] += used
    if (made > 0) a.lastProducedAt[item] = world.timeMs
  }
}
export function pruneAnalytics(world: World): void {
  const a = world.analytics
  // (now - 60s, now] for exact rolling rates; retain intersecting calendar-minute buckets.
  while (a.samples.length && a.samples[0].timeMs <= world.timeMs - RATE_WINDOW_MS) a.samples.shift()
  while (a.buckets.length && a.buckets[0].startMs + RATE_WINDOW_MS <= world.timeMs - HISTORY_MS) a.buckets.shift()
}
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
