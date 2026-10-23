import { PRESS_ACTIVITY_MS, pressReady, pressSpot } from '../simulation/gearPress'
import type { World } from '../simulation/world'
import * as v from './validation'

export function validatePress(world: World, version = 30): void {
  const project = world.pressProject
  if (world.buildings.some((b, i) => b?.kind === 'petePress' && (project?.phase !== 'complete' || project.tiles[0] !== i))) v.invalid('pressProject', 'structure without completed project')
  if (!['pressward', 'pressing'].includes(world.peace.activity)) return
  const press = project ? world.buildings[project.tiles[0]] : null
  const ready = version >= 30 ? pressReady(world) : press?.kind === 'petePress' && press.plates >= 2 && press.gears < 4 && world.timeMs >= project!.readyAtMs! && world.produced.ironGear < Number.MAX_SAFE_INTEGER
  if (world.peace.home === null || !ready || pressSpot(world) !== world.peace.destination || !project || project.readyAtMs! > world.peace.sinceMs || (world.peace.activity === 'pressing' && (world.pete.next !== null || world.pete.tile !== world.peace.destination || world.peace.untilMs - world.peace.sinceMs !== PRESS_ACTIVITY_MS))) v.invalid('press', 'invalid press visit')
}
