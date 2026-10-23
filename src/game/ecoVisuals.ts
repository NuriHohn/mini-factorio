import { SIZE } from '../simulation/world'
import type Phaser from 'phaser'
import type { PeteGarden, World } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function drawVegetableGarden(g: Phaser.GameObjects.Graphics, garden: PeteGarden, tile: number, progress = 1): void {
  const x = garden.x * tile, y = garden.y * tile
  g.fillStyle(0x775338).fillRoundedRect(x + 2, y + 3, tile - 4, tile - 6, 3)
  g.lineStyle(2, 0xc29863).strokeRoundedRect(x + 2, y + 3, tile - 4, tile - 6, 3)
  for (let row = 0; row < 3; row++) {
    g.lineStyle(1, 0x4e392b).lineBetween(x + 5, y + 9 + row * 7, x + tile - 5, y + 9 + row * 7)
    if (progress < (row + 1) / 4) continue
    for (let col = 0; col < 3; col++) {
      const px = x + 8 + col * 8, py = y + 8 + row * 7
      g.fillStyle(row === 1 ? 0xdf9c4a : 0x78a85a).fillEllipse(px, py + 2, 5, 4)
      g.fillStyle(0xa1c879).fillEllipse(px - 1, py - 1, 3, 5).fillEllipse(px + 2, py, 4, 3)
    }
  }
}
export function drawPlanting(g: Phaser.GameObjects.Graphics, x: number, y: number, tile: number, progress: number): void {
  const px = (x + .5) * tile, py = (y + .65) * tile
  g.fillStyle(0x614932).fillEllipse(px, py, 15, 7)
  if (progress > .4) {
    g.lineStyle(2, 0xa98a55).lineBetween(px, py, px, py - 8)
    g.fillStyle(0x85b85f).fillEllipse(px - 3, py - 8, 7, 4).fillEllipse(px + 3, py - 11, 7, 4)
  }
}
export function drawGardenTending(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  if (world.peace.activity !== 'gardening' || !visiblePoint(view, (world.pete.x + .5) * tile, (world.pete.y + .5) * tile, tile)) return
  const x = (world.pete.x + .5) * tile, y = (world.pete.y + .5) * tile
  const garden = world.gardenProject!, dx = Math.sign(garden.tiles[0] % SIZE - world.pete.x), dy = Math.sign(Math.floor(garden.tiles[0] / SIZE) - world.pete.y)
  g.fillStyle(0x7eabb5).fillRoundedRect(x + dx * 10 - 4, y + dy * 8, 9, 7, 2)
  g.lineStyle(2, 0xb6d4d2).lineBetween(x + dx * 10, y + dy * 8 + 2, x + dx * 18, y + dy * 15)
  for (let i = 0; i < 3; i++) {
    const t = (world.timeMs / 800 + i / 3) % 1
    g.fillStyle(0xb1d9de, 1 - t).fillCircle(x + dx * (18 + t * 7) + i - 1, y + dy * 15 + t * 8, 1)
  }
}
