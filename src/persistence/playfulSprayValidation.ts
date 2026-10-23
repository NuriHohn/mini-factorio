import type { PlayfulSpray } from '../simulation/playfulSpray'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restorePlayfulSpray(value: unknown, world: World): PlayfulSpray {
  const r = v.object(value, 'playfulSpray', ['source', 'target', 'startedAtMs', 'untilMs', 'wetPete', 'wetBirds'])
  const source = v.tile(r.source, 'playfulSpray.source'), target = v.position(r.target, 'playfulSpray.target'), startedAtMs = v.count(r.startedAtMs, 'playfulSpray.startedAtMs', world.timeMs), untilMs = v.count(r.untilMs, 'playfulSpray.untilMs', world.timeMs + 3000)
  const wetBirds = v.array(r.wetBirds, 'playfulSpray.wetBirds', undefined, 5).map(id => v.count(id, 'playfulSpray.bird', 4))
  if (world.buildings[source]?.kind !== 'sprinkler' || startedAtMs % 50 || untilMs !== startedAtMs + 3000 || untilMs <= world.timeMs || Math.hypot(source % SIZE - target.x, Math.floor(source / SIZE) - target.y) > 3 + 1e-8 || new Set(wetBirds).size !== wetBirds.length || wetBirds.some(id => !world.poultry?.birds.some(b => b.id === id))) v.invalid('playfulSpray', 'invalid source, range, actor or lifetime')
  return { source, target, startedAtMs, untilMs, wetPete: v.boolean(r.wetPete, 'playfulSpray.wetPete'), wetBirds }
}
