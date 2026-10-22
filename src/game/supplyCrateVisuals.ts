import type Phaser from 'phaser'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
import type { SupplyCrate, World } from '../simulation/world'
import { crateAtSpot } from '../simulation/supplyCrate'
export function drawSupplyCrate(g: Phaser.GameObjects.Graphics, crate: SupplyCrate, tile: number): void {
  const x = crate.x * tile, y = crate.y * tile
  g.fillStyle(0x182b1d, .3).fillEllipse(x + 16, y + 28, 30, 9)
  g.fillStyle(0x99653f).fillRoundedRect(x + 3, y + 6, 26, 23, 2)
  g.fillStyle(0xc39460).fillRect(x + 4, y + 4, 24, 8)
  g.lineStyle(1, 0x795234).lineBetween(x + 4, y + 14, x + 28, y + 14).lineBetween(x + 4, y + 22, x + 28, y + 22)
  g.lineStyle(3, 0xd5b17a).lineBetween(x + 6, y + 7, x + 6, y + 27).lineBetween(x + 26, y + 7, x + 26, y + 27)
  // A little green Pete label distinguishes it from an ordinary storage chest.
  g.fillStyle(0xe4cf9d).fillRoundedRect(x + 10, y + 13, 12, 11, 2)
  g.fillStyle(0x78a959).fillCircle(x + 16, y + 18, 4)
  g.fillStyle(0x304b2d).fillRect(x + 13, y + 17, 1, 2).fillRect(x + 18, y + 17, 1, 2)
}
export function drawCrateInspection(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const s = world.peace, p = world.pete, crate = crateAtSpot(world, s.destination)
  if (s.activity !== 'checkingCrate' || !crate || !visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, tile)) return
  const x = (p.x + .5) * tile, y = (p.y + .5) * tile
  const reach = Math.sin((world.timeMs - s.sinceMs) / 450) * 1.5
  const side = crate.x < p.x ? -1 : 1
  g.lineStyle(3, 0x91dd60).lineBetween(x + side * 6, y + 5, x + side * (11 + reach), y)
  // Small clipboard and slow checking gesture; never touches the inventory.
  g.fillStyle(0xb08050).fillRoundedRect(x + side * 12 - 4, y - 2, 8, 10, 1)
  g.fillStyle(0xe7d8ad).fillRect(x + side * 12 - 3, y, 6, 6)
  g.lineStyle(1, 0x6b8d52).lineBetween(x + side * 12 - 2, y + 3, x + side * 12, y + 5).lineBetween(x + side * 12, y + 5, x + side * 12 + 2, y + 1)
}
