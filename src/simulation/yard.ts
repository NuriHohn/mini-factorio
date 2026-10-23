import { footbridgeBank } from './footbridge'
import { neighboringTiles, peteReachableTiles as reachableTiles, tilePath } from './navigation'
import type { SecretProject } from './secretProject'
import { SIZE } from './world'
import type { World } from './world'
export const YARD_MAX_SPAN = 14
export interface Yard extends SecretProject {
  kind: 'yard' | 'run'
  left: number
  right: number
  top: number
  bottom: number
  entrance: number
  reused: number[]
  deferredWork?: { tile: number; elapsedMs: number }[]
}
export function yardInterior(y: Pick<Yard, 'left' | 'right' | 'top' | 'bottom'>, i: number): boolean { return i % SIZE > y.left && i % SIZE < y.right && Math.floor(i / SIZE) > y.top && Math.floor(i / SIZE) < y.bottom }
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
  return y?.phase === 'complete' && coop !== undefined && world.buildings[coop]?.kind === 'peteCoop' && yardInterior(y, coop) && yardBoundary(y).every(i => i === y.entrance || world.buildings[i]?.kind === 'peteFence') && !world.water[y.entrance] && (!world.buildings[y.entrance] || world.buildings[y.entrance]?.kind === 'peteGate') ? y : null
}
function occupied(world: World, i: number): boolean {
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])]
  return world.water[i] || footbridgeBank(world, i) || world.buildings.some(b => b?.kind === 'prison' && b.exit === i) || actors.some(a => a.tile === i || a.next === i || (a !== world.pete && 'path' in a && a.path.includes(i)))
}
export function yardNavigation(world: World, y: Yard): World {
  const buildings = [...world.buildings]
  for (const i of y.tiles.slice(y.built)) if (!buildings[i] && !world.water[i]) buildings[i] = { kind: 'peteFence', x: i % SIZE, y: Math.floor(i / SIZE), direction: yardDirection(y, i) }
  return { ...world, buildings, ...(y.kind === 'run' ? { chickenRun: { ...y, built: y.tiles.length } } : {}) }
}

