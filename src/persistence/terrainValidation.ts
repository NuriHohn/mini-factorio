import { footbridgeBanks, footbridgeSpan } from '../simulation/footbridge'
import { bridgeCrossing } from '../simulation/waterTerrain'
import { opposite, SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restoreWater(value: unknown): boolean[] { return v.array(value, 'game.water', SIZE * SIZE).map((b, i) => v.boolean(b, `water[${i}]`)) }
export function validateTerrain(world: World): void {
  for (let i = 0; i < world.water.length; i++) {
    const b = world.buildings[i]
    if (world.water[i] && (world.nature.decorations[i] || (b && b.kind !== 'footbridge' && (b.kind !== 'belt' || !b.bridge)))) v.invalid(`water[${i}]`, 'land building or decoration overlaps water')
    if (b?.kind === 'belt' && b.bridge) {
      const span = bridgeCrossing(world, b.x, b.y, b.direction)
      if (!world.water[i] || !span || b.entry !== opposite(b.direction) || span.some(j => { const other = world.buildings[j]; return other?.kind !== 'belt' || !other.bridge || other.direction !== b.direction })) v.invalid(`buildings[${i}].bridge`, 'incomplete, turning or oversized bridge')
    }
    if (b?.kind === 'footbridge') {
      const span = footbridgeSpan(world, i), banks = footbridgeBanks(world, i)
      if (!world.water[i] || !span || banks.length !== 2 || banks.some(j => world.water[j] || world.buildings[j]) || span.some(j => { const other = world.buildings[j]; return other?.kind !== 'footbridge' || other.direction !== b.direction })) v.invalid(`buildings[${i}].footbridge`, 'incomplete, occupied or oversized crossing')
    }
    if (b?.kind === 'prison' && world.water[b.exit]) v.invalid('prison.exit', 'exit is on water')
  }
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])]
  for (const a of actors) if ([a.tile, a.next, ...('path' in a ? a.path : [])].some(i => i !== null && world.water[i] && (a === world.revenge.boss || world.buildings[i]?.kind !== 'footbridge'))) v.invalid('navigation', 'actor or path is on water')
  if (world.peace.gifts.some(g => world.water[g.tile])) v.invalid('peace.gifts', 'gift is on water')
}
