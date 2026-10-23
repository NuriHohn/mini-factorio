import { gardenSpot } from './ecoProjects'
import { neighboringTiles, peteReachableTiles, tilePath } from './navigation'
import { poultryActive } from './poultry'
import { projectPlansConflict } from './secretProject'
import type { SecretProject } from './secretProject'
import type { PeteGarden, World } from './world'
export const FEED_MS = 4000
export const FEED_COOLDOWN_MS = 180000
export const FEED_XP = 2
export const GARDEN_FEED_CAPACITY = 4
export function feedGarden(world: World): PeteGarden | null {
  const project = world.gardenProject, b = project?.phase === 'complete' ? world.buildings[project.tiles[0]] : null
  return b?.kind === 'peteGarden' ? b : null
}
export function feedingSiteClear(world: World, project: SecretProject): boolean {
  return poultryActive(world) && world.poultry!.coop === project.tiles[0] && !world.water[project.spots[0]] && !world.buildings[project.spots[0]] && peteReachableTiles(world, world.pete.tile).has(project.spots[0])
}
export function planFeeding(world: World): SecretProject | null {
  if (world.peace.home === null || !poultryActive(world) || !feedGarden(world)?.feed || gardenSpot(world) === null) return null
  const tile = world.poultry!.coop, paths = peteReachableTiles(world, world.pete.tile)
  const spots = neighboringTiles(tile).filter(i => paths.has(i) && !world.water[i] && !world.buildings[i])
  spots.sort((a, b) => tilePath(paths, a)!.length - tilePath(paths, b)!.length || a - b)
  for (const spot of spots) {
    const project: SecretProject = { kind: 'feed', home: world.peace.home, direction: 'east', tiles: [tile], spots: [spot], phase: 'collecting', crate: null, built: 0, carried: 0, carriedFeed: 0, elapsedMs: 0, completedCycles: world.feedingProject?.completedCycles ?? 0 }
    if (!projectPlansConflict(world, project)) return project
  }
  return null
}
