import { forestryNeedsTrees, ownedForestTile } from './forestrySupply'
import { nearFactory, naturalTreeCap } from './nature'
import { neighboringTiles, peteReachableTiles, tilePath } from './navigation'
import { projectPlansConflict, projectSiteClear } from './secretProject'
import type { SecretProject } from './secretProject'
import { inside, placementError, SIZE } from './world'
import type { World } from './world'
export const PLANT_COOLDOWN_MS = 120000
export const TEND_COOLDOWN_MS = 60000
export const TEND_MS = 4000
export const CARE_XP = 4
const distance = (a: number, b: number) => Math.max(Math.abs(a % SIZE - b % SIZE), Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)))
export function plantingSite(world: World, tile: number): boolean {
  const x = tile % SIZE, y = Math.floor(tile / SIZE)
  const forest = ownedForestTile(world, tile)
  if (placementError(world, x, y, 'tree') || world.tiles[tile] || (!forest && (world.homestead ? neighboringTiles(tile).some(i => world.buildings[i] && world.buildings[i]?.kind !== 'tree') || world.buildings.some(b => b && ['miner', 'belt', 'furnace', 'assembler', 'sawmill', 'forester', 'generator', 'powerPole'].includes(b.kind) && Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= 3) : nearFactory(world, x, y)))) return false
  const trees = world.buildings.flatMap((b, i) => b?.kind === 'tree' ? [i] : [])
  if (forest) {
    const before = peteReachableTiles(world, world.pete.tile), buildings = [...world.buildings]
    buildings[tile] = { kind: 'tree', x, y, species: 'oak', origin: 'manual', bornAtMs: world.timeMs, nextReproductionAtMs: world.timeMs + 600000 }
    const candidate = { ...world, buildings }, after = peteReachableTiles(candidate, world.pete.tile)
    if ([...before.keys()].some(i => i !== tile && !after.has(i)) || world.buildings.some((b, i) => b && neighboringTiles(i).some(n => before.has(n) && !world.buildings[n]) && !neighboringTiles(i).some(n => after.has(n) && !buildings[n]))) return false
  }
  return trees.length < naturalTreeCap() && !trees.some(i => distance(i, tile) < (forest ? 1 : 3)) && trees.filter(i => distance(i, tile) <= 6).length < 8
}
export function nearbyPlanting(project: SecretProject, world?: World): boolean { return distance(project.home, project.tiles[0]) >= 4 && distance(project.home, project.tiles[0]) <= (world?.homestead ? 8 : 6) }
export function planPlanting(world: World): SecretProject | null {
  const home = world.peace.home
  if (home === null) return null
  const trees = world.buildings.flatMap((b, i) => b?.kind === 'tree' ? [i] : []), parents = peteReachableTiles(world, world.pete.tile)
  const candidates: { tile: number; spot: number; steps: number }[] = []
  const replenish = forestryNeedsTrees(world)
  const radius = world.homestead ? 8 : 6
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const x = home % SIZE + dx, y = Math.floor(home / SIZE) + dy, tile = y * SIZE + x
    if (ownedForestTile(world, tile) && !replenish) continue
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 4 || !inside(x, y) || !plantingSite(world, tile)) continue
    for (const spot of neighboringTiles(tile)) {
      if (!parents.has(spot) || world.water[spot] || world.buildings[spot]) continue
      candidates.push({ tile, spot, steps: tilePath(parents, spot)!.length })
    }
  }
  // Prefer the inner home band, then walking distance and nearby forest edges.
  candidates.sort((a, b) => (replenish ? Number(ownedForestTile(world, b.tile)) - Number(ownedForestTile(world, a.tile)) : 0) || Number(distance(home, a.tile) > 6) - Number(distance(home, b.tile) > 6) || a.steps - b.steps || Number(!trees.some(i => distance(i, a.tile) <= 5)) - Number(!trees.some(i => distance(i, b.tile) <= 5)) || distance(home, a.tile) - distance(home, b.tile) || a.tile - b.tile || a.spot - b.spot)
  for (const { tile, spot } of candidates) {
    const plan: SecretProject = { kind: 'plant', home, direction: 'east', tiles: [tile], spots: [spot], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }
    if (!projectPlansConflict(world, plan, world.plantProject) && projectSiteClear(world, plan)) return plan
  }
  return null
}
export function gardenSpot(world: World): number | null {
  const garden = world.gardenProject
  if (garden?.phase !== 'complete' || world.buildings[garden.tiles[0]]?.kind !== 'peteGarden' || world.water[garden.spots[0]] || world.buildings[garden.spots[0]]) return null
  return peteReachableTiles(world, world.pete.tile).has(garden.spots[0]) ? garden.spots[0] : null
}
export function refreshGardening(world: World): void {
  if (!['gardenward', 'gardening'].includes(world.peace.activity) || gardenSpot(world) === world.peace.destination) return
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}

export function planGardenCare(world: World): SecretProject | null {
  const garden = world.gardenProject, spot = gardenSpot(world)
  if (!garden || spot === null || world.peace.home === null) return null
  return { kind: 'care', completedCycles: world.careProject?.completedCycles ?? 0, home: garden.home, direction: garden.direction, tiles: [...garden.tiles], spots: [spot], phase: 'collecting', built: 0, carried: 0, elapsedMs: 0, crate: null }
}
