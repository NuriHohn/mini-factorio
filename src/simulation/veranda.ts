import { neighboringTiles, peteReachableTiles } from './navigation'
import { projectPlansConflict } from './secretProject'
import type { SecretProject } from './secretProject'
import type { World } from './world'
export const VERANDA_BUILD_MS = 12000
export const VERANDA_REST_MS = 12000
export function hasVeranda(world: World, home = world.peace.home): boolean {
  return home !== null && world.verandaProject?.phase === 'complete' && world.verandaProject.home === home && world.buildings[home]?.kind === 'treehouse'
}
export function verandaSiteClear(world: World, project: SecretProject): boolean {
  const spot = project.spots[0]
  return world.peace.home === project.home && world.buildings[project.home]?.kind === 'treehouse' && !world.water[spot] && !world.buildings[spot] && world.yard?.entrance !== spot && !world.buildings.some(b => b?.kind === 'prison' && b.exit === spot) && peteReachableTiles(world, world.pete.tile).has(spot)
}
export function planVeranda(world: World): SecretProject | null {
  const home = world.peace.home
  if (home === null) return null
  for (const spot of neighboringTiles(home)) {
    const project: SecretProject = { kind: 'veranda', home, tiles: [home], spots: [spot], direction: 'east', phase: 'collecting', built: 0, carried: 0, carriedIron: 0, elapsedMs: 0, crate: null }
    if (verandaSiteClear(world, project) && !projectPlansConflict(world, project)) return project
  }
  return null
}
