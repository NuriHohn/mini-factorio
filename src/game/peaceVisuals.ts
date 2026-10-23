import { drawPressActivity } from './gearPressVisuals'
import { drawExperimentActivity } from './experimentVisuals'
import { drawVeranda, drawVerandaRest } from './verandaVisuals'
import { drawWorkshopActivity } from './workshopVisuals'
import { drawGardenTending } from './ecoVisuals'
import { drawCooking } from './campfireVisuals'
import { drawEggCollection } from './poultryVisuals'
import { drawSecretProject } from './secretProjectVisuals'
import { drawCrateInspection } from './supplyCrateVisuals'
import { drawRowboat } from './rowboatVisuals'
import { dockAtSpot } from '../simulation/fishingDock'
import { drawFishing } from './fishingDockVisuals'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
import type Phaser from 'phaser'
import { SIZE } from '../simulation/world'
import type { Treehouse, World } from '../simulation/world'
import { drawPete } from './peteVisuals'
import { peaceful } from '../simulation/peace'

export function drawTreehouse(g: Phaser.GameObjects.Graphics, world: World, home: Treehouse, tile: number, preview = false): void {
  const x = (home.x + .5) * tile, baseY = (home.y + .5) * tile
  const t = preview ? 1 : Math.min(1, (world.timeMs - home.placedAtMs) / 3000)
  const y = baseY - Math.sin(t * Math.PI) * 2
  g.fillStyle(0x182b1d, .35).fillEllipse(x, y + 12, 32, 13)
  g.fillStyle(0x795333).fillRoundedRect(x - 4, y - 13, 7, 27, 2)
  g.fillStyle(0x487747).fillCircle(x - 10, y - 13, 10).fillCircle(x + 9, y - 15, 11).fillCircle(x, y - 20, 11)
  g.fillStyle(0x659554).fillCircle(x - 8, y - 19, 7).fillCircle(x + 7, y - 22, 7)
  g.fillStyle(0xc18a51).fillRoundedRect(x - 13, y - 9, 25, 18, 2)
  g.lineStyle(1, 0x95613c).lineBetween(x - 12, y - 3, x + 11, y - 3).lineBetween(x - 12, y + 3, x + 11, y + 3)
  g.fillStyle(0x8b5140).fillTriangle(x - 17, y - 8, x, y - 21, x + 16, y - 8)
  g.lineStyle(2, 0xd8ad72).lineBetween(x - 16, y - 8, x, y - 20).lineBetween(x, y - 20, x + 15, y - 8)
  g.fillStyle(0xffd68a).fillRoundedRect(x - 8, y - 5, 10, 9, 2)
  g.lineStyle(1, 0x724d35).strokeRect(x - 8, y - 5, 10, 9).lineBetween(x - 3, y - 5, x - 3, y + 4)
  g.fillStyle(0x624633).fillRect(x + 5, y, 5, 9)
  g.lineStyle(2, 0xcbb07b).lineBetween(x + 4, y + 8, x + 1, y + 16).lineBetween(x + 10, y + 8, x + 7, y + 16)
  for (let i = 0; i < 3; i++) g.lineBetween(x + 3 - i, y + 10 + i * 3, x + 9 - i, y + 10 + i * 3)
  if (!preview) drawVeranda(g, world, home, tile)
  if (t < 1) for (let i = 0; i < 4; i++) {
    const a = t * Math.PI * 2 + i * 1.7
    g.fillStyle(0xd8ad72, (1 - t) * .7).fillRect(x + Math.sin(a) * 16, baseY + 9 - t * 14 - i, 3, 2)
  }
}
export function drawPeace(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const s = world.peace
  if (s.shutdown && visiblePoint(view, (s.shutdown.position.x + .5) * tile, (s.shutdown.position.y + .5) * tile, 128)) {
    const t = (world.timeMs - s.shutdown.atMs) / 6000, fade = Math.min(1, (1 - t) * 2)
    const x = (s.shutdown.position.x + .5) * tile, y = (s.shutdown.position.y + .5) * tile
    const settle = t * t * (3 - 2 * t) * 6
    // The same walker silhouette, now empty and harmless: heavy feet, cockpit
    // and unlit side coils. Warm smoke/hearts replace combat breakdown effects.
    g.fillStyle(0x18291e, fade * .25).fillEllipse(x, y + 26, 74, 22)
    g.lineStyle(8, 0x586b60, fade).lineBetween(x - 19, y + 3, x - 26, y + 22).lineBetween(x + 19, y + 3, x + 26, y + 22)
    g.fillStyle(0x96a38f, fade).fillRoundedRect(x - 38, y + 18, 28, 12, 3).fillRoundedRect(x + 10, y + 18, 28, 12, 3)
    g.fillStyle(0x657b6a, fade * .85).fillRoundedRect(x - 29, y - 27 + settle, 58, 45 - settle, 8)
    g.lineStyle(2, 0xa7b5a0, fade * .8).strokeRoundedRect(x - 29, y - 27 + settle, 58, 45 - settle, 8)
    g.fillStyle(0x304b3c, fade).fillEllipse(x, y - 16 + settle, 30, 22)
    g.fillStyle(0x344c3c, fade).fillRect(x - 40, y - 10, 16, 14).fillRect(x + 24, y - 10, 16, 14)
    g.fillStyle(0x849c83, fade * .65).fillCircle(x - 34, y - 3, 5).fillCircle(x + 34, y - 3, 5)
    g.lineStyle(2, 0xe2cca0, fade).lineBetween(x - 13, y + 8, x - 4, y + 11).lineBetween(x - 4, y + 11, x + 5, y + 11).lineBetween(x + 5, y + 11, x + 13, y + 8)
    for (let i = 0; i < 3; i++) g.fillStyle(0xc6d3bd, fade * .35).fillCircle(x - 20 + i * 18 + Math.sin(t * 2 + i) * 3, y - 28 - t * 22 - i * 4, 5 + t * 4)
    g.fillStyle(0xe6a6a4, fade).fillCircle(x - 3, y - 36 - t * 18, 4).fillCircle(x + 3, y - 36 - t * 18, 4).fillTriangle(x - 7, y - 35 - t * 18, x + 7, y - 35 - t * 18, x, y - 28 - t * 18)
  }
  if (peaceful(world)) {
    const home = world.buildings[s.home!]!, p = world.pete
    const from = { x: p.x, y: p.y }
    if (s.activity === 'entering' || s.activity === 'resting') {
      const t = s.activity === 'resting' ? 1 : Math.min(1, (world.timeMs - s.sinceMs) / 3000)
      const ease = t * t * (3 - 2 * t)
      const position = { x: from.x + (home.x - .12 - from.x) * ease, y: from.y + (home.y - .22 - from.y) * ease }
      // Draw a copied pose only; the real actor remains on its reserved entrance.
      if (s.activity === 'entering' && t < .85) drawPete(g, { ...world, pete: { ...p, ...position } }, tile)
      else {
        const x = (home.x + .4) * tile, y = (home.y + .48) * tile
        g.fillStyle(0x91dd60).fillCircle(x, y, 4)
        g.lineStyle(1, 0x35562c).lineBetween(x - 2, y, x - .5, y).lineBetween(x + 1, y, x + 2.5, y)
      }
    } else {
      const dock = s.activity === 'fishing' ? dockAtSpot(world, s.destination) : null
      if (s.activity === 'verandaRest') drawVerandaRest(g, world, tile, view)
      else if (s.activity === 'cooking' || s.activity === 'campfireHappy') drawCooking(g, world, tile, view)
      else if (s.activity === 'boating') drawRowboat(g, world, tile, view)
      else if (dock) drawFishing(g, world, dock, tile, view)
      else drawPete(g, world, tile, view)
      drawCrateInspection(g, world, tile, view)
      drawEggCollection(g, world, tile, view)
      if (s.activity === 'waving' && visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, 32)) {
        const x = (p.x + .5) * tile, y = (p.y + .5) * tile
        g.lineStyle(3, 0x91dd60).lineBetween(x + 7, y + 5, x + 14 + Math.sin((world.timeMs - s.sinceMs) / 400) * 2, y - 7)
      }
      if (s.activity === 'flowers' && visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, 32)) {
        const x = (p.x + .5) * tile, y = (p.y + .5) * tile
        g.lineStyle(2, 0x759c55).lineBetween(x + 8, y + 6, x + 11, y - 1)
        g.fillStyle(0xf2c6b6).fillCircle(x + 11, y - 3, 4).fillStyle(0xffd97c).fillCircle(x + 11, y - 3, 1.5)
      }
    }
    for (const gift of s.gifts) {
      if (world.buildings[gift.tile] || !visiblePoint(view, (gift.tile % SIZE + .5) * tile, (Math.floor(gift.tile / SIZE) + .5) * tile, 32)) continue
      const x = (gift.tile % SIZE + .5) * tile, y = (Math.floor(gift.tile / SIZE) + .5) * tile + Math.sin((world.timeMs - gift.atMs) / 700) * 1.5
      g.fillStyle(0x17271b, .3).fillEllipse(x, y + 9, 20, 6)
      g.fillStyle(gift.kind === 'wood' ? 0xd2a56d : 0xd6a9bc).fillRoundedRect(x - 9, y - 6, 18, 14, 2)
      g.lineStyle(2, 0xffe4ad).lineBetween(x, y - 6, x, y + 8).lineBetween(x - 9, y, x + 9, y)
      g.strokeEllipse(x - 3, y - 8, 7, 5).strokeEllipse(x + 3, y - 8, 7, 5)
    }
  }
  drawSecretProject(g, world, tile, view)
  drawGardenTending(g, world, tile, view)
  drawWorkshopActivity(g, world, tile, view)
  drawExperimentActivity(g, world, tile, view)
  drawPressActivity(g, world, tile, view)
}
