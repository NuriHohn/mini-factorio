import { MAX_EXTRA_STORES, STORAGE_BATCH, STORAGE_WORK_MS, ownedStores } from '../simulation/warehousing'
import type { Warehousing, StorageJob } from '../simulation/warehousing'
import { ITEMS } from '../simulation/items'
import type { World } from '../simulation/world'
import * as v from './validation'

export function restoreWarehousing(value: unknown): Warehousing {
  const r = v.object(value, 'warehousing', ['stores', 'job', 'nextAtMs'])
  const stores = v.array(r.stores, 'warehousing.stores', undefined, MAX_EXTRA_STORES).map((t, i) => v.tile(t, `warehousing.stores[${i}]`))
  if (new Set(stores).size !== stores.length) v.invalid('warehousing.stores', 'duplicate ownership')
  let job: StorageJob | null = null
  if (r.job !== null) {
    const j = v.object(r.job, 'warehousing.job', ['kind', 'source', 'target', 'item', 'amount', 'carried', 'elapsedMs'], ['waiting'])
    const kind = v.choice(j.kind, 'warehousing.job.kind', ['build', 'haul'] as const)
    const item = v.choice(j.item, 'warehousing.job.item', ITEMS)
    const amount = v.count(j.amount, 'warehousing.job.amount', STORAGE_BATCH)
    const carried = v.count(j.carried, 'warehousing.job.carried', amount)
    const elapsedMs = v.count(j.elapsedMs, 'warehousing.job.elapsedMs', STORAGE_WORK_MS)
    if (!amount || elapsedMs % 50 || kind === 'haul' && elapsedMs || kind === 'build' && (amount !== (item === 'woodenCrate' ? 2 : STORAGE_BATCH) || carried !== 0 && carried !== amount || elapsedMs && !carried)) v.invalid('warehousing.job', 'invalid invoice or work clock')
    const source = v.tile(j.source, 'warehousing.job.source'), target = v.tile(j.target, 'warehousing.job.target')
    if (source === target) v.invalid('warehousing.job', 'source equals destination')
    if (Object.hasOwn(j, 'waiting') && (j.waiting !== true || !carried)) v.invalid('warehousing.job.waiting', 'requires paid cargo')
    job = { ...(j.waiting === true ? { waiting: true } : {}), kind, source, target, item, amount, carried, elapsedMs }
  }
  const nextAtMs = v.count(r.nextAtMs, 'warehousing.nextAtMs')
  if (nextAtMs % 50) v.invalid('warehousing.nextAtMs', 'invalid clock')
  return { stores, job, nextAtMs }
}
export function validateWarehousing(world: World): void {
  const s = world.warehousing
  if (!s) return
  if (!world.miniFactory || !world.homestead || world.peace.home === null || s.nextAtMs > world.timeMs + 3000) v.invalid('warehousing', 'requires Petes Welt and a valid clock')
  for (const t of s.stores) if (t === world.homestead.store || world.buildings[t]?.kind !== 'supplyCrate' || world.buildings[t].storeTier === undefined) v.invalid('warehousing.stores', 'invalid extra store')
  const job = s.job
  if (job && !job.carried && (!ownedStores(world).includes(job.source) || job.kind === 'haul' && !ownedStores(world).includes(job.target))) v.invalid('warehousing.job', 'unfunded job requires owned stores')
}
