import type Phaser from 'phaser'
import { isWater, shoreline } from '../simulation/waterTerrain'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
const hash = (n: number) => (Math.imul(n + 71, 1103515245) ^ Math.imul(n + 9, 2654435761)) >>> 0
export interface WaterLife { tile: number; kind: 'fish' | 'bubbles'; t: number; alpha: number }
// Three bounded cosmetic schedules with 15–31 second quiet periods. No RNG or entities.
export function waterLife(sites: number[], deep: number[], timeMs: number): WaterLife[] {
  if (!sites.length) return []
  const result: WaterLife[] = []
  for (let slot = 0; slot < 3; slot++) {
    const period = 19000 + slot * 7000, clock = timeMs + slot * 4700
    const cycle = Math.floor(clock / period), age = clock % period
    if (age < 4000 || age >= 6800) continue
    const fish = slot === 1 && deep.length > 0, candidates = fish ? deep : sites
    const tile = candidates[hash(cycle * 13 + slot) % candidates.length], t = (age - 4000) / 2800
    result.push({ tile, kind: fish ? 'fish' : 'bubbles', t, alpha: Math.sin(t * Math.PI) * .65 })
  }
  return result
}
export function drawWaterTile(g: Phaser.GameObjects.Graphics, world: World, x: number, y: number, tile: number) {
  const px = x * tile, py = y * tile, mask = shoreline(world, x, y), seed = hash(y * SIZE + x)
  g.fillStyle(mask ? 0x527f83 : 0x416f7e).fillRect(px, py, tile, tile)
  g.fillStyle(0x6f9b91, .05).fillEllipse(px + tile / 2, py + tile / 2, tile - 8, tile - 20)
  g.lineStyle(3, 0x95a47b, .9)
  if (mask & 1) g.lineBetween(px, py + 1, px + tile, py + 1)
  if (mask & 2) g.lineBetween(px + tile - 1, py, px + tile - 1, py + tile)
  if (mask & 4) g.lineBetween(px, py + tile - 1, px + tile, py + tile - 1)
  if (mask & 8) g.lineBetween(px + 1, py, px + 1, py + tile)
  for (const [bits, cx, cy] of [[9, px, py], [3, px + tile, py], [6, px + tile, py + tile], [12, px, py + tile]]) if ((mask & bits) === bits) g.fillStyle(0x7e956a).fillCircle(cx, cy, 4)
  if (mask && seed % 7 === 0) {
    const xx = px + (mask & 8 ? 4 : mask & 2 ? tile - 4 : 12), yy = py + (mask & 1 ? 5 : tile - 5)
    g.lineStyle(1, 0xabc08a, .75).lineBetween(xx, yy + 3, xx - 2, yy - 4).lineBetween(xx + 3, yy + 3, xx + 4, yy - 5)
  } else if (!mask && seed % 17 === 0) g.fillStyle(0x83a878, .7).fillEllipse(px + 20, py + 19, 7, 4)
}
export class LandscapeWater {
  private world: World | null = null
  private sites: number[] = []
  private deep: number[] = []
  draw(g: Phaser.GameObjects.Graphics, world: World, view: { x: number; y: number; width: number; height: number }, tile: number) {
    if (this.world !== world) {
      this.world = world; this.sites = world.water.flatMap((water, i) => water ? [i] : [])
      this.deep = this.sites.filter(i => [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => isWater(world, i % SIZE + dx, Math.floor(i / SIZE) + dy))))
    }
    g.clear()
    const visible = (i: number) => { const x = i % SIZE * tile, y = Math.floor(i / SIZE) * tile; return x + tile >= view.x && x <= view.x + view.width && y + tile >= view.y && y <= view.y + view.height }
    for (const i of this.sites) if (!world.buildings[i] && visible(i)) {
      const x = i % SIZE * tile, y = Math.floor(i / SIZE) * tile, sway = Math.sin(world.timeMs / 2300 + i) * 2
      g.lineStyle(1, 0xb4d1c3, .18).lineBetween(x + 8 + sway, y + 13, x + 18 + sway, y + 13).lineBetween(x + 17 - sway, y + 24, x + 24 - sway, y + 24)
    }
    for (const effect of waterLife(this.sites, this.deep, world.timeMs)) {
      if (world.buildings[effect.tile] || !visible(effect.tile)) continue
      const x = (effect.tile % SIZE + .5) * tile, y = (Math.floor(effect.tile / SIZE) + .5) * tile
      if (effect.kind === 'fish') {
        const xx = x + (effect.t - .5) * 13
        g.fillStyle(0xd4c997, effect.alpha * .75).fillEllipse(xx, y, 7, 3).fillTriangle(xx - 3, y, xx - 6, y - 2, xx - 6, y + 2)
      } else for (let b = 0; b < 3; b++) g.lineStyle(1, 0xd0e3d2, effect.alpha).strokeCircle(x + (b - 1) * 4 + Math.sin(effect.t * 3 + b), y + 5 - effect.t * 9 - b * 2, 1 + b * .5)
      g.lineStyle(1, 0xb9d9ca, effect.alpha * .45).strokeEllipse(x, y + 3, 4 + effect.t * 12, 2 + effect.t * 6)
    }
  }
}
