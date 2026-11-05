import { expansionLayout } from './homesteadExpansion'
import type { StoreMove, ConstructionResite } from './storageRecovery'
import { arrived, freeSite } from './homestead'
import { inventoryTotal, emptyInventory, ITEMS } from './items'
import type { Item } from './items'
import { storedMaterial, mainStoreTargets } from './materialPolicy'
import { supplyCapacity } from './supplyCrate'
import { miniApproach } from './petesWorld'
import { currentProject } from './secretProject'
import { inside, SIZE } from './grid'
import type { SupplyCrate, World } from './world'

export const MAX_EXTRA_STORES = 12
export const STORAGE_BATCH = 6
export const STORAGE_WORK_MS = 4000
export interface StorageJob {
  waiting?: true
  kind: 'build' | 'haul'
  source: number
  target: number
  item: Item
  amount: number
  carried: number
  elapsedMs: number
}
export interface Warehousing { move?: StoreMove; resite?: ConstructionResite; recoveryAtMs?: number; stores: number[]; job: StorageJob | null; nextAtMs: number }
export function ownedStores(world: World): number[] {
  const main = world.homestead?.store
  return [...new Set([...(main === null || main === undefined ? [] : [main]), ...(world.warehousing?.stores ?? [])])].filter(t => {
    const b = world.buildings[t]
    return b?.kind === 'supplyCrate' && b.storeTier !== undefined
  })
}
export function storeRoom(store: SupplyCrate): number { return Math.max(0, supplyCapacity(store) - store.wood - inventoryTotal(store.inventory)) }
export function warehouseCost(world: World, store: SupplyCrate): { item: Item; amount: number } | null {
  const priority: Item[] = ['wood', 'woodenCrate', ...ITEMS.filter(i => i !== 'wood' && i !== 'woodenCrate')]
  const targets = mainStoreTargets(world)
  for (const surplusOnly of [true, false]) for (const item of priority) {
    const amount = item === 'woodenCrate' ? 2 : STORAGE_BATCH
    if (storedMaterial(store, item) >= amount + (surplusOnly ? targets[item] : 0)) return { item, amount }
  }
  return null
}
export function* warehouseSites(world: World, near = world.homestead?.store ?? world.peace.home): Generator<number> {
  if (near === null) return
  for (let radius = 2; radius <= 10; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
    const x = near % SIZE + dx, y = Math.floor(near / SIZE) + dy, tile = y * SIZE + x
    if (inside(x, y) && !world.water[tile] && !world.buildings[tile] && world.tiles[tile] === null && !warehouseReserved(world).includes(tile) && freeSite(world, [tile])) yield tile
  }
  return
}
export function warehouseSite(world: World, near = world.homestead?.store ?? world.peace.home): number | null {
  const next = warehouseSites(world, near).next()
  return next.done ? null : next.value
}
function moveStock(store: SupplyCrate, item: Item, amount: number): void {
  if (item === 'wood') store.wood += amount
  else store.inventory[item] += amount
}
export function releaseWarehouseActor(world: World): void {
  const h = world.homestead!, p = world.pete
  if (h.cargoBicycle && h.bikeTile === null) h.bikeTile = p.tile
  p.path = []; p.pathRevision = -1
  Object.assign(world.peace, { activity: 'walking', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
function finishStorage(world: World): void {
  const s = world.warehousing!
  s.job = null; s.nextAtMs = world.timeMs + 3000
  releaseWarehouseActor(world)
}
const access = new WeakMap<World, { revision: number; actor: number; plan: unknown; connection: unknown; stores: Map<number, boolean> }>()
function reachableStore(world: World, tile: number): boolean {
  const plan = world.homestead?.expansion.plan, connection = world.homestead?.infrastructure.plan
  let cached = access.get(world)
  if (!cached || cached.revision !== world.topologyRevision || cached.actor !== world.pete.tile || cached.plan !== plan || cached.connection !== connection) {
    cached = { revision: world.topologyRevision, actor: world.pete.tile, plan, connection, stores: new Map() }; access.set(world, cached)
  }
  if (!cached.stores.has(tile)) cached.stores.set(tile, miniApproach(world, tile) !== null)
  return cached.stores.get(tile)!
}
export function receivingStore(world: World, amount: number, preferred = world.homestead?.store, excluded?: number): number | null {
  const candidates = ownedStores(world).filter(t => t !== excluded).filter(t => {
    const b = world.buildings[t]
    return b?.kind === 'supplyCrate' && storeRoom(b) >= amount && reachableStore(world, t)
  })
  if (preferred !== null && preferred !== undefined && candidates.includes(preferred)) return preferred
  return candidates.sort((a, b) => Math.abs(a % SIZE - world.pete.tile % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(world.pete.tile / SIZE)) - Math.abs(b % SIZE - world.pete.tile % SIZE) - Math.abs(Math.floor(b / SIZE) - Math.floor(world.pete.tile / SIZE)) || a - b)[0] ?? null
}
export function canStartWarehouseWork(world: World): boolean {
  const h = world.homestead!
  return world.pete.next === null && !currentProject(world)?.selected && !world.leisure?.carried && !world.developmentLife?.carriedFruit && !world.developmentLife?.carriedWood && !world.developmentLife?.carriedSapling &&
    (h.task === 'returnStock' || h.task === null || !!h.paused) && ['walking', 'waving', 'flowers'].includes(world.peace.activity)
}
function chooseStorage(world: World): StorageJob | null {
  const h = world.homestead!, main = h.store === null ? null : world.buildings[h.store]
  if (main?.kind !== 'supplyCrate') return null
  const targets = mainStoreTargets(world)
  const stores = ownedStores(world), returning = h.task === 'returnStock' ? inventoryTotal(h.carried) : 0
  const blockedReturn = returning > 0 && receivingStore(world, returning) === null
  const waitingBelt = h.infrastructure.links.some(p => p.target === h.store && p.parts.some(part => { const b = world.buildings[part.tile]; return (b?.kind === 'belt' || b?.kind === 'inserter') && b.item !== null }))
  const missingBuffer = stores.some(t => t !== h.store && ITEMS.some(i => storedMaterial(main, i) < targets[i] && storedMaterial(world.buildings[t] as SupplyCrate, i) > 0))
  const crowded = blockedReturn || storeRoom(main) < STORAGE_BATCH && (waitingBelt || missingBuffer)
  if (crowded) {
    const surplus = ITEMS.filter(i => storedMaterial(main, i) > targets[i]).sort((a, b) => storedMaterial(main, b) - targets[b] - storedMaterial(main, a) + targets[a])[0]
    if (surplus) {
      const amount = Math.min(STORAGE_BATCH, storedMaterial(main, surplus) - targets[surplus])
      const target = stores.find(t => t !== h.store && world.buildings[t]?.kind === 'supplyCrate' && storeRoom(world.buildings[t] as SupplyCrate) >= amount && reachableStore(world, t)) ?? null
      if (target !== null && target !== h.store) return { kind: 'haul', source: h.store!, target, item: surplus, amount, carried: 0, elapsedMs: 0 }
    }
    if (stores.length <= MAX_EXTRA_STORES) {
      const cost = warehouseCost(world, main), target = warehouseSite(world)
      if (cost && target !== null) return { kind: 'build', source: h.store!, target, ...cost, carried: 0, elapsedMs: 0 }
    }
  }
  if (returning || world.timeMs < (world.warehousing?.nextAtMs ?? 0)) return null
  for (const item of ITEMS) {
    const amount = Math.min(STORAGE_BATCH, Math.max(0, targets[item] - storedMaterial(main, item)), storeRoom(main))
    if (!amount) continue
    const source = stores.find(t => t !== h.store && world.buildings[t]?.kind === 'supplyCrate' && storedMaterial(world.buildings[t] as SupplyCrate, item) > 0 && reachableStore(world, t))
    if (source !== undefined) return { kind: 'haul', source, target: h.store!, item, amount, carried: 0, elapsedMs: 0 }
  }
  return null
}
export function advanceWarehousing(world: World, delta: number): boolean {
  if (!world.homestead || !world.miniFactory || world.peace.home === null) return false
  let s = world.warehousing
  if (!s?.job) {
    if (s?.move || s?.resite) return false
    if (!canStartWarehouseWork(world)) return false
    const job = chooseStorage(world)
    if (!job) return false
    s = world.warehousing ??= { stores: [], job: null, nextAtMs: 0 }
    s.job = job; releaseWarehouseActor(world)
  }
  const job = s.job!
  if (job.waiting) {
    if (!canStartWarehouseWork(world) || (job.kind === 'build' ? !freeSite(world, [job.target]) && warehouseSite(world) === null : receivingStore(world, job.carried) === null)) return false
    delete job.waiting; releaseWarehouseActor(world)
  }
  if (!job.carried) {
    const source = world.buildings[job.source]
    if (source?.kind !== 'supplyCrate') { finishStorage(world); return false }
    if (!arrived(world, job.source, delta)) return true
    const amount = Math.min(job.amount, storedMaterial(source, job.item))
    if (!amount || job.kind === 'build' && amount !== job.amount) { finishStorage(world); return false }
    moveStock(source, job.item, -amount); job.carried = amount
    return true
  }
  if (job.kind === 'build') {
    if (!freeSite(world, [job.target])) {
      const alternative = warehouseSite(world)
      if (alternative === null) { job.waiting = true; releaseWarehouseActor(world); return false }
      job.target = alternative
    }
    if (!arrived(world, job.target, delta, true)) return true
    job.elapsedMs = Math.min(STORAGE_WORK_MS, job.elapsedMs + delta)
    if (job.elapsedMs < STORAGE_WORK_MS || !freeSite(world, [job.target])) return true
    const tile = job.target
    world.buildings[tile] = { kind: 'supplyCrate', x: tile % SIZE, y: Math.floor(tile / SIZE), wood: 0, inventory: emptyInventory(), storeTier: 0 }
    s.stores.push(tile); world.topologyRevision++
    finishStorage(world); return true
  }
  let target = world.buildings[job.target]
  if (target?.kind !== 'supplyCrate' || !ownedStores(world).includes(job.target) || storeRoom(target) < job.carried || !reachableStore(world, job.target)) {
    const alternative = receivingStore(world, job.carried)
    if (alternative === null) { job.waiting = true; releaseWarehouseActor(world); return false }
    job.target = alternative; target = world.buildings[alternative]
  }
  if (target?.kind !== 'supplyCrate' || !arrived(world, job.target, delta)) return true
  moveStock(target, job.item, job.carried)
  finishStorage(world); return true
}
export function forgetWarehouse(world: World, tile: number): void {
  const s = world.warehousing
  if (!s) return
  const h = world.homestead
  if (h?.task === 'returnStock' && h.target === tile) h.target = h.store
  s.stores = s.stores.filter(t => t !== tile)
  if (s.job && !s.job.carried && (s.job.source === tile || s.job.target === tile)) s.job = null
}
export function warehouseActivity(world: World): string | null {
  const job = world.warehousing?.job
  if (world.warehousing?.resite) return 'Ich versetze meinen bezahlten Bauauftrag an einen freien Standort.'
  const move = world.warehousing?.move
  if (move && !job) return move.phase === 'empty' ? 'Ich bringe die Vorräte in mein neues Lager.' : move.phase === 'remove' ? 'Ich baue das leere alte Lager ab.' : 'Ich baue mein Lager und seine Förderstrecken um.'
  return job ? job.kind === 'build' ? job.carried ? 'Ich baue ein zusätzliches Materiallager.' : 'Ich hole Material für ein zusätzliches Lager.' : 'Ich transportiere Vorräte zwischen meinen Lagern.' : null
}

export function takeWarehouseStock(world: World, tile: number, item: Item, requested: number): number {
  const store = world.buildings[tile]
  if (store?.kind !== 'supplyCrate' || !ownedStores(world).includes(tile)) return 0
  const amount = Math.min(requested, storedMaterial(store, item))
  moveStock(store, item, -amount)
  return amount
}
export function putWarehouseStock(world: World, tile: number, item: Item, amount: number): boolean {
  const store = world.buildings[tile]
  if (store?.kind !== 'supplyCrate' || !ownedStores(world).includes(tile) || storeRoom(store) < amount) return false
  moveStock(store, item, amount)
  return true
}
export function warehouseReserved(world: World): number[] {
  const s = world.warehousing, plan = world.homestead?.expansion.plan
  return [...(s?.job?.kind === 'build' ? [s.job.target] : []), ...(plan ? expansionLayout(plan).map(p => p.tile) : []), ...(s?.move ? [s.move.from, s.move.to, ...s.move.links.flatMap(p => p.parts.map(p => p.tile))] : []), ...(s?.resite ? expansionLayout(s.resite.to).map(p => p.tile) : [])]
}
export function warehouseRemovalError(world: World, tile: number): string | null {
  const s = world.warehousing, b = world.buildings[tile]
  if (s?.move && (tile === s.move.from || tile === s.move.to) && ownedStores(world).includes(tile)) return 'Pete is moving this warehouse. Removal is available after the move.'
  if (s?.move?.phase === 'connect' && b && s.move.links.flatMap(p => p.parts).slice(0, s.move.index).some(p => p.tile === tile && p.kind === b.kind)) return 'Pete is connecting this warehouse. Removal is available after the move.'
  if (s?.resite && b && [...expansionLayout(s.resite.to), ...(world.homestead?.expansion.plan ? expansionLayout(world.homestead.expansion.plan) : [])].some(p => p.tile === tile && p.kind === b.kind)) return 'Pete is relocating these paid parts. Wait until the move is complete.'
  return null
}
