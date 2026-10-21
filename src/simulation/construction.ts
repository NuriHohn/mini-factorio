import { FISHING_DOCK_WOOD } from './fishingDock'
import { WATERWHEEL_WOOD } from './waterwheel'
import { BRIDGE_WOOD } from './waterTerrain'
import { planBelts, redirectBelt } from './beltConstruction'
import { findPowerRoute } from './powerRouting'
import { TREEHOUSE_WOOD } from './peace'
import { inside, opposite, placeBuilding, placementError, SIZE } from './world'
import type { BuildingKind, Direction, Position, World } from './world'

export type DragBuilding = 'belt' | 'powerPole'
export interface ConstructionCell extends Position { direction: Direction; reuse: boolean; reverse?: boolean; bridge?: boolean; error: string | null }
export interface ConstructionPlan { kind: DragBuilding; cells: ConstructionCell[]; error: string | null; detour?: boolean; snapFrom?: Position; beltSnap?: Position; wood?: number; unaffordable?: boolean }
export interface PlacementInfo { state: 'valid' | 'invalid' | 'unaffordable'; error: string | null; wood: number; available: number }
export function placementInfo(world: World, point: Position, kind: BuildingKind, direction: Direction = 'east'): PlacementInfo {
  const wood = kind === 'treehouse' ? TREEHOUSE_WOOD : kind === 'waterwheel' ? WATERWHEEL_WOOD : kind === 'fishingDock' ? FISHING_DOCK_WOOD : 0
  // Check geometry independently of funding, without changing any live state.
  const candidate = wood > world.nature.wood ? { ...world, nature: { ...world.nature, wood } } : world
  const error = placementError(candidate, point.x, point.y, kind, kind === 'waterwheel' || kind === 'fishingDock' ? direction : undefined)
  return { state: error ? 'invalid' : world.nature.wood < wood ? 'unaffordable' : 'valid', error: error ?? (world.nature.wood < wood ? `Needs ${wood} Wood.` : null), wood, available: world.nature.wood }
}
export function planConstruction(world: World, start: Position, end: Position, kind: DragBuilding, facing: Direction, dragged = false): ConstructionPlan {
  if (!inside(start.x, start.y) || !inside(end.x, end.y)) return { kind, cells: [], error: 'Keep the whole path inside the world.' }
  const pointCell = (p: Position): ConstructionCell => {
    const reuse = kind === 'powerPole' && world.buildings[p.y * SIZE + p.x]?.kind === 'powerPole'
    return { ...p, direction: facing, reuse, error: reuse ? null : placementError(world, p.x, p.y, kind) }
  }
  if (kind === 'belt') return planBelts(world, start, end, facing, dragged)
  const endpoints = [pointCell(start), pointCell(end)]
  const invalid = endpoints.find(c => c.error)?.error
  if (invalid) return { kind, cells: endpoints, error: invalid }
  const route = findPowerRoute(world, start, end)
  if (!route.points) return { kind, cells: endpoints, error: route.exhausted ? 'Power route search limit reached. Try a shorter drag.' : 'No valid power route found. Try a shorter drag or another destination.' }
  return { kind, cells: route.points.map(pointCell), error: null, snapFrom: route.snapped ? { ...end } : undefined }
}
export function commitConstruction(world: World, start: Position, end: Position, kind: DragBuilding, facing: Direction, dragged = false): { error: string | null; placed: number; reversed?: number; wood?: number } {
  const plan = planConstruction(world, start, end, kind, facing, dragged)
  if (plan.error) return { error: plan.error, placed: 0 }
  const created: number[] = [], revision = world.topologyRevision
  for (const cell of plan.cells) {
    if (cell.reuse) continue
    const bridgeError = cell.bridge ? placementError(world, cell.x, cell.y, 'belt', cell.direction, true) : null
    const accepted = cell.bridge ? !bridgeError : placeBuilding(world, cell.x, cell.y, kind, cell.direction)
    if (!accepted) {
      for (const index of created) world.buildings[index] = null
      world.topologyRevision = revision
      return { error: 'The path changed. Nothing was built. Try again.', placed: 0 }
    }
    if (cell.bridge) { world.buildings[cell.y * SIZE + cell.x] = { kind: 'belt', bridge: true, x: cell.x, y: cell.y, direction: cell.direction, entry: opposite(cell.direction), item: null, progress: 0 }; world.topologyRevision++ }
    created.push(cell.y * SIZE + cell.x)
  }
  const wood = created.filter(i => world.buildings[i]?.kind === 'belt' && world.water[i]).length * BRIDGE_WOOD
  world.nature.wood -= wood
  const reversed = plan.cells.filter(c => c.reverse)
  for (const cell of reversed) {
    const belt = world.buildings[cell.y * SIZE + cell.x]
    if (belt?.kind === 'belt') redirectBelt(belt, cell.direction)
  }
  if (reversed.length) world.topologyRevision++
  return { error: null, placed: created.length, ...(reversed.length ? { reversed: reversed.length } : {}), ...(wood ? { wood } : {}) }
}
