import { BOARDING_MS, launchTile, ROWBOAT_RANGE, ROWBOAT_TILE_MS, rowboatValid } from '../simulation/rowboat'
import type { RowboatTrip } from '../simulation/rowboat'
import { dockAtSpot } from '../simulation/fishingDock'
import type { World } from '../simulation/world'
import * as v from './validation'

export function restoreRowboat(value: unknown, world: World, destination: number | null, sinceMs: number, untilMs: number): RowboatTrip {
  const b = v.object(value, 'peace.boat', ['dock', 'phase', 'tile', 'next', 'travelMs', 'path'])
  const boat: RowboatTrip = {
    dock: v.tile(b.dock, 'boat.dock'), phase: v.choice(b.phase, 'boat.phase', ['boarding', 'rowing', 'landing'] as const),
    tile: v.tile(b.tile, 'boat.tile'), next: b.next === null ? null : v.tile(b.next, 'boat.next'),
    travelMs: v.count(b.travelMs, 'boat.travelMs', ROWBOAT_TILE_MS - 1),
    path: v.array(b.path, 'boat.path', undefined, ROWBOAT_RANGE * 2).map((tile, i) => v.tile(tile, `boat.path[${i}]`)),
  }
  const dock = dockAtSpot(world, destination)
  if (!dock || !rowboatValid(world, boat, dock) || boat.travelMs % 50 || (boat.next === null && boat.travelMs !== 0)) v.invalid('peace.boat', 'invalid dock, route or movement')
  if (boat.phase === 'rowing') {
    if (untilMs !== sinceMs || (boat.next === null && !boat.path.length)) v.invalid('peace.boat', 'invalid rowing phase')
  } else {
    if (boat.tile !== launchTile(world, dock) || boat.next !== null || boat.travelMs !== 0 || untilMs - sinceMs !== BOARDING_MS || untilMs <= world.timeMs || (boat.phase === 'boarding' ? boat.path.length < 6 : boat.path.length !== 0)) v.invalid('peace.boat', 'invalid boarding or landing')
  }
  return boat
}
