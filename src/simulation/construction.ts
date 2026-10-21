import { findBeltRoute } from './beltRouting'
import { polesConnect } from './power'
import { TREEHOUSE_WOOD } from './peace'
import { inside, offsets, placeBuilding, placementError, SIZE } from './world'
import type { BuildingKind, Direction, Position, World } from './world'

export type DragBuilding = 'belt' | 'powerPole'
export interface ConstructionCell extends Position { direction: Direction; reuse: boolean; error: string | null }
export interface ConstructionPlan { kind: DragBuilding; cells: ConstructionCell[]; error: string | null; detour?: boolean }
export interface PlacementInfo { state: 'valid' | 'invalid' | 'unaffordable'; error: string | null; wood: number; available: number }
export function placementInfo(world: World, point: Position, kind: BuildingKind): PlacementInfo {
  const wood = kind === 'treehouse' ? TREEHOUSE_WOOD : 0
  // Check geometry independently of funding, without changing any live state.
  const candidate = wood > world.nature.wood ? { ...world, nature: { ...world.nature, wood } } : world
  const error = placementError(candidate, point.x, point.y, kind)
  return { state: error ? 'invalid' : world.nature.wood < wood ? 'unaffordable' : 'valid', error: error ?? (world.nature.wood < wood ? `Needs ${wood} Wood.` : null), wood, available: world.nature.wood }
}
function directionTo(a: Position, b: Position): Direction {
  return b.x > a.x ? 'east' : b.x < a.x ? 'west' : b.y > a.y ? 'south' : 'north'
}
function orthogonal(start: Position, end: Position, facing: Direction): Position[] {
  const points = [{ ...start }], current = { ...start }
  const axes: ('x' | 'y')[] = offsets[facing].x ? ['x', 'y'] : ['y', 'x']
  for (const axis of axes) while (current[axis] !== end[axis]) {
    current[axis] += Math.sign(end[axis] - current[axis]); points.push({ ...current })
  }
  return points
}
// A bounded digital straight corridor, not a world pathfinder or obstacle detour.
function straight(start: Position, end: Position): Position[] {
  const count = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  return Array.from({ length: count + 1 }, (_, i) => ({ x: Math.round(start.x + (end.x - start.x) * i / (count || 1)), y: Math.round(start.y + (end.y - start.y) * i / (count || 1)) }))
}
export function planConstruction(world: World, start: Position, end: Position, kind: DragBuilding, facing: Direction): ConstructionPlan {
  if (!inside(start.x, start.y) || !inside(end.x, end.y)) return { kind, cells: [], error: 'Keep the whole path inside the world.' }
  const pointCell = (p: Position): ConstructionCell => {
    const reuse = kind === 'powerPole' && world.buildings[p.y * SIZE + p.x]?.kind === 'powerPole'
    return { ...p, direction: facing, reuse, error: reuse ? null : placementError(world, p.x, p.y, kind) }
  }
  if (kind === 'belt') {
    let cells = orthogonal(start, end, facing).map(pointCell)
    let error = cells.find(c => c.error)?.error ?? null, detour = false
    // Invalid endpoints remain explicit errors; a detour cannot fix them.
    if (error && !cells[0].error && !cells[cells.length - 1].error) {
      const route = findBeltRoute(start, end, facing, (x, y) => placementError(world, x, y, 'belt') === null)
      if (route.points) { cells = route.points.map(pointCell); error = null; detour = true }
      else error = route.exhausted ? 'Path search limit reached. Try a shorter drag.' : 'No free path to the destination. Try a shorter drag or another destination.'
    }
    for (let i = 0; i < cells.length; i++) cells[i].direction = cells[i + 1] ? directionTo(cells[i], cells[i + 1]) : i > 0 ? cells[i - 1].direction : facing
    return { kind, cells, error, detour }
  }
  const corridor = straight(start, end).map(pointCell), last = corridor.length - 1
  const steps = corridor.map(() => Infinity), hops = corridor.map(() => Infinity), next = corridor.map(() => -1)
  if (!corridor[last].error) { steps[last] = corridor[last].reuse ? 0 : 1; hops[last] = 0 }
  for (let i = last - 1; i >= 0; i--) {
    if (corridor[i].error) continue
    for (let j = last; j > i; j--) {
      const cost = (corridor[i].reuse ? 0 : 1) + steps[j]
      if (polesConnect(corridor[i], corridor[j]) && (cost < steps[i] || (cost === steps[i] && 1 + hops[j] < hops[i]))) { steps[i] = cost; hops[i] = 1 + hops[j]; next[i] = j }
    }
  }
  if (Number.isFinite(steps[0])) {
    const cells = [corridor[0]]
    for (let i = 0; i !== last;) { i = next[i]; cells.push(corridor[i]) }
    return { kind, cells, error: null }
  }
  // Show an honest failure corridor rather than committing disconnected fragments.
  return { kind, cells: corridor, error: corridor[0].error ?? corridor[last].error ?? 'No clear pole connection here. Try a different straight path.' }
}
export function commitConstruction(world: World, start: Position, end: Position, kind: DragBuilding, facing: Direction): { error: string | null; placed: number } {
  const plan = planConstruction(world, start, end, kind, facing)
  if (plan.error) return { error: plan.error, placed: 0 }
  const created: number[] = [], revision = world.topologyRevision
  for (const cell of plan.cells) {
    if (cell.reuse) continue
    if (!placeBuilding(world, cell.x, cell.y, kind, cell.direction)) {
      for (const index of created) world.buildings[index] = null
      world.topologyRevision = revision
      return { error: 'The path changed. Nothing was built. Try again.', placed: 0 }
    }
    created.push(cell.y * SIZE + cell.x)
  }
  return { error: null, placed: created.length }
}