function preservesApproaches(world: World, before: Map<number, number>, after: Map<number, number>, final: World): boolean {
  return world.buildings.every((b, i) => !b || b.kind === 'peteFence' || b.kind === 'tree' || !neighboringTiles(i).some(n => before.has(n) && !world.buildings[n] && !world.water[n]) || neighboringTiles(i).some(n => after.has(n) && !final.buildings[n] && !world.water[n]))
}
const workCache = new WeakMap<World, { key: string; spot: number | null }>()
// Validate the next section, not every future actor reservation at once.
export function yardWorkSpot(world: World, y: Yard, tile: number): number | null {
  if (world.buildings[tile] || occupied(world, tile)) return null
  const key = `${world.topologyRevision}:${world.pete.tile}:${tile}:${y.left}:${y.right}:${y.top}:${y.bottom}`
  const cached = workCache.get(world)
  if (cached?.key === key) return cached.spot
  const before = reachableTiles(world, world.pete.tile), buildings = [...world.buildings]
  buildings[tile] = { kind: 'peteFence', x: tile % SIZE, y: Math.floor(tile / SIZE), direction: yardDirection(y, tile) }
  const candidate = { ...world, buildings, ...(y.kind === 'run' ? { chickenRun: { ...y, tiles: [...y.tiles.slice(0, y.built), tile], built: y.built + 1 } } : {}) }, after = reachableTiles(candidate, world.pete.tile)
  // A section must preserve all currently accessible space. Future sections may wait.
  if (!preservesApproaches(world, before, after, candidate) || [...before.keys()].some(i => i !== tile && !after.has(i))) return null
  const boundary = yardBoundary(y)
  const spot = neighboringTiles(tile).filter(i => !boundary.includes(i) && !world.water[i] && !world.buildings[i] && after.has(i))
    .sort((a, b) => (tilePath(after, a)?.length ?? Infinity) - (tilePath(after, b)?.length ?? Infinity) || a - b)[0] ?? null
  workCache.set(world, { key, spot })
  return spot
}
export function yardSiteClear(world: World, y: Yard): boolean {
  return !world.water[y.entrance] && (!world.buildings[y.entrance] || world.buildings[y.entrance]?.kind === 'peteGate') && yardWorkSpot(world, y, y.tiles[y.built]) !== null
}
export function prepareYardSection(world: World, y: Yard, moving = false): boolean {
  if (y.phase === 'complete') return false
  // Save partial hammer work by tile when another section can progress.
  for (let n = y.built; n < y.tiles.length; n++) {
    const spot = yardWorkSpot(world, y, y.tiles[n])
    if (spot === null) continue
    if (n !== y.built) {
      const tile = y.tiles[y.built], previous = y.spots[y.built]
      if (y.elapsedMs) { (y.deferredWork ??= []).push({ tile, elapsedMs: y.elapsedMs }); y.elapsedMs = 0 }
      y.tiles[y.built] = y.tiles[n]; y.tiles[n] = tile
      y.spots[y.built] = y.spots[n]; y.spots[n] = previous
    }
    if (y.phase === 'building') {
      const saved = y.deferredWork?.find(work => work.tile === y.tiles[y.built])
      if (saved) {
        y.elapsedMs = saved.elapsedMs
        y.deferredWork = y.deferredWork!.filter(work => work !== saved)
        if (!y.deferredWork.length) delete y.deferredWork
      }
    }
    if (y.spots[y.built] !== spot) { y.spots[y.built] = spot; if (moving) { world.peace.destination = null; world.pete.pathRevision = -1 } }
    return true
  }
  return false
}
export function planYard(world: World, run = false): Yard | null {
  const home = world.peace.home, coop = world.coopProject?.tiles[0]
  if (home === null || world.coopProject?.phase !== 'complete' || coop === undefined || world.buildings[coop]?.kind !== 'peteCoop') return null
  const anchors = run ? [coop] : [home, coop, ...(world.campfireProject?.phase === 'complete' && world.buildings[world.campfireProject.tiles[0]]?.kind === 'peteCampfire' ? world.campfireProject.tiles : [])]
  const xs = anchors.map(i => i % SIZE), ys = anchors.map(i => Math.floor(i / SIZE)), candidates: Yard[] = []
  for (let l = 1; l <= 4; l++) for (let r = 1; r <= 4; r++) for (let t = 1; t <= 4; t++) for (let b = 1; b <= 4; b++) {
    const bounds = { left: Math.min(...xs) - l, right: Math.max(...xs) + r, top: Math.min(...ys) - t, bottom: Math.max(...ys) + b }
    if (bounds.left < 1 || bounds.top < 1 || bounds.right >= SIZE - 1 || bounds.bottom >= SIZE - 1 || bounds.right - bounds.left > YARD_MAX_SPAN || bounds.bottom - bounds.top > YARD_MAX_SPAN) continue
    if (run && yardInterior(bounds, home)) continue
    const boundary = yardBoundary(bounds)
    if ((run && boundary.includes(world.yard?.entrance ?? -1)) || boundary.some(i => world.water[i] || (world.buildings[i] && world.buildings[i]?.kind !== 'peteFence'))) continue
    if ([world.orchardProject, world.nurseryProject, world.bicycleProject, world.mechanicProject, world.winchProject, world.houseProject, world.treasureProject, world.flightProject, world.pressProject, world.experimentProject, world.campfireProject, world.workshopProject, world.gardenProject, world.verandaProject].some(p => p?.spots.some(i => boundary.includes(i)))) continue
    const reused = boundary.filter(i => world.buildings[i]?.kind === 'peteFence')
    const entrances = boundary.filter(i => !world.buildings[i] && neighboringTiles(i).some(n => n % SIZE > bounds.left && n % SIZE < bounds.right && Math.floor(n / SIZE) > bounds.top && Math.floor(n / SIZE) < bounds.bottom))
    // Prefer mid-side openings, then try other accessible openings in the bounded perimeter.
    const middleX = Math.floor((bounds.left + bounds.right) / 2), middleY = Math.floor((bounds.top + bounds.bottom) / 2)
    const preferred = [bounds.top * SIZE + middleX, middleY * SIZE + bounds.right, bounds.bottom * SIZE + middleX, middleY * SIZE + bounds.left]
    for (const entrance of [...preferred.filter(i => entrances.includes(i)), ...entrances.filter(i => !preferred.includes(i))]) {
      candidates.push({ kind: run ? 'run' : 'yard', ...bounds, home, entrance, reused, direction: 'east', tiles: boundary.filter(i => i !== entrance && !reused.includes(i)), spots: [], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 })
    }
  }
  candidates.sort((a, b) => b.reused.length - a.reused.length || a.tiles.length - b.tiles.length || (a.right - a.left) * (a.bottom - a.top) - (b.right - b.left) * (b.bottom - b.top) || a.entrance - b.entrance)
  for (const y of candidates) {
    if (!y.tiles.length || y.tiles.includes(world.pete.tile)) continue
    const boundary = new Set(yardBoundary(y)), candidate = yardNavigation(world, y), paths = reachableTiles(candidate, world.pete.tile)
    y.spots = y.tiles.map(i => neighboringTiles(i).filter(n => !boundary.has(n) && !candidate.water[n] && !candidate.buildings[n] && paths.has(n) && !candidate.buildings.some(b => b?.kind === 'prison' && b.exit === n)).sort((a, b) => Number(yardInterior(y, b)) - Number(yardInterior(y, a)) || (tilePath(paths, a)?.length ?? Infinity) - (tilePath(paths, b)?.length ?? Infinity) || a - b)[0] ?? -1)
    const before = reachableTiles(world, world.pete.tile)
    if (!preservesApproaches(world, before, paths, candidate) || [...before.keys()].some(i => !y.tiles.includes(i) && !paths.has(i))) continue
    if ([home, ...anchors].some(i => !neighboringTiles(i).some(n => paths.has(n) && !candidate.water[n] && !candidate.buildings[n])) || y.spots.includes(-1) || !prepareYardSection(world, y)) continue
    return y
  }
  return null
}

