import type Phaser from 'phaser'
import { SIZE } from '../simulation/world'
import type { Treehouse, World } from '../simulation/world'
import { hasVeranda, VERANDA_BUILD_MS } from '../simulation/veranda'
import { drawPete } from './peteVisuals'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function drawVeranda(g: Phaser.GameObjects.Graphics, world: World, home: Treehouse, tile: number): void {
  const project = world.verandaProject
  if (!project || project.home !== home.y * SIZE + home.x) return
  const progress = project.phase === 'complete' ? 1 : project.elapsedMs / VERANDA_BUILD_MS
  if (!progress) return
  // Attached front deck stays inside the existing house's visual bounds.
  const x = (home.x + .5) * tile, y = (home.y + .5) * tile
  g.lineStyle(2, 0x71888b).lineBetween(x - 11, y + 9, x - 7, y + 15).lineBetween(x + 11, y + 9, x + 7, y + 15)
  if (progress < .3) return
  g.fillStyle(0xa97c4c).fillRect(x - 14, y + 6, 28, 5)
  g.lineStyle(1, 0xd3b181).lineBetween(x - 13, y + 7, x + 13, y + 7).lineBetween(x - 13, y + 9, x + 13, y + 9)
  if (progress < .65) return
  g.lineStyle(2, 0xd5ae79).lineBetween(x - 13, y + 1, x - 13, y + 10).lineBetween(x + 13, y + 1, x + 13, y + 10).lineBetween(x - 13, y + 2, x + 13, y + 2)
  for (const dx of [-7, 0, 7]) g.lineStyle(1, 0xb58c5d).lineBetween(x + dx, y + 3, x + dx, y + 8)
  if (progress < .9) return
  g.fillStyle(0xb4c9c8).fillRect(x - 14, y + 8, 2, 2).fillRect(x + 12, y + 8, 2, 2)
}
export function drawVerandaRest(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const home = world.peace.home
  if (world.peace.activity !== 'verandaRest' || !hasVeranda(world) || home === null) return
  const b = world.buildings[home]!
  if (!visiblePoint(view, (b.x + .5) * tile, (b.y + .5) * tile, tile)) return
  // A visual seated pose; navigation remains on the original dry entrance tile.
  drawPete(g, { ...world, pete: { ...world.pete, x: b.x, y: b.y - .12 } }, tile)
  const x = (b.x + .5) * tile, y = (b.y + .5) * tile
  g.lineStyle(3, 0x5e853c).lineBetween(x - 3, y + 8, x - 6, y + 10).lineBetween(x + 3, y + 8, x + 6, y + 10)
}
