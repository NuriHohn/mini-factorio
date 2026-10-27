import type Phaser from 'phaser'
import { machineGuide, peteRoute } from '../simulation/learning'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
export function drawGuidance(g: Phaser.GameObjects.Graphics, world: World, tile: number, showPete: boolean, index: number | null, connections: boolean): void {
  if (showPete) {
    const route = peteRoute(world)
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i]
      g.lineStyle(2, 0xc3e8a2, .75).lineBetween((a % SIZE + .5) * tile, (Math.floor(a / SIZE) + .5) * tile, (b % SIZE + .5) * tile, (Math.floor(b / SIZE) + .5) * tile)
    }
    const target = world.peace.home !== null ? world.peace.destination : null
    if (target !== null) g.lineStyle(3, 0xc3e8a2).strokeCircle((target % SIZE + .5) * tile, (Math.floor(target / SIZE) + .5) * tile, tile * .35)
  }
  if (connections && index !== null) {
    const guide = machineGuide(world, index)
    for (const n of guide?.tiles ?? []) g.lineStyle(3, n === guide?.source ? 0x79c8f2 : n === guide?.target ? 0x9fe38f : 0xf4cc7b, .9).strokeRect(n % SIZE * tile + 2, Math.floor(n / SIZE) * tile + 2, tile - 4, tile - 4)
  }
}
