import { advanceWarehousing, canStartWarehouseWork, releaseWarehouseActor, warehouseSites, ownedStores, receivingStore, warehouseCost, takeWarehouseStock, putWarehouseStock, MAX_EXTRA_STORES } from './warehousing'
import { arrived, freeSite } from './homestead'
import { expansionLayout, planChain, chainCost, paidConstructionBlocked } from './homesteadExpansion'
import type { ExpansionPlan, ChainKind } from './homesteadExpansion'
import { planConnection, previewConnection } from './infrastructure'
import { linkCost, linkCurrency, separateCircuitInputsUnlocked } from './infrastructureRules'
import type { Connection, InfrastructurePart, LinkKind } from './infrastructureRules'
import { emptyInventory, inventoryTotal, ITEMS } from './items'
import type { Inventory, Item } from './items'
import { storedMaterial } from './materialPolicy'
import { miniApproach, miniWalk } from './petesWorld'
import { PETE_PROJECTS } from './projectRegistry'
import { SIZE, opposite } from './grid'
import { placeBuilding } from './world'
import type { Belt, Generator, Inserter, PowerPole, SupplyCrate, World } from './world'

const WORK_MS = 4000
type MovablePart = Belt | Inserter | Generator | PowerPole
export interface ConstructionResite {
  to: ExpansionPlan
  rollback?: true
  index: number
  held: MovablePart | null
  elapsedMs: number
  waiting?: true
}
export interface StoreMove {
  from: number
  to: number
  tier: 0 | 1 | 2
  goal: ChainKind | null
  previous: Connection[]
  links: Connection[]
  cost: Inventory
  paid: Inventory
  phase: 'fund' | 'store' | 'retire' | 'connect' | 'empty' | 'remove'
  index: number
  elapsedMs: number
  salvage: Item | null
  waiting?: true
}
const movable = (kind: string) => ['belt', 'inserter', 'powerPole', 'generator'].includes(kind)
const isStore = (world: World, tile: number): SupplyCrate | null => {
  const b = world.buildings[tile]
  return b?.kind === 'supplyCrate' ? b : null
}
function pause(world: World, state: { waiting?: true }, delta: number): boolean {
  if (world.pete.next !== null) { miniWalk(world, world.pete.next, delta); return true }
  if (!state.waiting) { state.waiting = true; releaseWarehouseActor(world) }
  return false
}
function resume(world: World, state: { waiting?: true }): boolean {
  if (!state.waiting) return true
  if (!canStartWarehouseWork(world)) return false
  return true
}
function workAt(world: World, tile: number, state: { elapsedMs: number; waiting?: true }, delta: number, construction = false): boolean {
  if (!arrived(world, tile, delta, construction)) return false
  if (state.waiting) { delete state.waiting; releaseWarehouseActor(world) }
  state.elapsedMs = Math.min(WORK_MS, state.elapsedMs + delta)
  return state.elapsedMs === WORK_MS
}
function resitePlan(world: World): ExpansionPlan | null {
  const h = world.homestead!, from = h.expansion.plan
  if (!h.paused || h.task !== 'buildChain' || !from || from.reuse?.length) return null
  const prefix = expansionLayout(from).slice(0, from.built)
  if (prefix.some(p => !movable(p.kind))) return null
  const shadow = { ...world, homestead: { ...h, expansion: { ...h.expansion, plan: null } } }
  const to = planChain(shadow, from.kind)
  if (!to || to.anchor === from.anchor && to.direction === from.direction || expansionLayout(to).slice(0, from.built).some((p, i) => p.kind !== prefix[i]?.kind)) return null
  return { ...to, built: from.built }
}
function advanceResite(world: World, delta: number): boolean {
  const s = world.warehousing!, r = s.resite!, h = world.homestead!, from = h.expansion.plan
  if (!from) return pause(world, r, delta)
  if (!resume(world, r)) return false
  const oldParts = expansionLayout(from), newParts = expansionLayout(r.to)
  if (r.index === from.built) {
    h.expansion.plan = { ...r.to, built: from.built }
    h.target = newParts[from.built].tile
    delete h.paused; delete s.resite
    world.topologyRevision++; releaseWarehouseActor(world)
    return true
  }
  const forwardTarget = newParts[r.index]
  if (!r.rollback && (world.buildings[forwardTarget.tile] || world.water[forwardTarget.tile] || miniApproach(world, forwardTarget.tile) === null)) {
    if (!r.held && r.index === 0) {
      const alternative = resitePlan(world)
      if (!alternative) return pause(world, r, delta)
      r.to = alternative; r.elapsedMs = 0; world.topologyRevision++
      return true
    }
    if (!r.held) r.index--
    r.rollback = true; r.elapsedMs = 0
  }
  const source = (r.rollback ? newParts : oldParts)[r.index], target = (r.rollback ? oldParts : newParts)[r.index]
  if (!r.held) {
    const b = world.buildings[source.tile]
    if (!b || b.kind !== source.kind || !movable(b.kind) || miniApproach(world, source.tile) === null) return pause(world, r, delta)
    if (!workAt(world, source.tile, r, delta)) return true
    r.held = b as MovablePart
    world.buildings[source.tile] = null; world.topologyRevision++; r.elapsedMs = 0
    return true
  }
  if (world.buildings[target.tile] || world.water[target.tile] || miniApproach(world, target.tile) === null) return pause(world, r, delta)
  if (!workAt(world, target.tile, r, delta, true)) return true
  const held = r.held
  held.x = target.tile % SIZE; held.y = Math.floor(target.tile / SIZE)
  if ('direction' in held) held.direction = target.direction
  if (held.kind === 'belt') held.entry = opposite(target.direction)
  world.buildings[target.tile] = held; world.topologyRevision++
  r.held = null; r.elapsedMs = 0
  if (r.rollback) {
    if (r.index === 0) {
      delete s.resite
      releaseWarehouseActor(world)
    } else r.index--
  } else r.index++
  return true
}
function retiredParts(world: World, previous: Connection[]): InfrastructurePart[] {
  const kinds = new Set(previous.map(p => p.kind))
  const protectedTiles = new Set(world.homestead!.infrastructure.links.filter(p => !kinds.has(p.kind)).flatMap(p => [...p.parts.map(b => b.tile), ...(p.inlet ?? []), ...(p.receiver === undefined ? [] : [p.receiver])]))
  return [...new Map(previous.flatMap(p => p.parts).filter(p => (p.kind === 'belt' || p.kind === 'inserter') && !protectedTiles.has(p.tile)).map(p => [p.tile, p])).values()]
}
function mainLinks(world: World): Connection[] {
  const h = world.homestead!
  return h.infrastructure.links.filter(p => p.source === h.store || p.target === h.store || p.kind === 'circuitCableFeed')
}
const linkOrder: LinkKind[] = ['gearFeed', 'cableFeed', 'circuitFeed', 'cableReturn', 'circuitCableFeed', 'circuitReturn', 'copper', 'gearReturn', 'iron', 'woodReturn', 'panelReturn', 'crateReturn']
export function blockedStoreConnection(world: World): LinkKind | null {
  const h = world.homestead!, e = h.expansion, levels = world.personality.paths
  if (separateCircuitInputsUnlocked(world) && !h.infrastructure.links.some(p => p.kind === 'circuitCableFeed')) return planConnection(world, 'circuitCableFeed') === null ? 'circuitCableFeed' : null
  const wanted: LinkKind[] = []
  if (h.cargoBicycle) {
    if (e.furnace !== null) wanted.push('iron')
    if (h.cargoBicycle && e.gearAssembler !== null) wanted.push('gearFeed', 'gearReturn')
  }
  if (world.flightProject?.phase === 'complete' && levels.inventor.level >= 4 && e.copperMiner !== null) {
    wanted.push('copper', 'cableFeed', 'cableReturn')
    if (e.circuitAssembler !== null) wanted.push('circuitFeed', 'circuitReturn')
  }
  // Preserve the established build order: a later blocked lane must not preempt
  // an earlier connection that can still be built in place.
  const next = wanted.find(kind => !h.infrastructure.links.some(p => p.kind === kind))
  return next && planConnection(world, next) === null ? next : null
}
function wantedChain(world: World): ChainKind | null {
  const h = world.homestead!, e = h.expansion
  if (h.task === 'buildChain' && h.paused && e.plan) {
    const part = expansionLayout(e.plan)[e.plan.built]
    return paidConstructionBlocked(world) && part?.tile === h.store ? e.plan.kind : null
  }
  if (h.task || world.personality.paths.eco.level < 4 || h.millBuilt !== 3 || h.store === null || isStore(world, h.store)?.storeTier === 0) return null
  const kind = e.forestry === null ? 'forestry' : e.assembler === null ? 'crates' : null
  return kind && !planChain(world, kind) ? kind : null
}
function availableStocks(world: World): Inventory {
  const total = emptyInventory()
  for (const t of ownedStores(world).filter(t => miniApproach(world, t) !== null)) {
    const store = isStore(world, t)!
    for (const item of ITEMS) total[item] += storedMaterial(store, item)
  }
  return total
}
function moveCost(world: World, links: Pick<Connection, 'kind'>[], tier: 0 | 1 | 2, future: Partial<Inventory>): Inventory | null {
  const total = availableStocks(world), base = emptyInventory()
  for (const link of links) base[linkCurrency(link.kind)] += linkCost(link.kind)
  if (tier >= 1) base.woodPanel += 8
  if (tier === 2) base.woodenCrate += 4
  for (const item of ['wood', 'woodenCrate', ...ITEMS.filter(i => i !== 'wood' && i !== 'woodenCrate')] as Item[]) {
    const cost = { ...base, [item]: base[item] + (item === 'woodenCrate' ? 2 : 6) }
    if (ITEMS.every(i => total[i] >= cost[i] + (future[i] ?? 0))) return cost
  }
  return null
}
const moveFailures = new WeakMap<World, Set<string>>()
export function planStoreMove(world: World, retained?: StoreMove): StoreMove | null {
  const h = world.homestead, main = h?.store === null || h?.store === undefined ? null : isStore(world, h.store)
  if (!h || !main || (world.warehousing?.stores.length ?? 0) >= MAX_EXTRA_STORES) return null
  const link = retained ? retained.links.find(p => !retained.previous.some(old => old.kind === p.kind))?.kind ?? null : blockedStoreConnection(world), chain = retained ? retained.goal : wantedChain(world)
  if (!link && !chain) return null
  const previous = mainLinks(world), from = h.store!, oldParts = retiredParts(world, previous)
  const kinds = [...new Set([...previous.map(p => p.kind), ...(link ? [link] : [])])].sort((a, b) => linkOrder.indexOf(a) - linkOrder.indexOf(b))
  if (!retained && !moveCost(world, kinds.map(kind => ({ kind })), main.storeTier ?? 0, {})) return null
  const stock = availableStocks(world)
  const reservations = JSON.stringify(PETE_PROJECTS.map(p => { const v = world[p.state]; return v ? [v.tiles, v.spots, v.phase] : null }))
  const key = [reservations, world.topologyRevision, world.pete.tile, from, link, chain, h.expansion.plan?.built, h.bikeTile, ...ITEMS.map(i => stock[i])].join(':')
  let failures = moveFailures.get(world)
  if (!failures) { failures = new Set(); moveFailures.set(world, failures) }
  if (failures.has(key)) return null
  let tried = 0
  const planningWorld = { ...world, warehousing: world.warehousing ? { ...world.warehousing, move: undefined, resite: undefined } : undefined }
  for (const to of warehouseSites(planningWorld, from)) {
    if (tried++ === 32) break
    const buildings = [...world.buildings]
    for (const part of oldParts) buildings[part.tile] = null
    buildings[to] = { kind: 'supplyCrate', x: to % SIZE, y: Math.floor(to / SIZE), wood: 0, inventory: emptyInventory(), storeTier: main.storeTier ?? 0 }
    const continuing = h.infrastructure.links.filter(p => !previous.some(old => old.kind === p.kind))
    let candidate: World = { ...world, buildings, warehousing: undefined, homestead: { ...h, store: to, infrastructure: { ...h.infrastructure, links: continuing, plan: null } } }
    // Planning must not treat Pete's temporary funding position as a permanent obstacle.
    // The home approach must be reachable from his real position before using it in the probe.
    const planningSpot = world.peace.home === null ? null : miniApproach(candidate, world.peace.home)
    if (planningSpot === null) continue
    candidate = { ...candidate, pete: { ...world.pete, tile: planningSpot, x: planningSpot % SIZE, y: Math.floor(planningSpot / SIZE), next: null, path: [] } }
    let future: Partial<Inventory> = {}
    if (chain) {
      const probe: World = { ...candidate, buildings: [...candidate.buildings], homestead: { ...candidate.homestead!, expansion: { ...h.expansion, plan: null } } }
      probe.buildings[from] = null
      if (h.expansion.plan) {
        probe.homestead!.expansion.plan = h.expansion.plan
        if (paidConstructionBlocked(probe)) continue
      } else {
        const plan = planChain(probe, chain)
        if (!plan) continue
        candidate = { ...candidate, homestead: { ...candidate.homestead!, expansion: { ...h.expansion, plan } } }
        future = chainCost(chain)
      }
    }
    const links: Connection[] = []
    for (const kind of kinds) {
      const plan = planConnection(candidate, kind)
      if (!plan) break
      links.push(plan); candidate = previewConnection(candidate, plan)
    }
    if (links.length !== kinds.length) continue
    const tier = main.storeTier ?? 0, cost = retained?.cost ?? moveCost(world, links, tier, future)
    if (!cost) continue
    return { from, to, tier, goal: chain, previous: structuredClone(previous), links, cost, paid: emptyInventory(), phase: 'fund', index: 0, elapsedMs: 0, salvage: null }
  }
  if (failures.size >= 64) failures.clear()
  failures.add(key)
  return null
}
function requestCapacity(world: World, source: number): boolean {
  const s = world.warehousing!, store = isStore(world, source)
  const cost = store ? warehouseCost(world, store) : null, site = warehouseSites(world, source).next()
  if (!cost || site.done || s.stores.length >= MAX_EXTRA_STORES) return false
  s.job = { kind: 'build', source, target: site.value, ...cost, carried: 0, elapsedMs: 0 }
  return true
}
function advanceMove(world: World, delta: number): boolean {
  const s = world.warehousing!, m = s.move!, h = world.homestead!
  if (!resume(world, m)) return false
  if (h.store === m.from && !isStore(world, m.from)) return pause(world, m, delta)
  if ((m.phase === 'retire' || m.phase === 'connect') && !isStore(world, m.to)) return pause(world, m, delta)
  if (m.salvage) {
    const target = receivingStore(world, 1)
    if (target === null) return requestCapacity(world, m.from) || pause(world, m, delta)
    if (miniApproach(world, target) === null) return pause(world, m, delta)
    if (!arrived(world, target, delta)) return true
    if (putWarehouseStock(world, target, m.salvage, 1)) m.salvage = null
    return true
  }
  if (m.phase === 'fund') {
    const item = ITEMS.find(i => m.paid[i] < m.cost[i])
    if (!item) { m.phase = 'store'; m.elapsedMs = 0; return true }
    const source = ownedStores(world).find(t => storedMaterial(isStore(world, t)!, item) > 0 && miniApproach(world, t) !== null)
    if (source === undefined) return pause(world, m, delta)
    if (!arrived(world, source, delta)) return true
    m.paid[item] += takeWarehouseStock(world, source, item, Math.min(6, m.cost[item] - m.paid[item]))
    delete m.waiting
    return true
  }
  if (m.phase === 'store') {
    if (!freeSite(world, [m.to], true)) {
      const alternative = planStoreMove(world, m)
      if (!alternative) return pause(world, m, delta)
      s.move = { ...alternative, paid: m.paid, phase: 'store', elapsedMs: m.elapsedMs }
      world.topologyRevision++; releaseWarehouseActor(world)
      return true
    }
    if (!workAt(world, m.to, m, delta, true)) return true
    world.buildings[m.to] = { kind: 'supplyCrate', x: m.to % SIZE, y: Math.floor(m.to / SIZE), wood: 0, inventory: emptyInventory(), storeTier: m.tier }
    s.stores.push(m.to); world.topologyRevision++
    m.phase = 'retire'; m.index = 0; m.elapsedMs = 0
    return true
  }
  if (m.phase === 'retire') {
    const parts = retiredParts(world, m.previous), part = parts[m.index]
    if (!part) { m.phase = 'connect'; m.index = 0; return true }
    const b = world.buildings[part.tile]
    if (!b || b.kind !== part.kind) { m.index++; m.elapsedMs = 0; return true }
    if (miniApproach(world, part.tile) === null) return pause(world, m, delta)
    if (!workAt(world, part.tile, m, delta)) return true
    if (b.kind === 'belt' || b.kind === 'inserter') m.salvage = b.item
    world.buildings[part.tile] = null; world.topologyRevision++
    m.index++; m.elapsedMs = 0
    return true
  }
  if (m.phase === 'connect') {
    const parts = m.links.flatMap(p => p.parts), part = parts[m.index]
    if (!part) {
      h.store = m.to
      h.infrastructure.links = [...h.infrastructure.links.filter(p => !m.previous.some(old => old.kind === p.kind)), ...m.links]
      s.stores = [...s.stores.filter(t => t !== m.to), m.from]
      if (h.task === 'returnStock' && h.target === m.from) h.target = m.to
      if (h.expansion.improvements.storeShelves === m.from) h.expansion.improvements.storeShelves = m.to
      for (const definition of PETE_PROJECTS) { const project = world[definition.state]; if (project?.crate === m.from) project.crate = m.to }
      world.topologyRevision++; m.phase = 'empty'; m.index = 0
      return true
    }
    if (world.buildings[part.tile] || world.water[part.tile] || miniApproach(world, part.tile) === null) return pause(world, m, delta)
    if (!workAt(world, part.tile, m, delta, true)) return true
    if (!freeSite(world, [part.tile], true)) return pause(world, m, delta)
    if (part.kind === 'inserter' && !world.research.unlocked.includes('logistics1')) world.research.unlocked.push('logistics1')
    if (!placeBuilding(world, part.tile % SIZE, Math.floor(part.tile / SIZE), part.kind, part.direction)) return pause(world, m, delta)
    m.index++; m.elapsedMs = 0
    return true
  }
  const old = isStore(world, m.from)
  if (!old) return pause(world, m, delta)
  if (m.phase === 'empty') {
    const item = ITEMS.find(i => storedMaterial(old, i) > 0)
    if (!item) { m.phase = 'remove'; return true }
    const amount = Math.min(6, storedMaterial(old, item)), target = receivingStore(world, amount, m.to, m.from)
    if (target === null) return requestCapacity(world, m.to) || pause(world, m, delta)
    s.job = { kind: 'haul', source: m.from, target, item, amount, carried: 0, elapsedMs: 0 }
    return true
  }
  if (old.wood || inventoryTotal(old.inventory)) { m.phase = 'empty'; m.elapsedMs = 0; return true }
  if (!workAt(world, m.from, m, delta)) return true
  world.buildings[m.from] = null
  s.stores = s.stores.filter(t => t !== m.from)
  delete s.move; s.recoveryAtMs = world.timeMs + 300000; world.topologyRevision++; releaseWarehouseActor(world)
  return true
}
export function advanceStorageRecovery(world: World, delta: number): boolean {
  const h = world.homestead
  if (!h || !world.miniFactory) return false
  const s = world.warehousing
  if (s?.job) return advanceWarehousing(world, delta)
  if (s?.resite) return advanceResite(world, delta)
  if (s?.move) return advanceMove(world, delta)
  if (!canStartWarehouseWork(world) || h.task && !(h.paused && h.task === 'buildChain')) return false
  if (h.paused && paidConstructionBlocked(world)) {
    const to = resitePlan(world)
    if (to) {
      const state = world.warehousing ??= { stores: [], job: null, nextAtMs: 0 }
      state.resite = { to, index: 0, held: null, elapsedMs: 0 }
      releaseWarehouseActor(world); return true
    }
  }
  if (world.timeMs < (s?.recoveryAtMs ?? 0)) return false
  const move = planStoreMove(world)
  if (!move) return false
  const state = world.warehousing ??= { stores: [], job: null, nextAtMs: 0 }
  state.move = move; releaseWarehouseActor(world)
  return true
}
