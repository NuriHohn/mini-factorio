import type Phaser from 'phaser'
import { flightPose } from '../simulation/peteLeisure'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import { drawPete } from './peteVisuals'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function drawInventorStructure(g: Phaser.GameObjects.Graphics, kind: 'treasure' | 'flightpad', x: number, y: number, tile: number, progress = 1, open = false): void {
  const px = (x + .5) * tile, py = (y + .5) * tile
  g.fillStyle(0x142a21, .3).fillEllipse(px, py + 12, 30, 10)
  if (kind === 'treasure') {
    g.fillStyle(0x704b32).fillRoundedRect(px - 13, py - 3, 26, 17, 3)
    if (progress < .3) return
    g.fillStyle(0xb87745).fillRoundedRect(px - 14, py - (open ? 18 : 10), 28, 12, 4)
    if (progress < .7) return
    g.lineStyle(3, 0xdeaa65).lineBetween(px - 9, py - 9, px - 9, py + 12).lineBetween(px + 9, py - 9, px + 9, py + 12)
    g.fillStyle(0xf1cb72).fillRect(px - 3, py + 1, 6, 6).fillTriangle(px, py - 8, px - 4, py - 1, px + 4, py - 1)
  } else {
    g.fillStyle(0x6e7257).fillRoundedRect(px - 15, py + 2, 30, 13, 3)
    g.lineStyle(2, 0xd2b76b).strokeEllipse(px, py + 6, 23, 10)
    if (progress < .35) return
    g.lineStyle(3, 0xae7045).lineBetween(px - 12, py + 4, px - 12, py - 14).lineBetween(px + 12, py + 4, px + 12, py - 14).lineBetween(px - 12, py - 14, px + 12, py - 14)
    if (progress < .75) return
    g.fillStyle(0xbd8655).fillRoundedRect(px - 6, py - 11, 12, 16, 3)
    g.fillStyle(0x7eb6b4).fillCircle(px, py - 5, 4)
    g.lineStyle(3, 0xe3cda0).lineBetween(px - 11, py - 18, px + 11, py - 18)
    g.fillStyle(0x556a55).fillCircle(px, py - 18, 3)
  }
}
export function drawLeisure(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const state = world.leisure
  if (!state) return
  if (state.pending) {
    const x = (state.pending.tile % SIZE + .5) * tile, y = (Math.floor(state.pending.tile / SIZE) + .5) * tile
    if (visiblePoint(view, x, y, tile)) g.fillStyle(0xf5d786, .6 + Math.sin(world.timeMs / 200) * .3).fillCircle(x, y, 3).lineStyle(1, 0xfdf0b6).lineBetween(x - 5, y, x + 5, y).lineBetween(x, y - 5, x, y + 5)
  }
  const pose = flightPose(world), p = world.pete
  if (pose || world.peace.activity === 'crashRest') {
    const position = pose ?? p, x = (position.x + .5) * tile, y = (position.y + .5) * tile
    if (!visiblePoint(view, x, y, tile * 3)) return
    if (pose) {
      const groundY = (Math.floor(state.flight!.tile / SIZE) + .5) * tile
      g.fillStyle(0x14231a, .2).fillEllipse(x, groundY + 13, 24, 7)
    }
    if (!pose) { g.save(); g.translateCanvas(x, y + 8); g.rotateCanvas(-Math.PI / 5); g.translateCanvas(-x, -y - 8) }
    drawPete(g, { ...world, pete: { ...p, ...position } }, tile, view)
    if (!pose) g.restore()
    g.fillStyle(0xc08048).fillRoundedRect(x + 8, y - 10, 9, 18, 3)
    const spin = world.timeMs / 32
    g.lineStyle(3, 0xe8d3a2).lineBetween(x + 12 - Math.cos(spin) * 16, y - 18 - Math.sin(spin) * 3, x + 12 + Math.cos(spin) * 16, y - 18 + Math.sin(spin) * 3)
    g.fillStyle(0x58785d).fillCircle(x + 12, y - 18, 3)
    if (!pose) for (let n = 0; n < 4; n++) {
      const t = (world.timeMs - world.peace.sinceMs) / 2000
      g.fillStyle(0xc4b58c, (1 - t) * .55).fillCircle(x + (n - 1.5) * (7 + t * 8), y + 10 - t * 5, 3 + t * 4)
    }
  } else if (state.carried && visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, tile)) {
    g.fillStyle(0xf3d47c).fillCircle((p.x + .5) * tile + 11, (p.y + .5) * tile + 4, 4)
  }
}
export function drawPlayfulSpray(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const spray = world.playfulSpray
  if (!spray || world.timeMs >= spray.untilMs) return
  const x = (spray.target.x + .5) * tile, y = (spray.target.y + .5) * tile
  if (world.timeMs - spray.startedAtMs < 1000 && visiblePoint(view, x, y, tile * 4)) {
    const sx = (spray.source % SIZE + .5) * tile, sy = (Math.floor(spray.source / SIZE) + .5) * tile - 8
    g.lineStyle(3, 0x86d7ee, .8).lineBetween(sx, sy, x, y)
    for (let n = 0; n < 6; n++) { const t = (world.timeMs / 300 + n / 6) % 1; g.fillStyle(0xc5f1ff, .8).fillCircle(sx + (x - sx) * t, sy + (y - sy) * t - Math.sin(t * Math.PI) * 8, 1.5) }
  }
  const wet = (px: number, py: number) => {
    if (!visiblePoint(view, px, py, tile)) return
    for (let n = 0; n < 3; n++) { const t = (world.timeMs / 550 + n / 3) % 1; g.fillStyle(0xa2e0f3, 1 - t).fillCircle(px + (n - 1) * 7, py + t * 14, 1.5) }
  }
  if (spray.wetPete) { const p = flightPose(world) ?? world.pete; wet((p.x + .5) * tile, (p.y + .5) * tile - 8) }
  for (const bird of world.poultry?.birds ?? []) if (spray.wetBirds.includes(bird.id) && bird.tile !== null) wet((bird.tile % SIZE + .5) * tile, (Math.floor(bird.tile / SIZE) + .5) * tile - 5)
}
