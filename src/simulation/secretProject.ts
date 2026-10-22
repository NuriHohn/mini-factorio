import { neighboringTiles, reachableTiles, tilePath, walkableTile } from './navigation'
import { footbridgeBank } from './footbridge'
import { PETE_WALK_MS } from './pete'
import { inside, SIZE } from './world'
import type { World } from './world'
export const PROJECT_WOOD = 6
export const FENCE_SEGMENT_MS = 4000
export interface SecretProject {
  home: number
  direction: 'east' | 'south'
  tiles: number[]
  spots: number[]
  phase: 'collecting' | 'building' | 'complete'
  crate: number | null
  built: number
  carried: number
  elapsedMs: number
}
function navigationWorld(world: World, project = world.project): World {
  if (!project) return world
  const buildings = [...world.buildings]
  for (const i of project.tiles.slice(project.built)) buildings[i] = { kind: 'peteFence', x: i % SIZE, y: Math.floor(i / SIZE), direction: project.direction }
  return { ...world, buildings }
}
function source(world: World, project = world.project): { crate: number; spot: number } | null {
  const parents = reachableTiles(navigationWorld(world, project), world.pete.tile)
  const candidates = world.buildings.flatMap((b, crate) => b?.kind === 'supplyCrate' && b.wood >= PROJECT_WOOD ? neighboringTiles(crate).filter(spot => !world.water[spot] && !world.buildings[spot] && parents.has(spot) && !world.buildings.some(b => b?.kind === 'prison' && b.exit === spot)).map(spot => ({ crate, spot })) : [])
  return candidates.sort((a, b) => (tilePath(parents, a.spot)?.length ?? Infinity) - (tilePath(parents, b.spot)?.length ?? Infinity) || a.crate - b.crate || a.spot - b.spot)[0] ?? null
}
export function projectSiteClear(world: World, project: SecretProject): boolean {
  const remaining = project.tiles.slice(project.built)
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])]
  if (remaining.some(i => world.water[i] || world.buildings[i] || footbridgeBank(world, i) || world.buildings.some(b => b?.kind === 'prison' && b.exit === i) || actors.some(a => a.tile === i || a.next === i || ('path' in a && a.path.includes(i))))) return false
  if (project.spots.slice(project.built).some(i => world.water[i] || world.buildings[i])) return false
  const before = reachableTiles(world, world.pete.tile), buildings = [...world.buildings]
  for (const i of remaining) buildings[i] = { kind: 'peteFence', x: i % SIZE, y: Math.floor(i / SIZE), direction: project.direction }
  const after = reachableTiles({ ...world, buildings }, world.pete.tile)
  return project.spots.slice(project.built).every(i => after.has(i)) && [...before.keys()].every(i => remaining.includes(i) || after.has(i))
}
function layout(world: World): SecretProject | null {
  const home = world.peace.home!, x = home % SIZE, y = Math.floor(home / SIZE)
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const cells = [-1, 0, 1].map(n => ({ x: x + dx * 3 + (dy ? n : 0), y: y + dy * 3 + (dx ? n : 0) }))
    if (cells.some(p => !inside(p.x, p.y))) continue
    const project: SecretProject = { home, direction: dy ? 'east' : 'south', tiles: cells.map(p => p.y * SIZE + p.x), spots: cells.map(p => (p.y - dy) * SIZE + p.x - dx), phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }
    if (projectSiteClear(world, project) && source(world, project)) return project
  }
  return null
}
function stop(world: World): void {
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
export function refreshProject(world: World): void {
  const project = world.project
  if (project && project.crate !== null && world.buildings[project.crate]?.kind !== 'supplyCrate') {
    project.crate = null
    if (world.peace.activity === 'project') stop(world)
  }
}
export function trySecretProject(world: World): boolean {
  if (world.project?.phase === 'complete' || world.peace.home === null || world.police.car || world.revenge.boss || world.pete.mode !== 'WANDERING') return false
  if (!world.project) {
    if (!source(world)) return false
    const plan = layout(world)
    if (!plan) return false
    world.project = plan
  }
  if (!projectSiteClear(world, world.project) || (world.project.phase === 'collecting' && !source(world))) return false
  Object.assign(world.peace, { activity: 'project', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
  world.pete.path = []; world.pete.pathRevision = -1
  return true
}
function moveTo(world: World, target: number, delta: number): boolean {
  const p = world.pete, s = world.peace
  if (p.next !== null && !walkableTile(world, p.next)) { p.next = null; p.travelMs = 0; p.x = p.tile % SIZE; p.y = Math.floor(p.tile / SIZE); p.pathRevision = -1 }
  if (p.next === null && (s.destination !== target || p.pathRevision !== world.topologyRevision)) {
    const path = tilePath(reachableTiles(navigationWorld(world), p.tile), target)
    if (!path) { stop(world); return false }
    p.path = path; p.pathRevision = world.topologyRevision; s.destination = target
  }
  if (p.next === null) p.next = p.path.shift() ?? null
  if (p.next === null) return p.tile === target
  p.travelMs += delta
  const t = Math.min(1, p.travelMs / PETE_WALK_MS)
  p.x = p.tile % SIZE + (p.next % SIZE - p.tile % SIZE) * t
  p.y = Math.floor(p.tile / SIZE) + (Math.floor(p.next / SIZE) - Math.floor(p.tile / SIZE)) * t
  if (t === 1) { p.tile = p.next; p.next = null; p.travelMs = 0 }
  return false
}
export function advanceSecretProject(world: World, delta: number): void {
  const project = world.project
  if (!project || project.phase === 'complete' || world.peace.home === null) { stop(world); return }
  if (project.phase === 'collecting') {
    const stored = project.crate === null ? null : world.buildings[project.crate], spot = world.peace.destination
    // Keep an in-flight pickup stable when another crate receives Wood.
    const pickup = stored?.kind === 'supplyCrate' && stored.wood >= PROJECT_WOOD && spot !== null && !world.water[spot] && !world.buildings[spot] && neighboringTiles(project.crate!).includes(spot) ? { crate: project.crate!, spot } : source(world)
    if (!pickup || !projectSiteClear(world, project)) { project.crate = null; stop(world); return }
    project.crate = pickup.crate
    if (!moveTo(world, pickup.spot, delta)) return
    const crate = world.buildings[pickup.crate]!
    if (crate.kind !== 'supplyCrate' || crate.wood < PROJECT_WOOD) { stop(world); return }
    crate.wood -= PROJECT_WOOD
    project.carried = PROJECT_WOOD; project.phase = 'building'; project.crate = null
    world.peace.destination = null; world.pete.pathRevision = -1
    return
  }
  const spot = project.spots[project.built]
  if (!moveTo(world, spot, delta)) return
  if (!projectSiteClear(world, project)) { stop(world); return }
  project.elapsedMs += delta
  if (project.elapsedMs < FENCE_SEGMENT_MS) return
  const tile = project.tiles[project.built]
  world.buildings[tile] = { kind: 'peteFence', x: tile % SIZE, y: Math.floor(tile / SIZE), direction: project.direction }
  world.topologyRevision++
  project.built++; project.carried -= PROJECT_WOOD / 3; project.elapsedMs = 0
  world.peace.destination = null; world.pete.pathRevision = -1
  if (project.built === 3) { project.phase = 'complete'; stop(world) }
}
