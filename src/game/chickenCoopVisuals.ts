import type Phaser from 'phaser'
import type { PeteCoop } from '../simulation/world'
export function drawChickenCoop(g: Phaser.GameObjects.Graphics, coop: PeteCoop, tile: number, progress = 1): void {
  const x = (coop.x + .5) * tile, y = (coop.y + .5) * tile
  g.fillStyle(0x1d3021, .3).fillEllipse(x, y + 12, 30, 9)
  g.fillStyle(0x795438).fillRect(x - 11, y + 3, 3, 10).fillRect(x + 8, y + 3, 3, 10)
  g.lineStyle(2, 0xb38a55).lineBetween(x - 12, y + 4, x + 12, y + 4)
  if (progress < .3) return
  g.fillStyle(0xc3945d).fillRoundedRect(x - 12, y - 9, 24, 15, 2)
  g.lineStyle(1, 0x9c7048).lineBetween(x - 11, y - 4, x + 11, y - 4).lineBetween(x - 11, y + 1, x + 11, y + 1)
  if (progress < .65) return
  g.fillStyle(0x94533f).fillTriangle(x - 16, y - 8, x, y - 20, x + 16, y - 8)
  g.lineStyle(2, 0xd0a56d).lineBetween(x - 16, y - 8, x, y - 20).lineBetween(x, y - 20, x + 16, y - 8)
  if (progress < 1) return
  g.fillStyle(0x41372a).fillRoundedRect(x - 4, y - 2, 8, 8, 3)
  g.fillStyle(0xd9b270).fillRect(x - 5, y + 6, 10, 2)
  g.fillStyle(0xd6b77c).fillTriangle(x - 4, y + 7, x + 4, y + 7, x + 7, y + 15).fillTriangle(x - 4, y + 7, x + 7, y + 15, x - 1, y + 15)
  g.lineStyle(1, 0x9e754b).lineBetween(x - 2, y + 10, x + 4, y + 10).lineBetween(x, y + 13, x + 6, y + 13)
  g.fillStyle(0xe8d6a6).fillRect(x - 9, y - 13, 18, 5)
  // Small empty-coop sign: a feather, not a chicken or production indicator.
  g.lineStyle(1, 0x98774c).lineBetween(x - 3, y - 9, x + 3, y - 12).lineBetween(x, y - 10, x, y - 12)
}
