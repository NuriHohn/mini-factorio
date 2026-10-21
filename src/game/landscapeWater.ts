import type Phaser from 'phaser'
import { isWater, shoreline, shorelineCorners, terrainRevision } from '../simulation/waterTerrain'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
const hash = (n: number) => (Math.imul(n + 71, 1103515245) ^ Math.imul(n + 9, 2654435761)) >>> 0
export interface WaterLife { tile: number; kind: 'fish' | 'bubbles'; t: number; alpha: number }
// Three bounded cosmetic schedules with 15–31 second quiet periods. No RNG or entities.
export function waterLife(sites: number[], deep: number[], timeMs: number): WaterLife[] {
  if (!sites.length) return []
  const result: WaterLife[] = []
  for (let slot = 0; slot < Math.min(3, Math.ceil(sites.length / 4)); slot++) {
    const period = 19000 + slot * 7000, clock = timeMs + slot * 4700
    const cycle = Math.floor(clock / period), age = clock % period
    if (age < 4000 || age >= 6800) continue
    const fish = slot === 1 && deep.length > 0, candidates = fish ? deep : sites
    const tile = candidates[hash(cycle * 13 + slot) % candidates.length], t = (age - 4000) / 2800
    result.push({ tile, kind: fish ? 'fish' : 'bubbles', t, alpha: Math.sin(t * Math.PI) * .65 })
  }
  return result
}
const WATER_COLOR = 0x4e7d80
const BANK_COLOR = 0x98aa80
export function drawWaterTile(g: Phaser.GameObjects.Graphics, world: World, x: number, y: number, tile: number) {
  const px = x * tile, py = y * tile, mask = shoreline(world, x, y), seed = hash(y * SIZE + x)
  const corners = shorelineCorners(world, x, y), radius = tile * .31
  if (!isWater(world, x, y)) {
    // Round a concave water corner in the diagonal land tile. This joins the
    // neighboring straight banks without a square bite or disconnected seam.
    for (let i = 0; i < 4; i++) if (corners[i] === 'inlet') {
      const east = i === 1 || i === 2, south = i >= 2
      g.save().translateCanvas(px + (east ? tile : 0), py + (south ? tile : 0)).scaleCanvas(east ? -1 : 1, south ? -1 : 1)
      g.fillStyle(WATER_COLOR).beginPath().moveTo(0, 0).lineTo(radius, 0).arc(radius, radius, radius, -Math.PI / 2, -Math.PI, true).lineTo(0, 0).closePath().fillPath()
      g.lineStyle(2, BANK_COLOR, .8).beginPath().arc(radius, radius, radius, -Math.PI / 2, -Math.PI, true).strokePath().restore()
    }
    return
  }
  const r = corners.map(c => c === 'convex' ? radius : 0)
  g.fillStyle(WATER_COLOR).fillRoundedRect(px, py, tile, tile, { tl: r[0], tr: r[1], br: r[2], bl: r[3] })
  g.lineStyle(2, BANK_COLOR, .8)
  if (mask & 1) g.lineBetween(px + r[0], py, px + tile - r[1], py)
  if (mask & 2) g.lineBetween(px + tile, py + r[1], px + tile, py + tile - r[2])
  if (mask & 4) g.lineBetween(px + r[3], py + tile, px + tile - r[2], py + tile)
  if (mask & 8) g.lineBetween(px, py + r[0], px, py + tile - r[3])
  for (let i = 0; i < 4; i++) if (r[i]) {
    const east = i === 1 || i === 2, south = i >= 2
    g.save().translateCanvas(px + (east ? tile : 0), py + (south ? tile : 0)).scaleCanvas(east ? -1 : 1, south ? -1 : 1)
    g.beginPath().arc(radius, radius, radius, Math.PI, Math.PI * 1.5).strokePath().restore()
  }
  if (mask && seed % 7 === 0) {
    const xx = px + (mask & 8 ? 4 : mask & 2 ? tile - 4 : 12), yy = py + (mask & 1 ? 5 : tile - 5)
    g.lineStyle(1, 0xabc08a, .75).lineBetween(xx, yy + 3, xx - 2, yy - 4).lineBetween(xx + 3, yy + 3, xx + 4, yy - 5)
  } else if (!mask && seed % 17 === 0) g.fillStyle(0x83a878, .7).fillEllipse(px + 20, py + 19, 7, 4)
}
export class LandscapeWater {
  private world: World | null = null
  private revision = -1
  private sites: number[] = []
  private deep: number[] = []
  draw(g: Phaser.GameObjects.Graphics, world: World, view: { x: number; y: number; width: number; height: number }, tile: number) {
    const revision = terrainRevision(world)
    if (this.world !== world || this.revision !== revision) {
      this.world = world; this.revision = revision; this.sites = []; this.deep = []
      for (let i = 0; i < world.water.length; i++) if (world.water[i]) {
        this.sites.push(i)
        let deep = true
        for (let dy = -1; dy <= 1 && deep; dy++) for (let dx = -1; dx <= 1; dx++) if (!isWater(world, i % SIZE + dx, Math.floor(i / SIZE) + dy)) { deep = false; break }
        if (deep) this.deep.push(i)
      }
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
