import type Phaser from 'phaser'
import { birdStepMs, EGG_COLLECT_MS, eggAt, poultryActive, poultryBedtime } from '../simulation/poultry'
import type { Bird } from '../simulation/poultry'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function drawBird(g: Phaser.GameObjects.Graphics, b: Bird, timeMs: number, tile: number): void {
  if (b.tile === null) return
  const t = b.next === null ? 0 : b.travelMs / birdStepMs(b), next = b.next ?? b.tile
  const x = (b.tile % SIZE + (next % SIZE - b.tile % SIZE) * t + .5) * tile + (b.id % 3 - 1) * 3
  const y = (Math.floor(b.tile / SIZE) + (Math.floor(next / SIZE) - Math.floor(b.tile / SIZE)) * t + .5) * tile + (b.id % 2) * 3
  const chick = b.kind === 'chick', scale = chick ? .6 : 1
  const hop = b.mode === 'walking' ? Math.sin(t * Math.PI) * (chick ? 3 : 1.2) : chick ? Math.max(0, Math.sin(timeMs / 260 + b.id)) * .8 : 0
  const peck = b.mode === 'pecking' ? Math.max(0, Math.sin(timeMs / 330 + b.id)) * 3 : 0
  g.fillStyle(0x15261d, .22).fillEllipse(x, y + 4, 13 * scale, 4 * scale)
  g.save().translateCanvas(x, y - hop).scaleCanvas((b.facing === 'east' ? 1 : -1) * scale, scale)
  g.lineStyle(1, 0xd5a054).lineBetween(-3, 1, -3 + (b.mode === 'walking' ? Math.sin(t * Math.PI * 2) * 2 : 0), 5).lineBetween(3, 1, 3, 5)
  g.fillStyle(chick ? 0xf2d16b : 0xf1ead8).fillEllipse(0, -3, 14, 10)
  g.fillStyle(chick ? 0xdfb34d : 0xd5ceb9).fillEllipse(-2, -3, 7, 5)
  g.fillStyle(chick ? 0xffdf81 : 0xfff3dc).fillCircle(5, -7 + peck, 4)
  g.fillStyle(0xd6a252).fillTriangle(8, -8 + peck, 12, -6 + peck, 8, -5 + peck)
  g.fillStyle(0x2a3528).fillCircle(6, -8 + peck, 1)
  if (!chick) {
    g.fillStyle(0xc87558).fillCircle(4, -11 + peck, 2).fillCircle(7, -11 + peck, 1.5).fillCircle(6, -3 + peck, 1.5)
    g.fillStyle(0xe8dfc8).fillTriangle(-5, -6, -10, -9, -8, -1)
  }
  g.restore()
}
export function drawPoultry(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  if (!poultryActive(world)) return
  const s = world.poultry!
  if (poultryBedtime(world) && s.birds.every(b => b.tile === null)) {
    const x = (s.coop % SIZE + .7) * tile, y = (Math.floor(s.coop / SIZE) - .2) * tile - Math.sin(world.timeMs / 900) * 2
    if (visiblePoint(view, x, y, tile)) g.lineStyle(1.5, 0xe9db9e, .8).lineBetween(x, y, x + 5, y).lineBetween(x + 5, y, x, y + 5).lineBetween(x, y + 5, x + 5, y + 5)
  }
  for (const egg of s.eggs) {
    if (!eggAt(world, egg.tile)) continue
    const x = (egg.tile % SIZE + .5) * tile + 5, y = (Math.floor(egg.tile / SIZE) + .5) * tile + 5
    if (!visiblePoint(view, x, y, tile)) continue
    g.fillStyle(0x192c20, .25).fillEllipse(x, y + 3, 8, 3)
    g.fillStyle(0xf1e3bd).fillEllipse(x, y, 6, 8).fillStyle(0xfff6db).fillEllipse(x - 1, y - 1, 3, 4)
  }
  for (const b of s.birds) {
    if (b.tile === null || !visiblePoint(view, (b.tile % SIZE + .5) * tile, (Math.floor(b.tile / SIZE) + .5) * tile, tile * 2)) continue
    drawBird(g, b, world.timeMs, tile)
  }
}
export function drawEggCollection(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  if (world.peace.activity !== 'collectingEgg' || !eggAt(world, world.peace.destination)) return
  const p = world.pete, x = (p.x + .5) * tile, y = (p.y + .5) * tile
  if (!visiblePoint(view, x, y, tile)) return
  const t = Math.min(1, (world.timeMs - world.peace.sinceMs) / EGG_COLLECT_MS), lift = Math.sin(t * Math.PI / 2) * 13
  g.lineStyle(3, 0x91dd60).lineBetween(x + 5, y + 4, x + 10, y + 10 - lift)
  g.fillStyle(0xffedc5).fillEllipse(x + 11, y + 8 - lift, 5, 7)
}
