import { arrived, begin, finish, freeSite, materialStore } from './homestead'
import { inventoryTotal } from './items'
import { deliverItem } from './transport'
import { DIRECTIONS, offsets, placeBuilding, SIZE } from './world'
import type { World } from './world'
import type { LoadingSite } from './infrastructureRules'

export function loadingParts(site: LoadingSite) { return [{ tile: site.pole, kind: 'powerPole' as const }, { tile: site.output, kind: 'fuelDepot' as const }, { tile: site.input, kind: 'fuelDepot' as const }] }
export function planLoading(world: World): LoadingSite | null {
  const hoist = world.homestead!.expansion.steamHoist
  if (hoist === null) return null
  const reaches = [1, 2].flatMap(n => DIRECTIONS.map(d => ({ d, n })))
  for (const { d, n } of reaches) {
    const step = (offsets[d].y * SIZE + offsets[d].x) * n, input = hoist + step
    const outputs = [hoist - step, ...reaches.map(({ d, n }) => hoist + (offsets[d].y * SIZE + offsets[d].x) * n)]
    for (const output of outputs) {
      if (output === input) continue
      if ([input, output].some(t => t < 0 || t >= SIZE * SIZE || Math.abs(t % SIZE - hoist % SIZE) > 2 || world.tiles[t] !== null)) continue
      for (const direction of DIRECTIONS) {
        const pole = hoist + offsets[direction].y * SIZE + offsets[direction].x
        if ([input, output].includes(pole) || pole < 0 || pole >= SIZE * SIZE || Math.abs(pole % SIZE - hoist % SIZE) > 1) continue
        if ((freeSite(world, [input, output]) && world.buildings[pole]?.kind === 'powerPole') || freeSite(world, [input, output, pole])) return { input, output, pole }
      }
    }
  }
  return null
}
export function chooseLoading(world: World): boolean {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world), e = h.expansion
  const hoist = e.steamHoist === null ? null : world.buildings[e.steamHoist]
  if (!store || hoist?.kind !== 'steamHoist' || hoist.cycles < 1) return false
  const site = s.loading ?? (store.inventory.coal >= 6 ? planLoading(world) : null)
  if (site && loadingParts(site).some(p => world.buildings[p.tile]?.kind !== p.kind) && (world.buildings[site.input]?.kind === 'fuelDepot' || store.inventory.coal >= 6)) { s.loadingPlan = site; s.built = 0; begin(world, 'buildLoading', h.store); return true }
  if (!s.loading || e.fuelStore === null) return false
  const input = world.buildings[s.loading.input], output = world.buildings[s.loading.output], depot = world.buildings[e.fuelStore]
  if (input?.kind !== 'fuelDepot' || output?.kind !== 'fuelDepot' || depot?.kind !== 'fuelDepot') return false
  if (inventoryTotal(output.inventory) && inventoryTotal(depot.inventory) <= 22) { begin(world, 'takeLoading', s.loading.output); return true }
  if (inventoryTotal(input.inventory) < 6 && inventoryTotal(depot.inventory) >= 10) { begin(world, 'fetchLoading', e.fuelStore); return true }
  return false
}
export function advanceLoading(world: World, delta: number): boolean {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world)
  if (!['buildLoading', 'fetchLoading', 'feedLoading', 'takeLoading'].includes(h.task ?? '')) return false
  if (h.task === 'buildLoading') {
    const site = s.loadingPlan!, parts = loadingParts(site)
    const lost = parts.findIndex((p, i) => i < s.built && world.buildings[p.tile]?.kind !== p.kind)
    if (lost >= 0) { s.built = lost; h.elapsedMs = 0 }
    while (s.built < parts.length && world.buildings[parts[s.built].tile]?.kind === parts[s.built].kind) s.built++
    const part = parts[s.built]
    if (!part) { s.loading = site; s.loadingPlan = null; s.built = 0; finish(world); return true }
    if (world.rebuilding?.jobs.some(job => job.tile === part.tile)) { world.rebuilding.active = part.tile; return true }
    if (world.buildings[site.input]?.kind !== 'fuelDepot' && !h.carried.coal) {
      if (!store || !arrived(world, h.store, delta)) return true
      if (store.inventory.coal < 6) { s.loadingPlan = null; s.built = 0; finish(world); return true }
      store.inventory.coal -= 6; h.carried.coal = 6
    }
    if (world.buildings[part.tile] || world.water[part.tile] || !arrived(world, part.tile, delta, true)) return true
    h.elapsedMs = Math.min(4000, h.elapsedMs + delta)
    if (h.elapsedMs !== 4000 || !freeSite(world, [part.tile], true) || !placeBuilding(world, part.tile % SIZE, Math.floor(part.tile / SIZE), part.kind, 'east')) return true
    const b = world.buildings[part.tile]
    if (part.tile === site.input && b?.kind === 'fuelDepot') { b.inventory.coal = h.carried.coal; h.carried.coal = 0 }
    h.elapsedMs = 0; s.built++; return true
  }
  if (!s.loading || !arrived(world, h.target, delta)) return true
  const target = h.target === null ? null : world.buildings[h.target]
  if (h.task === 'feedLoading') {
    if (target?.kind !== 'fuelDepot') { begin(world, 'returnStock', h.store); return true }
    for (const item of ['coal', 'coalBriquette'] as const) while (h.carried[item] && deliverItem(target, item, 'east')) h.carried[item]--
    if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world)
  } else {
    if (target?.kind !== 'fuelDepot') { finish(world); return true }
    if (h.task === 'fetchLoading' && inventoryTotal(target.inventory) < 10) { finish(world); return true }
    const item = target.inventory.coalBriquette ? 'coalBriquette' : 'coal', count = Math.min(2, target.inventory[item])
    if (!count) { finish(world); return true }
    target.inventory[item] -= count; h.carried[item] = count
    begin(world, h.task === 'fetchLoading' ? 'feedLoading' : 'storeFuel', h.task === 'fetchLoading' ? s.loading.input : h.expansion.fuelStore)
  }
  return true
}
// One real item rides the existing hoist clock; an empty healthy loader retains the old test load.
export function prepareLoading(world: World, tile: number, start: boolean): boolean {
  const h = world.homestead, s = h?.infrastructure, site = s?.loading
  if (!h || !s || !site || h.expansion.steamHoist !== tile) return true
  const input = world.buildings[site.input], output = world.buildings[site.output]
  if (input?.kind !== 'fuelDepot' || output?.kind !== 'fuelDepot' || world.buildings[site.pole]?.kind !== 'powerPole') return false
  if (s.loadingCargo || inventoryTotal(input.inventory)) {
    if (inventoryTotal(output.inventory) >= 24) return false
    if (!s.loadingCargo && start) { const item = input.inventory.coalBriquette ? 'coalBriquette' : 'coal'; input.inventory[item]--; s.loadingCargo = item }
  }
  return true
}
export function completeLoading(world: World, tile: number): void {
  const h = world.homestead, s = h?.infrastructure, site = s?.loading
  if (!h || !s?.loadingCargo || !site || h.expansion.steamHoist !== tile) return
  const output = world.buildings[site.output]
  if (output?.kind === 'fuelDepot') { output.inventory[s.loadingCargo]++; s.loadingCargo = null }
}
