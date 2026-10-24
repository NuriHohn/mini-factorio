import { developmentBuilding } from './peteDevelopments'
import { chopTree, MATURE_TREE_MS, plantTree, treeStage } from './nature'
import { recordProduction } from './analytics'
import { SIZE } from './world'
import type { Forester, World } from './world'

export const FOREST_RADIUS = 3
export const FELL_MS = 6000
export const REPLANT_MS = 3000
export function forestTiles(station: Forester): number[] {
  const tiles: number[] = []
  for (let y = Math.max(0, station.y - FOREST_RADIUS); y <= Math.min(SIZE - 1, station.y + FOREST_RADIUS); y++) {
    for (let x = Math.max(0, station.x - FOREST_RADIUS); x <= Math.min(SIZE - 1, station.x + FOREST_RADIUS); x++) tiles.push(y * SIZE + x)
  }
  return tiles
}
export function matureForest(world: World, station: Forester): number[] {
  return forestTiles(station).filter(i => { const b = world.buildings[i]; return b?.kind === 'tree' && treeStage(world, b) === 'mature' })
}
// The station keeps a bounded list of its own harvested plots; no arbitrary land is planted.
export function advanceForestry(world: World, delta: number): void {
  for (const station of world.buildings) {
    if (station?.kind !== 'forester') continue
    const speed = world.power?.consumers[station.y * SIZE + station.x]?.speedFraction ?? 0
    if (speed <= 0) continue
    const plot = station.replant ? station.plots.find(i => !world.water[i] && !world.buildings[i]) : undefined
    const nursery = developmentBuilding(world, 'nursery')
    const seedling = !!nursery && !!world.developmentLife?.saplings && Math.abs(nursery.x - station.x) + Math.abs(nursery.y - station.y) <= 3
    if (plot !== undefined && (station.output.wood > 0 || seedling)) {
      station.plantElapsed += delta * speed
      if (station.plantElapsed >= REPLANT_MS && plantTree(world, plot % SIZE, Math.floor(plot / SIZE), 'oak')) {
        if (seedling) world.developmentLife!.saplings--
        else { station.output.wood--; recordProduction(world, {}, { wood: 1 }) }
        station.plots = station.plots.filter(i => i !== plot)
        station.plantElapsed = 0
      }
      continue
    }
    if (station.output.wood > 3) continue
    const tile = matureForest(world, station)[0]
    if (tile === undefined) continue
    station.elapsed = Math.min(FELL_MS, station.elapsed + delta * speed)
    if (station.elapsed < FELL_MS) continue
    if (chopTree(world, tile % SIZE, Math.floor(tile / SIZE), false)) {
      station.elapsed = 0
      station.output.wood += 3
      world.mined.wood += 3
      recordProduction(world, { wood: 3 })
      if (!station.plots.includes(tile)) station.plots.push(tile)
    }
  }
}
export function forestryStatus(world: World, station: Forester): string {
  if (station.replant && station.plots.some(i => !world.water[i] && !world.buildings[i]) && station.output.wood) return 'Growing a replacement sapling · costs 1 Wood'
  if (station.output.wood > 3) return 'Wood output full · connect transport'
  if (matureForest(world, station).length) return 'Felling mature trees · 3 Wood each'
  return `Waiting for mature trees within ${FOREST_RADIUS} tiles · growth ${MATURE_TREE_MS / 60000} min; keep harvested plots clear`
}

export function forestryOutput(station: Forester, world?: World): number {
  const reserve = station.replant && station.plots.some(i => !world || (!world.water[i] && !world.buildings[i])) ? 1 : 0
  return Math.max(0, station.output.wood - reserve)
}
