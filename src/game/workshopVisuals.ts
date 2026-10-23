import type Phaser from 'phaser'
import type { PeteWorkshop, World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function drawWorkshop(g: Phaser.GameObjects.Graphics, workshop: PeteWorkshop, tile: number, progress = 1): void {
  const x = workshop.x * tile, y = workshop.y * tile
  g.fillStyle(0x554b3a).fillRoundedRect(x + 2, y + 24, 29, 6, 2)
  g.fillStyle(0xc39a65).fillRect(x + 4, y + 8, 3, 19).fillRect(x + 26, y + 8, 3, 19)
  if (progress < .3) return
  g.fillStyle(0x956e49).fillRect(x + 7, y + 9, 19, 14)
  g.lineStyle(1, 0xc8a273).lineBetween(x + 8, y + 12, x + 25, y + 12).lineBetween(x + 8, y + 17, x + 25, y + 17)
  if (progress < .6) return
  g.fillStyle(0x657c81).fillTriangle(x + 1, y + 10, x + 16, y + 1, x + 32, y + 10)
  g.lineStyle(1, 0xa6b5af).lineBetween(x + 4, y + 8, x + 16, y + 2).lineBetween(x + 18, y + 3, x + 26, y + 8)
  // Tool rack and anvil remain legible at a single tile's normal pixel scale.
  g.lineStyle(2, 0x634c37).lineBetween(x + 10, y + 13, x + 24, y + 13)
  g.lineStyle(1, 0xd5b782).lineBetween(x + 12, y + 12, x + 12, y + 19).lineBetween(x + 21, y + 12, x + 21, y + 18)
  g.fillStyle(0xaebfc0).fillRect(x + 10, y + 14, 5, 2).fillRect(x + 19, y + 17, 4, 3)
  if (progress < .85) return
  g.fillStyle(0x46585c).fillRect(x + 13, y + 23, 8, 5).fillRect(x + 10, y + 27, 14, 2)
  g.fillStyle(0xb6c9cb).fillRect(x + 10, y + 20, 14, 4).fillTriangle(x + 5, y + 20, x + 11, y + 20, x + 11, y + 24)
}
export function drawWorkshopActivity(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  if (world.peace.activity !== 'hammering' || !visiblePoint(view, (world.pete.x + .5) * tile, (world.pete.y + .5) * tile, tile)) return
  const p = world.pete, target = world.workshopProject!.tiles[0]
  const x = (p.x + .5) * tile, y = (p.y + .5) * tile, dx = Math.sign(target % SIZE - p.x) || 1
  const swing = Math.sin((world.timeMs - world.peace.sinceMs) / 150)
  g.lineStyle(3, 0x91dd60).lineBetween(x + dx * 5, y + 3, x + dx * 13, y - 5)
  g.save().translateCanvas(x + dx * 13, y - 5).rotateCanvas(swing * .7)
  g.fillStyle(0xbf9760).fillRect(-1, -10, 2, 12)
  g.fillStyle(0xc4d4d2).fillRoundedRect(-5, -12, 10, 4, 1).restore()
  if (swing > .7) g.lineStyle(1, 0xf0d083, .7).lineBetween(x + dx * 19, y + 3, x + dx * 23, y).lineBetween(x + dx * 20, y + 6, x + dx * 25, y + 8)
}
