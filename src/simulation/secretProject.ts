import type { Yard } from './yard'
import { planYard, yardDirection, yardNavigation, yardSiteClear } from './yard'
import { neighboringTiles, reachableTiles, tilePath, walkableTile } from './navigation'
import { footbridgeBank } from './footbridge'
import { PETE_WALK_MS } from './pete'
import { inside, SIZE } from './world'
import type { PeteCampfire, PeteCoop, PeteFence, World } from './world'
export const PROJECT_WOOD = 6
export const FENCE_SEGMENT_MS = 4000
export const COOP_WOOD = 10
export const COOP_BUILD_MS = 12000
export const CAMPFIRE_WOOD = 5
export const CAMPFIRE_BUILD_MS = 6000
export interface SecretProject {
  kind?: 'coop' | 'campfire' | 'yard'
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
export function currentProject(world: World): SecretProject | null {
  if (world.project?.phase !== 'complete') return world.project
  if (world.coopProject?.phase === 'complete' && world.yard && world.yard.phase !== 'complete') return world.yard
  return world.coopProject?.phase === 'complete' ? world.campfireProject : world.coopProject
}
export function projectWood(project: SecretProject | null): number { return project?.kind === 'yard' ? 2 : project?.kind === 'campfire' ? CAMPFIRE_WOOD : project?.kind === 'coop' ? COOP_WOOD : PROJECT_WOOD }
export function projectBuildMs(project: SecretProject): number { return project.kind === 'campfire' ? CAMPFIRE_BUILD_MS : project.kind === 'coop' ? COOP_BUILD_MS : FENCE_SEGMENT_MS }
function worldYard(project: SecretProject): Yard { return project as Yard }
function projectBuilding(project: SecretProject, i: number): PeteCampfire | PeteCoop | PeteFence {
  const position = { x: i % SIZE, y: Math.floor(i / SIZE) }
  return project.kind === 'campfire' ? { ...position, kind: 'peteCampfire' } : project.kind === 'coop' ? { ...position, kind: 'peteCoop' } : { ...position, kind: 'peteFence', direction: project.kind === 'yard' ? yardDirection(worldYard(project), i) : project.direction }
}
function navigationWorld(world: World, project = currentProject(world)): World {
  if (!project) return world
  if (project.kind === 'yard') return yardNavigation(world, worldYard(project))
  const buildings = [...world.buildings]
  for (const i of project.tiles.slice(project.built)) buildings[i] = projectBuilding(project, i)
  return { ...world, buildings }
}
function source(world: World, project = currentProject(world), wood = projectWood(project)): { crate: number; spot: number } | null {
  const parents = reachableTiles(navigationWorld(world, project), world.pete.tile)
  const candidates = world.buildings.flatMap((b, crate) => b?.kind === 'supplyCrate' && b.wood >= wood ? neighboringTiles(crate).filter(spot => !world.water[spot] && !world.buildings[spot] && parents.has(spot) && !world.buildings.some(b => b?.kind === 'prison' && b.exit === spot)).map(spot => ({ crate, spot })) : [])
  return candidates.sort((a, b) => (tilePath(parents, a.spot)?.length ?? Infinity) - (tilePath(parents, b.spot)?.length ?? Infinity) || a.crate - b.crate || a.spot - b.spot)[0] ?? null
}
export function projectSiteClear(world: World, project: SecretProject): boolean {
  if (project.kind === 'yard') return yardSiteClear(world, worldYard(project))
  const remaining = project.tiles.slice(project.built)
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])]
  if (remaining.some(i => world.water[i] || world.buildings[i] || footbridgeBank(world, i) || world.buildings.some(b => b?.kind === 'prison' && b.exit === i) || actors.some(a => a.tile === i || a.next === i || ('path' in a && a.path.includes(i))))) return false
  if (project.spots.slice(project.built).some(i => world.water[i] || world.buildings[i])) return false
  const before = reachableTiles(world, world.pete.tile), buildings = [...world.buildings]
  for (const i of remaining) buildings[i] = projectBuilding(project, i)
  const after = reachableTiles({ ...world, buildings }, world.pete.tile)
  return project.spots.slice(project.built).every(i => after.has(i)) && [...before.keys()].every(i => remaining.includes(i) || after.has(i))
}
function layout(world: World, kind: SecretProject['kind']): SecretProject | null {
  const home = world.peace.home!, x = home % SIZE, y = Math.floor(home / SIZE)
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const cells = (kind ? [0] : [-1, 0, 1]).map(n => ({ x: x + dx * 3 + (dy ? n : 0), y: y + dy * 3 + (dx ? n : 0) }))
    if (cells.some(p => !inside(p.x, p.y))) continue
    const project: SecretProject = { ...(kind ? { kind } : {}), home, direction: dy ? 'east' : 'south', tiles: cells.map(p => p.y * SIZE + p.x), spots: cells.map(p => (p.y - dy) * SIZE + p.x - dx), phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }
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
  for (const project of [world.project, world.coopProject, world.campfireProject, world.yard]) if (project && project.crate !== null && world.buildings[project.crate]?.kind !== 'supplyCrate') {
    project.crate = null
    if (world.peace.activity === 'project' && currentProject(world) === project) stop(world)
  }
}
export function trySecretProject(world: World): boolean {
  if (world.peace.home === null || world.police.car || world.revenge.boss || world.pete.mode !== 'WANDERING') return false
  const kind = world.coopProject?.phase === 'complete' ? 'campfire' : world.project?.phase === 'complete' ? 'coop' : undefined
  let project = currentProject(world)
  if (project?.phase === 'complete') return false
  if (!project) {
    if (!source(world, null, kind === 'campfire' ? CAMPFIRE_WOOD : kind === 'coop' ? COOP_WOOD : PROJECT_WOOD)) return false
    const plan = layout(world, kind)
    if (!plan) return false
    if (kind === 'campfire') world.campfireProject = plan
    else if (kind === 'coop') world.coopProject = plan
    else world.project = plan
    project = plan
  }
  if (!projectSiteClear(world, project) || (project.phase === 'collecting' && !source(world))) return false
  Object.assign(world.peace, { activity: 'project', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
  world.pete.path = []; world.pete.pathRevision = -1
  return true
}
export function tryYard(world: World): boolean {
  if (world.yard || world.peace.home === null || world.coopProject?.phase !== 'complete' || world.campfireProject?.phase !== 'complete' || world.pete.mode !== 'WANDERING' || world.police.car || world.revenge.boss || !source(world, null, 2)) return false
  const yard = planYard(world)
  if (!yard || !source(world, yard, 2)) return false
  world.yard = yard
  return trySecretProject(world)
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
  const project = currentProject(world)
  if (!project || project.phase === 'complete' || world.peace.home === null) { stop(world); return }
  const wood = projectWood(project)
  if (project.phase === 'collecting') {
    const stored = project.crate === null ? null : world.buildings[project.crate], spot = world.peace.destination
    // Keep an in-flight pickup stable when another crate receives Wood.
    const pickup = stored?.kind === 'supplyCrate' && stored.wood >= wood && spot !== null && !world.water[spot] && !world.buildings[spot] && neighboringTiles(project.crate!).includes(spot) ? { crate: project.crate!, spot } : source(world)
    if (!pickup || !projectSiteClear(world, project)) { project.crate = null; stop(world); return }
    project.crate = pickup.crate
    if (!moveTo(world, pickup.spot, delta)) return
    const crate = world.buildings[pickup.crate]!
    if (crate.kind !== 'supplyCrate' || crate.wood < wood) { stop(world); return }
    crate.wood -= wood
    project.carried = wood; project.phase = 'building'; project.crate = null
    world.peace.destination = null; world.pete.pathRevision = -1
    return
  }
  const spot = project.spots[project.built]
  if (!moveTo(world, spot, delta)) return
  if (!projectSiteClear(world, project)) { stop(world); return }
  project.elapsedMs += delta
  if (project.elapsedMs < projectBuildMs(project)) return
  const tile = project.tiles[project.built]
  world.buildings[tile] = projectBuilding(project, tile)
  world.topologyRevision++
  project.built++; project.carried -= project.kind === 'yard' ? wood : wood / project.tiles.length; project.elapsedMs = 0
  if (project.kind === 'yard' && project.built < project.tiles.length) project.phase = 'collecting'
  world.peace.destination = null; world.pete.pathRevision = -1
  if (project.built === project.tiles.length) { project.phase = 'complete'; stop(world) }
}
