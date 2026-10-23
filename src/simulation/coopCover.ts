import { neighboringTiles, peteReachableTiles, tilePath } from './navigation'
import type { World } from './world'
export const COVER_MS = 2000
export function coverSpot(world: World): number | null {
  const coop = world.coopProject?.tiles[0]
  if (coop === undefined || world.buildings[coop]?.kind !== 'peteCoop' || world.peace.home === null) return null
  const paths = peteReachableTiles(world, world.pete.tile)
  return neighboringTiles(coop).filter(i => !world.water[i] && !world.buildings[i] && paths.has(i))
    .sort((a, b) => (tilePath(paths, a)?.length ?? Infinity) - (tilePath(paths, b)?.length ?? Infinity) || a - b)[0] ?? null
}
