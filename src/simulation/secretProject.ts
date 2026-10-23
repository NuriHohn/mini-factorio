import { planPlanting, plantingSite, PLANT_COOLDOWN_MS, TEND_COOLDOWN_MS } from './ecoProjects'
import { plantTree } from './nature'
import { PETE_PROJECTS, projectUnlocked } from './projectRegistry'
import type { ProjectDefinition, ProjectMaterial } from './projectRegistry'
import { awardActivity, rewardProject } from './personality'
import { gateSiteClear, GATE_WOOD, planGate, preparePeteGate } from './gardenGate'
import type { Yard } from './yard'
import { planYard, yardDirection, yardNavigation, yardSiteClear } from './yard'
import { neighboringTiles, peteReachableTiles as reachableTiles, tilePath, peteWalkableTile as walkableTile } from './navigation'
import { footbridgeBank } from './footbridge'
import { PETE_WALK_MS } from './pete'
import { inside, SIZE } from './world'
import type { PeteGarden, Tree, PeteGate, PeteCampfire, PeteCoop, PeteFence, World } from './world'
export const PROJECT_WOOD = PETE_PROJECTS.find(p => p.id === 'fence')!.resources.wood!
export const FENCE_SEGMENT_MS = 4000
export const COOP_WOOD = PETE_PROJECTS.find(p => p.id === 'coop')!.resources.wood!
export const COOP_BUILD_MS = 12000
export const CAMPFIRE_WOOD = PETE_PROJECTS.find(p => p.id === 'campfire')!.resources.wood!
export const CAMPFIRE_BUILD_MS = 6000
export interface SecretProject {
  selected?: true
  readyAtMs?: number
  kind?: 'garden' | 'plant' | 'coop' | 'campfire' | 'yard' | 'gate'
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
  return PETE_PROJECTS.map(p => world[p.state]).find(p => p?.selected) ?? null
}
export function projectWood(project: SecretProject | null): number { return project?.kind === 'garden' ? 12 : project?.kind === 'plant' ? 2 : project?.kind === 'gate' ? GATE_WOOD : project?.kind === 'yard' ? 2 : project?.kind === 'campfire' ? CAMPFIRE_WOOD : project?.kind === 'coop' ? COOP_WOOD : PROJECT_WOOD }
export function projectBuildMs(project: SecretProject): number { return project.kind === 'garden' ? 12000 : project.kind === 'plant' ? 5000 : project.kind === 'campfire' ? CAMPFIRE_BUILD_MS : project.kind === 'coop' ? COOP_BUILD_MS : FENCE_SEGMENT_MS }
function worldYard(project: SecretProject): Yard { return project as Yard }
function projectBuilding(project: SecretProject, i: number): PeteGarden | Tree | PeteGate | PeteCampfire | PeteCoop | PeteFence {
  const position = { x: i % SIZE, y: Math.floor(i / SIZE) }
  return project.kind === 'garden' ? { ...position, kind: 'peteGarden' } : project.kind === 'plant' ? { ...position, kind: 'tree', species: 'oak', origin: 'manual', bornAtMs: 0, nextReproductionAtMs: 600000 } : project.kind === 'gate' ? { ...position, kind: 'peteGate', direction: project.direction, openMs: 0, holdUntilMs: 0 } : project.kind === 'campfire' ? { ...position, kind: 'peteCampfire' } : project.kind === 'coop' ? { ...position, kind: 'peteCoop' } : { ...position, kind: 'peteFence', direction: project.kind === 'yard' ? yardDirection(worldYard(project), i) : project.direction }
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
  if (project.kind === 'plant' && !plantingSite(world, project.tiles[0])) return false
  if (project.kind === 'gate') return gateSiteClear(world, project)
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
  for (const radius of kind === 'garden' ? [3, 2, 4, 5] : [3]) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const cells = (kind ? [0] : [-1, 0, 1]).map(n => ({ x: x + dx * radius + (dy ? n : 0), y: y + dy * radius + (dx ? n : 0) }))
    if (cells.some(p => !inside(p.x, p.y))) continue
    const project: SecretProject = { ...(kind ? { kind } : {}), home, direction: dy ? 'east' : 'south', tiles: cells.map(p => p.y * SIZE + p.x), spots: cells.map(p => (p.y - dy) * SIZE + p.x - dx), phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }
    if (!projectPlansConflict(world, project) && projectSiteClear(world, project) && source(world, project)) return project
  }
  return null
}
function stop(world: World): void {
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
export function refreshProject(world: World): void {
  for (const project of [world.project, world.coopProject, world.campfireProject, world.yard, world.gateProject, world.gardenProject, world.plantProject]) if (project && project.crate !== null && world.buildings[project.crate]?.kind !== 'supplyCrate') {
    project.crate = null
    if (world.peace.activity === 'project' && currentProject(world) === project) stop(world)
  }
}
function availableMaterials(world: World, project: SecretProject | null, definition: ProjectDefinition): number {
  if (project?.phase === 'building') return 1 // Already collected stock is never charged again.
  const parents = reachableTiles(navigationWorld(world, project), world.pete.tile)
  const resources = Object.entries(definition.resources) as [ProjectMaterial, number][]
  let weight = 0
  for (let i = 0; i < world.buildings.length; i++) {
    const b = world.buildings[i]
    if (b?.kind !== 'supplyCrate' || !neighboringTiles(i).some(spot => !world.water[spot] && !world.buildings[spot] && parents.has(spot) && !world.buildings.some(b => b?.kind === 'prison' && b.exit === spot))) continue
    const quantity = (item: ProjectMaterial) => item === 'wood' ? b.wood : b.inventory[item]
    if (resources.every(([item, amount]) => quantity(item) >= amount)) weight += Math.min(...resources.map(([item, amount]) => Math.floor(quantity(item) / amount)))
  }
  return weight
}
export function projectPlansConflict(world: World, project: SecretProject): boolean {
  return PETE_PROJECTS.some(({ state }) => {
    const other = world[state]
    return other && other !== project && other.phase !== 'complete' && (project.tiles.some(i => other.tiles.includes(i) || other.spots.includes(i)) || project.spots.some(i => other.tiles.includes(i)))
  })
}
function projectWeight(world: World, project: SecretProject, definition: ProjectDefinition): number {
  return projectUnlocked(world, definition) && !projectPlansConflict(world, project) && projectSiteClear(world, project) ? availableMaterials(world, project, definition) : 0
}
export function projectCandidates(world: World): { definition: ProjectDefinition; project: SecretProject; weight: number }[] {
  if (world.peace.home === null || world.police.car || world.revenge.boss || world.pete.mode !== 'WANDERING') return []
  return PETE_PROJECTS.flatMap(definition => {
    if (!projectUnlocked(world, definition)) return []
    const saved = world[definition.state]
    if ((!saved || saved.phase === 'complete') && !availableMaterials(world, null, definition)) return []
    const project = saved?.phase !== 'complete' && saved ? saved : definition.id === 'reforestation' ? planPlanting(world) : definition.id === 'garden' ? layout(world, 'garden') : definition.id === 'yard' ? planYard(world) : definition.id === 'gate' ? planGate(world) : layout(world, definition.id === 'fence' ? undefined : definition.id)
    if (!project) return []
    const weight = projectWeight(world, project, definition)
    return weight ? [{ definition, project, weight }] : []
  })
}
export function trySecretProject(world: World): boolean {
  if (world.peace.home === null || world.police.car || world.revenge.boss || world.pete.mode !== 'WANDERING') return false
  let project = currentProject(world)
  if (project) {
    const definition = PETE_PROJECTS.find(p => world[p.state] === project)!
    if (!projectWeight(world, project, definition)) { delete project.selected; project.crate = null; project = null }
  }
  if (!project) {
    const candidates = projectCandidates(world)
    if (!candidates.length) return false
    // Reuse the persisted peaceful LCG, consuming exactly one draw per new decision.
    const peace = world.peace
    peace.seed = (Math.imul(1664525, peace.seed) + 1013904223) >>> 0
    let roll = peace.seed / 4294967296 * candidates.reduce((sum, c) => sum + c.weight, 0)
    const chosen = candidates.find(c => { roll -= c.weight; return roll < 0 })!
    project = chosen.project
    if (chosen.definition.state === 'yard') world.yard = worldYard(project)
    else world[chosen.definition.state] = project
    project.selected = true
  }
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
  if (!preparePeteGate(world, p.next)) return false
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
  if (project.kind === 'plant') {
    if (!plantTree(world, tile % SIZE, Math.floor(tile / SIZE), 'oak')) { stop(world); return }
  } else world.buildings[tile] = projectBuilding(project, tile)
  if (project.kind !== 'plant') world.topologyRevision++
  project.built++; project.carried -= project.kind === 'yard' ? wood : wood / project.tiles.length; project.elapsedMs = 0
  if (project.kind === 'yard' && project.built < project.tiles.length) project.phase = 'collecting'
  world.peace.destination = null; world.pete.pathRevision = -1
  if (project.built === project.tiles.length) {
    project.phase = 'complete'
    delete project.selected
    if (project.kind === 'plant') { project.readyAtMs = world.timeMs + PLANT_COOLDOWN_MS; awardActivity(world.personality, { path: 'eco', xp: 5 }) }
    else { rewardProject(world.personality, project.kind ?? 'fence'); if (project.kind === 'garden') project.readyAtMs = world.timeMs + TEND_COOLDOWN_MS }
    stop(world)
  }
}
