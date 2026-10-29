import { wantsShoreDock } from './projectRegistry'
import { arrived, begin, finish, freeSite, materialStore } from './homestead'
import { fishingSpot } from './fishingDock'
import { planRowboat } from './rowboat'
import { planFootbridge, commitFundedFootbridge } from './footbridge'
import { peteReachableTiles, neighboringTiles } from './navigation'
import { miniWalk } from './petesWorld'
import { projectCandidates, projectPlansConflict } from './secretProject'
import { awardHomesteadOnce, ensureRebuilding } from './rebuilding'
import { DIRECTIONS, inside, offsets, SIZE } from './world'
import type { Direction, World } from './world'

export interface BridgePlan { kind: 'bridge'; start: number; end: number }
export interface DockPlan { kind: 'dock'; tile: number; direction: Direction }
export type ShorePlan = BridgePlan | DockPlan
export interface Waterworks { plan: ShorePlan | null; bridges: BridgePlan[]; dock: DockPlan | null; nextVisitAtMs: number; preferBoat: boolean }
export const SHORE_WORK_MS = 4000
export function shoreTiles(plan: ShorePlan): number[] {
  if (plan.kind === 'dock') return [plan.tile]
  const step = plan.start % SIZE === plan.end % SIZE ? Math.sign(plan.end - plan.start) * SIZE : Math.sign(plan.end - plan.start)
  return Array.from({ length: Math.abs((plan.end - plan.start) / step) - 1 }, (_, n) => plan.start + step * (n + 1))
}
export function shoreCost(world: World, plan: ShorePlan): number {
  return plan.kind === 'dock' ? 8 : shoreTiles(plan).filter(tile => world.buildings[tile]?.kind !== 'footbridge').length * 3
}
export function shoreApproaches(plan: ShorePlan): number[] {
  return plan.kind === 'bridge' ? [plan.start, plan.end] : [plan.tile - (offsets[plan.direction].y * SIZE + offsets[plan.direction].x)]
}
function clear(world: World, plan: ShorePlan): boolean {
  if (plan.kind === 'bridge') {
    const funded = { ...world, nature: { ...world.nature, wood: 15 } }
    return !planFootbridge(funded, { x: plan.start % SIZE, y: Math.floor(plan.start / SIZE) }, { x: plan.end % SIZE, y: Math.floor(plan.end / SIZE) }).error
  }
  const dock = { kind: 'fishingDock' as const, x: plan.tile % SIZE, y: Math.floor(plan.tile / SIZE), direction: plan.direction }
  const spot = fishingSpot(world, dock)
  return !world.water[plan.tile] && !world.buildings[plan.tile] && spot !== null && peteReachableTiles(world, world.pete.tile).has(spot) && freeSite(world, [plan.tile])
}
const bridgeCache = new WeakMap<World, { revision: number; home: number; plan: BridgePlan | null }>()
export function planNeededBridge(world: World): BridgePlan | null {
  const home = world.peace.home
  if (home === null) return null
  const cached = bridgeCache.get(world)
  if (cached?.revision === world.topologyRevision && cached.home === home) return cached.plan
  const parents = peteReachableTiles(world, world.pete.tile)
  const resources = world.tiles.flatMap((ore, tile) => Math.max(Math.abs(tile % SIZE - home % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(home / SIZE))) <= 11 && (ore && !world.buildings[tile] || world.buildings[tile]?.kind === 'tree') && !neighborsReach(parents, tile) ? [tile] : [])
  let chosen: BridgePlan | null = null
  if (resources.length) outer: for (const start of parents.keys()) {
    if (world.water[start] || world.buildings[start] || Math.max(Math.abs(start % SIZE - home % SIZE), Math.abs(Math.floor(start / SIZE) - Math.floor(home / SIZE))) > 11) continue
    for (const direction of DIRECTIONS) {
      const d = offsets[direction], step = d.y * SIZE + d.x
      for (let length = 1; length <= 5; length++) {
        const x = start % SIZE + d.x * (length + 1), y = Math.floor(start / SIZE) + d.y * (length + 1), end = y * SIZE + x
        if (!inside(x, y) || !world.water[start + step * length]) break
        if (world.water[end]) continue
        const plan: BridgePlan = { kind: 'bridge', start, end }, tiles = shoreTiles(plan)
        if (parents.has(end) || !clear(world, plan) || conflict(world, plan)) break
        const buildings = [...world.buildings]
        for (const tile of tiles) buildings[tile] = { kind: 'footbridge', x: tile % SIZE, y: Math.floor(tile / SIZE), direction: d.x ? 'east' : 'south' }
        const after = peteReachableTiles({ ...world, buildings }, start)
        if (resources.some(tile => neighborsReach(after, tile))) { chosen = plan; break outer }
        break
      }
    }
  }
  bridgeCache.set(world, { revision: world.topologyRevision, home, plan: chosen })
  return chosen
}
function neighborsReach(parents: Map<number, number>, tile: number): boolean { return parents.has(tile) || neighboringTiles(tile).some(i => parents.has(i)) }
function conflict(world: World, plan: ShorePlan): boolean {
  return projectPlansConflict(world, { home: world.peace.home!, direction: 'east', tiles: shoreTiles(plan), spots: shoreApproaches(plan), built: 0, phase: 'collecting', crate: null, carried: 0, elapsedMs: 0 })
}
export function planShoreDock(world: World): DockPlan | null {
  const home = world.peace.home
  if (home === null) return null
  const sites = world.buildings.flatMap((b, tile) => !b && !world.water[tile] && world.tiles[tile] === null && Math.max(Math.abs(tile % SIZE - home % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(home / SIZE))) <= 11 ? [tile] : [])
  sites.sort((a, b) => Math.abs(a % SIZE - home % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(home / SIZE)) - Math.abs(b % SIZE - home % SIZE) - Math.abs(Math.floor(b / SIZE) - Math.floor(home / SIZE)) || a - b)
  for (const tile of sites) for (const direction of DIRECTIONS) {
    const plan: DockPlan = { kind: 'dock', tile, direction }
    if (clear(world, plan) && !conflict(world, plan) && planRowboat(world, { kind: 'fishingDock', x: tile % SIZE, y: Math.floor(tile / SIZE), direction })) return plan
  }
  return null
}
export function scheduledShoreVisit(world: World): number | null {
  const water = world.homestead?.waterworks, plan = water?.dock
  if (!water || !plan || world.timeMs < water.nextVisitAtMs) return null
  const dock = world.buildings[plan.tile]
  if (dock?.kind !== 'fishingDock') return null
  if (projectCandidates(world).some(c => !c.definition.repeatable && !['yard', 'run'].includes(c.definition.id))) return null
  const spot = fishingSpot(world, dock)
  return spot !== null && peteReachableTiles(world, world.pete.tile).has(spot) ? spot : null
}
export function chooseShoreline(world: World): boolean {
  const h = world.homestead!, store = materialStore(world), water = h.waterworks
  if (!store || world.personality.paths.eco.level < 2) return false
  const missingBridge = water.bridges.find(plan => shoreTiles(plan).some(tile => world.buildings[tile]?.kind !== 'footbridge'))
  const missingDock = water.dock && world.buildings[water.dock.tile]?.kind !== 'fishingDock' ? water.dock : null
  const bridge = water.bridges.length < 8 ? planNeededBridge(world) : null
  const dock = wantsShoreDock(world) && store.wood >= 8 ? planShoreDock(world) : null
  const plan = missingBridge ?? missingDock ?? bridge ?? dock
  if (!plan || !clear(world, plan) || store.wood < shoreCost(world, plan)) return false
  water.plan = plan; begin(world, plan.kind === 'bridge' ? 'buildBridge' : 'buildDock', plan.kind === 'bridge' ? plan.start : plan.tile)
  return true
}
export function advanceShoreline(world: World, delta: number): boolean {
  const h = world.homestead!, plan = h.waterworks.plan
  if (!plan || !['buildBridge', 'buildDock'].includes(h.task ?? '')) return false
  const cost = shoreCost(world, plan), store = materialStore(world)
  if (h.carried.wood < cost) {
    if (!store || !arrived(world, h.store, delta)) return true
    if (store.wood < cost - h.carried.wood) {
      if (!h.carried.wood) { h.waterworks.plan = null; finish(world) }
      return true
    }
    store.wood -= cost - h.carried.wood; h.carried.wood = cost
  }
  const spot = shoreApproaches(plan)[0]
  // Finish crossing the still-empty dock site before checking placement occupancy.
  if (plan.kind === 'dock' && !world.buildings[plan.tile] && (world.pete.tile === plan.tile || world.pete.next === plan.tile)) { miniWalk(world, spot, delta); return true }
  if (!clear(world, plan)) return true
  if (!miniWalk(world, spot, delta)) return true
  const duration = plan.kind === 'bridge' ? Math.max(1, cost / 3) * SHORE_WORK_MS : 8000
  h.elapsedMs = Math.min(duration, h.elapsedMs + delta)
  if (h.elapsedMs < duration) return true
  if (plan.kind === 'bridge') {
    const result = commitFundedFootbridge(world, { x: plan.start % SIZE, y: Math.floor(plan.start / SIZE) }, { x: plan.end % SIZE, y: Math.floor(plan.end / SIZE) }, h.carried.wood)
    if (result.error) return true
    h.carried.wood -= result.wood ?? 0
    if (!h.waterworks.bridges.some(p => p.start === plan.start && p.end === plan.end)) h.waterworks.bridges.push(plan)
  } else {
    world.buildings[plan.tile] = { kind: 'fishingDock', x: plan.tile % SIZE, y: Math.floor(plan.tile / SIZE), direction: plan.direction }
    world.topologyRevision++; h.carried.wood -= cost; h.waterworks.dock = plan; h.waterworks.nextVisitAtMs = world.timeMs + 300000
  }
  ensureRebuilding(world)
  awardHomesteadOnce(world, plan.kind === 'bridge' ? `shore:${plan.start}:${plan.end}` : 'shore:dock', { path: 'eco', xp: plan.kind === 'bridge' ? 5 : 10 })
  h.waterworks.plan = null
  if (h.carried.wood) begin(world, 'returnStock', h.store); else finish(world)
  return true
}
