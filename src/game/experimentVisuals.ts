import type Phaser from 'phaser'
import type { PeteExperiment, World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'

export function drawExperimentTable(g: Phaser.GameObjects.Graphics, table: PeteExperiment, tile: number, progress = 1): void {
  const x = table.x * tile, y = table.y * tile
  g.fillStyle(0x172d26, .3).fillEllipse(x + 16, y + 27, 29, 8)
  g.fillStyle(0x916742).fillRect(x + 5, y + 17, 4, 13).fillRect(x + 23, y + 17, 4, 13)
  if (progress < .3) return
  g.fillStyle(0xc69a65).fillRoundedRect(x + 2, y + 15, 28, 6, 2)
  g.fillStyle(0x566e72).fillRect(x + 7, y + 21, 18, 3)
  if (progress < .6) return
  // Copper coil, pocket-sized gear and a glass bulb: Pete's first harmless invention.
  g.fillStyle(0x526776).fillRoundedRect(x + 5, y + 7, 10, 9, 2)
  for (let n = 0; n < 3; n++) g.lineStyle(2, 0xc78856).strokeEllipse(x + 10, y + 8 + n * 3, 8, 3)
  g.lineStyle(1, 0xe0b779).lineBetween(x + 15, y + 13, x + 23, y + 13)
  if (progress < .85) return
  g.fillStyle(0x6d7973).fillRect(x + 20, y + 11, 6, 5)
  g.fillStyle(0xb5e0db, .85).fillCircle(x + 23, y + 7, 4)
  g.fillStyle(0xf2e8b0).fillCircle(x + 22, y + 6, 1)
  g.fillStyle(0xbc8453).fillCircle(x + 16, y + 17, 3).fillRect(x + 12, y + 16, 8, 2).fillRect(x + 15, y + 13, 2, 8)
  g.fillStyle(0x51616a).fillCircle(x + 16, y + 17, 1)
}

export function drawExperimentActivity(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  if (world.peace.activity !== 'experimenting' || !world.experimentProject || !visiblePoint(view, (world.pete.x + .5) * tile, (world.pete.y + .5) * tile, tile * 2)) return
  const target = world.experimentProject.tiles[0], p = world.pete
  const x = (target % SIZE + .5) * tile, y = (Math.floor(target / SIZE) + .5) * tile
  const phase = (world.timeMs - world.peace.sinceMs) / 350, pulse = (Math.sin(phase) + 1) / 2
  g.fillStyle(0xa5e6d5, .08 + pulse * .12).fillCircle(x + 7, y - 9, 6)
  g.fillStyle(0xf1e8ad, .5 + pulse * .4).fillCircle(x + 7, y - 9, 2)
  const px = (p.x + .5) * tile, py = (p.y + .5) * tile, dx = Math.sign(x - px), dy = Math.sign(y - py)
  g.lineStyle(2, 0x91dd60).lineBetween(px + dx * 5, py + 4, px + dx * 12, py + dy * 8 + Math.sin(phase) * 2)
  g.fillStyle(0xc78856).fillRect(px + dx * 12 - 1, py + dy * 8 - 3 + Math.sin(phase) * 2, 2, 5)
}
