import type Phaser from 'phaser'
import { inventoryTotal } from '../simulation/items'
import { handMillLayout } from '../simulation/homestead'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'

export function drawHomestead(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const s = world.homestead, p = world.pete
  if (!s?.task || !visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, tile)) return
  const x = (p.x + .5) * tile, y = (p.y + .5) * tile
  if (inventoryTotal(s.carried)) {
    const panels = s.carried.woodPanel > 0
    for (let n = 0; n < Math.min(3, panels ? s.carried.woodPanel : s.carried.wood); n++) {
      g.fillStyle(panels ? 0xd4ad70 : 0x986338).fillRect(x + 5, y + 3 - n * 4, 12, 4)
      if (!panels) g.fillStyle(0xe1bc81).fillCircle(x + 15, y + 5 - n * 4, 2)
    }
  }
  if (!s.elapsedMs) return
  const phase = Math.sin(s.elapsedMs / 130), axe = s.task === 'gather'
  g.lineStyle(3, 0x91dd60).lineBetween(x + 5, y + 4, x + 11, y - 3 - phase * 3)
  g.lineStyle(2, 0xa87b4e).lineBetween(x + 10, y - 1, x + 15, y - 12 - phase * 3)
  g.fillStyle(0xc6d3cd).fillRect(x + 12, y - 14 - phase * 3, axe ? 8 : 6, axe ? 6 : 4)
  const target = s.task === 'buildMill' && s.millAnchor !== null ? handMillLayout(s.millAnchor)[s.millBuilt]?.tile : s.target
  if (target === null || target === undefined || axe) return
  const tx = target % SIZE * tile, ty = Math.floor(target / SIZE) * tile
  g.lineStyle(2, 0xd7bd85, .8).strokeRect(tx + 2, ty + 3, tile - 4, tile - 5)
  g.fillStyle(0x91bb78, .6).fillRect(tx + 3, ty + tile - 7, (tile - 6) * s.elapsedMs / (s.task === 'buildMill' ? 4000 : s.task === 'expandStore' ? 8000 : 6000), 4)
}
