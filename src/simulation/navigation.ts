import { GATE_OPEN_MS } from './gardenGate'
import { SIZE, inside } from './world'
import type { World } from './world'

export function neighboringTiles(tile: number): number[] {
  const x = tile % SIZE, y = Math.floor(tile / SIZE)
  return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].filter(([a, b]) => inside(a, b)).map(([a, b]) => b * SIZE + a)
}
export function walkableTile(world: World, tile: number, peteGates = false): boolean {
  if (peteGates && serviceCrossing(world, tile)) return true
  return tile >= 0 && tile < SIZE * SIZE && (world.water[tile] && world.buildings[tile]?.kind === 'footbridge' || (!world.water[tile] && (!world.buildings[tile] || (world.buildings[tile]?.kind === 'peteFence' && world.chickenRun?.tiles.slice(0, world.chickenRun.built).includes(tile)) || (world.buildings[tile]?.kind === 'peteGate' && (peteGates || world.buildings[tile].openMs === GATE_OPEN_MS)))))
}
export function serviceCrossing(world: World, tile: number): boolean {
  const s = world.homestead?.infrastructure, b = world.buildings[tile]
  return !!s && !world.water[tile] && (b?.kind === 'belt' || b?.kind === 'inserter') && [...s.links, ...(s.plan ? [s.plan] : [])].some(link => link.parts.some(p => p.tile === tile && p.kind === b.kind))
}
export function reachableTiles(world: World, start: number, footbridges = true, peteGates = false): Map<number, number> {
  const queue = [start], parents = new Map<number, number>([[start, -1]])
  for (let head = 0; head < queue.length; head++) for (const tile of neighboringTiles(queue[head])) {
    if ((footbridges ? walkableTile(world, tile, peteGates) : !world.water[tile] && !world.buildings[tile]) && !parents.has(tile)) { parents.set(tile, queue[head]); queue.push(tile) }
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

// Pete may plan through his closed gate; movement still waits for the opening animation.
export function peteWalkableTile(world: World, tile: number): boolean { return walkableTile(world, tile, true) }
export function peteReachableTiles(world: World, start: number): Map<number, number> { return reachableTiles(world, start, true, true) }
