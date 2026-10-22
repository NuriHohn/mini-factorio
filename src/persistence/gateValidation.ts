import { GATE_WOOD } from '../simulation/gardenGate'
import { neighboringTiles } from '../simulation/navigation'
import { yardDirection } from '../simulation/yard'
import type { SecretProject } from '../simulation/secretProject'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restoreGateProject(value: unknown, world: World): SecretProject | null {
  const gates = world.buildings.flatMap((b, i) => b?.kind === 'peteGate' ? [i] : [])
  if (value === undefined) { if (gates.length) v.invalid('gateProject', 'missing gate project'); return null }
  const r = v.object(value, 'game.gateProject', ['kind', 'home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs'])
  const yard = world.yard
  if (r.kind !== 'gate' || yard?.phase !== 'complete') v.invalid('gateProject', 'gate requires a completed yard')
  const home = v.tile(r.home, 'gateProject.home'), direction = v.choice(r.direction, 'gateProject.direction', ['east', 'south'] as const)
  const tiles = v.array(r.tiles, 'gateProject.tiles', 1).map(i => v.tile(i, 'gateProject.tile')), spots = v.array(r.spots, 'gateProject.spots', 1).map(i => v.tile(i, 'gateProject.spot'))
  const phase = v.choice(r.phase, 'gateProject.phase', ['collecting', 'building', 'complete'] as const), built = v.count(r.built, 'gateProject.built', 1), carried = v.count(r.carried, 'gateProject.carried', GATE_WOOD), elapsedMs = v.count(r.elapsedMs, 'gateProject.elapsedMs', 3950), crate = r.crate === null ? null : v.tile(r.crate, 'gateProject.crate')
  if (home !== yard.home || tiles[0] !== yard.entrance || direction !== yardDirection(yard, yard.entrance) || !neighboringTiles(tiles[0]).includes(spots[0]) || elapsedMs % 50 || (phase === 'collecting' ? built !== 0 || carried !== 0 || elapsedMs !== 0 : phase === 'building' ? built !== 0 || carried !== GATE_WOOD || crate !== null : built !== 1 || carried !== 0 || elapsedMs !== 0 || crate !== null)) v.invalid('gateProject', 'invalid geometry, progress or Wood accounting')
  if (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate') v.invalid('gateProject.crate', 'missing supply crate')
  if (gates.some(i => i !== yard.entrance || phase !== 'complete' || (world.buildings[i]?.kind === 'peteGate' && world.buildings[i].direction !== direction))) v.invalid('gateProject', 'gate disagrees with completed construction')
  return { kind: 'gate', home, direction, tiles, spots, phase, built, carried, elapsedMs, crate }
}
