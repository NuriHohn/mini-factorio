import { FEED_MS, FEED_COOLDOWN_MS } from '../simulation/feeding'
import { neighboringTiles } from '../simulation/navigation'
import type { SecretProject } from '../simulation/secretProject'
import type { World } from '../simulation/world'
import { restoreEcoDeadline, restoreProjectSelection } from './projectValidation'
import * as v from './validation'
export function restoreFeeding(value: unknown, world: World): SecretProject {
  const r = v.object(value, 'game.feedingProject', ['kind', 'home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'carriedFeed', 'elapsedMs', 'completedCycles'], ['selected', 'readyAtMs'])
  const home = v.tile(r.home, 'feedingProject.home'), tiles = v.array(r.tiles, 'feedingProject.tiles', 1).map(i => v.tile(i, 'feedingProject.tile')), spots = v.array(r.spots, 'feedingProject.spots', 1).map(i => v.tile(i, 'feedingProject.spot'))
  if (r.kind !== 'feed' || r.direction !== 'east' || world.coopProject?.phase !== 'complete' || world.gardenProject?.phase !== 'complete' || tiles[0] !== world.coopProject.tiles[0] || !neighboringTiles(tiles[0]).includes(spots[0])) v.invalid('feedingProject', 'invalid coop/garden link or geometry')
  const phase = v.choice(r.phase, 'feedingProject.phase', ['collecting', 'building', 'complete'] as const), built = v.count(r.built, 'feedingProject.built', 1), carried = v.count(r.carried, 'feedingProject.carried', 0), carriedFeed = v.count(r.carriedFeed, 'feedingProject.carriedFeed', 1), elapsedMs = v.count(r.elapsedMs, 'feedingProject.elapsedMs', FEED_MS - 50)
  const crate = r.crate === null ? null : v.tile(r.crate, 'feedingProject.crate'), completedCycles = v.count(r.completedCycles, 'feedingProject.completedCycles', Math.floor(world.timeMs / FEED_MS))
  if (built !== (phase === 'complete' ? 1 : 0) || carriedFeed !== (phase === 'building' ? 1 : 0) || elapsedMs % 50 || (phase !== 'building' && elapsedMs !== 0) || (phase !== 'collecting' && crate !== null) || (crate !== null && (crate !== world.gardenProject.tiles[0] || world.buildings[crate]?.kind !== 'peteGarden')) || (phase === 'complete' && completedCycles < 1)) v.invalid('feedingProject', 'invalid feed accounting, work or cycles')
  return { kind: 'feed', home, direction: 'east', tiles, spots, phase, built, carried, carriedFeed, elapsedMs, crate, completedCycles, ...restoreProjectSelection(r), ...restoreEcoDeadline(r, world, FEED_COOLDOWN_MS) }
}
