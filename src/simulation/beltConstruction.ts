import { BRIDGE_WOOD, MAX_BRIDGE_SPAN, isWater } from './waterTerrain'
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
export function planBelts(world: World, start: Position, end: Position, facing: Direction, dragged = false): ConstructionPlan {
  const direct = orthogonal(start, end, facing)
  const single = direct.length === 1 && !dragged && !isWater(world, start.x, start.y)
  const outgoing = (points: Position[], i: number) => points[i + 1] ? directionTo(points[i], points[i + 1]) : i ? directionTo(points[i - 1], points[i]) : facing
  const intent = new Map(direct.map((p, i) => [p.y * SIZE + p.x, outgoing(direct, i)]))
  const geometry = new Map<string, string | null>()
  const errorAt = (x: number, y: number, direction: Direction, incoming?: Direction) => {
    const belt = buildingAt(world, x, y)
    // A land click may redirect a belt; retain all normal actor/unlock checks.
    const validationDirection = single && belt?.kind === 'belt' ? belt.direction : direction
    const key = `${x},${y},${direction}`
    if (!geometry.has(key)) geometry.set(key, placementError(world, x, y, 'belt', validationDirection, isWater(world, x, y)))
    const error = geometry.get(key)!
    if (error) return error
    if (isWater(world, x, y) && incoming && incoming !== direction) return 'Bridges stay straight while crossing water.'
    if (belt?.kind !== 'belt') return null
    if (incoming && incoming !== direction) return 'Existing belt blocks this route. Join it along its flow axis.'
    if (belt.direction !== direction && intent.get(y * SIZE + x) !== direction) return 'Keep this existing belt direction. Drag along it to reverse it.'
    return null
  }
  const cellsFor = (points: Position[]): ConstructionCell[] => points.map((p, i) => {
    const direction = outgoing(points, i), belt = buildingAt(world, p.x, p.y), reuse = belt?.kind === 'belt'
    const error = errorAt(p.x, p.y, direction, i ? directionTo(points[i - 1], p) : undefined)
    return { ...p, direction, reuse, bridge: isWater(world, p.x, p.y), reverse: !error && reuse && belt.direction !== direction, error }
  })
  const validate = (cells: ConstructionCell[]) => {
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i].bridge) continue
      const start = i, d = cells[i].direction
      while (i + 1 < cells.length && cells[i + 1].bridge) i++
      const unchangedClick = cells.length === 1 && cells[0].reuse && !cells[0].reverse
      const error = unchangedClick ? null : start === 0 || i === cells.length - 1 ? 'A bridge needs land at both ends. Drag across both banks.' : i - start + 1 > MAX_BRIDGE_SPAN ? 'Bridges span at most 5 consecutive water tiles.' : cells.slice(start, i + 1).some(c => c.direction !== d) || directionTo(cells[start - 1], cells[start]) !== d ? 'Bridges stay straight while crossing water.' : null
      if (error) for (let j = start; j <= i; j++) { cells[j].error = error; cells[j].reverse = false }
    }
    return cells.find(c => c.error)?.error ?? null
  }
  const cost = (cells: ConstructionCell[]) => cells.filter(c => c.bridge && !c.reuse).length * BRIDGE_WOOD
  let cells = cellsFor(direct), error = validate(cells), detour = false
  let unaffordable = !error && cost(cells) > world.nature.wood
  if ((error || unaffordable) && direct.length > 1 && !isWater(world, start.x, start.y) && !isWater(world, end.x, end.y)) {
    const route = findBeltRoute(start, end, facing, (x, y, direction, incoming) => errorAt(x, y, direction, incoming) === null, undefined, (x, y) => buildingAt(world, x, y)?.kind === 'belt', { water: (x, y) => isWater(world, x, y), available: world.nature.wood, price: BRIDGE_WOOD })
    if (route.points) { cells = cellsFor(route.points); error = validate(cells); detour = true; unaffordable = false }
    else if (!error) unaffordable = true
    else if (!DIRECTIONS.some(d => errorAt(start.x, start.y, d) === null) || !DIRECTIONS.some(d => errorAt(end.x, end.y, d) === null)) error = cells[0].error ?? cells[cells.length - 1].error ?? error
    else if (!cells.some(c => c.bridge)) error = route.exhausted ? 'Path search limit reached. Try a shorter drag.' : 'No free path to the destination. Existing belts cannot be crossed.'
  }
  if (unaffordable) error = `Needs ${cost(cells)} Wood for bridges · You have ${world.nature.wood}.`
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
  return { kind: 'belt', cells, error, detour, beltSnap, wood: cost(cells), unaffordable }
}
// Keep entity/item identity and progress on turns, with a legal entry side.
// Reversal mirrors straight packets to retain their position; side entries stay.
export function redirectBelt(belt: Belt, direction: Direction): void {
  if (direction !== opposite(belt.direction)) {
    belt.direction = direction
    if (belt.entry === direction) belt.entry = opposite(direction)
    return
  }
  const straight = belt.entry === opposite(belt.direction)
  belt.direction = direction
  if (straight) { belt.entry = opposite(direction); if (belt.item) belt.progress = 1 - belt.progress }
}
