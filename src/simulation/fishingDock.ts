import { DIRECTIONS, inside, offsets, SIZE } from './world'
import type { FishingDock, World } from './world'
import { facesWater } from './waterTerrain'
import { peteReachableTiles as reachableTiles, tilePath } from './navigation'
export const FISHING_DOCK_WOOD = 8
export const FISHING_MS = 20000
export function fishingSpot(world: World, dock: FishingDock): number | null {
  const d = offsets[dock.direction], x = dock.x - d.x, y = dock.y - d.y, tile = y * SIZE + x
  return inside(x, y) && !world.water[tile] && !world.buildings[tile] && !world.buildings.some(b => b?.kind === 'prison' && b.exit === tile) && facesWater(world, dock, dock.direction) ? tile : null
}
// The existing peace destination identifies the reserved land approach, not a
// second actor or an occupied dock tile. Stable N/E/S/W order resolves sharing.
export function dockAtSpot(world: World, spot: number | null): FishingDock | null {
  if (spot === null) return null
  for (const direction of DIRECTIONS) {
    const d = offsets[direction], x = spot % SIZE + d.x, y = Math.floor(spot / SIZE) + d.y
    const b = inside(x, y) ? world.buildings[y * SIZE + x] : null
    if (b?.kind === 'fishingDock' && b.direction === direction && fishingSpot(world, b) === spot) return b
  }
  return null
}
export function reachableFishingSpot(world: World): number | null {
  const spots = world.buildings.flatMap(b => {
    if (b?.kind !== 'fishingDock') return []
    const spot = fishingSpot(world, b)
    return spot === null ? [] : [spot]
  })
  if (!spots.length) return null
  const parents = reachableTiles(world, world.pete.tile)
  return spots.filter(i => parents.has(i)).sort((a, b) => (tilePath(parents, a)?.length ?? Infinity) - (tilePath(parents, b)?.length ?? Infinity) || a - b)[0] ?? null
}
