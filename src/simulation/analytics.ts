import { emptyInventory, ITEMS, inventoryTotal } from './items'
import type { Inventory } from './items'
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
  // Older Pete saves contain Factory diagnostics. Keep their valid history but
  // retire stale entries instead of running Factory's machine observer in Pete.
  if (world.miniFactory) for (const [key, diagnostic] of Object.entries(a.machines)) {
    if (diagnostic.task !== productionTask(world, world.buildings[Number(key)]) || diagnostic.sinceMs !== null && world.timeMs - diagnostic.sinceMs > diagnostic.observedMs) delete a.machines[Number(key)]
  }
}
