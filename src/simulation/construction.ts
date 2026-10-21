import { findBeltRoute } from './beltRouting'
import { findPowerRoute } from './powerRouting'
import { TREEHOUSE_WOOD } from './peace'
import { inside, offsets, placeBuilding, placementError, SIZE } from './world'
import type { BuildingKind, Direction, Position, World } from './world'

export type DragBuilding = 'belt' | 'powerPole'
export interface ConstructionCell extends Position { direction: Direction; reuse: boolean; error: string | null }
export interface ConstructionPlan { kind: DragBuilding; cells: ConstructionCell[]; error: string | null; detour?: boolean; snapFrom?: Position }
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
  const endpoints = [pointCell(start), pointCell(end)]
  const invalid = endpoints.find(c => c.error)?.error
  if (invalid) return { kind, cells: endpoints, error: invalid }
  const route = findPowerRoute(world, start, end)
  if (!route.points) return { kind, cells: endpoints, error: route.exhausted ? 'Power route search limit reached. Try a shorter drag.' : 'No valid power route found. Try a shorter drag or another destination.' }
  return { kind, cells: route.points.map(pointCell), error: null, snapFrom: route.snapped ? { ...end } : undefined }
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
