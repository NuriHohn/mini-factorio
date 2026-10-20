import { splitterDirections } from './splitters'
import { buildingAt, DIRECTIONS, offsets, opposite, SIZE } from './world'
import type { Belt, Direction, World } from './world'

// Topology only: empty and occupied belts have identical connections.
// Rear input is the main lane; side inputs follow source tile order.
export function beltInputs(world: World, belt: Belt): Direction[] {
  const inputs = DIRECTIONS.filter(side => {
    if (side === belt.direction) return false
    const offset = offsets[side]
    const source = buildingAt(world, belt.x + offset.x, belt.y + offset.y)
    if (source?.kind === 'splitter') return splitterDirections(source.direction).includes(opposite(side))
    return (source?.kind === 'belt' || source?.kind === 'miner' || source?.kind === 'furnace' || source?.kind === 'assembler' || source?.kind === 'inserter') && source.direction === opposite(side)
  })
  const rear = opposite(belt.direction)
  return inputs.sort((a, b) => {
    if (a === rear) return -1
    if (b === rear) return 1
    return offsets[a].y * SIZE + offsets[a].x - offsets[b].y * SIZE - offsets[b].x
  })
}
