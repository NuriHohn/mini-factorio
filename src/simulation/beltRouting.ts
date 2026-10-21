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
const STEP_COST = SIZE * SIZE * 4 + 1
// Read-only A*: cardinal movement, shortest length then fewest turns, stable ties.
// The callback is the existing authoritative belt placement validator.
export function findBeltRoute(start: Position, end: Position, facing: Direction, canBuild: (x: number, y: number) => boolean, budget = BELT_SEARCH_BUDGET): BeltRoute {
  const left = Math.max(0, Math.min(start.x, end.x) - BELT_SEARCH_MARGIN), right = Math.min(SIZE - 1, Math.max(start.x, end.x) + BELT_SEARCH_MARGIN)
  const top = Math.max(0, Math.min(start.y, end.y) - BELT_SEARCH_MARGIN), bottom = Math.min(SIZE - 1, Math.max(start.y, end.y) + BELT_SEARCH_MARGIN)
  const passable = new Map<number, boolean>(), best = new Map<number, number>(), heap: Node[] = []
  let order = 0, expanded = 0
  const free = (x: number, y: number) => {
    const tile = y * SIZE + x
    if (!passable.has(tile)) passable.set(tile, canBuild(x, y))
    return passable.get(tile)!
  }
  if (!free(start.x, start.y) || !free(end.x, end.y)) return { points: null, exhausted: false, expanded }
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
    if (x === end.x && y === end.y) {
      const points: Position[] = []
      for (let n: Node | null = node; n; n = n.parent) points.push({ x: n.tile % SIZE, y: Math.floor(n.tile / SIZE) })
      return { points: points.reverse(), exhausted: false, expanded }
    }
    for (const direction of neighbors) {
      const delta = offsets[directions[direction]], nx = x + delta.x, ny = y + delta.y
      if (nx < left || nx > right || ny < top || ny > bottom || !free(nx, ny)) continue
      const tile = ny * SIZE + nx, key = tile * 4 + direction
      const cost = node.cost + STEP_COST + (node.direction !== -1 && node.direction !== direction ? 1 : 0)
      if (cost >= (best.get(key) ?? Infinity)) continue
      best.set(key, cost)
      pushRoute(heap, { tile, direction, cost, estimate: cost + distance(nx, ny) * STEP_COST, order: order++, parent: node })
    }
  }
  return { points: null, exhausted: false, expanded }
}
