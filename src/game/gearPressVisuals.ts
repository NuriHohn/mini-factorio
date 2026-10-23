import type Phaser from 'phaser'
import type { PetePress, World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'

export function drawGearPress(g: Phaser.GameObjects.Graphics, press: PetePress, tile: number, progress = 1): void {
  const x = press.x * tile, y = press.y * tile
  g.fillStyle(0x21312e, .35).fillEllipse(x + 16, y + 28, 30, 7)
  g.fillStyle(0x795b3d).fillRoundedRect(x + 3, y + 24, 26, 6, 2)
  if (progress < .3) return
  g.fillStyle(0x527487).fillRect(x + 5, y + 5, 4, 21).fillRect(x + 23, y + 5, 4, 21)
  g.fillStyle(0x93a9ae).fillRoundedRect(x + 4, y + 3, 24, 5, 1).fillRect(x + 8, y + 22, 16, 3)
  if (progress < .6) return
  g.fillStyle(0x354b5b).fillRect(x + 14, y + 7, 4, 8)
  g.fillStyle(0xc2cfd0).fillRect(x + 10, y + 14, 12, 4)
  g.lineStyle(2, 0xc3985c).lineBetween(x + 25, y + 11, x + 30, y + 7)
  g.fillStyle(0x795b3d).fillCircle(x + 30, y + 7, 2)
  if (progress < .85) return
  g.fillStyle(0xe4ba62).fillRect(x + 9, y + 4, 3, 3).fillRect(x + 20, y + 4, 3, 3)
  g.fillStyle(0xc2cfd0)
  for (let n = 0; n < press.plates; n++) g.fillRect(x + 1, y + 22 - n * 2, 6, 2)
  for (let n = 0; n < press.gears; n++) {
    g.fillStyle(0xc2cfd0).fillCircle(x + 25, y + 25 - n * 3, 2.5)
    g.fillStyle(0x354b5b).fillCircle(x + 25, y + 25 - n * 3, .8)
  }
}

export function drawPressActivity(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const project = world.pressProject
  if (world.peace.activity !== 'pressing' || !project || !visiblePoint(view, (world.pete.x + .5) * tile, (world.pete.y + .5) * tile, tile * 2)) return
  const target = project.tiles[0], x = target % SIZE * tile, y = Math.floor(target / SIZE) * tile
  const stroke = (1 + Math.sin((world.timeMs - world.peace.sinceMs) / 400)) / 2
  g.fillStyle(0x354b5b).fillRect(x + 14, y + 7, 4, 8 + stroke * 5)
  g.fillStyle(0xc2cfd0).fillRect(x + 10, y + 14 + stroke * 5, 12, 4)
  const px = (world.pete.x + .5) * tile, py = (world.pete.y + .5) * tile
  const dx = Math.sign(x + 16 - px), dy = Math.sign(y + 16 - py)
  g.lineStyle(3, 0x91dd60).lineBetween(px + dx * 5, py + 4, px + dx * 12, py + dy * 8 + stroke * 3)
}
