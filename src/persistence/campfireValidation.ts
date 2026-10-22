import { availableEggs, campfireSpot } from '../simulation/campfire'
import type { World } from '../simulation/world'
import { invalid } from './validation'
export function validateCooking(world: World): void {
  const s = world.peace
  if (s.activity === 'campfireHappy' && (world.campfireProject?.phase !== 'complete' || !world.poultry?.eaten)) invalid('peace.activity', 'happy cooking reaction requires a completed meal')
  if (['campfireward', 'cooking'].includes(s.activity) && (s.home === null || s.destination === null || campfireSpot(world) !== s.destination || availableEggs(world) < 1 || (s.activity === 'cooking' && world.pete.tile !== s.destination))) invalid('peace.destination', 'cooking requires a campfire, egg and valid approach')
}
