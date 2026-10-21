import type Phaser from 'phaser'
import { MATURE_TREE_MS, treeAge, treeStage, YOUNG_TREE_MS } from '../simulation/nature'
import { SIZE } from '../simulation/world'
import type { Tree, World } from '../simulation/world'
const FLOWERS = [0xe9b0b2, 0xe4c477, 0xc2b9df, 0xeee4c4]
const hash = (i: number) => (Math.imul(i + 17, 1103515245) ^ Math.imul(i + 3, 2654435761)) >>> 0
export function drawTree(g: Phaser.GameObjects.Graphics, world: World, tree: Tree, tile: number): void {
  const stage = treeStage(world, tree), age = treeAge(world, tree)
  const start = stage === 'young' ? YOUNG_TREE_MS : stage === 'mature' ? MATURE_TREE_MS : 0
  const t = Math.min(1, Math.max(0, (age - start) / 1500)), ease = t * t * (3 - 2 * t)
  const scale = stage === 'sapling' ? .45 : stage === 'young' ? .45 + .27 * ease : .72 + .28 * ease
  const x = (tree.x + .5) * tile, y = (tree.y + .5) * tile + 12
  const sway = Math.sin(world.timeMs / 1800 + tree.x * 2 + tree.y) * .5 * scale
  g.fillStyle(0x172b20, .22).fillEllipse(x, y, 26 * scale, 8 * scale)
  g.fillStyle(tree.species === 'birch' ? 0xd8d7bc : 0x8b6541).fillRoundedRect(x - 2 * scale, y - 23 * scale, 4 * scale, 23 * scale, scale)
  if (tree.species === 'birch') {
    g.lineStyle(scale, 0x675d4e).lineBetween(x - 2 * scale, y - 7 * scale, x + scale, y - 7 * scale).lineBetween(x, y - 13 * scale, x + 2 * scale, y - 13 * scale)
    g.fillStyle(0x92b465).fillEllipse(x + sway, y - 24 * scale, 21 * scale, 22 * scale)
    g.fillStyle(0xb8c987, .8).fillEllipse(x - 4 * scale + sway, y - 29 * scale, 12 * scale, 12 * scale)
  } else if (tree.species === 'pine') {
    g.fillStyle(0x456f58).fillTriangle(x - 14 * scale + sway, y - 12 * scale, x + sway, y - 37 * scale, x + 14 * scale + sway, y - 12 * scale)
    g.fillStyle(0x67916a).fillTriangle(x - 10 * scale + sway, y - 22 * scale, x + sway, y - 39 * scale, x + 10 * scale + sway, y - 22 * scale)
    g.lineStyle(scale, 0x99b887, .6).lineBetween(x - 5 * scale + sway, y - 26 * scale, x + sway, y - 34 * scale)
  } else {
    g.fillStyle(0x648747).fillCircle(x - 7 * scale + sway, y - 21 * scale, 10 * scale).fillCircle(x + 7 * scale + sway, y - 22 * scale, 10 * scale)
    g.fillStyle(0x83a65b).fillCircle(x + sway, y - 29 * scale, 11 * scale)
    g.fillStyle(0xa4ba73, .75).fillEllipse(x - 4 * scale + sway, y - 33 * scale, 10 * scale, 6 * scale)
  }
  if (stage === 'sapling') g.fillStyle(0xd0ba7c).fillCircle(x + 4, y, 1.2)
}
export function stumpVisual(ageMs: number) {
  return { visible: ageMs >= 0 && ageMs < 2000, alpha: Math.max(0, Math.min(1, (2000 - ageMs) / 500)), fall: Math.min(1, Math.max(0, ageMs / 700)) }
}
export class NatureVisuals {
  private world: World | null = null
  private decorationRevision = -1
  private topologyRevision = -1
  private fellings: { tree: Tree; atMs: number }[] = []
  private reset(world: World) {
    if (world === this.world) return
    this.world = world; this.decorationRevision = -1; this.topologyRevision = -1; this.fellings = []
  }
  fell(world: World, tree: Tree) {
    this.reset(world)
    this.fellings.push({ tree, atMs: world.timeMs })
    if (this.fellings.length > 32) this.fellings.shift()
  }
  drawDecorations(g: Phaser.GameObjects.Graphics, world: World, tile: number) {
    this.reset(world)
    if (this.decorationRevision === world.nature.decorationRevision && this.topologyRevision === world.topologyRevision) return
    this.decorationRevision = world.nature.decorationRevision; this.topologyRevision = world.topologyRevision
    g.clear()
    for (let i = 0; i < world.nature.decorations.length; i++) {
      const decoration = world.nature.decorations[i]
      if (!decoration || world.water[i] || world.buildings[i]) continue
      const x = i % SIZE * tile, y = Math.floor(i / SIZE) * tile, seed = hash(i)
      g.fillStyle(0x729354, .18).fillEllipse(x + 16, y + 18, 29, 21)
      for (let n = 0; n < 5; n++) {
        const dx = 5 + ((seed >>> (n * 3)) % 22), dy = 7 + ((seed >>> (n * 4)) % 19)
        g.lineStyle(1, 0x92ac6d, .6).lineBetween(x + dx, y + dy, x + dx - 1, y + dy - 4)
        if (decoration === 'flowers') {
          g.fillStyle(FLOWERS[(seed + n) % FLOWERS.length], .9).fillCircle(x + dx, y + dy - 5, n % 2 ? 2 : 2.5)
          g.fillStyle(0xf2daa0).fillCircle(x + dx, y + dy - 5, .8)
        }
      }
    }
  }
  drawEffects(g: Phaser.GameObjects.Graphics, world: World, tile: number) {
    this.reset(world)
    this.fellings = this.fellings.filter(f => stumpVisual(world.timeMs - f.atMs).visible)
    for (const f of this.fellings) {
      if (world.buildings[f.tree.y * SIZE + f.tree.x]) continue
      const visual = stumpVisual(world.timeMs - f.atMs), x = (f.tree.x + .5) * tile, y = (f.tree.y + .5) * tile + 10
      g.fillStyle(0x85613d, visual.alpha).fillRoundedRect(x - 5, y - 4, 10, 7, 2)
      g.fillStyle(0xd9b582, visual.alpha).fillEllipse(x, y - 4, 11, 5)
      g.lineStyle(1, 0xa27c4c, visual.alpha).strokeEllipse(x, y - 4, 6, 3)
      if (visual.fall < 1) {
        g.fillStyle(0x88a96c, (1 - visual.fall) * .55).fillEllipse(x + visual.fall * 12, y - 16 + visual.fall * 12, 19, 11)
        for (let n = 0; n < 3; n++) g.fillStyle(0xd9b582, 1 - visual.fall).fillRect(x + (n - 1) * visual.fall * 14, y - Math.sin(visual.fall * Math.PI) * 9, 3, 2)
      }
    }
  }
}
