import { peteReachableTiles as reachableTiles } from './navigation'
import type { World } from './world'
import { SIZE } from './world'
export const COOKING_MS = 8000
export const CAMPFIRE_HAPPY_MS = 2000
export function availableEggs(world: World): number { return world.poultry ? world.poultry.collected - world.poultry.eaten : 0 }
export function campfireSpot(world: World): number | null {
  const project = world.campfireProject
  if (project?.phase !== 'complete' || world.buildings[project.tiles[0]]?.kind !== 'peteCampfire') return null
  const spot = project.spots[0]
  return !world.water[spot] && !world.buildings[spot] && !world.buildings.some(b => b?.kind === 'prison' && b.exit === spot) ? spot : null
}
export function reachableCampfire(world: World): number | null {
  if (availableEggs(world) < 1) return null
  const spot = campfireSpot(world)
  return spot !== null && reachableTiles(world, world.pete.tile).has(spot) ? spot : null
}
export function refreshCooking(world: World): void {
  const s = world.peace, p = world.pete
  if (!['campfireward', 'cooking'].includes(s.activity) || (campfireSpot(world) === s.destination && availableEggs(world) > 0)) return
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(s, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
// The animation reserves no egg: Pete is the sole consumer, and commits only at completion.
export function finishCooking(world: World): boolean {
  const s = world.peace, p = world.pete
  if (s.home === null || s.activity !== 'cooking' || world.timeMs < s.untilMs || p.next !== null || p.tile !== s.destination || campfireSpot(world) !== s.destination || availableEggs(world) < 1) return false
  world.poultry!.eaten++
  return true
}
