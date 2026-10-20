import { offsets, opposite } from '../simulation/world'
import type { Direction, Position } from '../simulation/world'
import { splitterDirections } from '../simulation/splitters'
import type { SplitterOutput } from '../simulation/splitters'
export function splitterInputPoint(direction: Direction, progress: number): Position {
  const rear = offsets[opposite(direction)], t = Math.max(0, Math.min(1, progress))
  return { x: rear.x * (1 - t) / 2, y: rear.y * (1 - t) / 2 }
}
export function splitterOutputPoint(direction: Direction, output: SplitterOutput, progress: number): Position {
  const t = Math.max(0, Math.min(1, progress)), d = offsets[direction], end = offsets[splitterDirections(direction)[output]]
  if (output === 0) return { x: end.x * t / 2, y: end.y * t / 2 }
  // Cubic: continue the incoming tangent, then leave parallel to the side output belt.
  const forward = 3 * (1 - t) ** 2 * t * .2
  const side = 3 * (1 - t) * t * t * .3 + t ** 3 * .5
  return { x: d.x * forward + end.x * side, y: d.y * forward + end.y * side }
}
