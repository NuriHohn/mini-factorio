import type Phaser from 'phaser'
import type { DevelopmentKind } from '../simulation/peteDevelopments'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
export function drawAnnexWalkway(g: Phaser.GameObjects.Graphics, world: World, tile: number, progress = 1): void {
  const p = world.houseProject
  if (!p || p.home !== world.peace.home || world.buildings[p.home]?.kind !== 'treehouse' || progress < .25) return
  const start = { x: (p.home % SIZE + .5) * tile, y: (Math.floor(p.home / SIZE) + .5) * tile - 12 }
  const end = { x: (p.tiles[0] % SIZE + .5) * tile, y: (Math.floor(p.tiles[0] / SIZE) + .5) * tile - 12 }
  const length = Math.hypot(end.x - start.x, end.y - start.y), steps = Math.ceil(length / 8)
  const nx = -(end.y - start.y) / length, ny = (end.x - start.x) / length
  g.lineStyle(9, 0x493b2d).lineBetween(start.x, start.y + 3, end.x, end.y + 3)
  if (progress < .5) return
  for (let i = 1; i < steps; i++) {
    const x = start.x + (end.x - start.x) * i / steps, y = start.y + (end.y - start.y) * i / steps
    g.lineStyle(5, i % 2 ? 0xbd9563 : 0xa78155).lineBetween(x - nx * 4, y - ny * 4, x + nx * 4, y + ny * 4)
    if (progress > .75 && i % 3 === 0) g.lineStyle(2, 0xe3c491).lineBetween(x + nx * 5, y + ny * 5, x + nx * 5, y + ny * 5 - 9)
  }
  if (progress > .75) g.lineStyle(2, 0xe3c491).lineBetween(start.x + nx * 5, start.y + ny * 5 - 9, end.x + nx * 5, end.y + ny * 5 - 9)
}
export function drawDevelopment(g: Phaser.GameObjects.Graphics, kind: DevelopmentKind, x: number, y: number, tile: number, time: number, progress = 1, fruit = 0, working = false, parked = true): void {
  const px = (x + .5) * tile, py = (y + .5) * tile
  g.fillStyle(0x273c28, .4).fillEllipse(px, py + 11, 31, 12)
  g.fillStyle(kind === 'mechanic' || kind === 'winch' ? 0x7a8582 : 0x9f7448).fillRoundedRect(px - 14, py + 1, 28, 12, 3)
  if (progress < .25) return
  if (progress < .5) {
    g.lineStyle(2, 0xd6bc86).strokeRect(px - 12, py - 9, 24, 17)
    return
  }
  if (kind === 'orchard' || kind === 'nursery') {
    for (const dx of [-9, 7]) { g.fillStyle(0x785033).fillRect(px + dx - 2, py - 9, 4, 16); g.fillStyle(kind === 'orchard' ? 0x559e45 : 0x80b865).fillCircle(px + dx, py - 9, kind === 'orchard' ? 10 : 6) }
    if (progress > .7) for (let n = 0; n < fruit; n++) g.fillStyle(0xe5a04c).fillCircle(px - 13 + n % 3 * 8, py - 12 + Math.floor(n / 3) * 7, 2.5)
    if (kind === 'nursery') g.lineStyle(2, 0xd5bc83).strokeRect(px - 15, py + 2, 30, 9)
  } else if (kind === 'bicycle') {
    g.lineStyle(2, 0x7b8c78).lineBetween(px - 14, py + 10, px + 14, py + 10)
    if (!parked) return
    g.lineStyle(2, 0xd8d7b1).strokeCircle(px - 10, py + 5, 7).strokeCircle(px + 10, py + 5, 7)
    g.lineStyle(2, 0x6da5ad).strokeTriangle(px - 10, py + 5, px, py - 5, px + 3, py + 5).lineBetween(px + 10, py + 5, px + 5, py - 9).lineBetween(px + 4, py - 9, px + 10, py - 9)
  } else if (kind === 'house') {
    g.lineStyle(3, 0x878d8d).lineBetween(px - 10, py + 12, px - 10, py - 9).lineBetween(px + 10, py + 12, px + 10, py - 9)
    if (progress > .5) g.fillStyle(0xae8350).fillRect(px - 13, py - 14, 26, 18).fillStyle(0x526f68).fillTriangle(px - 17, py - 14, px, py - 26, px + 17, py - 14)
    if (progress > .8) g.fillStyle(0xffd276).fillRect(px - 4, py - 10, 8, 7)
    if (progress > .9) g.fillStyle(0xd2b180).fillRect(px - 12, py + 3, 13, 3).fillRect(px - 11, py + 6, 2, 6).fillRect(px - 2, py + 6, 2, 6)
  } else if (kind === 'mechanic') {
    g.fillStyle(0x8c9a92).fillRect(px - 13, py - 5, 26, 6).fillStyle(0xc5a65d).fillCircle(px - 5, py - 9, 5)
    if (progress > .7) { const spin = working ? time / 180 : 0; g.lineStyle(3, 0xd9c57f).lineBetween(px - 5 - Math.cos(spin) * 7, py - 9 - Math.sin(spin) * 7, px - 5 + Math.cos(spin) * 7, py - 9 + Math.sin(spin) * 7); g.fillStyle(0x556c65).fillRect(px + 4, py - 15, 8, 12) }
  } else {
    g.lineStyle(3, 0xa9b4a2).lineBetween(px - 11, py + 6, px - 11, py - 23).lineBetween(px - 11, py - 23, px + 12, py - 23)
    const drop = working ? 7 + Math.sin(time / 500) * 5 : 8
    g.lineStyle(1, 0xdfce98).lineBetween(px + 10, py - 23, px + 10, py - drop).fillStyle(0x96794f).fillRect(px + 4, py - drop, 12, 9)
  }
}
export function drawDevelopmentActivity(g: Phaser.GameObjects.Graphics, world: World, tile: number): void {
  const p = world.pete, x = (p.x + .5) * tile, y = (p.y + .5) * tile
  if (world.peace.activity === 'cycling') {
    g.lineStyle(2, 0xd5d9ae).strokeCircle(x - 10, y + 12, 7).strokeCircle(x + 10, y + 12, 7).lineStyle(2, 0x6ab0bc).strokeTriangle(x - 10, y + 12, x, y + 1, x + 10, y + 12)
    g.lineStyle(2, 0xddbf68).lineBetween(x - 4, y + 10 + Math.sin(world.timeMs / 80) * 3, x + 4, y + 10 - Math.sin(world.timeMs / 80) * 3)
  }
  if (world.developmentLife?.carriedFruit) g.fillStyle(0xe7a149).fillCircle(x + 11, y + 2, 5)
  if (world.developmentLife?.carriedSapling) g.fillStyle(0x8dc965).fillEllipse(x + 11, y - 1, 8, 12)
  if (world.developmentLife?.carriedWood) g.fillStyle(0xbd8d56).fillRect(x + 8, y, 10, 6)
  if (world.peace.activity === 'developmentWork') {
    const t = world.developmentLife?.task
    if (t === 'cookFruit') g.fillStyle(0xe7b55c).fillEllipse(x + 10, y + 3, 12, 5)
    if (t === 'tendOrchard' || t === 'nursing') g.lineStyle(2, 0x9fd1e0).lineBetween(x + 9, y, x + 16, y + 8)
    if (t === 'pickFruit' || t === 'takeSapling') g.lineStyle(3, 0xdfbc83).lineBetween(x + 6, y + 1, x + 13, y - 7 + Math.sin(world.timeMs / 180) * 3)
    if (t === 'plantSapling') g.lineStyle(2, 0xb8a47c).lineBetween(x + 8, y - 4, x + 12, y + 12).fillStyle(0x80978a).fillRect(x + 9, y + 10, 7, 4)
    if (t === 'storeFruit' || t === 'collectNurseryWood') g.lineStyle(2, 0xc4a171).strokeRect(x + 6, y + 4, 14, 10)
    if (t === 'annexRest') g.fillStyle(0xd6bc89).fillRect(x - 8, y + 9, 16, 3)
    const progress = Math.max(0, Math.min(1, (world.timeMs - world.peace.sinceMs) / (world.peace.untilMs - world.peace.sinceMs)))
    g.lineStyle(3, 0x263a29).lineBetween(x - 12, y - 25, x + 12, y - 25)
    g.lineStyle(3, 0xc4d889).lineBetween(x - 12, y - 25, x - 12 + progress * 24, y - 25)
  }
}
