import { drawWetPete } from './sprinklerVisuals'
import type Phaser from 'phaser'
import { PUMPKIN_FLIGHT_MS, sabotageRemaining } from '../simulation/pete'
import { SIZE } from '../simulation/world'
import type { Building, World } from '../simulation/world'

// Immediate-mode graphics have no per-hit objects, emitters or timers to leak.
export function drawSabotage(g: Phaser.GameObjects.Graphics, world: World, building: Building, tile: number): void {
  if (world.buildings[building.y * SIZE + building.x] !== building || sabotageRemaining(world, building) <= 0) return
  const x = (building.x + .5) * tile, y = (building.y + .5) * tile
  g.fillStyle(0x07100c, .65).fillRoundedRect(x - 15, y - 15, 30, 30, 3)
  g.fillStyle(0xf68b25).fillEllipse(x - 3, y - 2, 21, 13)
  for (const [dx, dy, size] of [[-10, -8, 3], [8, -5, 4], [-7, 8, 3], [11, 5, 2]]) g.fillCircle(x + dx, y + dy, size)
  g.fillStyle(0xffc04e).fillEllipse(x - 5, y - 4, 9, 5)
  g.fillStyle(0x79df49).fillEllipse(x + 4, y + 3, 17, 10)
  for (let i = 0; i < 3; i++) {
    const phase = world.timeMs / 650 + i * 2
    const drip = 4 + (Math.sin(phase) + 1) * 3
    g.fillRoundedRect(x - 6 + i * 6, y + 4, 3, drip, 1.5)
    g.fillStyle(0xc2ff73, .7).fillCircle(x - 3 + i * 5, y + Math.sin(phase) * 2, 1 + (Math.sin(phase) + 1) * .5)
    g.fillStyle(0x79df49)
  }
}
export function drawPete(g: Phaser.GameObjects.Graphics, world: World, tile: number): void {
  if (world.pete.mode === 'TRANSPORTED') return
  if (world.pete.water) { drawWetPete(g, world, tile); return }
  const pete = world.pete, crying = pete.mode === 'CRYING'
  const x = (pete.x + .5) * tile, y = (pete.y + .5) * tile
  const bob = crying ? Math.sin(world.timeMs / 110) : pete.next !== null ? Math.sin(world.timeMs / (pete.mode === 'FLEEING' ? 55 : 95)) * 1.5 : 0
  g.fillStyle(0x101811, .4).fillEllipse(x, y + 10, 21, 8)
  g.fillStyle(0x523a28).fillEllipse(x, y + 6 + bob, 14, 14)
  g.fillStyle(0x253125).fillEllipse(x - 5, y + 12 + bob, 7, 4).fillEllipse(x + 5, y + 12 - bob, 7, 4)
  g.fillStyle(0x73c947).fillTriangle(x - 6, y - 8 + bob, x - 15, y - 8 + bob, x - 8, y + 1 + bob)
  g.fillTriangle(x + 6, y - 8 + bob, x + 15, y - 8 + bob, x + 8, y + 1 + bob)
  g.fillStyle(0x91dd60).fillEllipse(x, y - 4 + bob, 20, 18)
  g.fillStyle(0xeaa93e).fillEllipse(x, y - 12 + bob, 17, 7)
  g.fillStyle(0x719847).fillRect(x - 1, y - 18 + bob, 3, 5)
  g.fillStyle(0xfff2b6).fillCircle(x - 4, y - 4 + bob, 3).fillCircle(x + 4, y - 4 + bob, 3)
  g.fillStyle(0x17251b).fillCircle(x - 4, y - 4 + bob, 1.5).fillCircle(x + 4, y - 4 + bob, 1.5)
  g.lineStyle(1.5, 0x3e682d).lineBetween(x - 3, y + 2 + bob, x + 3, y + (crying ? 0 : 2) + bob)
  if (pete.mode === 'IMPRISONED') {
    g.lineStyle(2, 0x334520).lineBetween(x - 7, y - 9, x - 2, y - 6).lineBetween(x + 2, y - 6, x + 7, y - 9)
    const grimace = Math.sin(world.timeMs / 200) * 2
    g.lineStyle(2, 0x3e682d).lineBetween(x - 4, y + 3, x, y + 1 + grimace).lineBetween(x, y + 1 + grimace, x + 4, y + 3)
  }
  if (crying) for (const side of [-1, 1]) {
    const fall = world.timeMs % 650 / 650
    g.fillStyle(0x72d6ff).fillEllipse(x + side * (6 + fall * 3), y + fall * 15, 3, 5)
  }
  if (pete.webMs > 0) {
    const progress = 1 - pete.webMs / 700
    const wx = x - (1 - progress) * 35, wy = y - Math.sin(progress * Math.PI) * 15
    g.lineStyle(1, 0xe3ecdc, pete.webMs / 700)
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      g.lineBetween(wx, wy, wx + Math.cos(a) * 12, wy + Math.sin(a) * 12)
    }
    g.strokeCircle(wx, wy, 5).strokeCircle(wx, wy, 10)
  }
  if (pete.pumpkin) {
    const shot = pete.pumpkin, t = shot.elapsedMs / PUMPKIN_FLIGHT_MS
    const px = (shot.from.x + .5 + (shot.target.x - shot.from.x) * t) * tile
    const py = (shot.from.y + .5 + (shot.target.y - shot.from.y) * t) * tile - Math.sin(t * Math.PI) * 15
    g.lineStyle(2, 0x96d856).lineBetween(x + 6, y + 3, x + 13, y - 3)
    g.fillStyle(0xff9c29).fillEllipse(px, py, 11, 9)
    g.lineStyle(1, 0xc75c20).strokeEllipse(px, py, 5, 9)
    g.fillStyle(0x81b64a).fillRect(px - 1, py - 7, 3, 4)
  }
}
