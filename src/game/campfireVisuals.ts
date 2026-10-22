import type Phaser from 'phaser'
import { campfireSpot, COOKING_MS } from '../simulation/campfire'
import type { PeteCampfire, World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { drawPete } from './peteVisuals'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function drawCampfire(g: Phaser.GameObjects.Graphics, fire: PeteCampfire, tile: number, progress = 1): void {
  const x = (fire.x + .5) * tile, y = (fire.y + .5) * tile
  g.fillStyle(0x29352a, .3).fillEllipse(x, y + 6, 29, 13)
  for (let i = 0; i < Math.ceil(progress * 8); i++) {
    const angle = i * Math.PI / 4
    g.fillStyle(i % 2 ? 0x9b9c88 : 0x818675).fillEllipse(x + Math.cos(angle) * 12, y + Math.sin(angle) * 5 + 3, 7, 5)
  }
  if (progress < .3) return
  g.lineStyle(5, 0x795335).lineBetween(x - 8, y + 1, x + 7, y + 6)
  if (progress < .65) return
  g.lineStyle(5, 0xb08855).lineBetween(x - 7, y + 6, x + 8, y)
  g.lineStyle(1, 0xd4b47e).lineBetween(x - 6, y + 5, x + 7, y)
}
export function drawCampfireEffects(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const project = world.campfireProject
  if (project?.phase !== 'complete' || world.buildings[project.tiles[0]]?.kind !== 'peteCampfire') return
  const i = project.tiles[0], x = (i % SIZE + .5) * tile, y = (Math.floor(i / SIZE) + .5) * tile
  if (!visiblePoint(view, x, y, tile * 2)) return
  const flicker = Math.sin(world.timeMs / 370) * 1.2 + Math.sin(world.timeMs / 710) * .6
  g.fillStyle(0xe6b262, .07).fillEllipse(x, y + 2, 35, 23)
  g.fillStyle(0xd98543).fillTriangle(x - 7, y + 3, x - 2, y - 13 - flicker, x + 6, y + 3)
  g.fillStyle(0xf0bd60).fillTriangle(x - 4, y + 3, x + 2, y - 9 + flicker, x + 5, y + 3)
  g.fillStyle(0xffdf91).fillEllipse(x, y, 5, 7)
  for (let n = 0; n < 2; n++) {
    const t = ((world.timeMs + n * 1100) % 9000) / 2800
    if (t >= 1) continue
    g.lineStyle(1, 0xbfc2ae, (1 - t) * .25).strokeEllipse(x + Math.sin(t * 4 + n) * 4, y - 15 - t * 18, 4 + t * 7, 3 + t * 4)
  }
}
export function drawCooking(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const s = world.peace, p = world.pete, happy = s.activity === 'campfireHappy'
  if ((!happy && (s.activity !== 'cooking' || campfireSpot(world) !== s.destination)) || !visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, tile * 2)) return
  const x = (p.x + .5) * tile, y = (p.y + .5) * tile + 3
  g.fillStyle(0x8b6743).fillRoundedRect(x - 10, y + 9, 20, 5, 2)
  drawPete(g, { ...world, pete: { ...p, y: p.y + .1 } }, tile, view)
  // Bent knees and a little log seat distinguish the seated pose from walking.
  g.lineStyle(4, 0x523a28).lineBetween(x - 5, y + 7, x - 11, y + 6).lineBetween(x + 5, y + 7, x + 11, y + 6)
  g.fillStyle(0x253125).fillEllipse(x - 11, y + 8, 6, 4).fillEllipse(x + 11, y + 8, 6, 4)
  if (happy) {
    g.lineStyle(2, 0x3e682d).lineBetween(x - 4, y - 1, x, y + 1).lineBetween(x, y + 1, x + 4, y - 1)
    const lift = (world.timeMs - s.sinceMs) / 2000 * 8
    g.fillStyle(0xe6a6a4).fillCircle(x - 3, y - 25 - lift, 3).fillCircle(x + 3, y - 25 - lift, 3).fillTriangle(x - 6, y - 24 - lift, x + 6, y - 24 - lift, x, y - 18 - lift)
    return
  }
  const age = Math.min(COOKING_MS, world.timeMs - s.sinceMs), eating = age >= 5000
  const fire = world.campfireProject!.tiles[0]
  const panX = eating ? x + 12 : x * .3 + (fire % SIZE + .5) * tile * .7
  const panY = eating ? y + 5 : y * .3 + (Math.floor(fire / SIZE) + .5) * tile * .7 - 4
  g.lineStyle(3, 0x91dd60).lineBetween(x + 6, y + 2, panX - 8, panY + 1)
  g.lineStyle(3, 0x343e35).lineBetween(panX - 12, panY, panX - 2, panY)
  g.fillStyle(0x343e35).fillEllipse(panX, panY, 17, 10)
  if (!eating) {
    g.fillStyle(0xfff1cf).fillEllipse(panX, panY - 1, 11, 6).fillStyle(0xecc15d).fillCircle(panX + 1, panY - 1, 2.5)
    const steam = age % 1500 / 1500
    g.lineStyle(1, 0xdadbc5, (1 - steam) * .35).lineBetween(panX, panY - 6 - steam * 7, panX + 2, panY - 9 - steam * 7)
  } else {
    const lift = (Math.sin((age - 5000) / 400) + 1) / 2
    g.lineStyle(2, 0xb4b9a0).lineBetween(x + 7, y + 6, x + 5, y + 2 - lift * 5)
    g.fillStyle(0xffe6a5).fillEllipse(x + 5, y - lift * 5, 5, 3)
  }
}
