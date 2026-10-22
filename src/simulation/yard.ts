import { footbridgeBank } from './footbridge'
import { neighboringTiles, reachableTiles, tilePath } from './navigation'
import type { SecretProject } from './secretProject'
import { SIZE } from './world'
import type { World } from './world'
export interface Yard extends SecretProject {
  kind: 'yard'
  left: number
  right: number
  top: number
  bottom: number
  entrance: number
  reused: number[]
}
export function yardInterior(y: Yard, i: number): boolean { return i % SIZE > y.left && i % SIZE < y.right && Math.floor(i / SIZE) > y.top && Math.floor(i / SIZE) < y.bottom }
export function yardBoundary(y: Pick<Yard, 'left' | 'right' | 'top' | 'bottom'>): number[] {
  const out: number[] = []
  for (let x = y.left; x <= y.right; x++) out.push(y.top * SIZE + x)
  for (let row = y.top + 1; row <= y.bottom; row++) out.push(row * SIZE + y.right)
  for (let x = y.right - 1; x >= y.left; x--) out.push(y.bottom * SIZE + x)
  for (let row = y.bottom - 1; row > y.top; row--) out.push(row * SIZE + y.left)
  return out
}
export function yardDirection(y: Yard, i: number): 'east' | 'south' { return Math.floor(i / SIZE) === y.top || Math.floor(i / SIZE) === y.bottom ? 'east' : 'south' }
export function enclosedYard(world: World): Yard | null {
  const y = world.yard, coop = world.coopProject?.tiles[0]
  return y?.phase === 'complete' && coop !== undefined && world.buildings[coop]?.kind === 'peteCoop' && yardInterior(y, coop) && yardBoundary(y).every(i => i === y.entrance || world.buildings[i]?.kind === 'peteFence') && !world.water[y.entrance] && !world.buildings[y.entrance] ? y : null
}
function occupied(world: World, i: number): boolean {
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])]
  return world.water[i] || footbridgeBank(world, i) || world.buildings.some(b => b?.kind === 'prison' && b.exit === i) || actors.some(a => a.tile === i || a.next === i || ('path' in a && a.path.includes(i)))
}
export function yardNavigation(world: World, y: Yard): World {
  const buildings = [...world.buildings]
  for (const i of y.tiles.slice(y.built)) buildings[i] = { kind: 'peteFence', x: i % SIZE, y: Math.floor(i / SIZE), direction: yardDirection(y, i) }
  return { ...world, buildings }
}
const siteCache = new WeakMap<World, { yard: Yard; revision: number; built: number; tile: number; result: boolean }>()
export function yardSiteClear(world: World, y: Yard): boolean {
  const remaining = y.tiles.slice(y.built), boundary = yardBoundary(y)
  if (remaining.some(i => world.buildings[i] || occupied(world, i)) || world.water[y.entrance] || world.buildings[y.entrance]) return false
  // A removed already-built/reused rail invalidates the enclosure, never traps an actor.
  if (boundary.some(i => i !== y.entrance && !remaining.includes(i) && world.buildings[i]?.kind !== 'peteFence')) return false
  if (y.spots.slice(y.built).some(i => world.water[i] || world.buildings[i])) return false
  const cached = siteCache.get(world)
  if (cached?.yard === y && cached.revision === world.topologyRevision && cached.built === y.built && cached.tile === world.pete.tile) return cached.result
  const candidate = yardNavigation(world, y), before = reachableTiles(world, world.pete.tile), after = reachableTiles(candidate, world.pete.tile)
  const result = y.spots.slice(y.built).every(i => after.has(i)) && [...before.keys()].every(i => remaining.includes(i) || after.has(i))
  siteCache.set(world, { yard: y, revision: world.topologyRevision, built: y.built, tile: world.pete.tile, result })
  return result
}
export function planYard(world: World): Yard | null {
  const home = world.peace.home, coop = world.coopProject?.tiles[0]
  if (home === null || world.coopProject?.phase !== 'complete' || coop === undefined || world.buildings[coop]?.kind !== 'peteCoop') return null
  const anchors = [home, coop, ...(world.campfireProject?.phase === 'complete' && world.buildings[world.campfireProject.tiles[0]]?.kind === 'peteCampfire' ? world.campfireProject.tiles : [])]
  const xs = anchors.map(i => i % SIZE), ys = anchors.map(i => Math.floor(i / SIZE)), candidates: Yard[] = []
  for (let l = 1; l <= 3; l++) for (let r = 1; r <= 3; r++) for (let t = 1; t <= 3; t++) for (let b = 1; b <= 3; b++) {
    const bounds = { left: Math.min(...xs) - l, right: Math.max(...xs) + r, top: Math.min(...ys) - t, bottom: Math.max(...ys) + b }
    if (bounds.left < 1 || bounds.top < 1 || bounds.right >= SIZE - 1 || bounds.bottom >= SIZE - 1 || bounds.right - bounds.left > 10 || bounds.bottom - bounds.top > 10) continue
    const boundary = yardBoundary(bounds)
    if (boundary.some(i => world.water[i] || (world.buildings[i] && world.buildings[i]?.kind !== 'peteFence'))) continue
    if (world.campfireProject?.spots.some(i => boundary.includes(i))) continue
    const reused = boundary.filter(i => world.buildings[i]?.kind === 'peteFence')
    const entrances = boundary.filter(i => !world.buildings[i] && neighboringTiles(i).some(n => n % SIZE > bounds.left && n % SIZE < bounds.right && Math.floor(n / SIZE) > bounds.top && Math.floor(n / SIZE) < bounds.bottom))
    // Four mid-side openings keep the search bounded; choose the closest accessible crate side first.
    const middleX = Math.floor((bounds.left + bounds.right) / 2), middleY = Math.floor((bounds.top + bounds.bottom) / 2)
    const preferred = [bounds.top * SIZE + middleX, middleY * SIZE + bounds.right, bounds.bottom * SIZE + middleX, middleY * SIZE + bounds.left]
    for (const entrance of preferred.filter(i => entrances.includes(i))) {
      candidates.push({ kind: 'yard', ...bounds, home, entrance, reused, direction: 'east', tiles: boundary.filter(i => i !== entrance && !reused.includes(i)), spots: [], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 })
    }
  }
  candidates.sort((a, b) => b.reused.length - a.reused.length || a.tiles.length - b.tiles.length || (a.right - a.left) * (a.bottom - a.top) - (b.right - b.left) * (b.bottom - b.top) || a.entrance - b.entrance)
  for (const y of candidates) {
    if (!y.tiles.length || y.tiles.some(i => occupied(world, i))) continue
    const boundary = new Set(yardBoundary(y)), candidate = yardNavigation(world, y), paths = reachableTiles(candidate, world.pete.tile)
    y.spots = y.tiles.map(i => neighboringTiles(i).filter(n => !boundary.has(n) && !candidate.water[n] && !candidate.buildings[n] && paths.has(n) && !candidate.buildings.some(b => b?.kind === 'prison' && b.exit === n)).sort((a, b) => Number(yardInterior(y, b)) - Number(yardInterior(y, a)) || (tilePath(paths, a)?.length ?? Infinity) - (tilePath(paths, b)?.length ?? Infinity) || a - b)[0] ?? -1)
    if (anchors.some(i => !neighboringTiles(i).some(n => paths.has(n) && !candidate.water[n] && !candidate.buildings[n])) || y.spots.includes(-1) || !yardSiteClear(world, y)) continue
    return y
  }
  return null
}
