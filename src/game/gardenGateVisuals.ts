import type Phaser from 'phaser'
import { GATE_OPEN_MS } from '../simulation/gardenGate'
import type { PeteGate } from '../simulation/world'
import { drawEntrancePosts } from './yardVisuals'
export function drawGardenGate(g: Phaser.GameObjects.Graphics, gate: PeteGate, tile: number, progress = 1): void {
  const x = (gate.x + .5) * tile, y = (gate.y + .5) * tile
  g.fillStyle(0x243726, .2).fillEllipse(x, y + 7, 30, 7)
  drawEntrancePosts(g, x, y, gate.direction === 'east')
  if (progress < .3) return
  const t = gate.openMs / GATE_OPEN_MS, ease = t * t * (3 - 2 * t)
  g.save().translateCanvas(x, y)
  if (gate.direction === 'south') g.rotateCanvas(Math.PI / 2)
  g.translateCanvas(-11, 0).rotateCanvas(-ease * Math.PI / 2)
  g.lineStyle(3, 0xd2ad74).lineBetween(0, -3, 22, -3)
  if (progress >= .65) {
    g.lineStyle(3, 0xb88b58).lineBetween(0, 5, 22, 5)
    g.lineStyle(2, 0xd2ad74).lineBetween(1, 4, 21, -3)
    g.fillStyle(0xb88b58).fillRect(0, -6, 3, 14).fillRect(19, -6, 3, 14)
  }
  if (progress === 1) g.fillStyle(0x636e61).fillRect(18, -1, 5, 2).fillRect(-1, -3, 4, 2).fillRect(-1, 4, 4, 2)
  g.restore()
}
