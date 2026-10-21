import { findBeltRoute } from './beltRouting'
import { buildingAt, DIRECTIONS, offsets, opposite, placementError, SIZE } from './world'
import type { Belt, Direction, Position, World } from './world'
import type { ConstructionCell, ConstructionPlan } from './construction'
function directionTo(a: Position, b: Position): Direction {
  return b.x > a.x ? 'east' : b.x < a.x ? 'west' : b.y > a.y ? 'south' : 'north'
}
function orthogonal(start: Position, end: Position, facing: Direction): Position[] {
  const points = [{ ...start }], current = { ...start }
  for (const axis of (offsets[facing].x ? ['x', 'y'] : ['y', 'x']) as ('x' | 'y')[]) while (current[axis] !== end[axis]) {
    current[axis] += Math.sign(end[axis] - current[axis]); points.push({ ...current })
  }
  return points
}
export function planBelts(world: World, start: Position, end: Position, facing: Direction): ConstructionPlan {
  const direct = orthogonal(start, end, facing)
  const outgoing = (points: Position[], i: number) => points[i + 1] ? directionTo(points[i], points[i + 1]) : i ? directionTo(points[i - 1], points[i]) : facing
  const intent = new Map(direct.map((p, i) => [p.y * SIZE + p.x, outgoing(direct, i)]))
  const geometry = new Map<string, string | null>()
  const errorAt = (x: number, y: number, direction: Direction, incoming?: Direction) => {
    const key = `${x},${y},${direction}`
    if (!geometry.has(key)) geometry.set(key, placementError(world, x, y, 'belt', direction))
    const error = geometry.get(key)!
    if (error) return error
    const belt = buildingAt(world, x, y)
    if (belt?.kind !== 'belt') return null
    if (incoming && incoming !== direction) return 'Existing belt blocks this route. Join it along its flow axis.'
    if (belt.direction !== direction && intent.get(y * SIZE + x) !== direction) return 'Keep this existing belt direction. Drag along it to reverse it.'
    return null
  }
  const cellsFor = (points: Position[]): ConstructionCell[] => points.map((p, i) => {
    const direction = outgoing(points, i), belt = buildingAt(world, p.x, p.y), reuse = belt?.kind === 'belt'
    const error = errorAt(p.x, p.y, direction, i ? directionTo(points[i - 1], p) : undefined)
    return { ...p, direction, reuse, reverse: !error && reuse && belt.direction !== direction, error }
  })
  let cells = cellsFor(direct), error = cells.find(c => c.error)?.error ?? null, detour = false
  if (error && direct.length > 1) {
    const route = findBeltRoute(start, end, facing, (x, y, direction, incoming) => errorAt(x, y, direction, incoming) === null, undefined, (x, y) => buildingAt(world, x, y)?.kind === 'belt')
    if (route.points) { cells = cellsFor(route.points); error = cells.find(c => c.error)?.error ?? null; detour = true }
    else if (!DIRECTIONS.some(d => errorAt(start.x, start.y, d) === null) || !DIRECTIONS.some(d => errorAt(end.x, end.y, d) === null)) error = cells[0].error ?? cells[cells.length - 1].error ?? error
    else error = route.exhausted ? 'Path search limit reached. Try a shorter drag.' : 'No free path to the destination. Existing belts cannot be crossed.'
  }
  // Only new endpoints may turn into one unambiguous rear-facing receiver.
  // Selected facing is an explicit constraint, including R/manual placement.
  let beltSnap: Position | undefined
  if (!error && cells.length > 1 && !cells[cells.length - 1].reuse) {
    const last = cells[cells.length - 1], tiles = new Set(cells.map(c => c.y * SIZE + c.x))
    const receivers = DIRECTIONS.flatMap(direction => {
      const d = offsets[direction], target = buildingAt(world, last.x + d.x, last.y + d.y)
      return target?.kind === 'belt' && target.direction === direction && !tiles.has(target.y * SIZE + target.x) ? [{ target, direction }] : []
    })
    if (receivers.length === 1 && receivers[0].direction === facing && last.direction !== facing) {
      last.direction = facing; beltSnap = { x: receivers[0].target.x, y: receivers[0].target.y }
    }
  }
  return { kind: 'belt', cells, error, detour, beltSnap }
}
// Keep entity and packet identity. Mirror a straight packet's progress so its
// position is continuous; a side-entered packet keeps its entry and progress.
export function reverseBelt(belt: Belt): void {
  const direction = opposite(belt.direction)
  const straight = belt.entry === opposite(belt.direction)
  belt.direction = direction
  if (straight) { belt.entry = opposite(direction); if (belt.item) belt.progress = 1 - belt.progress }
}
