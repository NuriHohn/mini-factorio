import { nearFactory, naturalTreeCap } from './nature'
import { neighboringTiles, peteReachableTiles } from './navigation'
import { projectPlansConflict, projectSiteClear } from './secretProject'
import type { SecretProject } from './secretProject'
import { inside, placementError, SIZE } from './world'
import type { World } from './world'
export const PLANT_COOLDOWN_MS = 120000
export const TEND_COOLDOWN_MS = 60000
export const TEND_MS = 4000
const distance = (a: number, b: number) => Math.max(Math.abs(a % SIZE - b % SIZE), Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)))
export function plantingSite(world: World, tile: number): boolean {
  const x = tile % SIZE, y = Math.floor(tile / SIZE)
  if (placementError(world, x, y, 'tree') || world.tiles[tile] || nearFactory(world, x, y)) return false
  const trees = world.buildings.flatMap((b, i) => b?.kind === 'tree' ? [i] : [])
  return trees.length < naturalTreeCap() && !trees.some(i => distance(i, tile) < 3) && trees.filter(i => distance(i, tile) <= 6).length < 8
}
export function planPlanting(world: World): SecretProject | null {
  const home = world.peace.home
  if (home === null) return null
  const trees = world.buildings.flatMap((b, i) => b?.kind === 'tree' ? [i] : []), parents = peteReachableTiles(world, world.pete.tile)
  const candidates: number[] = []
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
    const x = home % SIZE + dx, y = Math.floor(home / SIZE) + dy
    if (inside(x, y) && plantingSite(world, y * SIZE + x)) candidates.push(y * SIZE + x)
  }
  // Prefer forest edges, then nearby sites, with stable tile-order ties. No RNG here.
  candidates.sort((a, b) => Number(!trees.some(i => distance(i, a) <= 5)) - Number(!trees.some(i => distance(i, b) <= 5)) || distance(home, a) - distance(home, b) || a - b)
  for (const tile of candidates) {
    const spot = neighboringTiles(tile).find(i => parents.has(i) && !world.water[i] && !world.buildings[i])
    if (spot === undefined) continue
    const plan: SecretProject = { kind: 'plant', home, direction: 'east', tiles: [tile], spots: [spot], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }
    if (!projectPlansConflict(world, plan) && projectSiteClear(world, plan)) return plan
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
