import type Phaser from 'phaser'
import { BOARDING_MS, rowboatPosition } from '../simulation/rowboat'
import type { World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { drawPete } from './peteVisuals'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'

export function drawRowboat(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const s = world.peace, boat = s.boat
  if (!boat) return
  const pos = rowboatPosition(boat), p = world.pete
  const x = (pos.x + .5) * tile, y = (pos.y + .5) * tile
  if (!visiblePoint(view, x, y, tile * 3)) return
  const t = Math.min(1, (world.timeMs - s.sinceMs) / BOARDING_MS)
  const seated = boat.phase === 'rowing' || (boat.phase === 'boarding' ? t >= .8 : t < .2)
  const stroke = boat.phase === 'rowing' ? Math.sin(world.timeMs / 650) : 0
  const next = boat.next ?? boat.path[0] ?? boat.tile
  const angle = next === boat.tile ? 0 : Math.atan2(Math.floor(next / SIZE) - Math.floor(boat.tile / SIZE), next % SIZE - boat.tile % SIZE)
  g.save().translateCanvas(x, y).rotateCanvas(angle)
  const ripple = (world.timeMs % 2400) / 2400
  g.lineStyle(1, 0xbad6cf, (1 - ripple) * .3).strokeEllipse(-2, 0, 40 + ripple * 10, 23 + ripple * 6)
  g.lineStyle(1, 0xbad6cf, .15).strokeEllipse(-7, 0, 49, 29)
  g.fillStyle(0x61462f).fillEllipse(0, 0, 35, 19)
  g.fillStyle(0xb98a55).fillEllipse(0, -1, 32, 16)
  g.fillStyle(0x735033).fillEllipse(0, -1, 25, 11)
  g.lineStyle(2, 0xd5ad78).strokeEllipse(0, -1, 32, 16)
  g.lineStyle(3, 0xb98a55).lineBetween(-4, -6, -4, 5).lineBetween(7, -5, 7, 4)
  for (const sign of [-1, 1]) {
    g.lineStyle(2, 0xd5b583).lineBetween(-2, sign * 5, stroke * 6 - 5, sign * 17)
    g.lineStyle(4, 0xb68958).lineBetween(stroke * 6 - 5, sign * 17, stroke * 7 - 8, sign * 21)
  }
  g.restore()
  if (seated) {
    // A small upright seated pose keeps Pete identifiable in every boat heading.
    g.fillStyle(0x47783c).fillEllipse(x, y - 2, 11, 9)
    g.fillStyle(0x91dd60).fillCircle(x, y - 8, 6).fillTriangle(x - 4, y - 9, x - 10, y - 12, x - 6, y - 5).fillTriangle(x + 4, y - 9, x + 10, y - 12, x + 6, y - 5)
    g.fillStyle(0xffe4a0).fillCircle(x - 2, y - 9, 1.4).fillCircle(x + 2, y - 9, 1.4)
    g.lineStyle(2, 0x91dd60).lineBetween(x - 3, y - 1, x - 9, y + stroke * 2).lineBetween(x + 3, y - 1, x + 9, y - stroke * 2)
  } else {
    const progress = boat.phase === 'boarding' ? t / .8 : (1 - t) / .8
    const ease = progress * progress * (3 - 2 * progress)
    drawPete(g, { ...world, pete: { ...p, x: p.x + (pos.x - p.x) * ease, y: p.y + (pos.y - p.y) * ease } }, tile, view)
  }
}
