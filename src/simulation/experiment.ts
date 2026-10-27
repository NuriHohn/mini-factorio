import { peteReachableTiles, serviceCrossing } from './navigation'
import { awardActivity } from './personality'
import type { World } from './world'
import { SIZE } from './world'
export const EXPERIMENT_BUILD_MS = 12000
export const EXPERIMENT_ACTIVITY_MS = 5000
export const EXPERIMENT_COOLDOWN_MS = 60000
export function experimentSpot(world: World): number | null {
  const project = world.experimentProject
  if (project?.phase !== 'complete' || world.buildings[project.tiles[0]]?.kind !== 'peteExperiment' || world.water[project.spots[0]] || world.buildings[project.spots[0]] && !serviceCrossing(world, project.spots[0])) return null
  return peteReachableTiles(world, world.pete.tile).has(project.spots[0]) ? project.spots[0] : null
}
export function finishExperiment(world: World): boolean {
  const project = world.experimentProject, peace = world.peace
  if (!project || peace.home === null || peace.activity !== 'experimenting' || world.timeMs < peace.untilMs || world.timeMs < project.readyAtMs! || world.pete.next !== null || experimentSpot(world) !== world.pete.tile || peace.destination !== world.pete.tile) return false
  project.readyAtMs = world.timeMs + EXPERIMENT_COOLDOWN_MS
  awardActivity(world.personality, { path: 'inventor', xp: 3 })
  return true
}
export function refreshExperiment(world: World): void {
  if (!['experimentward', 'experimenting'].includes(world.peace.activity) || experimentSpot(world) === world.peace.destination) return
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
