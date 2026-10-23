import { EXPERIMENT_ACTIVITY_MS, experimentSpot } from '../simulation/experiment'
import type { World } from '../simulation/world'
import * as v from './validation'
export function validateExperiment(world: World): void {
  const project = world.experimentProject
  if (world.buildings.some((b, i) => b?.kind === 'peteExperiment' && (project?.phase !== 'complete' || project.tiles[0] !== i))) v.invalid('experimentProject', 'structure without completed project')
  if (!['experimentward', 'experimenting'].includes(world.peace.activity)) return
  if (world.peace.home === null || experimentSpot(world) !== world.peace.destination || !project || project.readyAtMs! > world.peace.sinceMs || (world.peace.activity === 'experimenting' && (world.pete.next !== null || world.pete.tile !== world.peace.destination || world.peace.untilMs - world.peace.sinceMs !== EXPERIMENT_ACTIVITY_MS))) v.invalid('experiment', 'invalid experiment visit')
}
