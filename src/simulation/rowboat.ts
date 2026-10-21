import { neighboringTiles, tilePath } from './navigation'
import { inside, offsets, SIZE } from './world'
import type { FishingDock, World } from './world'

export const ROWBOAT_TILE_MS = 2000
export const BOARDING_MS = 1500
export const ROWBOAT_RANGE = 6
export const ROWBOAT_VISIT_LIMIT = 64
export interface RowboatTrip {
  dock: number
  phase: 'boarding' | 'rowing' | 'landing'
  tile: number
  next: number | null
  travelMs: number
  path: number[]
}
export function launchTile(world: World, dock: FishingDock): number | null {
  const d = offsets[dock.direction], x = dock.x + d.x, y = dock.y + d.y, tile = y * SIZE + x
  return inside(x, y) && world.water[tile] && !world.buildings[tile] ? tile : null
}
// Bounded cardinal BFS on water only. Keep the reverse path so every ordinary
// trip returns to its launch tile without a second search or random stream.
export function planRowboat(world: World, dock: FishingDock): RowboatTrip | null {
  const start = launchTile(world, dock)
  if (start === null) return null
  const parents = new Map<number, number>([[start, -1]]), depth = new Map([[start, 0]]), queue = [start]
  let goal = start
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head], distance = depth.get(tile)!
    if (distance > depth.get(goal)!) goal = tile
    if (distance >= ROWBOAT_RANGE) continue
    for (const next of neighboringTiles(tile)) {
      if (parents.size >= ROWBOAT_VISIT_LIMIT) break
      if (!world.water[next] || world.buildings[next] || parents.has(next)) continue
      parents.set(next, tile); depth.set(next, distance + 1); queue.push(next)
    }
  }
  if (depth.get(goal)! < 3) return null
  const outward = tilePath(parents, goal)!
  return { dock: dock.y * SIZE + dock.x, phase: 'boarding', tile: start, next: null, travelMs: 0, path: [...outward, ...[start, ...outward.slice(0, -1)].reverse()] }
}
export function rowboatValid(world: World, boat: RowboatTrip, dock: FishingDock): boolean {
  const launch = launchTile(world, dock), route = [boat.tile, ...(boat.next === null ? [] : [boat.next]), ...boat.path]
  return boat.dock === dock.y * SIZE + dock.x && launch !== null && route.at(-1) === launch && route.every((tile, i) => Math.abs(tile % SIZE - launch % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(launch / SIZE)) <= ROWBOAT_RANGE && world.water[tile] && !world.buildings[tile] && (i === 0 || neighboringTiles(route[i - 1]).includes(tile)))
}
export function rowboatPosition(boat: RowboatTrip) {
  const next = boat.next ?? boat.tile, t = boat.travelMs / ROWBOAT_TILE_MS
  return { x: boat.tile % SIZE + (next % SIZE - boat.tile % SIZE) * t, y: Math.floor(boat.tile / SIZE) + (Math.floor(next / SIZE) - Math.floor(boat.tile / SIZE)) * t }
}
export function moveRowboat(boat: RowboatTrip, delta: number): boolean {
  boat.next ??= boat.path.shift() ?? null
  if (boat.next === null) return true
  boat.travelMs = Math.min(ROWBOAT_TILE_MS, boat.travelMs + delta)
  if (boat.travelMs === ROWBOAT_TILE_MS) { boat.tile = boat.next; boat.next = null; boat.travelMs = 0 }
  return boat.next === null && boat.path.length === 0
}
