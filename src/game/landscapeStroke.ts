import { paintWater } from '../simulation/waterLandscaping'
import type { WaterBrush } from '../simulation/waterLandscaping'
import { combatPosition } from '../simulation/revenge'
import { paintLandscape } from '../simulation/nature'
import type { BrushSize, Decoration } from '../simulation/nature'
import type { Position, World } from '../simulation/world'
export function landscapeTile(screen: Position, camera: Parameters<typeof combatPosition>[1], tile = 32): Position {
  const point = combatPosition(screen, camera, tile)
  return { x: Math.floor(point.x + .5), y: Math.floor(point.y + .5) }
}
export type LandscapeMode = Decoration | WaterBrush | null
function paint(world: World, from: Position, to: Position, mode: LandscapeMode, size: BrushSize) {
  return mode === 'water' || mode === 'land' ? paintWater(world, from, to, mode, size) : paintLandscape(world, from, to, mode, size)
}
// UI gesture history only. Authoritative painting always goes through the simulation paint commands.
export class LandscapeStroke {
  private previous: Position | null = null
  private world: World | null = null
  private mode: LandscapeMode = null
  private size: BrushSize = 1
  get isActive() { return this.previous !== null }
  begin(world: World, point: Position, mode: LandscapeMode, size: BrushSize) {
    this.world = world; this.previous = point; this.mode = mode; this.size = size
    return paint(world, point, point, mode, size)
  }
  move(world: World, point: Position, mode: LandscapeMode, size: BrushSize) {
    if (!this.previous || this.world !== world || this.mode !== mode || this.size !== size) { this.end(); return 0 }
    if (point.x === this.previous.x && point.y === this.previous.y) return 0
    const changed = paint(world, this.previous, point, mode, size)
    this.previous = point
    return changed
  }
  end() { this.previous = null; this.world = null }
}
