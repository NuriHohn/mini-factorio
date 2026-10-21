import { inside, offsets, SIZE } from './world'
import type { Direction, World } from './world'
import { natureRandom } from './nature'
export const MAX_BRIDGE_SPAN = 5
export const BRIDGE_WOOD = 3
export function isWater(world: Pick<World, 'water'>, x: number, y: number): boolean { return inside(x, y) && world.water[y * SIZE + x] }
// N/E/S/W land bits, with map boundaries treated as a bank.
export function shoreline(world: Pick<World, 'water'>, x: number, y: number): number {
  if (!isWater(world, x, y)) return 0
  return (['north', 'east', 'south', 'west'] as const).reduce((mask, d, i) => mask | (isWater(world, x + offsets[d].x, y + offsets[d].y) ? 0 : 1 << i), 0)
}
export function generateWater(world: World, seed: number): void {
  const rng = { seed: (seed ^ 0x77617465) >>> 0 }, random = () => natureRandom(rng)
  const paint = (x: number, y: number) => {
    if (inside(x, y) && x >= 2 && y >= 2 && x < SIZE - 2 && y < SIZE - 2 && !(x >= 10 && x <= 30 && y >= 10 && y <= 30)) world.water[y * SIZE + x] = true
  }
  for (const [cx, cy] of [[6, 6], [33, 6]]) {
    const rx = 2.5 + random(), ry = 1.6 + random()
    for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1 + .12 * Math.sin(dx * 2 + dy + seed)) paint(cx + dx, cy + dy)
  }
  let x = 5
  for (let y = 13; y <= 28; y++) {
    if (y % 3 === 0) x = Math.max(3, Math.min(7, x + Math.floor(random() * 3) - 1))
    paint(x, y); if (y % 4 !== 0) paint(x + 1, y)
  }
  let y = 34
  for (let xx = 14; xx <= 33; xx++) {
    if (xx % 4 === 0) y = Math.max(33, Math.min(35, y + Math.floor(random() * 3) - 1))
    const radius = xx >= 23 && xx <= 26 ? 3 : xx % 5 < 2 ? 2 : 1
    for (let dy = -radius; dy <= radius; dy++) paint(xx, y + dy)
  }
}
// Whole straight crossing; used for geometry validation and safe demolition.
export function bridgeCrossing(world: World, x: number, y: number, direction: Direction): number[] | null {
  if (!isWater(world, x, y)) return null
  const d = offsets[direction], cells = [y * SIZE + x]
  for (const sign of [-1, 1]) {
    let xx = x + sign * d.x, yy = y + sign * d.y
    while (isWater(world, xx, yy) && cells.length <= MAX_BRIDGE_SPAN) { cells.push(yy * SIZE + xx); xx += sign * d.x; yy += sign * d.y }
    if (!inside(xx, yy) || isWater(world, xx, yy)) return null
  }
  return cells.length <= MAX_BRIDGE_SPAN ? cells : null
}

// Derived runtime invalidation only: saves contain the water mask, never these caches.
export const TERRAIN_CHUNK_SIZE = 8
export function terrainChunks(): number { return SIZE / TERRAIN_CHUNK_SIZE }
const terrainChanges = new WeakMap<World, { revision: number; chunks: number[] }>()
export function terrainRevision(world: World): number { return terrainChanges.get(world)?.revision ?? 0 }
export function terrainChunkRevision(world: World, chunk: number): number { return terrainChanges.get(world)?.chunks[chunk] ?? 0 }
export function invalidateTerrain(world: World, tiles: readonly number[]): void {
  if (!tiles.length) return
  let changes = terrainChanges.get(world)
  const chunks = terrainChunks()
  if (!changes) { changes = { revision: 0, chunks: Array<number>(chunks * chunks).fill(0) }; terrainChanges.set(world, changes) }
  changes.revision++
  for (const tile of tiles) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = tile % SIZE + dx, y = Math.floor(tile / SIZE) + dy
    if (inside(x, y)) changes.chunks[Math.floor(y / TERRAIN_CHUNK_SIZE) * chunks + Math.floor(x / TERRAIN_CHUNK_SIZE)] = changes.revision
  }
}
export type ShoreCorner = 'open' | 'edge' | 'convex' | 'concave' | 'inlet' | 'land'
// NW, NE, SE, SW. Diagonals distinguish an inside bay from a continuous surface.
export function shorelineCorners(world: Pick<World, 'water'>, x: number, y: number): ShoreCorner[] {
  const water = isWater(world, x, y)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => {
    const a = isWater(world, x + dx, y), b = isWater(world, x, y + dy), diagonal = isWater(world, x + dx, y + dy)
    if (!water) return a && b && diagonal ? 'inlet' : 'land'
    return !a && !b ? 'convex' : a && b ? diagonal ? 'open' : 'concave' : 'edge'
  })
}
