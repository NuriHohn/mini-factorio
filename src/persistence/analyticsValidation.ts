import { createAnalytics, HISTORY_MS, PROBLEMS, productionTask, RATE_WINDOW_MS } from '../simulation/analytics'
import type { AnalyticsState, MachineDiagnostic } from '../simulation/analytics'
import { ITEMS, inventoryTotal } from '../simulation/items'
import type { World } from '../simulation/world'
import * as v from './validation'

export function restoreAnalytics(value: unknown, world: World): AnalyticsState {
  const a = v.object(value, 'analytics', ['startedAtMs', 'samples', 'buckets', 'lastProducedAt', 'machines'])
  const startedAtMs = v.count(a.startedAtMs, 'analytics.startedAtMs', world.timeMs)
  if (startedAtMs % 50) v.invalid('analytics.startedAtMs', 'invalid boundary')
  let previous = -1
  const samples = v.array(a.samples, 'analytics.samples', undefined, RATE_WINDOW_MS / 50).map((entry, i) => {
    const name = `analytics.samples[${i}]`, s = v.object(entry, name, ['timeMs', 'produced', 'consumed'])
    const timeMs = v.count(s.timeMs, `${name}.timeMs`, world.timeMs)
    const produced = v.inventory(s.produced, `${name}.produced`), consumed = v.inventory(s.consumed, `${name}.consumed`)
    if (timeMs % 50 || timeMs <= previous || timeMs <= world.timeMs - RATE_WINDOW_MS || timeMs <= startedAtMs || inventoryTotal(produced) + inventoryTotal(consumed) === 0) v.invalid(name, 'invalid rolling sample')
    previous = timeMs
    return { timeMs, produced, consumed }
  })
  previous = -1
  const buckets = v.array(a.buckets, 'analytics.buckets', undefined, HISTORY_MS / RATE_WINDOW_MS + 1).map((entry, i) => {
    const name = `analytics.buckets[${i}]`, b = v.object(entry, name, ['startMs', 'produced', 'consumed'])
    const startMs = v.count(b.startMs, `${name}.startMs`, world.timeMs)
    if (startMs % RATE_WINDOW_MS || startMs <= previous || startMs + RATE_WINDOW_MS <= world.timeMs - HISTORY_MS || startMs + RATE_WINDOW_MS <= startedAtMs) v.invalid(name, 'invalid history bucket')
    previous = startMs
    return { startMs, produced: v.inventory(b.produced, `${name}.produced`), consumed: v.inventory(b.consumed, `${name}.consumed`) }
  })
  const lastProducedAt = v.inventory(a.lastProducedAt, 'analytics.lastProducedAt')
  for (const item of ITEMS) {
    if (lastProducedAt[item] > world.timeMs || lastProducedAt[item] % 50 || (lastProducedAt[item] !== 0 && lastProducedAt[item] <= startedAtMs)) v.invalid('analytics.lastProducedAt', 'invalid production timestamp')
    for (const sample of samples) {
      const bucket = buckets.find(b => b.startMs === Math.floor(sample.timeMs / RATE_WINDOW_MS) * RATE_WINDOW_MS)
      if (!bucket || sample.produced[item] > bucket.produced[item] || sample.consumed[item] > bucket.consumed[item] || (sample.produced[item] && lastProducedAt[item] < sample.timeMs)) v.invalid('analytics.samples', 'sample disagrees with history')
    }
    for (const bucket of buckets) {
      const members = samples.filter(s => Math.floor(s.timeMs / RATE_WINDOW_MS) * RATE_WINDOW_MS === bucket.startMs)
      for (const field of ['produced', 'consumed'] as const) {
        const total = members.reduce((sum, s) => sum + s[field][item], 0)
        if (total > bucket[field][item] || (bucket.startMs > world.timeMs - RATE_WINDOW_MS && total !== bucket[field][item])) v.invalid('analytics.buckets', 'history disagrees with rolling samples')
      }
    }
  }
  const raw = a.machines
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) v.invalid('analytics.machines', 'expected machine map')
  const machines: Record<number, MachineDiagnostic> = {}
  for (const [key, entry] of Object.entries(raw)) {
    const index = Number(key)
    if (!/^\d+$/.test(key) || String(index) !== key) v.invalid('analytics.machines', 'invalid machine index')
    v.tile(index, 'analytics.machine.index')
    const m = v.object(entry, `analytics.machines.${key}`, ['task', 'observedMs', 'productiveMs', 'cause', 'sinceMs'])
    if (!productionTask(world, world.buildings[index]) || m.task !== productionTask(world, world.buildings[index])) v.invalid('analytics.machine.task', 'stale machine task')
    const observedMs = v.count(m.observedMs, 'analytics.machine.observedMs', world.timeMs - startedAtMs)
    const productiveMs = v.count(m.productiveMs, 'analytics.machine.productiveMs', observedMs)
    const cause = m.cause === null ? null : v.choice(m.cause, 'analytics.machine.cause', PROBLEMS)
    const sinceMs = m.sinceMs === null ? null : v.count(m.sinceMs, 'analytics.machine.sinceMs', world.timeMs)
    if (observedMs % 50 || productiveMs % 50 || (cause === null) !== (sinceMs === null) || (sinceMs !== null && (sinceMs % 50 || sinceMs < startedAtMs || world.timeMs - sinceMs > observedMs))) v.invalid('analytics.machine', 'invalid diagnostic timing')
    machines[index] = { task: String(m.task), observedMs, productiveMs, cause, sinceMs }
  }
  return { startedAtMs, samples, buckets, lastProducedAt, machines }
}
export { createAnalytics }
