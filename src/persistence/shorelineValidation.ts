import { shoreTiles } from '../simulation/shoreline'
import type { ShorePlan, Waterworks } from '../simulation/shoreline'
import { SIZE, inside } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'

function restorePlan(value: unknown): ShorePlan {
  const r = v.object(value, 'waterworks.plan', ['kind'], ['start', 'end', 'tile', 'direction'])
  if (r.kind === 'bridge') {
    if (r.tile !== undefined || r.direction !== undefined) v.invalid('waterworks.plan', 'unexpected bridge fields')
    const start = v.tile(r.start, 'waterworks.start'), end = v.tile(r.end, 'waterworks.end')
    const distance = Math.abs(start % SIZE - end % SIZE) + Math.abs(Math.floor(start / SIZE) - Math.floor(end / SIZE))
    if (distance < 2 || distance > 6 || start % SIZE !== end % SIZE && Math.floor(start / SIZE) !== Math.floor(end / SIZE)) v.invalid('waterworks', 'bridge must span one to five straight water cells')
    return { kind: 'bridge', start, end }
  }
  if (r.kind !== 'dock' || r.start !== undefined || r.end !== undefined) v.invalid('waterworks.plan', 'invalid dock plan')
  const tile = v.tile(r.tile, 'waterworks.tile'), direction = v.direction(r.direction, 'waterworks.direction')
  const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0, dy = direction === 'south' ? 1 : direction === 'north' ? -1 : 0
  if (!inside(tile % SIZE + dx, Math.floor(tile / SIZE) + dy) || !inside(tile % SIZE - dx, Math.floor(tile / SIZE) - dy)) v.invalid('waterworks', 'dock needs two neighboring in-bounds cells')
  return { kind: 'dock', tile, direction }
}
export function restoreWaterworks(value: unknown, world: World): Waterworks {
  const r = v.object(value, 'waterworks', ['plan', 'bridges', 'dock', 'nextVisitAtMs', 'preferBoat'])
  const bridges = v.array(r.bridges, 'waterworks.bridges', undefined, 8).map(value => {
    const plan = restorePlan(value)
    if (plan.kind !== 'bridge') v.invalid('waterworks.bridges', 'bridge required')
    return plan
  })
  const occupied = bridges.flatMap(shoreTiles)
  if (new Set(occupied).size !== occupied.length) v.invalid('waterworks', 'duplicate or overlapping bridge ownership')
  const dock = r.dock === null ? null : restorePlan(r.dock)
  if (dock && dock.kind !== 'dock') v.invalid('waterworks.dock', 'dock required')
  const nextVisitAtMs = v.count(r.nextVisitAtMs, 'waterworks.nextVisitAtMs', world.timeMs + 300000)
  if (nextVisitAtMs % 50) v.invalid('waterworks.nextVisitAtMs', 'off fixed-step clock')
  return { plan: r.plan === null ? null : restorePlan(r.plan), bridges, dock, nextVisitAtMs, preferBoat: v.boolean(r.preferBoat, 'waterworks.preferBoat') }
}
