import type Phaser from 'phaser'
import { inventoryTotal, ITEMS, ITEM_DEFINITIONS } from '../simulation/items'
import { handMillLayout } from '../simulation/homestead'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
import { cargoBicycleAvailable } from '../simulation/craftsman'
import { shoreTiles } from '../simulation/shoreline'

export function drawHomestead(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const s = world.homestead, p = world.pete
  if (s && cargoBicycleAvailable(world) && s.bikeTile !== null && visiblePoint(view, (s.bikeTile % SIZE + .5) * tile, (Math.floor(s.bikeTile / SIZE) + .5) * tile, tile)) {
    drawCargoBike(g, (s.bikeTile % SIZE + .5) * tile, (Math.floor(s.bikeTile / SIZE) + .5) * tile)
  }
  if (s?.waterworks.plan) for (const at of shoreTiles(s.waterworks.plan)) {
    const x = at % SIZE * tile, y = Math.floor(at / SIZE) * tile
    if (visiblePoint(view, x + tile / 2, y + tile / 2, tile)) g.lineStyle(2, 0xd9c58a, .8).strokeRect(x + 3, y + 3, tile - 6, tile - 6)
  }
  if (s) for (const [id, at] of Object.entries(s.expansion.improvements)) {
    const b = world.buildings[at]
    if (!b || !visiblePoint(view, (b.x + .5) * tile, (b.y + .5) * tile, tile)) continue
    const x = b.x * tile, y = b.y * tile
    if (id === 'coopAwning') {
      g.fillStyle(0xb28b53).fillRect(x - 3, y + 13, tile + 6, 7)
      g.lineStyle(2, 0xe1c58a).lineBetween(x - 2, y + 18, x - 2, y + 29).lineBetween(x + tile + 2, y + 18, x + tile + 2, y + 29)
    } else if (id === 'gardenBench') {
      g.fillStyle(0xd4aa72).fillRect(x + 3, y + tile - 3, tile - 6, 5)
      g.lineStyle(2, 0x745132).lineBetween(x + 7, y + tile, x + 7, y + tile + 5).lineBetween(x + tile - 7, y + tile, x + tile - 7, y + tile + 5)
    } else if (id === 'gardenBoxes') {
      for (const dx of [0, tile - 7]) { g.fillStyle(0xb5874e).fillRect(x + dx, y - 4, 7, 6); g.fillStyle(0x82b65d).fillCircle(x + dx + 3, y - 4, 3) }
    } else {
      g.lineStyle(2, 0xe5cf9c).lineBetween(x + 4, y + 15, x + tile - 4, y + 15).lineBetween(x + 4, y + 22, x + tile - 4, y + 22)
    }
  }
  if (!s?.task || !visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, tile)) return
  const x = (p.x + .5) * tile, y = (p.y + .5) * tile
  if (s.cargoBicycle && s.bikeTile === null && cargoBicycleAvailable(world)) drawCargoBike(g, x, y + 8)
  if (inventoryTotal(s.carried)) {
    const item = ITEMS.find(i => s.carried[i])!, visual = ITEM_DEFINITIONS[item].visual
    for (let n = 0; n < Math.min(3, s.carried[item]); n++) {
      if ((item === 'iron' || item === 'copper')) g.fillStyle(visual.color).fillTriangle(x + 5, y + 6 - n * 4, x + 11, y - 2 - n * 4, x + 17, y + 6 - n * 4)
      else g.fillStyle(visual.color).fillRect(x + 5, y + 3 - n * 4, 12, item === 'woodenCrate' ? 7 : 4)
      if (item === 'wood') g.fillStyle(visual.highlight).fillCircle(x + 15, y + 5 - n * 4, 2)
    }
  }
  if (!s.elapsedMs) return
  const phase = Math.sin(s.elapsedMs / 130), axe = s.task === 'gather' || s.task === 'mineIron' || s.task === 'mineCopper' || s.task === 'mineCoal'
  g.lineStyle(3, 0x91dd60).lineBetween(x + 5, y + 4, x + 11, y - 3 - phase * 3)
  g.lineStyle(2, 0xa87b4e).lineBetween(x + 10, y - 1, x + 15, y - 12 - phase * 3)
  g.fillStyle(0xc6d3cd).fillRect(x + 12, y - 14 - phase * 3, axe ? 8 : 6, axe ? 6 : 4)
  const target = s.task === 'buildMill' && s.millAnchor !== null ? handMillLayout(s.millAnchor)[s.millBuilt]?.tile : s.target
  if (target === null || target === undefined || axe) return
  const tx = target % SIZE * tile, ty = Math.floor(target / SIZE) * tile
  g.lineStyle(2, 0xd7bd85, .8).strokeRect(tx + 2, ty + 3, tile - 4, tile - 5)
  const duration = s.task === 'buildBridge' && s.waterworks.plan ? shoreTiles(s.waterworks.plan).length * 4000 : s.task === 'buildMill' || s.task === 'buildChain' ? 4000 : ['buildDock', 'upgradeBicycle', 'expandStore', 'improve'].includes(s.task) ? 8000 : 6000
  g.fillStyle(0x91bb78, .6).fillRect(tx + 3, ty + tile - 7, (tile - 6) * Math.min(1, s.elapsedMs / duration), 4)
}
function drawCargoBike(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.lineStyle(2, 0xd8d7b1).strokeCircle(x - 10, y + 6, 6).strokeCircle(x + 10, y + 6, 6)
  g.lineStyle(2, 0x6da5ad).strokeTriangle(x - 10, y + 6, x, y - 4, x + 10, y + 6)
  g.fillStyle(0xb98c50).fillRect(x + 5, y - 6, 12, 8)
  g.lineStyle(1, 0xe0bd84).strokeRect(x + 5, y - 6, 12, 8)
}
