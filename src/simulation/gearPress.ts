import { recordProduction } from './analytics'
import { peteReachableTiles } from './navigation'
import { awardActivity } from './personality'
import { RECIPES } from './recipes'
import { SIZE } from './world'
import type { PetePress, World } from './world'

export const PRESS_BUILD_MS = 12000
export const PRESS_ACTIVITY_MS = 5000
export const PRESS_COOLDOWN_MS = 60000
export const PRESS_INPUT_CAPACITY = 4
export const PRESS_OUTPUT_CAPACITY = 4
export const PRESS_PLATES = RECIPES.ironGear.inputs.ironPlate!

export function gearPress(world: World): PetePress | null {
  const project = world.pressProject
  const building = project?.phase === 'complete' ? world.buildings[project.tiles[0]] : null
  return building?.kind === 'petePress' ? building : null
}
export function pressReady(world: World): boolean {
  const press = gearPress(world)
  return !!press && press.plates >= PRESS_PLATES && press.gears < PRESS_OUTPUT_CAPACITY && world.timeMs >= world.pressProject!.readyAtMs! && world.produced.ironGear < Number.MAX_SAFE_INTEGER
}
export function pressSpot(world: World): number | null {
  const project = world.pressProject
  if (!gearPress(world) || !project || world.water[project.spots[0]] || world.buildings[project.spots[0]]) return null
  return peteReachableTiles(world, world.pete.tile).has(project.spots[0]) ? project.spots[0] : null
}
export function finishPress(world: World): boolean {
  const project = world.pressProject, peace = world.peace, press = gearPress(world)
  if (!project || !press || peace.home === null || peace.activity !== 'pressing' || world.timeMs < peace.untilMs || !pressReady(world) || world.pete.next !== null || pressSpot(world) !== world.pete.tile || peace.destination !== world.pete.tile) return false
  // Keep input intact until the output commits: interrupted visits never spend plates.
  press.plates -= PRESS_PLATES
  press.gears++
  world.produced.ironGear++
  recordProduction(world, { ironGear: 1 }, { ironPlate: PRESS_PLATES })
  project.readyAtMs = world.timeMs + PRESS_COOLDOWN_MS
  awardActivity(world.personality, { path: 'industrial', xp: 1 })
  return true
}
export function refreshPress(world: World): void {
  if (!['pressward', 'pressing'].includes(world.peace.activity) || (pressReady(world) && pressSpot(world) === world.peace.destination)) return
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
