import type Phaser from 'phaser'
import type { Footbridge } from '../simulation/world'
export function drawFootbridge(g: Phaser.GameObjects.Graphics, b: Footbridge, tile: number): void {
  const x = (b.x + .5) * tile, y = (b.y + .5) * tile
  g.save().translateCanvas(x, y)
  if (b.direction === 'south') g.rotateCanvas(Math.PI / 2)
  g.fillStyle(0x152821, .25).fillRect(-tile / 2, -9, tile, 22)
  g.fillStyle(0xb98c59).fillRect(-tile / 2, -11, tile, 22)
  for (let i = -tile / 2; i < tile / 2; i += 6) {
    g.lineStyle(1, 0x805b39, .8).lineBetween(i, -10, i, 10)
    g.lineStyle(1, 0xd0ad78, .7).lineBetween(i + 2, -7, i + 2, 7)
  }
  g.lineStyle(3, 0x805738).lineBetween(-tile / 2, -12, tile / 2, -12).lineBetween(-tile / 2, 12, tile / 2, 12)
  g.fillStyle(0xd6b587).fillCircle(-tile / 2 + 3, -12, 2).fillCircle(tile / 2 - 3, 12, 2)
  g.restore()
}
