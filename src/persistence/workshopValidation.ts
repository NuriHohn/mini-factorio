import { WORKSHOP_ACTIVITY_MS, workshopSpot } from '../simulation/workshop'
import type { World } from '../simulation/world'
import * as v from './validation'
export function validateWorkshop(world: World): void {
  const project = world.workshopProject
  if (world.buildings.some((b, i) => b?.kind === 'peteWorkshop' && (project?.phase !== 'complete' || project.tiles[0] !== i))) v.invalid('workshopProject', 'structure without completed project')
  if (!['workshopward', 'hammering'].includes(world.peace.activity)) return
  if (world.peace.home === null || workshopSpot(world) !== world.peace.destination || !project || project.readyAtMs! > world.peace.sinceMs || (world.peace.activity === 'hammering' && (world.pete.next !== null || world.pete.tile !== world.peace.destination || world.peace.untilMs - world.peace.sinceMs !== WORKSHOP_ACTIVITY_MS))) v.invalid('workshop', 'invalid workshop visit')
}
