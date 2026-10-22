import type Phaser from 'phaser'
import { inside, SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import { isWater, terrainRevision } from '../simulation/waterTerrain'

function hash(x: number, y: number): number {
  let n = Math.imul(x + 137, 374761393) ^ Math.imul(y + 79, 668265263)
  n = Math.imul(n ^ n >>> 13, 1274126177)
  return ((n ^ n >>> 16) >>> 0) / 4294967296
}
const smooth = (n: number) => n * n * (3 - 2 * n)
// Broad, continuous patches with small per-tile gaps rather than a uniform fringe.
function density(x: number, y: number): number {
  const gx = Math.floor(x / 4), gy = Math.floor(y / 4), tx = smooth(x / 4 - gx), ty = smooth(y / 4 - gy)
  const a = hash(gx, gy) * (1 - tx) + hash(gx + 1, gy) * tx
  const b = hash(gx, gy + 1) * (1 - tx) + hash(gx + 1, gy + 1) * tx
  return a * (1 - ty) + b * ty
}
export interface ShorePlant { tile: number; edge: number; seed: number; cattail: boolean; animated: boolean }
export function shorePlants(world: World): ShorePlant[] {
  const plants: ShorePlant[] = []
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!isWater(world, x, y) || density(x, y) < .48 || hash(x * 7, y * 11) < .18) continue
    const edges = [[0, -1], [1, 0], [0, 1], [-1, 0]].flatMap(([dx, dy], edge) => inside(x + dx, y + dy) && !isWater(world, x + dx, y + dy) ? [edge] : [])
    if (!edges.length) continue
    let blocked = false
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy) && world.buildings[(y + dy) * SIZE + x + dx]) blocked = true
    if (blocked) continue
    const seed = Math.floor(hash(x * 13, y * 17) * 65536)
    plants.push({ tile: y * SIZE + x, edge: edges[seed % edges.length], seed, cattail: seed % 3 === 0, animated: seed % 4 === 0 })
  }
  return plants
}
export function plantSway(plant: ShorePlant, timeMs: number): number {
  return plant.animated ? Math.sin(timeMs / 3500 + plant.seed) * 1.1 : 0
}
export function drawShorePlant(g: Phaser.GameObjects.Graphics, plant: ShorePlant, timeMs: number, tile: number): void {
  const px = plant.tile % SIZE * tile, py = Math.floor(plant.tile / SIZE) * tile, scale = tile / 32
  const x = px + (plant.edge === 1 ? 27 : plant.edge === 3 ? 5 : 16) * scale
  const y = py + (plant.edge === 0 ? 7 : plant.edge === 2 ? 27 : 21) * scale
  const sway = plantSway(plant, timeMs) * scale
  g.fillStyle(0x395c49, .3).fillEllipse(x, y + scale, 13 * scale, 3 * scale)
  for (let stem = 0; stem < 4; stem++) {
    const xx = x + (stem * 3 - 4.5) * scale, height = (8 + (plant.seed + stem * 7) % 6) * scale
    const tip = xx + sway + (stem - 1.5) * scale
    g.lineStyle(scale, stem % 2 ? 0x8d9f60 : 0x718b51, .95).lineBetween(xx, y, tip, y - height)
    g.lineStyle(scale, 0x9aab6c, .85).lineBetween(xx, y - 2 * scale, xx + (stem % 2 ? 4 : -3) * scale + sway / 2, y - 7 * scale)
    if (plant.cattail && stem % 2 === 0) g.fillStyle(0x765338).fillRoundedRect(tip - 1.5 * scale, y - height - 3 * scale, 3 * scale, 5 * scale, scale)
  }
}
// Derived rendering cache only. Terrain/topology changes invalidate it, not camera or time.
export class ShoreVegetation {
  private world: World | null = null
  private terrain = -1
  private topology = -1
  private plants: ShorePlant[] = []
  sites(world: World): readonly ShorePlant[] {
    const terrain = terrainRevision(world)
    if (this.world !== world || this.terrain !== terrain || this.topology !== world.topologyRevision) {
      this.world = world; this.terrain = terrain; this.topology = world.topologyRevision
      this.plants = shorePlants(world)
    }
    return this.plants
  }
  draw(g: Phaser.GameObjects.Graphics, world: World, view: { x: number; y: number; width: number; height: number }, tile: number): void {
    for (const plant of this.sites(world)) {
      const x = plant.tile % SIZE * tile, y = Math.floor(plant.tile / SIZE) * tile
      if (x + tile >= view.x && x <= view.x + view.width && y + tile >= view.y && y - tile / 2 <= view.y + view.height) drawShorePlant(g, plant, world.timeMs, tile)
    }
  }
}
