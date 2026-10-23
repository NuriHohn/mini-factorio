import { PRESS_ACTIVITY_MS, pressReady, pressSpot } from '../simulation/gearPress'
import type { World } from '../simulation/world'
import * as v from './validation'

export function validatePress(world: World): void {
  const project = world.pressProject
  if (world.buildings.some((b, i) => b?.kind === 'petePress' && (project?.phase !== 'complete' || project.tiles[0] !== i))) v.invalid('pressProject', 'structure without completed project')
  if (!['pressward', 'pressing'].includes(world.peace.activity)) return
  if (world.peace.home === null || !pressReady(world) || pressSpot(world) !== world.peace.destination || !project || project.readyAtMs! > world.peace.sinceMs || (world.peace.activity === 'pressing' && (world.pete.next !== null || world.pete.tile !== world.peace.destination || world.peace.untilMs - world.peace.sinceMs !== PRESS_ACTIVITY_MS))) v.invalid('press', 'invalid press visit')
}
