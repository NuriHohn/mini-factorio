import { drawPeteOutfit, peteOutfit } from './peteOutfit'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
import type Phaser from 'phaser'
import { SLIP_MS, SPRAY_MS, SPRINKLER_COOLDOWN_MS, sprinklerPowered } from '../simulation/sprinklers'
import { SIZE } from '../simulation/world'
import type { Sprinkler, World } from '../simulation/world'

export function drawSprinkler(g: Phaser.GameObjects.Graphics, world: World, building: Sprinkler, tile: number): void {
  const x = (building.x + .5) * tile, y = (building.y + .5) * tile
  const active = world.pete.mode === 'SPRAYED' && world.pete.water?.source === building.y * SIZE + building.x
  const angle = active ? Math.atan2(world.pete.y - building.y, world.pete.x - building.x) : -.6
  g.fillStyle(0x172d38).fillRoundedRect(x - 13, y - 12, 26, 25, 4)
  g.lineStyle(2, 0x72c5dc).strokeRoundedRect(x - 11, y - 10, 22, 21, 3)
  g.fillStyle(0x4d8799).fillCircle(x, y + 1, 8)
  g.lineStyle(5, 0xb8e6e9).lineBetween(x, y, x + Math.cos(angle) * 13, y + Math.sin(angle) * 13)
  g.fillStyle(0x63b9f0).fillCircle(x, y, 4)
  if (building.cooldownUntilMs > world.timeMs) {
    const progress = 1 - (building.cooldownUntilMs - world.timeMs) / SPRINKLER_COOLDOWN_MS
    g.fillStyle(0x18343e).fillRect(x - 10, y + 10, 20, 2)
    g.fillStyle(0x79d5f2).fillRect(x - 10, y + 10, 20 * progress, 2)
  }
}
// At most 14 decorative marks, sampled from rendered positions. Never simulation entities.
export class WaterVisuals {
  private world: World | null = null
  private puddles: { x: number; y: number; atMs: number }[] = []
  private lastSampleMs = -400
  draw(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
    if (this.world !== world) { this.world = world; this.puddles = []; this.lastSampleMs = world.timeMs - 400 }
    this.puddles = this.puddles.filter(p => world.timeMs >= p.atMs && world.timeMs - p.atMs < 5000)
    if (world.pete.mode === 'WATER_FLEEING' && world.timeMs - this.lastSampleMs >= 400) {
      this.puddles.push({ x: world.pete.x, y: world.pete.y, atMs: world.timeMs })
      this.puddles = this.puddles.slice(-14); this.lastSampleMs = world.timeMs
    }
    for (const p of this.puddles) {
      if (!visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, 32)) continue
      const alpha = .45 * (1 - (world.timeMs - p.atMs) / 5000)
      g.fillStyle(0x62c8ee, alpha).fillEllipse((p.x + .5) * tile, (p.y + .5) * tile + 9, 17, 6)
    }
    const p = world.pete, water = p.water
    if (!water || !visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, 160)) return
    const x = (p.x + .5) * tile, y = (p.y + .5) * tile
    if (p.mode === 'SLIPPING') {
      const t = 1 - water.remainingMs / SLIP_MS
      g.lineStyle(2, 0x89e5ff, 1 - t).strokeEllipse(x, y + 10, 10 + t * 35, 4 + t * 10)
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3
        g.fillStyle(0x89e5ff, 1 - t).fillCircle(x + Math.cos(a) * t * 25, y + 8 - Math.abs(Math.sin(a)) * Math.sin(t * Math.PI) * 18, 2)
      }
    }
    if (p.mode !== 'SPRAYED' || water.source === null || !sprinklerPowered(world, water.source)) return
    const source = world.buildings[water.source]!
    const sx = (source.x + .5) * tile, sy = (source.y + .5) * tile
    // Draw a travelling, connected arc instead of independent particle emitters.
    const point = (t: number) => ({ x: sx + (x - sx) * t, y: sy + (y - 4 - sy) * t - Math.sin(t * Math.PI) * 10 })
    const reach = Math.min(1, (1 - water.remainingMs / SPRAY_MS) * 8)
    for (let i = 0; i < 12; i++) {
      const a = point(i / 12 * reach), b = point((i + 1) / 12 * reach)
      g.lineStyle(3, 0x66c9ff, .8).lineBetween(a.x, a.y, b.x, b.y)
    }
    for (let i = 0; i < 8; i++) {
      const t = (world.timeMs / 350 + i / 8) % 1, q = point(t * reach)
      g.fillStyle(0xc4f5ff, .9).fillCircle(q.x, q.y, 1.5)
      g.fillStyle(0x70ceff, .7).fillCircle(x + Math.sin(world.timeMs / 70 + i * 2) * 12, y + 6 + Math.cos(i * 3 + world.timeMs / 90) * 9, 1.5)
    }
  }
}
export function drawWetPete(g: Phaser.GameObjects.Graphics, world: World, tile: number): void {
  const p = world.pete, slip = p.mode === 'SLIPPING', running = p.mode === 'WATER_FLEEING'
  const t = slip ? 1 - p.water!.remainingMs / SLIP_MS : 0
  const x = (p.x + .5) * tile, y = (p.y + .5) * tile
  const bob = running && p.next !== null ? Math.sin(world.timeMs / 45) * 3 : 0
  const hx = x + (slip ? Math.sin(t * Math.PI / 2) * 8 : 0), hy = y - 5 + (slip ? t * 10 : bob)
  g.fillStyle(0x101811, .4).fillEllipse(x, y + 11, 24, 8)
  const outfit = peteOutfit(world.personality)
  drawPeteOutfit(g, outfit, hx, hy + 4, 'back')
  g.fillStyle(0x523a28).fillEllipse(x, y + 6, slip ? 20 : 14, slip ? 10 : 14)
  g.fillStyle(0x253125).fillEllipse(x - 5, y + 13 - (slip ? t * 12 : bob), 8, 4).fillEllipse(x + 5, y + 13 + (slip ? -t * 12 : bob), 8, 4)
  g.lineStyle(3, 0x91dd60).lineBetween(x - 5, y + 4, x - 17, y - 3 - Math.sin(world.timeMs / 70) * 4).lineBetween(x + 5, y + 4, x + 17, y - 3 + Math.sin(world.timeMs / 70) * 4)
  g.fillStyle(0x73c947).fillTriangle(hx - 6, hy - 5, hx - 15, hy - 8, hx - 8, hy + 2).fillTriangle(hx + 6, hy - 5, hx + 15, hy - 8, hx + 8, hy + 2)
  g.fillStyle(0x91dd60).fillEllipse(hx, hy, 20, 18)
  g.fillStyle(0xeaa93e).fillEllipse(hx, hy - 9, 17, 7)
  g.fillStyle(0x719847).fillRect(hx - 1, hy - 15, 3, 5)
  g.fillStyle(0xfff2b6).fillCircle(hx - 4, hy, 3).fillCircle(hx + 4, hy, 3)
  g.fillStyle(0x17251b).fillCircle(hx - 4, hy, 1.5).fillCircle(hx + 4, hy, 1.5)
  g.lineStyle(2, 0x36582a).lineBetween(hx - 8, hy - 5, hx - 2, hy - 3).lineBetween(hx + 2, hy - 3, hx + 8, hy - 5)
  g.lineStyle(2, 0x36582a).strokeEllipse(hx, hy + 6, 7, running ? 6 : 3)
  drawPeteOutfit(g, outfit, hx, hy + 4, 'front')
  for (let i = 0; i < 4; i++) {
    const fall = (world.timeMs / 500 + i / 4) % 1
    g.fillStyle(0x7fe5ff, .9).fillEllipse(hx - 8 + i * 5, hy + fall * 13, 2, 4)
  }
  if (p.mode === 'COMPLAINING') {
    g.fillStyle(0xfff3c9).fillRoundedRect(x - 38, y - 47, 76, 20, 5).fillTriangle(x - 8, y - 27, x - 2, y - 20, x + 3, y - 27)
    g.lineStyle(1, 0x946d35).strokeRoundedRect(x - 38, y - 47, 76, 20, 5)
  }
}
