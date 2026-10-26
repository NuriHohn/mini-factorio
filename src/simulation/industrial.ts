import { arrived, begin, finish, freeSite, materialStore } from './homestead'
import { expansionLayout, ironSite, planChain } from './homesteadExpansion'
import type { ChainKind, ExpansionPlan } from './homesteadExpansion'
import { findBeltRoute } from './beltRouting'
import { deliverItem } from './transport'
import { inventoryTotal } from './items'
import { supplyCapacity } from './supplyCrate'
import { inside, SIZE, offsets } from './world'
import type { Direction, World } from './world'
export function industrialLayout(plan: ExpansionPlan) {
  const a = plan.anchor, row = plan.direction === 'north' ? -SIZE : SIZE
  if (plan.kind === 'coalMining') {
    const route = plan.route ?? [], poles = [...new Set(route.filter((_, i) => i % 3 === 0 || i === route.length - 1).map(tile => tile + row))]
    const facing = (from: number, to: number): Direction => to === from + 1 ? 'east' : to === from - 1 ? 'west' : to > from ? 'south' : 'north'
    return [...poles.map(tile => ({ tile, kind: 'powerPole' as const, direction: 'east' as const })), { tile: route.at(-1)!, kind: 'fuelDepot' as const, direction: 'east' as const }, ...route.slice(1, -1).map((tile, i) => ({ tile, kind: 'belt' as const, direction: facing(tile, route[i + 2]) })), { tile: a, kind: 'miner' as const, direction: facing(a, route[1]) }]
  }
  if (plan.kind === 'coalFeed') return [{ tile: a, kind: 'inserter' as const, direction: plan.direction }]
  if (plan.kind === 'briquettes' || plan.kind === 'steamWorkshop' || plan.kind === 'steamHoist') return [{ tile: a + row, kind: 'powerPole' as const, direction: 'east' as const }, { tile: a, kind: plan.kind === 'briquettes' ? 'assembler' as const : plan.kind, direction: 'east' as const }]
  return null
}
export function planIndustrial(world: World, kind: ChainKind): ExpansionPlan | null {
  const e = world.homestead!.expansion, engine = e.steamEngine === null ? null : world.buildings[e.steamEngine]
  if (engine?.kind !== 'steamEngine') return null
  const directions = ['east', 'west', 'south', 'north'] as const
  if (kind === 'coalFeed') {
    if (e.fuelStore === null || world.buildings[e.fuelStore]?.kind !== 'fuelDepot') return null
    const direction = directions.find(d => e.fuelStore! + 2 * (offsets[d].y * SIZE + offsets[d].x) === e.steamEngine)
    if (!direction) return null
    const plan = { kind, anchor: (e.fuelStore + e.steamEngine!) / 2, direction, built: 0 }
    return freeSite(world, [plan.anchor]) ? plan : null
  }
  if (kind === 'coalMining') {
    for (const feed of directions) {
      const end = e.steamEngine! - 2 * (offsets[feed].y * SIZE + offsets[feed].x), gap = (end + e.steamEngine!) / 2
      if (!inside(end % SIZE, Math.floor(end / SIZE)) || Math.abs(end % SIZE - engine.x) > 2 || !freeSite(world, [end, gap])) continue
      const ores = world.tiles.flatMap((ore, tile) => ore === 'coal' && !world.buildings[tile] && !world.water[tile] && Math.max(Math.abs(tile % SIZE - engine.x), Math.abs(Math.floor(tile / SIZE) - engine.y)) <= 11 ? [tile] : [])
      ores.sort((a, b) => Math.abs(a % SIZE - end % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(end / SIZE)) - Math.abs(b % SIZE - end % SIZE) - Math.abs(Math.floor(b / SIZE) - Math.floor(end / SIZE)) || a - b)
      for (const anchor of ores) {
        const result = findBeltRoute({ x: anchor % SIZE, y: Math.floor(anchor / SIZE) }, { x: end % SIZE, y: Math.floor(end / SIZE) }, feed, (x, y) => !world.water[y * SIZE + x] && !world.buildings[y * SIZE + x] && y * SIZE + x !== gap, 400)
        if (!result.points || result.points.length < 2 || result.points.length > 13) continue
        const route = result.points.map(p => p.y * SIZE + p.x)
        for (const direction of ['north', 'south'] as const) {
          const plan = { kind, anchor, direction, built: 0, route }, tiles = expansionLayout(plan).map(p => p.tile)
          if (!tiles.includes(gap) && new Set(tiles).size === tiles.length && tiles.every(tile => inside(tile % SIZE, Math.floor(tile / SIZE)) && Math.abs(tile % SIZE - anchor % SIZE) <= 13) && freeSite(world, [...tiles, gap])) return plan
        }
      }
    }
    return null
  }
  for (let radius = 2; radius <= 4; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
    const x = engine.x + dx, y = engine.y + dy
    if (x < 1 || x >= SIZE - 1 || y < 1 || y >= SIZE - 1) continue
    for (const direction of ['north', 'south'] as const) {
      const plan = { kind, anchor: y * SIZE + x, direction, built: 0 }, parts = expansionLayout(plan)
      const pole = parts[0].tile, enginePoles = world.buildings.flatMap((b, i) => b?.kind === 'powerPole' && (b.x - engine.x) ** 2 + (b.y - engine.y) ** 2 <= 9 ? [i] : [])
      if (enginePoles.some(i => (i % SIZE - pole % SIZE) ** 2 + (Math.floor(i / SIZE) - Math.floor(pole / SIZE)) ** 2 <= 36) && freeSite(world, parts.map(p => p.tile))) return plan
    }
  }
  return null
}
export function chooseIndustrial(world: World): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)!, level = world.personality.paths.industrial.level
  const engine = e.steamEngine === null ? null : world.buildings[e.steamEngine], depot = e.fuelStore === null ? null : world.buildings[e.fuelStore]
  const workshop = e.steamWorkshop === null ? null : world.buildings[e.steamWorkshop]
  const feeder = e.coalInserter === null ? null : world.buildings[e.coalInserter]
  const next: ChainKind | null = e.steamEngine === null && level >= 2 ? 'steam' : e.coalMiner === null && level >= 3 && engine?.kind === 'steamEngine' ? 'coalMining' : e.coalInserter === null && depot?.kind === 'fuelDepot' ? 'coalFeed' : e.briquetteAssembler === null && level >= 3 && e.coalInserter !== null ? 'briquettes' : e.steamWorkshop === null && level >= 4 && e.briquetteAssembler !== null && world.produced.coalBriquette >= 4 ? 'steamWorkshop' : e.steamHoist === null && level >= 5 && workshop?.kind === 'steamWorkshop' && workshop.cycles >= 10 ? 'steamHoist' : null
  const plan = next && (store.inventory.coal >= 6 || level >= 3) ? planChain(world, next) : null
  if (plan && store.inventory.coal >= 6) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  // Reserve commissioning fuel for a buildable next project instead of burning
  // each mined batch in the test load before the six-coal reserve can accumulate.
  if (!plan && engine?.kind === 'steamEngine' && (engine.fuel + engine.briquettes <= 1 || engine.fuel + engine.briquettes <= 4 && feeder?.kind !== 'inserter') && (store.inventory.coal >= 2 || store.inventory.coalBriquette >= 2)) { begin(world, 'fetchSteam', h.store); return true }
  if (depot?.kind === 'fuelDepot') {
    if (store.inventory.coal < 12 && depot.inventory.coal >= 2 && inventoryTotal(store.inventory) + store.wood + 2 <= supplyCapacity(store)) { begin(world, 'takeCoal', e.fuelStore); return true }
    const stamp = e.briquetteAssembler === null ? null : world.buildings[e.briquetteAssembler]
    if (stamp?.kind === 'assembler' && store.inventory.coalBriquette + depot.inventory.coalBriquette < 8) {
      if (stamp.output.coalBriquette) { begin(world, 'takeBriquettes', e.briquetteAssembler); return true }
      if (!stamp.job && stamp.input.coal < 2 && store.inventory.coal >= 2) { begin(world, 'fetchStamp', h.store); return true }
    }
    if (store.inventory.coalBriquette && inventoryTotal(depot.inventory) < 24) { begin(world, 'fetchFuel', h.store); return true }
  }
  if (store.inventory.coal < 24 && inventoryTotal(store.inventory) + store.wood + 3 <= supplyCapacity(store)) { const tile = ironSite(world, 'coal'); if (tile !== null) { begin(world, 'mineCoal', tile); return true } }
  return false
}
export function advanceIndustrial(world: World, delta: number): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (!['takeCoal', 'fetchStamp', 'feedStamp', 'takeBriquettes', 'fetchFuel', 'storeFuel'].includes(h.task ?? '')) return false
  if (!store || !arrived(world, h.target, delta)) return true
  const depot = e.fuelStore === null ? null : world.buildings[e.fuelStore], stamp = e.briquetteAssembler === null ? null : world.buildings[e.briquetteAssembler]
  if (h.task === 'storeFuel') {
    if (depot?.kind === 'fuelDepot') for (const fuel of ['coalBriquette', 'coal'] as const) while (h.carried[fuel] && deliverItem(depot, fuel, 'east')) h.carried[fuel]--
    if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world)
  } else if (h.task === 'takeCoal') {
    if (depot?.kind !== 'fuelDepot' || depot.inventory.coal < 2) { finish(world); return true }
    depot.inventory.coal -= 2; h.carried.coal = 2; begin(world, 'returnStock', h.store)
  } else if (h.task === 'fetchFuel') {
    const amount = Math.min(2, store.inventory.coalBriquette)
    if (!amount) { finish(world); return true }
    store.inventory.coalBriquette -= amount; h.carried.coalBriquette = amount; begin(world, 'storeFuel', e.fuelStore)
  } else if (stamp?.kind !== 'assembler') {
    if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world)
  } else if (h.task === 'fetchStamp') {
    const amount = Math.max(0, 2 - stamp.input.coal)
    if (!amount || store.inventory.coal < amount || stamp.job) { finish(world); return true }
    store.inventory.coal -= amount; h.carried.coal = amount; begin(world, 'feedStamp', e.briquetteAssembler)
  } else if (h.task === 'feedStamp') {
    while (h.carried.coal && deliverItem(stamp, 'coal', 'east')) h.carried.coal--
    if (h.carried.coal) begin(world, 'returnStock', h.store); else finish(world)
  } else {
    const amount = Math.max(0, Math.min(2, stamp.output.coalBriquette, 8 - store.inventory.coalBriquette - (depot?.kind === 'fuelDepot' ? depot.inventory.coalBriquette : 0)))
    if (!amount) { finish(world); return true }
    stamp.output.coalBriquette -= amount; h.carried.coalBriquette = amount; begin(world, 'storeFuel', e.fuelStore ?? h.store)
  }
  return true
}
