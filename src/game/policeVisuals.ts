import type Phaser from 'phaser'
import { radarPowered } from '../simulation/police'
import { SIZE } from '../simulation/world'
import type { Prison, Radar, World } from '../simulation/world'

export function drawSecurityBuilding(g: Phaser.GameObjects.Graphics, world: World, building: Radar | Prison, tile: number): void {
  const x = (building.x + .5) * tile, y = (building.y + .5) * tile
  if (building.kind === 'radar') {
    const active = radarPowered(world, building.y * SIZE + building.x)
    g.fillStyle(0x192d36).fillRoundedRect(x - 13, y - 11, 26, 24, 3)
    g.lineStyle(2, 0x81a9bf).strokeRect(x - 11, y - 9, 22, 20)
    g.fillStyle(0x8fb3bb).fillRect(x - 2, y - 4, 4, 12)
    g.fillStyle(0xb3d6e2).fillEllipse(x, y - 5, 23, 9)
    g.lineStyle(2, 0x447185).lineBetween(x - 8, y - 10, x + 7, y - 1)
    g.fillStyle(active ? 0x84f1b0 : 0xf08172).fillCircle(x + 8, y + 7, 2.5)
    if (active) {
      const angle = world.timeMs / 400
      g.lineStyle(1, 0x84f1b0, .7).lineBetween(x, y - 6, x + Math.cos(angle) * 12, y - 6 + Math.sin(angle) * 8)
    }
  } else {
    g.fillStyle(0x222a34).fillRoundedRect(x - 16, y - 16, 32, 32, 2)
    g.fillStyle(0x747e8c).fillRect(x - 15, y - 15, 30, 5).fillRect(x - 15, y + 11, 30, 5)
    g.lineStyle(2, 0xa5b3c2).strokeRect(x - 14, y - 12, 28, 25)
    g.fillStyle(0xdab564).fillCircle(x + 10, y - 12, 2)
  }
}
export function drawPoliceEffects(g: Phaser.GameObjects.Graphics, world: World, tile: number): void {
  const flash = world.police.flash
  if (flash) {
    const x = (flash.position.x + .5) * tile, y = (flash.position.y + .5) * tile
    const alpha = Math.max(0, (flash.untilMs - world.timeMs) / 350)
    g.fillStyle(0xffffff, alpha * .8).fillCircle(x, y, 26)
    g.lineStyle(3, 0xfff7c6, alpha)
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(x + Math.cos(a) * 28, y + Math.sin(a) * 28, x + Math.cos(a) * 36, y + Math.sin(a) * 36) }
  }
  for (const prison of world.buildings) if (prison?.kind === 'prison') {
    const occupied = world.pete.mode === 'IMPRISONED' && world.pete.prison === prison
    const escaping = world.pete.jailbreak && world.pete.jailbreak.position.x === prison.x && world.pete.jailbreak.position.y === prison.y
    const rattle = escaping ? Math.sin(world.timeMs / 25) * 3 : occupied && world.timeMs % 3000 < 650 ? Math.sin(world.timeMs / 40) * 1.5 : 0
    const x = (prison.x + .5) * tile, y = (prison.y + .5) * tile
    g.lineStyle(2, 0xbdcbd7)
    for (let i = -1; i <= 1; i++) g.lineBetween(x + i * 8 + rattle, y - 11, x + i * 8 - rattle, y + 12)
    g.lineBetween(x - 13, y + 6, x + 13, y + 6)
  }
  const jailbreak = world.pete.jailbreak
  if (jailbreak) {
    const t = 1 - (jailbreak.untilMs - world.timeMs) / 1200
    const x = (jailbreak.position.x + .5) * tile, y = (jailbreak.position.y + .5) * tile
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3
      g.fillStyle(0xddc8a3, (1 - t) * .75).fillCircle(x + Math.cos(angle) * t * 26, y + Math.sin(angle) * t * 16, 5 + t * 8)
    }
  }
  const car = world.police.car
  if (!car) return
  const x = (car.x + .5) * tile, y = (car.y + .5) * tile
  const horizontal = car.next === null || car.next % SIZE !== car.tile % SIZE
  g.fillStyle(0x14202b, .4).fillEllipse(x, y + 9, 29, 13)
  g.fillStyle(0x10171e).fillRoundedRect(x - 14, y - 9, 28, 19, 4)
  g.fillStyle(0xe2ebee).fillRoundedRect(x - 12, y - 7, 24, 14, 3)
  g.fillStyle(0x315b76).fillRect(x - (horizontal ? 5 : 9), y - 5, horizontal ? 10 : 18, 10)
  g.fillStyle(0x28313c).fillRect(x - 10, y - 11, 5, 3).fillRect(x + 5, y - 11, 5, 3).fillRect(x - 10, y + 8, 5, 3).fillRect(x + 5, y + 8, 5, 3)
  g.fillStyle(world.timeMs % 300 < 150 ? 0xff6c6c : 0x4b7ea3).fillRect(x - 5, y - 9, 5, 4)
  g.fillStyle(world.timeMs % 300 >= 150 ? 0x72caff : 0x7b4f58).fillRect(x, y - 9, 5, 4)
  if (car.phase === 'TRANSPORTING') { g.fillStyle(0x91dd60).fillCircle(x + 4, y, 4); g.fillStyle(0x17251b).fillCircle(x + 3, y - 1, 1).fillCircle(x + 5, y - 1, 1) }
  if (car.phase === 'ARRESTING') { g.lineStyle(2, 0xe9cf77).strokeCircle(x - 7, y + 10, 4).strokeCircle(x + 1, y + 10, 4); g.lineBetween(x - 3, y + 10, x - 2, y + 10) }
}
