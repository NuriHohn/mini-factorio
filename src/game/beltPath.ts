import { offsets, opposite } from '../simulation/world'
import type { Direction, Position } from '../simulation/world'

// Tile-local coordinates, centered at (0, 0), with edges at +/- 0.5.
// The same centerline drives Phaser lane strokes and ore positions.
export function beltPathPoint(entry: Direction, output: Direction, progress: number): Position {
  const t = Math.max(0, Math.min(1, progress))
  const start = offsets[entry], end = offsets[output]
  if (entry === opposite(output)) {
    return { x: (start.x * (1 - t) + end.x * t) / 2, y: (start.y * (1 - t) + end.y * t) / 2 }
  }
  const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2
  const rx = -end.x / 2, ry = -end.y / 2
  const turn = end.x * start.y - end.y * start.x
  const angle = turn * Math.PI / 2 * t
  return { x: cx + rx * Math.cos(angle) - ry * Math.sin(angle), y: cy + rx * Math.sin(angle) + ry * Math.cos(angle) }
}