export function yardSummary(world: World): string {
  const y = world.yard
  if (y?.phase === 'complete') return enclosedYard(world) ? 'Enclosed yard complete. The chickens stay inside its fence.' : 'Yard construction is complete, but a fence section, coop or entrance is missing or blocked.'
  if (y) return `Enclosed yard: ${y.built}/${y.tiles.length} new fence sections built; ${y.reused.length} original sections reused. Each remaining section needs 2 supplied Wood.${yardSiteClear(world, y) ? '' : ` Waiting for a free section near (${y.tiles[y.built] % SIZE}, ${Math.floor(y.tiles[y.built] / SIZE)}); paid work is retained.`}`
  if (world.project?.phase !== 'complete') return 'The first project builds only three fence sections. The enclosed yard comes after the fence, chicken coop and campfire.'
  const missing = [world.coopProject?.phase !== 'complete' ? 'chicken coop' : '', world.campfireProject?.phase !== 'complete' ? 'campfire' : ''].filter(Boolean)
  return missing.length ? `The first three fence sections are complete. Before enclosing the yard I need: ${missing.join(', ')}.` : 'The enclosed yard is unlocked. I need supplied Wood and a safe perimeter around my home, coop and campfire.'
}

export function enclosedRun(world: World): Yard | null {
  const run = world.chickenRun, coop = world.coopProject?.tiles[0]
  return run?.phase === 'complete' && coop !== undefined && world.buildings[coop]?.kind === 'peteCoop' && yardInterior(run, coop) && yardBoundary(run).every(i => i === run.entrance || world.buildings[i]?.kind === 'peteFence') && !world.water[run.entrance] && !world.buildings[run.entrance] ? run : null
}
