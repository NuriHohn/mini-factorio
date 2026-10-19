export const SIZE = 40
export const INTERVAL = 1000
export interface Miner { x: number; y: number; elapsed: number }
export interface World { tiles: boolean[]; miners: Miner[]; ore: number }
export function createWorld(random = Math.random): World {
  const tiles = Array.from({ length: SIZE * SIZE }, () => false)
  for (let n = 0; n < 45; n++) {
    const cx = Math.floor(random() * SIZE), cy = Math.floor(random() * SIZE)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy
      if (x >= 0 && y >= 0 && x < SIZE && y < SIZE && dx * dx + dy * dy <= 5 && random() < .7) tiles[y * SIZE + x] = true
    }
  }
  tiles[20 * SIZE + 20] = true
  return { tiles, miners: [], ore: 0 }
}
export function placementError(world: World, x: number, y: number): string | null {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SIZE || y >= SIZE) return 'Choose a tile inside the world.'
  if (!world.tiles[y * SIZE + x]) return 'Place mining machines on iron deposits.'
  if (world.miners.some(m => m.x === x && m.y === y)) return 'This tile already has a miner.'
  return null
}
export function placeMiner(world: World, x: number, y: number): boolean {
  if (placementError(world, x, y)) return false
  world.miners.push({ x, y, elapsed: 0 })
  return true
}
export function advanceMining(world: World, delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) return
  for (const miner of world.miners) {
    miner.elapsed += delta
    world.ore += Math.floor(miner.elapsed / INTERVAL)
    miner.elapsed %= INTERVAL
  }
}

