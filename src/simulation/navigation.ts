import { SIZE, inside } from './world'
import type { World } from './world'

export function neighboringTiles(tile: number): number[] {
  const x = tile % SIZE, y = Math.floor(tile / SIZE)
  return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].filter(([a, b]) => inside(a, b)).map(([a, b]) => b * SIZE + a)
}
export function walkableTile(world: World, tile: number): boolean {
  return tile >= 0 && tile < SIZE * SIZE && (world.water[tile] && world.buildings[tile]?.kind === 'footbridge' || (!world.water[tile] && !world.buildings[tile]))
}
export function reachableTiles(world: World, start: number, footbridges = true): Map<number, number> {
  const queue = [start], parents = new Map<number, number>([[start, -1]])
  for (let head = 0; head < queue.length; head++) for (const tile of neighboringTiles(queue[head])) {
    if ((footbridges ? walkableTile(world, tile) : !world.water[tile] && !world.buildings[tile]) && !parents.has(tile)) { parents.set(tile, queue[head]); queue.push(tile) }
  }
  return parents
}
export function tilePath(parents: Map<number, number>, target: number): number[] | null {
  if (!parents.has(target)) return null
  const path: number[] = []
  for (let tile = target; parents.get(tile) !== -1; tile = parents.get(tile)!) path.unshift(tile)
  return path
}
export function edgeTile(tile: number): boolean {
  return tile % SIZE === 0 || tile % SIZE === SIZE - 1 || tile < SIZE || tile >= SIZE * (SIZE - 1)
}
