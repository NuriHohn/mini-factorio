import type { World } from './world'

export const FOREST_RADIUS = 3
export function ownedForestTile(world: World, tile: number): boolean {
  if (!['woodReturn', 'panelReturn', 'crateReturn'].every(kind => world.homestead?.infrastructure.links.some(link => link.kind === kind))) return false
  const width = Math.sqrt(world.buildings.length)
  const at = world.homestead?.expansion.forestry
  const station = at === null || at === undefined ? null : world.buildings[at]
  return station?.kind === 'forester' && station.replant && Math.max(Math.abs(station.x - tile % width), Math.abs(station.y - Math.floor(tile / width))) <= FOREST_RADIUS
}
export function forestryNeedsTrees(world: World): boolean {
  const at = world.homestead?.expansion.forestry
  if (at === null || at === undefined || world.buildings[at]?.kind !== 'forester') return false
  let count = 0
  for (let tile = 0; tile < world.buildings.length; tile++) if (world.buildings[tile]?.kind === 'tree' && ownedForestTile(world, tile)) count++
  return count < 6 && ownedForestTile(world, at)
}
