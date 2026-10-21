import { POLE_CONNECTION_RANGE, polesConnect } from './power'
import { popRoute, pushRoute } from './routingQueue'
import { inside, placementError, SIZE } from './world'
import type { Position, World } from './world'

export const POWER_SEARCH_MARGIN = 8
export const POWER_SEARCH_BUDGET = 1600
export interface PowerRoute { points: Position[] | null; snapped: boolean; exhausted: boolean; expanded: number }
interface Node { tile: number; cost: number; estimate: number; order: number; parent: Node | null }
// Integer lexicographic costs: a new pole outweighs all possible wire length,
// and wire length (ceil Euclidean millitiles) outweighs all possible link counts.
const LENGTH_COST = SIZE * SIZE + 1
const NEW_POLE_COST = SIZE * SIZE * Math.ceil(POLE_CONNECTION_RANGE * 1000) * LENGTH_COST + SIZE * SIZE + 1
const links: (Position & { length: number })[] = []
for (let y = -POLE_CONNECTION_RANGE; y <= POLE_CONNECTION_RANGE; y++) for (let x = -POLE_CONNECTION_RANGE; x <= POLE_CONNECTION_RANGE; x++) {
  if ((x || y) && polesConnect({ x: 0, y: 0 }, { x, y })) links.push({ x, y, length: Math.ceil(Math.hypot(x, y) * 1000) })
}
const position = (tile: number): Position => ({ x: tile % SIZE, y: Math.floor(tile / SIZE) })
// Dijkstra over electrical links, not walkable ground. No line-of-sight rule.
export function findPowerRoute(world: World, start: Position, end: Position, budget = POWER_SEARCH_BUDGET): PowerRoute {
  let expanded = 0, order = 0
  const fail = (exhausted = false): PowerRoute => ({ points: null, snapped: false, exhausted, expanded })
  if (!inside(start.x, start.y) || !inside(end.x, end.y)) return fail()
  const source = start.y * SIZE + start.x, destination = end.y * SIZE + end.x
  const reuse = (tile: number) => world.buildings[tile]?.kind === 'powerPole'
  const eligibility = new Map<number, boolean>()
  const valid = (tile: number) => {
    if (!eligibility.has(tile)) { const p = position(tile); eligibility.set(tile, reuse(tile) || placementError(world, p.x, p.y, 'powerPole') === null) }
    return eligibility.get(tile)!
  }
  if (!valid(source) || !valid(destination)) return fail()
  if (source === destination) return { points: [{ ...start }], snapped: false, exhausted: false, expanded }
  const goals = new Set([destination])
  // Only an already-valid destination may snap, and only to an adjacent pole.
  // Occupied/invalid endpoints never get rescued by silently stopping elsewhere.
  if (!reuse(destination)) for (const delta of [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) {
    const x = end.x + delta.x, y = end.y + delta.y
    if (inside(x, y) && reuse(y * SIZE + x)) goals.add(y * SIZE + x)
  }
  const left = Math.max(0, Math.min(start.x, end.x) - POWER_SEARCH_MARGIN), right = Math.min(SIZE - 1, Math.max(start.x, end.x) + POWER_SEARCH_MARGIN)
  const top = Math.max(0, Math.min(start.y, end.y) - POWER_SEARCH_MARGIN), bottom = Math.min(SIZE - 1, Math.max(start.y, end.y) + POWER_SEARCH_MARGIN)
  const heap: Node[] = [], best = new Map<number, number>()
  const initial = reuse(source) ? 0 : NEW_POLE_COST
  best.set(source, initial)
  pushRoute(heap, { tile: source, cost: initial, estimate: initial, order: order++, parent: null })
  while (heap.length) {
    const node = popRoute(heap)
    if (best.get(node.tile) !== node.cost) continue
    if (expanded >= budget) return fail(true)
    expanded++
    if (goals.has(node.tile)) {
      const points: Position[] = []
      for (let n: Node | null = node; n; n = n.parent) points.push(position(n.tile))
      return { points: points.reverse(), snapped: node.tile !== destination, exhausted: false, expanded }
    }
    const from = position(node.tile)
    for (const link of links) {
      const x = from.x + link.x, y = from.y + link.y
      if (x < left || x > right || y < top || y > bottom) continue
      const tile = y * SIZE + x
      if (!valid(tile)) continue
      const cost = node.cost + (reuse(tile) ? 0 : NEW_POLE_COST) + link.length * LENGTH_COST + 1
      if (cost >= (best.get(tile) ?? Infinity)) continue
      best.set(tile, cost)
      pushRoute(heap, { tile, cost, estimate: cost, order: order++, parent: node })
    }
  }
  return fail()
}
