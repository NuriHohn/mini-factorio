import { inventoryTotal } from './items'
import { treeStage } from './nature'
import { neighboringTiles, peteReachableTiles, serviceCrossing, tilePath } from './navigation'
import { projectPlansConflict } from './secretProject'
import type { SecretProject } from './secretProject'
import { supplyCapacity } from './supplyCrate'
import { SIZE } from './world'
import type { World } from './world'
export const HARVEST_MS = 6000
export const HARVEST_COOLDOWN_MS = 120000
export const HARVEST_XP = 3
export const HARVEST_WOOD = 3
export function woodDestination(world: World): { crate: number; spot: number } | null {
  const paths = peteReachableTiles(world, world.pete.tile)
  const options = world.buildings.flatMap((b, crate) => b?.kind === 'supplyCrate' && b.wood + inventoryTotal(b.inventory) + HARVEST_WOOD <= supplyCapacity(b) ? neighboringTiles(crate).filter(spot => paths.has(spot) && !world.water[spot] && (!world.buildings[spot] || serviceCrossing(world, spot)) && !world.buildings.some(p => p?.kind === 'prison' && p.exit === spot)).map(spot => ({ crate, spot })) : [])
  return options.sort((a, b) => tilePath(paths, a.spot)!.length - tilePath(paths, b.spot)!.length || a.crate - b.crate || a.spot - b.spot)[0] ?? null
}
export function harvestTreeReady(world: World, project: SecretProject): boolean {
  const tree = world.buildings[project.tiles[0]], spot = project.spots[0]
  return tree?.kind === 'tree' && tree.bornAtMs === project.treeBornAtMs && tree.species === project.treeSpecies && tree.origin === project.treeOrigin && treeStage(world, tree) === 'mature' && !world.water[spot] && !world.buildings[spot] && peteReachableTiles(world, world.pete.tile).has(spot)
}
export function harvestSiteClear(world: World, project: SecretProject): boolean { return project.carried === HARVEST_WOOD ? woodDestination(world) !== null : harvestTreeReady(world, project) && woodDestination(world) !== null }
export function planHarvest(world: World, onlyTiles?: readonly number[]): SecretProject | null {
  const home = world.peace.home
  if (home === null || !woodDestination(world)) return null
  const paths = peteReachableTiles(world, world.pete.tile), candidates: { project: SecretProject; steps: number }[] = []
  for (let tile = 0; tile < world.buildings.length; tile++) {
    if (onlyTiles && !onlyTiles.includes(tile)) continue
    const tree = world.buildings[tile]
    if (tree?.kind !== 'tree' || treeStage(world, tree) !== 'mature' || Math.max(Math.abs(tile % SIZE - home % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(home / SIZE))) > (world.miniFactory ? 11 : 6)) continue
    for (const spot of neighboringTiles(tile)) {
      if (!paths.has(spot) || world.water[spot] || world.buildings[spot] || world.buildings.some(b => b?.kind === 'prison' && b.exit === spot)) continue
      const project: SecretProject = { kind: 'fell', home, direction: 'east', tiles: [tile], spots: [spot], phase: 'building', crate: null, built: 0, carried: 0, elapsedMs: 0, treeBornAtMs: tree.bornAtMs, treeSpecies: tree.species, treeOrigin: tree.origin, completedCycles: world.harvestProject?.completedCycles ?? 0, manualCycles: world.harvestProject?.manualCycles ?? 0 }
      if (!projectPlansConflict(world, project, world.harvestProject)) candidates.push({ project, steps: tilePath(paths, spot)!.length })
    }
  }
  candidates.sort((a, b) => a.steps - b.steps || a.project.tiles[0] - b.project.tiles[0] || a.project.spots[0] - b.project.spots[0])
  return candidates[0]?.project ?? null
}
