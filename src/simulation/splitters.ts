import { DIRECTIONS, offsets, opposite } from './world'
import type { Direction, Position, Splitter } from './world'

export const SPLITTER_STAGE_MS = 250
export type SplitterOutput = 0 | 1
export function splitterDirections(direction: Direction): [Direction, Direction] {
  return [direction, DIRECTIONS[(DIRECTIONS.indexOf(direction) + 3) % 4]]
}
export function splitterPorts(splitter: Pick<Splitter, 'x' | 'y' | 'direction'>): { input: Position; outputs: [Position, Position] } {
  const rear = offsets[opposite(splitter.direction)]
  const outputs = splitterDirections(splitter.direction).map(direction => {
    const d = offsets[direction]
    return { x: splitter.x + d.x, y: splitter.y + d.y }
  }) as [Position, Position]
  return { input: { x: splitter.x + rear.x, y: splitter.y + rear.y }, outputs }
}
