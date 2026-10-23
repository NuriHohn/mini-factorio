import { CARE_XP, PLANT_COOLDOWN_MS, TEND_COOLDOWN_MS, TEND_MS, gardenSpot } from '../simulation/ecoProjects'
import type { SecretProject } from '../simulation/secretProject'
import { neighboringTiles } from '../simulation/navigation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import { restoreEcoDeadline, restoreProjectSelection } from './projectValidation'
import * as v from './validation'
export function restorePlanting(value: unknown, world: World): SecretProject | undefined {
  if (value === undefined) return undefined
  const r = v.object(value, 'game.plantProject', ['kind', 'home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs'], ['selected', 'readyAtMs'])
  if (r.kind !== 'plant' || r.direction !== 'east') v.invalid('plantProject', 'invalid planting kind or orientation')
  const home = v.tile(r.home, 'plantProject.home'), tiles = v.array(r.tiles, 'plantProject.tiles', 1).map(i => v.tile(i, 'plantProject.tile')), spots = v.array(r.spots, 'plantProject.spots', 1).map(i => v.tile(i, 'plantProject.spot'))
  const phase = v.choice(r.phase, 'plantProject.phase', ['collecting', 'building', 'complete'] as const), built = v.count(r.built, 'plantProject.built', 1), carried = v.count(r.carried, 'plantProject.carried', 2), elapsedMs = v.count(r.elapsedMs, 'plantProject.elapsedMs', 4950), crate = r.crate === null ? null : v.tile(r.crate, 'plantProject.crate')
  const distance = Math.max(Math.abs(home % SIZE - tiles[0] % SIZE), Math.abs(Math.floor(home / SIZE) - Math.floor(tiles[0] / SIZE)))
  if (distance < 4 || !neighboringTiles(tiles[0]).includes(spots[0]) || Math.max(Math.abs(home % SIZE - tiles[0] % SIZE), Math.abs(Math.floor(home / SIZE) - Math.floor(tiles[0] / SIZE))) > 10 || elapsedMs % 50 || (phase === 'collecting' ? built !== 0 || carried !== 0 || elapsedMs !== 0 : phase === 'building' ? built !== 0 || carried !== 2 || crate !== null : built !== 1 || carried !== 0 || elapsedMs !== 0 || crate !== null)) v.invalid('plantProject', 'invalid geometry, progress or Wood accounting')
  if (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate') v.invalid('plantProject.crate', 'missing supply crate')
  return { kind: 'plant', home, direction: 'east', tiles, spots, phase, built, carried, elapsedMs, crate, ...restoreProjectSelection(r), ...restoreEcoDeadline(r, world, PLANT_COOLDOWN_MS) }
}
export function validateGardening(world: World): void {
  const gardens = world.buildings.flatMap((b, i) => b?.kind === 'peteGarden' ? [i] : [])
  if (gardens.some(i => world.gardenProject?.phase !== 'complete' || world.gardenProject.tiles[0] !== i)) v.invalid('garden', 'structure without completed project')
  if ((world.gardenProject || world.plantProject) && world.personality.paths.eco.level < 2) v.invalid('eco', 'activity requires Eco level 2')
  if (!['gardenward', 'gardening'].includes(world.peace.activity)) return
  if (world.peace.home === null || gardenSpot(world) !== world.peace.destination || (world.peace.activity === 'gardening' && (world.pete.next !== null || world.pete.tile !== world.peace.destination || world.peace.untilMs - world.peace.sinceMs !== TEND_MS))) v.invalid('garden', 'invalid tending activity')
}

export function restoreGardenCare(value: unknown, world: World): SecretProject {
  const r = v.object(value, 'game.careProject', ['kind', 'home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs', 'completedCycles'], ['selected', 'readyAtMs'])
  if (r.kind !== 'care') v.invalid('careProject.kind', 'expected garden care')
  const home = v.tile(r.home, 'careProject.home'), direction = v.choice(r.direction, 'careProject.direction', ['east', 'south'] as const)
  const tiles = v.array(r.tiles, 'careProject.tiles', 1).map(i => v.tile(i, 'careProject.tile')), spots = v.array(r.spots, 'careProject.spots', 1).map(i => v.tile(i, 'careProject.spot'))
  const garden = world.gardenProject
  if (garden?.phase !== 'complete' || home !== garden.home || direction !== garden.direction || tiles[0] !== garden.tiles[0] || spots[0] !== garden.spots[0]) v.invalid('careProject', 'care must reference the completed garden')
  const phase = v.choice(r.phase, 'careProject.phase', ['collecting', 'building', 'complete'] as const), built = v.count(r.built, 'careProject.built', 1), carried = v.count(r.carried, 'careProject.carried', 2), elapsedMs = v.count(r.elapsedMs, 'careProject.elapsedMs', TEND_MS - 50)
  const crate = r.crate === null ? null : v.tile(r.crate, 'careProject.crate'), completedCycles = v.count(r.completedCycles, 'careProject.completedCycles', Math.floor(world.timeMs / TEND_MS))
  if (built !== (phase === 'complete' ? 1 : 0) || carried !== (phase === 'building' ? 2 : 0) || elapsedMs % 50 || (phase !== 'building' && elapsedMs !== 0) || (phase !== 'collecting' && crate !== null) || (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate') || (phase === 'complete' && completedCycles < 1)) v.invalid('careProject', 'invalid Wood accounting, cycles or work progress')
  return { kind: 'care', home, direction, tiles, spots, phase, built, carried, elapsedMs, crate, completedCycles, ...restoreProjectSelection(r), ...restoreEcoDeadline(r, world, TEND_COOLDOWN_MS) }
}
export function gardenCareXp(world: World): number { return (world.careProject?.completedCycles ?? 0) * CARE_XP }
