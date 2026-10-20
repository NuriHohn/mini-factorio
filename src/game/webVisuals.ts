import type Phaser from 'phaser'
import { WEB_FLIGHT_MS, MAX_GROUND_WEBS } from '../simulation/webs'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
export function drawWeb(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, alpha = 1): void {
  g.lineStyle(1.2, 0xeaf3f5, alpha)
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4
    g.lineBetween(x, y, x + Math.cos(a) * radius, y + Math.sin(a) * radius * .65)
  }
  g.strokeEllipse(x, y, radius * 1.1, radius * .7).strokeEllipse(x, y, radius * 1.8, radius * 1.15)
}
export class WebVisuals {
  private world: World | null = null
  private previous: { tile: number; expiresAtMs: number }[] = []
  private fading: { tile: number; expiresAtMs: number }[] = []
  draw(g: Phaser.GameObjects.Graphics, world: World, tile: number): void {
    if (this.world !== world) { this.world = world; this.previous = []; this.fading = [] }
    this.fading = [...this.fading, ...this.previous.filter(w => w.expiresAtMs <= world.timeMs)].filter(w => world.timeMs - w.expiresAtMs < 500).slice(-MAX_GROUND_WEBS)
    for (const w of this.fading) drawWeb(g, (w.tile % SIZE + .5) * tile, (Math.floor(w.tile / SIZE) + .5) * tile, 13 + (world.timeMs - w.expiresAtMs) / 100, .7 * (1 - (world.timeMs - w.expiresAtMs) / 500))
    this.previous = []
    for (const w of world.webs.patches) {
      const x = w.tile % SIZE, y = Math.floor(w.tile / SIZE)
      if (world.timeMs < w.landsAtMs) {
        const t = Math.max(0, Math.min(1, (world.timeMs - w.launchedAtMs) / WEB_FLIGHT_MS))
        drawWeb(g, (w.from.x + .5 + (x - w.from.x) * t) * tile, (w.from.y + .5 + (y - w.from.y) * t) * tile - Math.sin(t * Math.PI) * 15, 5 + t * 5)
      } else {
        drawWeb(g, (x + .5) * tile, (y + .5) * tile + 3, 14, .9)
        this.previous.push({ tile: w.tile, expiresAtMs: w.expiresAtMs })
      }
    }
  }
}
