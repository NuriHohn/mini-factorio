import type Phaser from 'phaser'
import { yardBoundary } from '../simulation/yard'
import type { Yard } from '../simulation/yard'
import { SIZE } from '../simulation/world'
import type { PeteFence, World } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function yardCorner(yard: Yard, i: number): boolean { return [yard.left, yard.right].includes(i % SIZE) && [yard.top, yard.bottom].includes(Math.floor(i / SIZE)) }
export function drawYardCorner(g: Phaser.GameObjects.Graphics, fence: PeteFence, yard: Yard, tile: number, progress = 1): void {
  const x = (fence.x + .5) * tile, y = (fence.y + .5) * tile, dx = fence.x === yard.left ? 1 : -1, dy = fence.y === yard.top ? 1 : -1
  g.fillStyle(0x243726, .25).fillEllipse(x, y + 10, 15, 6)
  for (const offset of [-2, 6]) if (progress >= (offset === -2 ? .35 : .7)) {
    g.lineStyle(4, 0xc29a67).lineBetween(x, y + offset, x + dx * tile / 2, y + offset).lineBetween(x, y + offset, x, y + dy * tile / 2 + offset)
  }
  g.fillStyle(0xb88b58).fillRect(x - 2, y - 6, 4, 20).fillStyle(0xd4b080).fillTriangle(x - 3, y - 6, x, y - 10, x + 3, y - 6)
}
export function drawYardEntrance(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const yard = world.yard
  if (!yard) return
  const i = yard.entrance, x = (i % SIZE + .5) * tile, y = (Math.floor(i / SIZE) + .5) * tile
  if (!visiblePoint(view, x, y, tile) || world.water[i] || world.buildings[i] || !yardBoundary(yard).includes(i)) return
  const horizontal = Math.floor(i / SIZE) === yard.top || Math.floor(i / SIZE) === yard.bottom
  g.fillStyle(0xa58c61, .25).fillRoundedRect(x - (horizontal ? 7 : 15), y - (horizontal ? 15 : 7), horizontal ? 14 : 30, horizontal ? 30 : 14, 4)
  drawEntrancePosts(g, x, y, horizontal)
}

export function drawEntrancePosts(g: Phaser.GameObjects.Graphics, x: number, y: number, horizontal: boolean): void {
  for (const side of [-1, 1]) {
    const px = x + (horizontal ? side * 12 : 0), py = y + (horizontal ? 0 : side * 12)
    g.fillStyle(0xb88b58).fillRect(px - 2, py - 5, 4, 13).fillStyle(0xd4b080).fillTriangle(px - 3, py - 5, px, py - 9, px + 3, py - 5)
  }
}
