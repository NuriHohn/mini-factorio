import { FISHING_MS } from '../simulation/fishingDock'
import type Phaser from 'phaser'
import { offsets } from '../simulation/world'
import type { FishingDock, World } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
import { drawPete } from './peteVisuals'
export function drawFishingDock(g: Phaser.GameObjects.Graphics, dock: FishingDock, tile = 32): void {
  const d = offsets[dock.direction], cx = (dock.x + .5) * tile, cy = (dock.y + .5) * tile
  for (let i = -2; i <= 5; i++) {
    const x = cx + d.x * i * 5, y = cy + d.y * i * 5
    g.lineStyle(4, i % 2 ? 0xad8959 : 0xb99565).lineBetween(x - d.y * 11, y + d.x * 11, x + d.y * 11, y - d.x * 11)
  }
  for (const side of [-1, 1]) {
    const x = cx + d.x * 21 - d.y * side * 11, y = cy + d.y * 21 + d.x * side * 11
    g.fillStyle(0x634a33).fillCircle(x, y, 3).fillStyle(0xd3b283).fillCircle(x, y - 1, 2)
  }
}
export function drawFishing(g: Phaser.GameObjects.Graphics, world: World, dock: FishingDock, tile: number, view?: Viewport): void {
  if (!visiblePoint(view, (dock.x + .5) * tile, (dock.y + .5) * tile, tile * 2)) return
  const d = offsets[dock.direction], age = world.timeMs - world.peace.sinceMs
  const t = Math.max(0, Math.min(1, age / 800, (FISHING_MS - age) / 800)), ease = t * t * (3 - 2 * t)
  const position = { x: world.pete.x + (dock.x - d.x * .15 - world.pete.x) * ease, y: world.pete.y + (dock.y - d.y * .15 - world.pete.y) * ease }
  drawPete(g, { ...world, pete: { ...world.pete, ...position } }, tile, view)
  const x = (position.x + .5) * tile, y = (position.y + .5) * tile
  const tipX = x + d.x * 22 - d.y * 5, tipY = y + d.y * 22 + d.x * 5 - 10 + Math.sin(age / 1800) * .7
  const floatX = (dock.x + .5 + d.x) * tile, floatY = (dock.y + .5 + d.y) * tile + Math.sin(age / 900) * .6
  g.lineStyle(2, 0xd2b079, ease).lineBetween(x + d.x * 6, y + d.y * 6, tipX, tipY)
  g.lineStyle(1, 0xd9dece, ease * .8).lineBetween(tipX, tipY, floatX, floatY)
  g.fillStyle(0xc98e70, ease).fillCircle(floatX, floatY, 1.5)
  const ripple = age % 5000 / 1400
  if (ripple < 1) g.lineStyle(1, 0xa3c7bc, (1 - ripple) * .5 * ease).strokeEllipse(floatX, floatY + 1, 4 + ripple * 14, 2 + ripple * 6)
}
