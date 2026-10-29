import { wantsShoreDock, wantsWaterwheel } from './projectRegistry'
import { ecoPickup } from './ecoLogistics'
import { choosePavilion, advancePavilion } from './pavilion'
import { IMPROVEMENT_RULES } from './homesteadExpansion'
import type { Item } from './items'
import { productionEndpoints, laterPickup, mainFuel, boilerPickupAllowed, coalInlet, outputClearance, inputClearance } from './productionLogistics'
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
import { copperLink, feedLink, linkMaterial, industrialLink, linkCurrency, linkCost, ecoLink } from './infrastructureRules'
import { chooseLoading, advanceLoading, loadingParts } from './loading'
import type { Connection, InfrastructurePart, LinkKind, WheelSite } from './infrastructureRules'

function next(tile: number, d: Direction, n = 1): number | null {
  const v = offsets[d], x = tile % SIZE + v.x * n, y = Math.floor(tile / SIZE) + v.y * n
  return inside(x, y) ? y * SIZE + x : null
}
export function facing(a: number, b: number): Direction { return b === a + 1 ? 'east' : b === a - 1 ? 'west' : b > a ? 'south' : 'north' }
export function linkEndpoints(world: World, kind: LinkKind): [number | null, number | null] {
  const h = world.homestead!
  return productionEndpoints(kind, h.store, h.expansion, h.infrastructure.loading, h.millAnchor)
}
function open(world: World, tile: number): boolean { return !world.buildings[tile] && !world.water[tile] && world.tiles[tile] === null && !infrastructureReserved(world).includes(tile) }
function accessibleLayout(world: World, plan: Connection): boolean {
  const h = world.homestead!
  return freeSite({ ...world, homestead: { ...h, bikeTile: null, infrastructure: { ...h.infrastructure, plan } } }, plan.parts.map(p => p.tile), true)
}
const plans = new WeakMap<World, Map<LinkKind, { revision: string; plan: Connection | null }>>()
const jointPlans = new WeakMap<World, Map<LinkKind, { revision: string; plan: Connection | null }>>()
function planRevision(world: World): string {
  const h = world.homestead!, e = h.expansion
  return `${world.yard?.entrance}:${world.chickenRun?.entrance}:${h.infrastructure.pavilion?.tile}:${h.infrastructure.pavilion?.spot}:${world.topologyRevision}:${world.pete.tile}:${h.bikeTile}:${h.infrastructure.links.map(p => p.kind).join(',')}:${[e.forestry, e.assembler, h.millAnchor, e.furnace, e.gearAssembler, e.copperFurnace, e.cableAssembler, e.circuitAssembler, e.briquetteAssembler, h.infrastructure.loading?.input, h.infrastructure.loading?.output].join(',')}`
}
export function previewConnection(world: World, plan: Connection): World {
  const h = world.homestead!, buildings = [...world.buildings]
  for (const p of plan.parts) {
    const position = { x: p.tile % SIZE, y: Math.floor(p.tile / SIZE) }
    if (p.kind === 'belt') buildings[p.tile] = { ...position, kind: 'belt', direction: p.direction, entry: p.direction, progress: 0, item: null }
    else if (p.kind === 'inserter') buildings[p.tile] = { ...position, kind: 'inserter', direction: p.direction, phase: 'idle', item: null, elapsedMs: 0 }
    else if (p.kind === 'generator' || p.kind === 'powerPole') buildings[p.tile] = { ...position, kind: p.kind }
  }
  return { ...world, buildings, homestead: { ...h, infrastructure: { ...h.infrastructure, links: [...h.infrastructure.links, plan] } } }
}
// Reserve the concrete ingredient lanes before routing returns across the same small yard.
// Preview buildings exist only in this detached planning world, without stock, costs or XP.
export function planConnection(world: World, kind: LinkKind): Connection | null {
  let cache = jointPlans.get(world)
  if (!cache) { cache = new Map(); jointPlans.set(world, cache) }
  const revision = planRevision(world), old = cache.get(kind)
  if (old?.revision === revision) return old.plan
  if (kind === 'iron' || ecoLink(kind)) return planSingleConnection(world, kind)
  // A mixed yard needs all three ingredient outlets before an enclosing return.
  let candidate = world
  for (const feed of ['gearFeed', 'cableFeed', 'circuitFeed'] as const) {
    if (candidate.homestead!.infrastructure.links.some(p => p.kind === feed)) continue
    const plan = planSingleConnection(candidate, feed)
    if (feed === kind) { cache.set(kind, { revision, plan }); return plan }
    if (plan) candidate = previewConnection(candidate, plan)
  }
  // In a mixed yard the short assembler returns need the inner lanes; copper can go around them.
  if ((kind === 'copper' || kind === 'cableReturn') && world.homestead!.expansion.furnace !== null && world.homestead!.expansion.circuitAssembler !== null) {
    for (const returning of ['circuitReturn', 'cableReturn'] as const) {
      if (returning === kind) break
      if (candidate.homestead!.infrastructure.links.some(p => p.kind === returning)) continue
      const plan = planSingleConnection(candidate, returning)
      if (!plan) { cache.set(kind, { revision, plan: null }); return null }
      candidate = previewConnection(candidate, plan)
    }
  }
  const chosen = planSingleConnection(candidate, kind)
  cache.set(kind, { revision, plan: chosen })
  return chosen
}
function ecoPickupSpots(world: World): { kind: LinkKind; direction: Direction; tiles: number[] }[] {
  const kinds = (['crateReturn', 'panelReturn', 'woodReturn'] as const).filter(kind => !world.homestead!.infrastructure.links.some(p => p.kind === kind))
  const at = world.homestead!.expansion.forestry, forest = at === null ? null : world.buildings[at]
  const plots = forest?.kind === 'forester' ? forest.plots : []
  const choices: { kind: LinkKind; direction: Direction; tiles: number[] }[] = []
  function select(index: number): boolean {
    if (index === kinds.length) return true
    const kind = kinds[index], [source] = linkEndpoints(world, kind)
    if (source === null) return select(index + 1)
    for (const direction of kind === 'crateReturn' ? ['east'] as const : DIRECTIONS) {
      const arm = next(source, direction), start = next(source, direction, 2)
      if (arm === null || start === null || [arm, start].some(t => !open(world, t) || plots.includes(t) || choices.some(c => c.tiles.includes(t)))) continue
      choices.push({ kind, direction, tiles: [arm, start] })
      if (select(index + 1)) return true
      choices.pop()
    }
    return false
  }
  return select(0) ? choices : []
}
function planSingleConnection(world: World, kind: LinkKind): Connection | null {
  const [source, target] = linkEndpoints(world, kind)
  if (source === null || target === null || !world.buildings[source] || !world.buildings[target]) return null
  let cache = plans.get(world)
  if (!cache) { cache = new Map(); plans.set(world, cache) }
  const old = cache.get(kind)
  const revision = planRevision(world)
  if (old?.revision === revision) return old.plan
  let chosen: Connection | null = null
  const gear = ecoLink(kind) ? null : kind === 'circuitFeed' || kind === 'circuitReturn' ? world.homestead!.expansion.circuitAssembler : industrialLink(kind) ? world.homestead!.expansion.briquetteAssembler : copperLink(kind) ? world.homestead!.expansion.cableAssembler : world.homestead!.expansion.gearAssembler
  const gearArm = gear === null ? null : next(gear, 'east')
  const reserved = !['gearReturn', 'cableReturn', 'circuitReturn', 'loadingFeed'].includes(kind) && gearArm !== null ? [gearArm, next(gearArm, 'east'), next(gearArm, 'north'), next(gearArm, 'south')] : []
  const forestry = world.homestead!.expansion.forestry
  const station = forestry === null ? null : world.buildings[forestry]
  if (ecoLink(kind) && station?.kind === 'forester') reserved.push(...station.plots)
  const ecoSpots = ecoLink(kind) ? ecoPickupSpots(world) : []
  for (const spot of ecoSpots) if (spot.kind !== kind) reserved.push(...spot.tiles)
  if (!feedLink(kind) && gear !== null) reserved.push(next(gear, 'west'))
  if (!feedLink(kind) && target === world.homestead!.store) reserved.push(next(target, 'east'), next(target, 'east', 2))
  const occupied = new Set(infrastructureReserved(world))
  const available = (tile: number) => !reserved.includes(tile) && !world.buildings[tile] && !world.water[tile] && world.tiles[tile] === null && !occupied.has(tile)
  reserved.push(...outputClearance(world, source), ...inputClearance(world, feedLink(kind) ? target : undefined))
  const storePorts = world.homestead!.store === null ? [] : neighboringTiles(world.homestead!.store!)
  const corridors = world.homestead!.store === null ? storePorts : [...storePorts, world.homestead!.store! - 2 * SIZE, world.homestead!.store! + 2 * SIZE]
  const yardLandings = [world.yard, world.chickenRun].flatMap(yard => yard ? neighboringTiles(yard.entrance) : [])
  const terminals = [target, ...(!feedLink(kind) ? world.homestead!.infrastructure.links.filter(p => !feedLink(p.kind) && p.target === target && p.receiver === undefined).flatMap(p => p.parts.filter(p => p.kind === 'belt').map(p => p.tile)) : [])]
  const inlet = kind === 'loadingReturn' ? coalInlet(world) : []
  terminals.push(...inlet.slice(1, -1))
  if (terminals.length > 1) terminals.push(terminals.shift()!)
  const sourceBuilding = world.buildings[source]
  const pickups: Direction[] = ecoLink(kind) && sourceBuilding?.kind === 'belt' || sourceBuilding?.kind === 'supplyCrate' || sourceBuilding?.kind === 'fuelDepot' ? ['east', 'south', 'west', 'north'] : ['east']
  const alignment = (d: Direction) => offsets[d].x * (target % SIZE - source % SIZE) + offsets[d].y * (Math.floor(target / SIZE) - Math.floor(source / SIZE))
  const ecoSpot = ecoSpots.find(p => p.kind === kind)
  if (ecoSpot) pickups.splice(0, pickups.length, ecoSpot.direction)
  pickups.sort((a, b) => alignment(b) - alignment(a))
  outer: for (const receiver of terminals) for (const d of pickups) {
    const arm = next(source, d), start = next(source, d, 2)
    if (arm === null || start === null || !available(arm) || !available(start)) continue
    const ends = neighboringTiles(receiver).filter(tile => (!feedLink(kind) || tile !== next(target, 'east')) && (receiver === target || facing(tile, receiver) !== ({ east: 'west', west: 'east', north: 'south', south: 'north' } as const)[world.buildings[receiver]?.kind === 'belt' ? world.buildings[receiver].direction : 'east']))
    if (feedLink(kind) || kind === 'iron' || kind === 'copper') ends.sort((a, b) => Number(b === next(target, 'west')) - Number(a === next(target, 'west')))
    for (const end of ends) {
      if (!available(end) || storePorts.includes(end) && receiver !== world.homestead!.store) continue
      const route = findBeltRoute({ x: start % SIZE, y: Math.floor(start / SIZE) }, { x: end % SIZE, y: Math.floor(end / SIZE) }, facing(end, receiver), (x, y, outgoing) => {
        const tile = y * SIZE + x
        return tile !== arm && (!corridors.includes(tile) || tile === start && source === world.homestead!.store || tile === end && receiver === world.homestead!.store) && available(tile) && (tile !== start || outgoing !== ({ east: 'west', west: 'east', north: 'south', south: 'north' } as const)[d])
      }, 500).points
      if (!route || route.length > 18) continue
      const tiles = route.map(p => p.y * SIZE + p.x)
      const parts: InfrastructurePart[] = [{ tile: arm, kind: 'inserter', direction: d }, ...tiles.map((tile, i) => ({ tile, kind: 'belt' as const, direction: facing(tile, tiles[i + 1] ?? receiver) }))]
      // A local ordinary generator/pole powers the pickup arm; belts need no power.
      const poles = world.buildings.flatMap((_, tile) => Math.max(Math.abs(tile % SIZE - arm % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(arm / SIZE))) <= 3 ? [tile] : [])
      poles.sort((a, b) => Math.abs(a - arm) - Math.abs(b - arm))
      for (const pole of poles) for (const generator of neighboringTiles(pole)) {
        if (!available(pole) || !available(generator) || corridors.includes(pole) || corridors.includes(generator) || yardLandings.includes(pole) || yardLandings.includes(generator) || pole === generator || parts.some(p => p.tile === pole || p.tile === generator)) continue
        const plan: Connection = { kind, source, target, ...(receiver === target ? {} : { receiver }), ...(inlet.slice(1, -1).includes(receiver) ? { inlet } : {}), parts: [{ tile: pole, kind: 'powerPole', direction: 'east' }, { tile: generator, kind: 'generator', direction: 'east' }, ...parts] }
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
export function partComplete(world: World, p: InfrastructurePart): boolean { const b = world.buildings[p.tile]; return b?.kind === p.kind && (!('direction' in b) || b.direction === p.direction) }
export function connectionComplete(world: World, link: Connection): boolean {
  const intact = (p: InfrastructurePart) => partComplete(world, p)
  if (!link.parts.every(intact)) return false
  if (link.receiver === undefined) return true
  if (link.inlet) return link.inlet.slice(link.inlet.indexOf(link.receiver), -1).every((tile, i, suffix) => {
    const b = world.buildings[tile]
    return b?.kind === 'belt' && b.direction === facing(tile, suffix[i + 1] ?? link.target)
  })
  const owner = world.homestead?.infrastructure.links.find(p => p.receiver === undefined && p.target === link.target && p.parts.some(b => b.kind === 'belt' && b.tile === link.receiver))
  return !!owner && owner.parts.slice(owner.parts.findIndex(p => p.tile === link.receiver)).every(intact)
}
export function connectionRunning(world: World, kind: LinkKind): boolean {
  const link = world.homestead?.infrastructure.links.find(p => p.kind === kind)
  if (!link || !world.buildings[link.source] || !world.buildings[link.target] || !connectionComplete(world, link)) return false
  const arm = link.parts.find(p => p.kind === 'inserter')!, assignment = world.power?.assignments[arm.tile]
  return (world.buildings[arm.tile]?.sabotageUntilMs ?? 0) <= world.timeMs && assignment !== undefined && (world.power?.networks.find(n => n.id === assignment)?.capacityKw ?? 0) > 0
}
export function orderTarget(world: World, path: 'eco' | 'craftsman' | 'inventor' | 'industrial'): number | null {
  if (path === 'industrial') { const e = world.homestead!.expansion, tile = world.homestead!.infrastructure.industrial === 0 ? e.steamWorkshop : e.steamHoist; return tile !== null && world.buildings[tile]?.kind === (world.homestead!.infrastructure.industrial === 0 ? 'steamWorkshop' : 'steamHoist') ? tile : null }
  const p = path === 'eco' ? world.coopProject : path === 'inventor' ? (world.homestead!.infrastructure.inventor === 0 ? world.experimentProject : world.flightProject) : world.workshopProject
  return p?.phase === 'complete' && world.buildings[p.tiles[0]] ? p.tiles[0] : null
}
function parkForConnection(world: World, kinds: LinkKind[]): boolean {
  const h = world.homestead!
  if (!h.cargoBicycle || h.bikeTile === null || !kinds.length) return false
  const desired = kinds.map(kind => planConnection(world, kind)).find(plan => plan !== null)
  if (!desired || !desired.parts.some(part => part.tile === h.bikeTile)) return false
  const home = world.peace.home!, candidates = [home + SIZE + 1, home + SIZE - 1, home - SIZE - 1]
  for (let radius = 2; radius <= 3; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === radius && inside(home % SIZE + dx, Math.floor(home / SIZE) + dy)) candidates.push(home + dy * SIZE + dx)
  const parking = candidates.find(tile => tile >= 0 && tile < SIZE * SIZE && open(world, tile) && !desired.parts.some(part => part.tile === tile) && miniApproach(world, tile) !== null)
  if (parking === undefined) return false
  begin(world, 'parkBicycle', parking); return true
}

export function chooseInfrastructure(world: World, path: string): boolean {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world)
  if (!store) return false
  if (path === 'eco' && world.personality.paths.eco.level >= 4 && h.expansion.assembler !== null && world.orchardProject?.phase === 'complete' && !wantsShoreDock(world) && !wantsWaterwheel(world)) {
    const missing = s.links.find(p => ecoLink(p.kind) && p.parts.some(part => !partComplete(world, part)))
    if (missing && store.wood > 0) { s.plan = structuredClone(missing); s.built = 0; s.repair = true; begin(world, 'buildConnection', h.store); return true }
    for (const kind of ['woodReturn', 'panelReturn', 'crateReturn'] as const) {
      if (store.wood < (kind === 'woodReturn' ? 6 : 18)) continue
      if (s.links.some(p => p.kind === kind)) continue
      const plan = planConnection(world, kind)
      if (plan) { s.plan = plan; s.built = 0; s.repair = false; begin(world, 'buildConnection', h.store); return true }
    }
    if ((s.pavilion || ['woodReturn', 'panelReturn', 'crateReturn'].every(kind => s.links.some(p => p.kind === kind))) && choosePavilion(world)) return true
  }
  if (path === 'industrial' && chooseLoading(world)) return true
  if (path === 'industrial' && world.personality.paths.industrial.level >= 4 && h.expansion.steamWorkshop !== null && world.produced.coalBriquette >= 4) {
    const missing = s.links.find(p => industrialLink(p.kind) && p.parts.some(part => !partComplete(world, part)))
    if (missing && store.inventory.coal) { s.plan = structuredClone(missing); s.built = 0; s.repair = true; begin(world, 'buildConnection', h.store); return true }
    if (mainFuel(world) >= 8 && store.inventory.coal >= 6) for (const kind of ['stampFeed', 'loadingFeed', 'loadingReturn'] as const) {
      if (s.links.some(p => p.kind === kind) || kind !== 'stampFeed' && (!s.loading || !s.links.some(p => p.kind === 'stampFeed'))) continue
      const plan = planConnection(world, kind)
      if (plan) { s.plan = plan; s.built = 0; s.repair = false; begin(world, 'buildConnection', h.store); return true }
    }
  }
  if (path === 'inventor' && world.personality.paths.inventor.level >= 4 && h.expansion.copperMiner !== null) {
    const plateThreshold = !s.links.some(p => p.kind === 'copper') || world.flightProject?.phase === 'complete' ? 8 : 32
    const wanted = (['copper', 'cableFeed', 'cableReturn', 'circuitFeed', 'circuitReturn'] as const).filter(kind => !s.links.some(p => p.kind === kind) && (kind === 'copper' || s.links.some(p => p.kind === 'copper')) && (!(kind === 'circuitFeed' || kind === 'circuitReturn') || h.expansion.circuitAssembler !== null && (kind === 'circuitFeed' ? store.inventory.copperPlate > (world.flightProject?.phase === 'complete' ? 2 : 24) && store.inventory.copperCable > (world.flightProject?.phase === 'complete' ? 0 : 12) : s.links.some(p => p.kind === 'circuitFeed'))))
    if (store.inventory.copperPlate >= plateThreshold && parkForConnection(world, wanted)) return true
    const missing = s.links.find(p => copperLink(p.kind) && p.parts.some(part => !partComplete(world, part)))
    if (missing && store.inventory.copperPlate >= 1) { s.plan = structuredClone(missing); s.built = 0; s.repair = true; begin(world, 'buildConnection', h.store); return true }
    for (const kind of ['copper', 'cableFeed', 'cableReturn', 'circuitFeed', 'circuitReturn'] as const) {
      if (s.links.some(p => p.kind === kind) || store.inventory.copperPlate < plateThreshold || kind !== 'copper' && !s.links.some(p => p.kind === 'copper')) continue
      if ((kind === 'circuitFeed' || kind === 'circuitReturn') && (h.expansion.circuitAssembler === null || kind === 'circuitFeed' && (store.inventory.copperPlate <= (world.flightProject?.phase === 'complete' ? 2 : 24) || store.inventory.copperCable <= (world.flightProject?.phase === 'complete' ? 0 : 12)) || kind === 'circuitReturn' && !s.links.some(p => p.kind === 'circuitFeed'))) continue
      const plan = planConnection(world, kind)
      if (plan) { s.plan = plan; s.built = 0; s.repair = false; begin(world, 'buildConnection', h.store); return true }
    }
  }
  if (path === 'craftsman' && h.cargoBicycle) {
    if (parkForConnection(world, (['iron', 'gearFeed', 'gearReturn'] as const).filter(kind => !s.links.some(p => p.kind === kind) && (kind === 'iron' || s.links.some(p => p.kind === 'iron'))))) return true
    const missing = s.links.find(p => !copperLink(p.kind) && !industrialLink(p.kind) && !ecoLink(p.kind) && p.parts.some(part => !partComplete(world, part)))
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
  if ((path !== 'eco' && path !== 'craftsman' && path !== 'inventor' && path !== 'industrial') || s[path] >= 3 || world.personality.paths[path].level < (path === 'industrial' ? 5 : 4) || world.timeMs < s.nextOrderAtMs || orderTarget(world, path) === null) return false
  if (path === 'eco') {
    const garden = world.gardenProject
    const improvement = h.expansion.improvements.storeShelves === undefined ? 'storeShelves' : h.expansion.improvements.gardenBoxes === undefined && garden?.phase === 'complete' && world.buildings[garden.tiles[0]] ? 'gardenBoxes' : null
    const reserve = improvement ? IMPROVEMENT_RULES[improvement] : null
    if (reserve && store.inventory[reserve.item] < reserve.amount + 2) return false
  }
  if (projectCandidates(world).some(c => !c.definition.repeatable && !['yard', 'run'].includes(c.definition.id))) return false
  const fuel = h.expansion.fuelStore === null ? null : world.buildings[h.expansion.fuelStore]
  if (path === 'industrial' && (s.cargoCycles < 10 || fuel?.kind !== 'fuelDepot' || fuel.inventory.coalBriquette < 6 || inventoryTotal(fuel.inventory) < 14)) return false
  if (path === 'eco' ? h.expansion.assembler === null || !s.wheel || store.inventory.woodenCrate < 2 : path === 'inventor' ? world.flightProject?.phase !== 'complete' || store.inventory.copperCable < 4 || store.inventory.electronicCircuit < 2 : path === 'industrial' ? false : !h.cargoBicycle || s.links.filter(p => !copperLink(p.kind) && !industrialLink(p.kind) && !ecoLink(p.kind)).length < 3 || store.inventory.ironGear < 4) return false
  s.order = path; begin(world, 'finishOrder', orderTarget(world, path)); return true
}
export function advanceInfrastructure(world: World, delta: number): boolean {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world)
  if (advancePavilion(world, delta)) return true
  if (advanceLoading(world, delta)) return true
  if (!['parkBicycle', 'buildConnection', 'buildWheel', 'finishOrder'].includes(h.task ?? '')) return false
  if (h.task === 'parkBicycle') {
    if (h.bikeTile !== null && !miniWalk(world, h.bikeTile, delta)) return true
    h.bikeTile = null
    if (miniWalk(world, h.target!, delta, true)) { h.bikeTile = world.pete.tile; finish(world) }
    return true
  }
  if (h.task === 'finishOrder') {
    const path = s.order!, orderStore = path === 'industrial' ? (h.expansion.fuelStore === null ? null : world.buildings[h.expansion.fuelStore]) : store
    if (!inventoryTotal(h.carried)) {
      if (path === 'industrial') {
        if (orderStore?.kind !== 'fuelDepot' || !arrived(world, h.expansion.fuelStore, delta)) return true
        if (orderStore.inventory.coalBriquette < 6 || inventoryTotal(orderStore.inventory) < 14) { s.order = null; finish(world); return true }
        orderStore.inventory.coalBriquette -= 6; h.carried.coalBriquette = 6
      } else {
        if (!store || !arrived(world, h.store, delta)) return true
        if (path === 'eco' ? store.inventory.woodenCrate < 2 : path === 'inventor' ? store.inventory.copperCable < 4 || store.inventory.electronicCircuit < 2 : store.inventory.ironGear < 4) { s.order = null; finish(world); return true }
        if (path === 'eco') { store.inventory.woodenCrate -= 2; h.carried.woodenCrate = 2 }
        else if (path === 'inventor') { store.inventory.copperCable -= 4; store.inventory.electronicCircuit -= 2; h.carried.copperCable = 4; h.carried.electronicCircuit = 2 }
        else { store.inventory.ironGear -= 4; h.carried.ironGear = 4 }
      }
    }
    if (orderTarget(world, path) !== h.target || !arrived(world, h.target, delta)) return true
    h.elapsedMs = Math.min(8000, h.elapsedMs + delta)
    if (h.elapsedMs === 8000) {
      h.carried.coalBriquette = 0; h.carried.woodPanel = 0; h.carried.woodenCrate = 0; h.carried.ironGear = 0; h.carried.copperCable = 0; h.carried.electronicCircuit = 0
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
    h.carried.wood = 0; h.carried.ironPlate = 0; h.carried.copperPlate = 0; h.carried.coal = 0; finish(world); return true
  }
  const item = wheel ? 'wood' : linkCurrency(plan!.kind), cost = wheel ? (world.buildings[site!.tile]?.kind === 'waterwheel' ? 0 : 10) : s.repair ? 1 : linkCost(plan!.kind)
  if (!h.carried[item] && cost) {
    if (!store || !arrived(world, h.store, delta)) return true
    if ((item === 'wood' ? store.wood : store.inventory[item]) < cost) {
      if (!s.built || s.repair || wheel && s.wheel) { s.plan = null; s.wheelPlan = null; s.built = 0; s.repair = false; finish(world) }
      return true
    }
    if (item === 'wood') store.wood -= cost; else store.inventory[item] -= cost
    h.carried[item] = cost
  }
  if (world.buildings[part.tile] || world.water[part.tile] || !arrived(world, part.tile, delta, true)) return true
  h.elapsedMs = Math.min(4000, h.elapsedMs + delta)
  if (h.elapsedMs !== 4000 || !freeSite(world, [part.tile], true)) return true
  const funded = part.kind === 'waterwheel' ? { ...world, nature: { ...world.nature, wood: h.carried.wood } } : world
  if (part.kind === 'inserter' && !world.research.unlocked.includes('logistics1')) world.research.unlocked.push('logistics1')
  if (!placeBuilding(funded, part.tile % SIZE, Math.floor(part.tile / SIZE), part.kind, part.direction)) return true
  world.topologyRevision = funded.topologyRevision
  if (s.repair && !wheel) h.carried[item] = 0
  s.built++; h.elapsedMs = 0
  return true
}
// Restrict only Pete-owned pickup arms. All transfers still use ordinary powered inserter arbitration.
export function infrastructurePickupAllowed(world: World, tile: number, item: Item): boolean {
  if (!boilerPickupAllowed(world, tile, item)) return false
  const h = world.homestead, s = h?.infrastructure
  const link = s?.links.find(p => p.parts.some(part => part.tile === tile && part.kind === 'inserter')) ?? (s?.plan?.parts.some(p => p.tile === tile && p.kind === 'inserter') ? s.plan : null)
  if (!link) return world.buildings[tile]?.kind === 'inserter'
  if (!connectionComplete(world, link)) return false
  const store = materialStore(world)
  if (!store) return false
  const eco = ecoPickup(world, link.kind, item)
  if (eco !== null) return eco
  const later = laterPickup(world, link.kind, item)
  if (later !== null) return later
  const material = linkMaterial(link.kind)
  if (item !== material) return false
  const quota = link.kind === 'iron' || link.kind === 'copper' ? 40 : link.kind === 'cableReturn' ? 16 : 12
  const inflight = (item: string) => s!.links.flatMap(p => p.parts).reduce((n, p) => { const b = world.buildings[p.tile]; return n + Number((b?.kind === 'belt' || b?.kind === 'inserter') && b.item === item) }, 0)
  if (!feedLink(link.kind)) return store.inventory[material] + inflight(material) < quota
  if (link.kind === 'cableFeed') return store.inventory.copperPlate > (world.flightProject?.phase === 'complete' ? 2 : 24) && store.inventory.copperCable + inflight('copperCable') < 16
  const reserve = world.bicycleProject?.phase !== 'complete' ? 24 : !h!.cargoBicycle ? 12 : 2
  return store.inventory.ironPlate > reserve && store.inventory.ironGear + inflight('ironGear') < 12
}
export function ownedStorePickup(world: World, tile: number): boolean { return !!world.homestead?.infrastructure.links.some(p => feedLink(p.kind) && p.parts.some(part => part.tile === tile && part.kind === 'inserter')) }
export function infrastructureReserved(world: World): number[] {
  const s = world.homestead?.infrastructure
  return s ? [...(s.pavilion ? [s.pavilion.tile, s.pavilion.spot] : []), ...(s.loading ? loadingParts(s.loading).map(p => p.tile) : []), ...(s.loadingPlan ? loadingParts(s.loadingPlan).map(p => p.tile) : []), ...s.links.flatMap(p => p.parts.map(p => p.tile)), ...(s.plan?.parts.map(p => p.tile) ?? []), ...(s.wheel ? wheelParts(s.wheel).map(p => p.tile) : []), ...(s.wheelPlan ? wheelParts(s.wheelPlan).map(p => p.tile) : [])] : []
}
export function infrastructureBlockage(world: World): string | null {
  const h = world.homestead, s = h?.infrastructure
  if (!s || !h) return null
  const part = h.task === 'buildConnection' ? s.plan?.parts[s.built] : h.task === 'buildWheel' && s.wheelPlan ? wheelParts(s.wheelPlan)[s.built] : null
  return part && (world.buildings[part.tile] || world.water[part.tile] || miniApproach(world, part.tile) === null) ? 'Bauplatz oder Zugang blockiert; bezahltes Material bleibt erhalten.' : null
}
