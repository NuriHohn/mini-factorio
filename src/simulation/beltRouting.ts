import { pushRoute, popRoute } from './routingQueue'
import { offsets, SIZE } from './world'
import type { Direction, Position } from './world'

// Search only near the gesture, never unbounded work on a simulation tick.
export const BELT_SEARCH_MARGIN = 8
export const BELT_SEARCH_BUDGET = 4096
export interface BeltRoute { points: Position[] | null; exhausted: boolean; expanded: number }
interface Node { tile: number; direction: number; cost: number; estimate: number; order: number; parent: Node | null }
const directions: Direction[] = ['north', 'east', 'south', 'west']
// A step always outweighs every possible turn in this finite directional graph.
const DETAIL_COST = SIZE * SIZE * 4 + 1
const STEP_COST = DETAIL_COST * DETAIL_COST
// Read-only A*: cardinal movement, shortest length, then existing-belt reuse, then fewest turns, stable ties.
// The callback is the existing authoritative belt placement validator.
export function findBeltRoute(start: Position, end: Position, facing: Direction, canBuild: (x: number, y: number, outgoing: Direction, incoming?: Direction) => boolean, budget = BELT_SEARCH_BUDGET, existing: (x: number, y: number) => boolean = () => false): BeltRoute {
  const left = Math.max(0, Math.min(start.x, end.x) - BELT_SEARCH_MARGIN), right = Math.min(SIZE - 1, Math.max(start.x, end.x) + BELT_SEARCH_MARGIN)
  const top = Math.max(0, Math.min(start.y, end.y) - BELT_SEARCH_MARGIN), bottom = Math.min(SIZE - 1, Math.max(start.y, end.y) + BELT_SEARCH_MARGIN)
  const passable = new Map<string, boolean>(), best = new Map<number, number>(), heap: Node[] = []
  let order = 0, expanded = 0
  const free = (x: number, y: number, direction: number, incoming = -1) => {
    const key = `${y * SIZE + x},${direction},${incoming}`
    if (!passable.has(key)) passable.set(key, canBuild(x, y, directions[direction], incoming < 0 ? undefined : directions[incoming]))
    return passable.get(key)!
  }
  const occupiable = (x: number, y: number, incoming = -1) => directions.some((_, d) => free(x, y, d, incoming))
  if (!occupiable(start.x, start.y) || !occupiable(end.x, end.y)) return { points: null, exhausted: false, expanded }
  const distance = (x: number, y: number) => Math.abs(end.x - x) + Math.abs(end.y - y)
  const initial: Node = { tile: start.y * SIZE + start.x, direction: -1, cost: 0, estimate: distance(start.x, start.y) * STEP_COST, order: order++, parent: null }
  pushRoute(heap, initial)
  const first = directions.indexOf(facing)
  const neighbors = [first, (first + 1) % 4, (first + 3) % 4, (first + 2) % 4]
  while (heap.length) {
    const node = popRoute(heap)
    if (node.direction !== -1 && best.get(node.tile * 4 + node.direction) !== node.cost) continue
    if (expanded >= budget) return { points: null, exhausted: true, expanded }
    expanded++
    const x = node.tile % SIZE, y = Math.floor(node.tile / SIZE)
    if (x === end.x && y === end.y && free(x, y, node.direction < 0 ? directions.indexOf(facing) : node.direction, node.direction)) {
      const points: Position[] = []
      for (let n: Node | null = node; n; n = n.parent) points.push({ x: n.tile % SIZE, y: Math.floor(n.tile / SIZE) })
      return { points: points.reverse(), exhausted: false, expanded }
    }
    for (const direction of neighbors) {
      const delta = offsets[directions[direction]], nx = x + delta.x, ny = y + delta.y
      if (nx < left || nx > right || ny < top || ny > bottom || !free(x, y, direction, node.direction) || !occupiable(nx, ny, direction)) continue
      // A single construction cannot visit a tile twice with different outputs.
      let repeated = false
      for (let n: Node | null = node; n; n = n.parent) if (n.tile === ny * SIZE + nx) { repeated = true; break }
      if (repeated) continue
      const tile = ny * SIZE + nx, key = tile * 4 + direction
      const cost = node.cost + STEP_COST + (existing(x, y) ? 0 : DETAIL_COST) + (node.direction !== -1 && node.direction !== direction ? 1 : 0)
      if (cost >= (best.get(key) ?? Infinity)) continue
      best.set(key, cost)
      pushRoute(heap, { tile, direction, cost, estimate: cost + distance(nx, ny) * STEP_COST, order: order++, parent: node })
    }
  }
  return { points: null, exhausted: false, expanded }
}
