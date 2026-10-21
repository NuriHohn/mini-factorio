import { combatPosition } from '../simulation/revenge'
import { paintLandscape } from '../simulation/nature'
import type { BrushSize, Decoration } from '../simulation/nature'
import type { Position, World } from '../simulation/world'
export function landscapeTile(screen: Position, camera: Parameters<typeof combatPosition>[1], tile = 32): Position {
  const point = combatPosition(screen, camera, tile)
  return { x: Math.floor(point.x + .5), y: Math.floor(point.y + .5) }
}
// UI gesture history only. Authoritative painting always goes through paintLandscape.
export class LandscapeStroke {
  private previous: Position | null = null
  private world: World | null = null
  private mode: Decoration | null = null
  private size: BrushSize = 1
  begin(world: World, point: Position, mode: Decoration | null, size: BrushSize) {
    this.world = world; this.previous = point; this.mode = mode; this.size = size
    return paintLandscape(world, point, point, mode, size)
  }
  move(world: World, point: Position, mode: Decoration | null, size: BrushSize) {
    if (!this.previous || this.world !== world || this.mode !== mode || this.size !== size) { this.end(); return 0 }
    if (point.x === this.previous.x && point.y === this.previous.y) return 0
    const changed = paintLandscape(world, this.previous, point, mode, size)
    this.previous = point
    return changed
  }
  end() { this.previous = null; this.world = null }
}
