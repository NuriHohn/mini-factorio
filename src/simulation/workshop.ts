import { peteReachableTiles } from './navigation'
import { awardActivity } from './personality'
import type { World } from './world'
import { SIZE } from './world'
export const WORKSHOP_BUILD_MS = 12000
export const WORKSHOP_ACTIVITY_MS = 5000
export const WORKSHOP_COOLDOWN_MS = 60000
export function workshopSpot(world: World): number | null {
  const project = world.workshopProject
  if (project?.phase !== 'complete' || world.buildings[project.tiles[0]]?.kind !== 'peteWorkshop' || world.water[project.spots[0]] || world.buildings[project.spots[0]]) return null
  return peteReachableTiles(world, world.pete.tile).has(project.spots[0]) ? project.spots[0] : null
}
export function finishWorkshop(world: World): boolean {
  const project = world.workshopProject, peace = world.peace
  if (!project || peace.home === null || peace.activity !== 'hammering' || world.timeMs < peace.untilMs || world.timeMs < project.readyAtMs! || world.pete.next !== null || workshopSpot(world) !== world.pete.tile || peace.destination !== world.pete.tile) return false
  project.readyAtMs = world.timeMs + WORKSHOP_COOLDOWN_MS
  awardActivity(world.personality, { path: 'craftsman', xp: 1 })
  return true
}
export function refreshWorkshop(world: World): void {
  if (!['workshopward', 'hammering'].includes(world.peace.activity) || workshopSpot(world) === world.peace.destination) return
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
