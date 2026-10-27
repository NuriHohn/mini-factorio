import { findBeltRoute } from './beltRouting'
import { arrived, begin, finish, freeSite, materialStore } from './homestead'
import { inventoryTotal } from './items'
import { neighboringTiles } from './navigation'
import { miniApproach } from './petesWorld'
import { miniWalk } from './petesWorld'
import { awardActivity } from './personality'
import { projectCandidates } from './secretProject'
import { DIRECTIONS, inside, offsets, placeBuilding, SIZE } from './world'
import type { Direction, World } from './world'
import type { Connection, InfrastructurePart, LinkKind, WheelSite } from './infrastructureRules'

function next(tile: number, d: Direction, n = 1): number | null {
  const v = offsets[d], x = tile % SIZE + v.x * n, y = Math.floor(tile / SIZE) + v.y * n
  return inside(x, y) ? y * SIZE + x : null
}
export function facing(a: number, b: number): Direction { return b === a + 1 ? 'east' : b === a - 1 ? 'west' : b > a ? 'south' : 'north' }
export function linkEndpoints(world: World, kind: LinkKind): [number | null, number | null] {
  const h = world.homestead!
  return kind === 'iron' ? [h.expansion.furnace, h.store] : kind === 'gearFeed' ? [h.store, h.expansion.gearAssembler] : [h.expansion.gearAssembler, h.store]
}
function open(world: World, tile: number): boolean { return !world.buildings[tile] && !world.water[tile] && world.tiles[tile] === null }
function accessibleLayout(world: World, plan: Connection): boolean {
  const h = world.homestead!
  return freeSite({ ...world, homestead: { ...h, infrastructure: { ...h.infrastructure, plan } } }, plan.parts.map(p => p.tile), true)
}
const plans = new WeakMap<World, Map<LinkKind, { revision: string; plan: Connection | null }>>()
export function planConnection(world: World, kind: LinkKind): Connection | null {
  const [source, target] = linkEndpoints(world, kind)
  if (source === null || target === null || !world.buildings[source] || !world.buildings[target]) return null
  let cache = plans.get(world)
  if (!cache) { cache = new Map(); plans.set(world, cache) }
  const old = cache.get(kind)
  const revision = `${world.topologyRevision}:${world.pete.tile}:${world.homestead!.bikeTile}`
  if (old?.revision === revision) return old.plan
  let chosen: Connection | null = null
  const gear = world.homestead!.expansion.gearAssembler
  const gearArm = gear === null ? null : next(gear, 'east')
  const reserved = kind !== 'gearReturn' && gearArm !== null ? [gearArm, next(gearArm, 'east'), next(gearArm, 'north'), next(gearArm, 'south')] : []
  if (kind !== 'gearFeed' && gear !== null) reserved.push(next(gear, 'west'))
  if (kind !== 'gearFeed') reserved.push(next(target, 'east'), next(target, 'east', 2), ...(gear === null ? [] : [next(gear, 'south')]))
  const available = (tile: number) => !reserved.includes(tile) && open(world, tile)
  outer: for (const d of kind === 'gearFeed' ? ['east', 'south', 'west', 'north'] as const : ['east'] as const) {
    const arm = next(source, d), start = next(source, d, 2)
    if (arm === null || start === null || !available(arm) || !available(start)) continue
    const ends = neighboringTiles(target).filter(tile => kind !== 'gearFeed' || tile !== next(target, 'east'))
    if (kind === 'iron') ends.sort((a, b) => Number(b === next(target, 'west')) - Number(a === next(target, 'west')))
    for (const end of ends) {
      if (!available(end)) continue
      const route = findBeltRoute({ x: start % SIZE, y: Math.floor(start / SIZE) }, { x: end % SIZE, y: Math.floor(end / SIZE) }, facing(end, target), (x, y, outgoing) => {
        const tile = y * SIZE + x
        const besideArm = d === 'east' || d === 'west' ? [next(arm, 'north'), next(arm, 'south')] : [next(arm, 'east'), next(arm, 'west')]
        return tile !== arm && !besideArm.includes(tile) && available(tile) && (tile !== start || outgoing !== ({ east: 'west', west: 'east', north: 'south', south: 'north' } as const)[d])
      }, 500).points
      if (!route || route.length > 18) continue
      const tiles = route.map(p => p.y * SIZE + p.x)
      const parts: InfrastructurePart[] = [{ tile: arm, kind: 'inserter', direction: d }, ...tiles.map((tile, i) => ({ tile, kind: 'belt' as const, direction: facing(tile, tiles[i + 1] ?? target) }))]
      // A local ordinary generator/pole powers the pickup arm; belts need no power.
      const poles = world.buildings.flatMap((_, tile) => Math.max(Math.abs(tile % SIZE - arm % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(arm / SIZE))) <= 3 ? [tile] : [])
      poles.sort((a, b) => Math.abs(a - arm) - Math.abs(b - arm))
      for (const pole of poles) for (const generator of neighboringTiles(pole)) {
        if (!available(pole) || !available(generator) || pole === generator || parts.some(p => p.tile === pole || p.tile === generator)) continue
        const plan: Connection = { kind, source, target, parts: [{ tile: pole, kind: 'powerPole', direction: 'east' }, { tile: generator, kind: 'generator', direction: 'east' }, ...parts] }
        if (accessibleLayout(world, plan)) { chosen = plan; break outer }
      }
    }
  }
  cache.set(kind, { revision, plan: chosen })
  return chosen
}
export function wheelParts(site: WheelSite): InfrastructurePart[] { return [...site.poles.map(tile => ({ tile, kind: 'powerPole' as const, direction: 'east' as const })), { tile: site.tile, kind: 'waterwheel', direction: site.direction }] }
export function planWheel(world: World): WheelSite | null {
  const h = world.homestead!, mill = h.millAnchor
  if (mill === null) return null
  const poles = world.buildings.flatMap((b, tile) => b?.kind === 'powerPole' && Math.max(Math.abs(tile % SIZE - mill % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(mill / SIZE))) <= 3 ? [tile] : [])
  const near = (a: number, b: number) => Math.max(Math.abs(a % SIZE - b % SIZE), Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)))
  for (let tile = 0; tile < world.buildings.length; tile++) {
    if (!open(world, tile) || near(tile, mill) > 14 || world.peace.home === null || near(tile, world.peace.home) > 11) continue
    for (const direction of DIRECTIONS) {
      const water = next(tile, direction)
      if (water === null || !world.water[water]) continue
      if (poles.some(p => near(tile, p) <= 3) && freeSite(world, [tile], true)) return { tile, direction, poles: [] }
      for (const pole of neighboringTiles(tile)) if (open(world, pole)) {
        if (poles.some(p => near(pole, p) <= 6) && freeSite(world, [tile, pole], true)) return { tile, direction, poles: [pole] }
        for (let connector = 0; connector < world.buildings.length; connector++) {
          if (connector === tile || connector === pole || !open(world, connector) || near(connector, pole) > 6 || !poles.some(p => near(connector, p) <= 6)) continue
          if (freeSite(world, [tile, pole, connector], true)) return { tile, direction, poles: [connector, pole] }
        }
      }
    }
  }
  return null
}
export function connectionComplete(world: World, link: Connection): boolean { return link.parts.every(p => { const b = world.buildings[p.tile]; return b?.kind === p.kind && (!('direction' in b) || b.direction === p.direction) }) }
export function connectionRunning(world: World, kind: LinkKind): boolean {
  const link = world.homestead?.infrastructure.links.find(p => p.kind === kind)
  if (!link || !connectionComplete(world, link)) return false
  const arm = link.parts.find(p => p.kind === 'inserter')!, assignment = world.power?.assignments[arm.tile]
  return assignment !== undefined && (world.power?.networks.find(n => n.id === assignment)?.capacityKw ?? 0) > 0
}
export function orderTarget(world: World, path: 'eco' | 'craftsman'): number | null {
  const p = path === 'eco' ? world.coopProject : world.workshopProject
  return p?.phase === 'complete' && world.buildings[p.tiles[0]] ? p.tiles[0] : null
}
export function chooseInfrastructure(world: World, path: string): boolean {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world)
  if (!store) return false
  if (path === 'craftsman' && h.cargoBicycle) {
    if (s.links.length < 3 && h.bikeTile !== null && ([h.expansion.furnace, h.expansion.gearAssembler].some(tile => tile !== null && next(tile, 'east') === h.bikeTile) || h.store !== null && neighboringTiles(h.store).includes(h.bikeTile))) {
      const home = world.peace.home!
      const parking = [home + SIZE + 1, home + SIZE - 1, home - SIZE - 1].find(tile => tile >= 0 && tile < SIZE * SIZE && open(world, tile) && miniApproach(world, tile) !== null)
      if (parking !== undefined) { begin(world, 'parkBicycle', parking); return true }
    }
    const missing = s.links.find(p => !connectionComplete(world, p))
    if (missing && store.inventory.ironPlate >= 1) { s.plan = structuredClone(missing); s.built = 0; s.repair = true; begin(world, 'buildConnection', h.store); return true }
    for (const kind of ['iron', 'gearFeed', 'gearReturn'] as const) {
      if (s.links.some(p => p.kind === kind) || store.inventory.ironPlate < 8 || kind !== 'iron' && !s.links.some(p => p.kind === 'iron')) continue
      const plan = planConnection(world, kind)
      if (plan) { s.plan = plan; s.built = 0; s.repair = false; begin(world, 'buildConnection', h.store); return true }
    }
  }
  if (path === 'eco' && h.millBuilt === 3 && h.waterworks.dock !== null && world.orchardProject?.phase === 'complete' && world.personality.paths.eco.level >= 3) {
    const site = s.wheel ?? (store.wood >= 10 ? planWheel(world) : null)
    if (site && !wheelParts(site).every(p => world.buildings[p.tile]?.kind === p.kind) && store.wood >= (world.buildings[site.tile]?.kind === 'waterwheel' ? 0 : 10)) { s.wheelPlan = site; s.built = 0; begin(world, 'buildWheel', h.store); return true }
  }
  if ((path !== 'eco' && path !== 'craftsman') || s[path] >= 3 || world.personality.paths[path].level < 4 || world.timeMs < s.nextOrderAtMs || orderTarget(world, path) === null) return false
  if (projectCandidates(world).some(c => !c.definition.repeatable && !['yard', 'run'].includes(c.definition.id))) return false
  if (path === 'eco' ? h.expansion.assembler === null || !s.wheel || store.inventory.woodenCrate < 2 : !h.cargoBicycle || s.links.length < 3 || store.inventory.ironGear < 4) return false
  s.order = path; begin(world, 'finishOrder', orderTarget(world, path)); return true
}
export function advanceInfrastructure(world: World, delta: number): boolean {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world)
  if (!['parkBicycle', 'buildConnection', 'buildWheel', 'finishOrder'].includes(h.task ?? '')) return false
  if (h.task === 'parkBicycle') {
    if (h.bikeTile !== null && !miniWalk(world, h.bikeTile, delta)) return true
    h.bikeTile = null
    if (miniWalk(world, h.target!, delta, true)) { h.bikeTile = world.pete.tile; finish(world) }
    return true
  }
  if (h.task === 'finishOrder') {
    const path = s.order!
    if (!inventoryTotal(h.carried)) {
      if (!store || !arrived(world, h.store, delta)) return true
      if (path === 'eco' ? store.inventory.woodenCrate < 2 : store.inventory.ironGear < 4) { s.order = null; finish(world); return true }
      if (path === 'eco') { store.inventory.woodenCrate -= 2; h.carried.woodenCrate = 2 }
      else { store.inventory.ironGear -= 4; h.carried.ironGear = 4 }
    }
    if (orderTarget(world, path) !== h.target || !arrived(world, h.target, delta)) return true
    h.elapsedMs = Math.min(8000, h.elapsedMs + delta)
    if (h.elapsedMs === 8000) {
      h.carried.woodPanel = 0; h.carried.woodenCrate = 0; h.carried.ironGear = 0
      s[path]++; s.order = null; s.nextOrderAtMs = world.timeMs + 300000
      awardActivity(world.personality, { path, xp: 8 }); finish(world)
    }
    return true
  }
  const wheel = h.task === 'buildWheel', site = s.wheelPlan, plan = s.plan
  const parts = wheel ? wheelParts(site!) : plan!.parts
  const matches = (p: InfrastructurePart) => { const b = world.buildings[p.tile]; return b?.kind === p.kind && (!('direction' in b) || b.direction === p.direction) }
  const lost = parts.findIndex((p, i) => i < s.built && !matches(p))
  if (lost >= 0) { s.built = lost; h.elapsedMs = 0 }
  while (s.built < parts.length) {
    if (!matches(parts[s.built])) break
    s.built++
  }
  const part = parts[s.built]
  if (!part) {
    if (wheel) { s.wheel = site; s.wheelPlan = null }
    else if (!s.links.some(p => p.kind === plan!.kind)) s.links.push(plan!)
    s.plan = null; s.built = 0; s.repair = false
    h.carried.wood = 0; h.carried.ironPlate = 0; finish(world); return true
  }
  const item = wheel ? 'wood' : 'ironPlate', cost = wheel ? (world.buildings[site!.tile]?.kind === 'waterwheel' ? 0 : 10) : s.repair ? 1 : 8
  if (!h.carried[item] && cost) {
    if (!store || !arrived(world, h.store, delta)) return true
    if ((item === 'wood' ? store.wood : store.inventory.ironPlate) < cost) {
      if (!s.built || s.repair || wheel && s.wheel) { s.plan = null; s.wheelPlan = null; s.built = 0; s.repair = false; finish(world) }
      return true
    }
    if (item === 'wood') store.wood -= cost; else store.inventory.ironPlate -= cost
    h.carried[item] = cost
  }
  if (world.buildings[part.tile] || world.water[part.tile] || !arrived(world, part.tile, delta, true)) return true
  h.elapsedMs = Math.min(4000, h.elapsedMs + delta)
  if (h.elapsedMs !== 4000 || !freeSite(world, [part.tile], true)) return true
  const funded = part.kind === 'waterwheel' ? { ...world, nature: { ...world.nature, wood: h.carried.wood } } : world
  if (part.kind === 'inserter' && !world.research.unlocked.includes('logistics1')) world.research.unlocked.push('logistics1')
  if (!placeBuilding(funded, part.tile % SIZE, Math.floor(part.tile / SIZE), part.kind, part.direction)) return true
  world.topologyRevision = funded.topologyRevision
  if (s.repair && !wheel) h.carried.ironPlate = 0
  s.built++; h.elapsedMs = 0
  return true
}
// Restrict only Pete-owned pickup arms. All transfers still use ordinary powered inserter arbitration.
export function infrastructurePickupAllowed(world: World, tile: number, item: string): boolean {
  const h = world.homestead, s = h?.infrastructure
  const link = s?.links.find(p => p.parts.some(part => part.tile === tile && part.kind === 'inserter')) ?? (s?.plan?.parts.some(p => p.tile === tile && p.kind === 'inserter') ? s.plan : null)
  if (!link) return world.buildings[tile]?.kind === 'inserter'
  if (!connectionComplete(world, link)) return false
  const store = materialStore(world)
  if (!store) return false
  const inflight = (kind: LinkKind) => s!.links.filter(p => p.kind === kind).flatMap(p => p.parts).reduce((n, p) => { const b = world.buildings[p.tile]; return n + Number((b?.kind === 'belt' || b?.kind === 'inserter') && !!b.item) }, 0)
  if (link.kind === 'iron') return item === 'ironPlate' && store.inventory.ironPlate + inflight('iron') < 40
  if (link.kind === 'gearReturn') return item === 'ironGear' && store.inventory.ironGear + inflight('gearReturn') < 12
  const reserve = world.bicycleProject?.phase !== 'complete' ? 24 : !h!.cargoBicycle ? 12 : 2
  return item === 'ironPlate' && store.inventory.ironPlate > reserve && store.inventory.ironGear + inflight('gearReturn') < 12
}
export function ownedStorePickup(world: World, tile: number): boolean { return !!world.homestead?.infrastructure.links.some(p => p.kind === 'gearFeed' && p.parts.some(part => part.tile === tile && part.kind === 'inserter')) }
export function infrastructureReserved(world: World): number[] {
  const s = world.homestead?.infrastructure
  return s ? [...s.links.flatMap(p => p.parts.map(p => p.tile)), ...(s.plan?.parts.map(p => p.tile) ?? []), ...(s.wheel ? wheelParts(s.wheel).map(p => p.tile) : []), ...(s.wheelPlan ? wheelParts(s.wheelPlan).map(p => p.tile) : [])] : []
}
export function infrastructureBlockage(world: World): string | null {
  const h = world.homestead, s = h?.infrastructure
  if (!s || !h) return null
  const part = h.task === 'buildConnection' ? s.plan?.parts[s.built] : h.task === 'buildWheel' && s.wheelPlan ? wheelParts(s.wheelPlan)[s.built] : null
  return part && (world.buildings[part.tile] || world.water[part.tile] || miniApproach(world, part.tile) === null) ? 'Bauplatz oder Zugang blockiert; bezahltes Material bleibt erhalten.' : null
}
