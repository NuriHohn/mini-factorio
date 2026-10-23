import type Phaser from 'phaser'
import type { DevelopmentKind } from '../simulation/peteDevelopments'
import type { World } from '../simulation/world'
export function drawDevelopment(g: Phaser.GameObjects.Graphics, kind: DevelopmentKind, x: number, y: number, tile: number, time: number, progress = 1, fruit = 0, working = false): void {
  const px = (x + .5) * tile, py = (y + .5) * tile
  g.fillStyle(0x273c28, .4).fillEllipse(px, py + 11, 31, 12)
  g.fillStyle(kind === 'mechanic' || kind === 'winch' ? 0x7a8582 : 0x9f7448).fillRoundedRect(px - 14, py + 1, 28, 12, 3)
  if (progress < .25) return
  if (kind === 'orchard' || kind === 'nursery') {
    for (const dx of [-9, 7]) { g.fillStyle(0x785033).fillRect(px + dx - 2, py - 9, 4, 16); g.fillStyle(kind === 'orchard' ? 0x559e45 : 0x80b865).fillCircle(px + dx, py - 9, kind === 'orchard' ? 10 : 6) }
    if (progress > .7) for (let n = 0; n < fruit; n++) g.fillStyle(0xe5a04c).fillCircle(px - 13 + n % 3 * 8, py - 12 + Math.floor(n / 3) * 7, 2.5)
    if (kind === 'nursery') g.lineStyle(2, 0xd5bc83).strokeRect(px - 15, py + 2, 30, 9)
  } else if (kind === 'bicycle') {
    g.lineStyle(2, 0xd8d7b1).strokeCircle(px - 10, py + 5, 7).strokeCircle(px + 10, py + 5, 7)
    g.lineStyle(2, 0x6da5ad).strokeTriangle(px - 10, py + 5, px, py - 5, px + 3, py + 5).lineBetween(px + 10, py + 5, px + 5, py - 9).lineBetween(px + 4, py - 9, px + 10, py - 9)
  } else if (kind === 'house') {
    g.lineStyle(3, 0x878d8d).lineBetween(px - 10, py + 12, px - 10, py - 9).lineBetween(px + 10, py + 12, px + 10, py - 9)
    if (progress > .5) g.fillStyle(0xae8350).fillRect(px - 13, py - 14, 26, 18).fillStyle(0x526f68).fillTriangle(px - 17, py - 14, px, py - 26, px + 17, py - 14)
    if (progress > .8) g.fillStyle(0xffd276).fillRect(px - 4, py - 10, 8, 7)
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
  }
}
