import { placementInfo } from '../simulation/construction'
import { placeBuilding, placementError } from '../simulation/world'
import type { Direction, Position, World } from '../simulation/world'
import type { Tool } from '../state/toolMetadata'

export const ROTATION_THRESHOLD = 24
export type RotationBuilding = 'forester' | 'sawmill' | 'fishingDock' | 'waterwheel' | 'miner' | 'furnace' | 'assembler' | 'inserter' | 'splitter'
export function rotationBuilding(tool: Tool): tool is RotationBuilding {
  return tool === 'forester' || tool === 'sawmill' || tool === 'fishingDock' || tool === 'waterwheel' || tool === 'miner' || tool === 'furnace' || tool === 'assembler' || tool === 'inserter' || tool === 'splitter'
}
// Input-only state. Screen coordinates are CSS pixels, independent of camera zoom.
export class PlacementRotation {
  private gesture: { world: World; tile: Position; origin: Position; last: Position; kind: RotationBuilding; direction: Direction; rotating: boolean } | null = null
  get active(): boolean { return this.gesture !== null }
  begin(world: World, tile: Position, screen: Position, kind: RotationBuilding, direction: Direction) {
    this.gesture = { world, tile: { ...tile }, origin: { ...screen }, last: { ...screen }, kind, direction, rotating: false }
  }
  move(screen: Position) {
    const g = this.gesture
    if (!g || (screen.x === g.last.x && screen.y === g.last.y)) return
    g.last = { ...screen }
    const dx = screen.x - g.origin.x, dy = screen.y - g.origin.y
    if (!g.rotating && dx * dx + dy * dy < ROTATION_THRESHOLD ** 2) return
    g.rotating = true
    if (dx || dy) g.direction = Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? 'east' : 'west' : dy >= 0 ? 'south' : 'north'
  }
  setDirection(direction: Direction) { if (this.gesture) this.gesture.direction = direction }
  preview() {
    const g = this.gesture
    return g ? { ...g.tile, kind: g.kind, direction: g.direction, info: placementInfo(g.world, g.tile, g.kind, g.direction) } : null
  }
  finish(world: World) {
    const g = this.gesture
    this.cancel() // Consume even rejected placements; a second release cannot build.
    if (!g || g.world !== world) return null
    const error = placementError(world, g.tile.x, g.tile.y, g.kind, g.direction)
    if (error) return { kind: g.kind, error }
    const placed = placeBuilding(world, g.tile.x, g.tile.y, g.kind, g.direction)
    return { kind: g.kind, error: placed ? null : 'The placement changed. Nothing was built.' }
  }
  cancel() { this.gesture = null }
}
