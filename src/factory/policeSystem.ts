import { peaceful } from '../simulation/peace'
import { bossAlive, peteUnavailable } from '../simulation/revenge'
import { damageWalker, recordArrest } from './revengeSystem'
import { releaseWebTrap } from './webSystem'
import { edgeTile, reachableTiles, tilePath, walkableTile } from '../simulation/navigation'
import { placeBuilding, removeBuilding, SIZE } from '../simulation/world'
import type { Prison, World } from '../simulation/world'

import { ARREST_MS, IMPRISONMENT_MS, POLICE_TILE_MS, arrestDuration, arrestBoardingProgress, radarDetects, releaseFromCustody, validPrison } from '../simulation/police'
import type { PoliceCar } from '../simulation/police'

function prisonFor(world: World, reachable: Map<number, number>, start = world.pete.tile): Prison | null {
  for (const building of world.buildings) if (building?.kind === 'prison' && reachable.has(building.exit) && !world.water[building.exit] && !world.buildings[building.exit]) return building
  // The prison appears only when a dispatch is possible. Reserve an edge bay for arrival/release.
  for (const tile of [...reachable.keys()].sort((a, b) => a - b)) {
    if (!edgeTile(tile) || tile === world.pete.tile || tile === world.pete.next) continue
    const x = tile % SIZE, y = Math.floor(tile / SIZE)
    if (placeBuilding(world, x, y, 'prison', 'east')) {
      const prison = world.buildings[tile] as Prison
      const routes = reachableTiles(world, start)
      if (routes.has(prison.exit) && [...routes.keys()].some(i => edgeTile(i) && i !== world.pete.tile && i !== world.pete.next && !world.water[i] && !world.buildings[i])) return prison
      removeBuilding(world, x, y)
    }
  }
  return null
}
function dispatch(world: World): void {
  if (peaceful(world)) return
  const pete = world.pete
  if ((peteUnavailable(world) && !bossAlive(world)) || pete.water || world.police.car || world.timeMs < world.police.retryAtMs || pete.mode === 'ARRESTED' || pete.mode === 'TRANSPORTED' || pete.mode === 'IMPRISONED') return
  if (world.police.radarRevision !== world.topologyRevision) {
    world.police.radars = world.buildings.flatMap((b, i) => b?.kind === 'radar' ? [i] : [])
    world.police.radarRevision = world.topologyRevision
  }
  const index = world.police.radars.find(i => radarDetects(world, i))
  if (index === undefined) return
  const pursued = bossAlive(world) ? world.revenge.boss! : pete
  const reachable = reachableTiles(world, pursued.tile)
  const prison = prisonFor(world, reachable, pursued.tile)
  if (!prison) { world.police.retryAtMs = world.timeMs + 1000; return }
  const routes = reachableTiles(world, pursued.tile)
  const edge = [...routes.keys()].sort((a, b) => a - b).find(tile => edgeTile(tile) && tile !== pursued.tile && tile !== pursued.next && !world.water[tile] && !world.buildings[tile])
  if (edge === undefined || !routes.has(prison.exit)) { world.police.retryAtMs = world.timeMs + 1000; return }
  const position = { x: edge % SIZE, y: Math.floor(edge / SIZE) }
  world.police.car = { ...position, tile: edge, next: null, travelMs: 0, path: [], pathRevision: -1, target: pursued.tile, phase: 'RESPONDING', arrestElapsedMs: 0, arrestFrom: { x: pete.x, y: pete.y }, prison }
  const radar = world.buildings[index]!
  world.police.flash = { position: { x: radar.x, y: radar.y }, untilMs: world.timeMs + 350 }
}
function beginArrest(world: World, car: PoliceCar): void {
  const pete = world.pete
  releaseWebTrap(world)
  car.phase = 'ARRESTING'; car.arrestDurationMs = ARREST_MS; car.arrestStartedAtMs = world.timeMs; car.arrestElapsedMs = 0; car.arrestFrom = { x: pete.x, y: pete.y }
  Object.assign(pete, { mode: 'ARRESTED', prison: car.prison, next: null, travelMs: 0, pumpkin: null, webMs: 0 })
}
export function advancePolice(world: World, delta: number): void {
  if (peaceful(world)) return
  const pete = world.pete
  if (peteUnavailable(world) && !bossAlive(world)) return
  if (world.police.flash && world.timeMs >= world.police.flash.untilMs) world.police.flash = null
  if (pete.mode === 'IMPRISONED') {
    if (!pete.prison || !validPrison(world, pete.prison)) releaseFromCustody(world, false)
    else if (world.timeMs - pete.imprisonedAtMs! >= IMPRISONMENT_MS) releaseFromCustody(world, true)
    // A release inside an active radar is eligible on this same boundary.
    dispatch(world)
    return
  }
  const car = world.police.car
  if (!car) { dispatch(world); return }
  if (!validPrison(world, car.prison)) {
    if (pete.mode === 'ARRESTED' || pete.mode === 'TRANSPORTED') releaseFromCustody(world, false)
    else world.police.car = null
    return
  }
  if (car.phase === 'ARRESTING') {
    car.arrestElapsedMs = Math.min(arrestDuration(car), car.arrestElapsedMs + delta)
    const t = arrestBoardingProgress(car)
    pete.x = car.arrestFrom.x + (car.x - car.arrestFrom.x) * t
    pete.y = car.arrestFrom.y + (car.y - car.arrestFrom.y) * t
    if (car.arrestElapsedMs === arrestDuration(car)) { recordArrest(world); car.phase = 'TRANSPORTING'; pete.mode = 'TRANSPORTED'; car.pathRevision = -1 }
    return
  }
  let remaining = delta
  while (remaining > 1e-8) {
    if (car.next === null) {
      const boss = bossAlive(world) ? world.revenge.boss : null
      if (boss && Math.hypot(car.x - boss.x, car.y - boss.y) <= 2) {
        if (world.timeMs >= world.revenge.policeReadyAtMs) {
          world.revenge.policeReadyAtMs = world.timeMs + 2000
          damageWalker(world, 2)
          world.police.flash = { position: { x: car.x, y: car.y }, untilMs: world.timeMs + 350 }
        }
        return
      }
      if (!boss && car.phase === 'RESPONDING' && Math.hypot(car.x - pete.x, car.y - pete.y) <= .8) { beginArrest(world, car); return }
      const target = car.phase === 'TRANSPORTING' ? car.prison.exit : boss?.tile ?? pete.tile
      if (car.pathRevision !== world.topologyRevision || car.target !== target || car.path.length === 0) {
        const path = tilePath(reachableTiles(world, car.tile), target)
        if (!path) {
          if (car.phase === 'TRANSPORTING') releaseFromCustody(world, false)
          else { world.police.car = null; world.police.retryAtMs = world.timeMs + 1000 }
          return
        }
        car.path = path; car.target = target; car.pathRevision = world.topologyRevision
      }
      if (car.tile === car.prison.exit && car.phase === 'TRANSPORTING') {
        Object.assign(pete, { mode: 'IMPRISONED', imprisonedAtMs: world.timeMs, tile: car.prison.y * SIZE + car.prison.x, x: car.prison.x, y: car.prison.y })
        world.police.car = null
        return
      }
      car.next = car.path.shift() ?? null
      if (car.next === null) return
    }
    if (!walkableTile(world, car.next)) { car.next = null; car.pathRevision = -1; continue }
    const spent = Math.min(POLICE_TILE_MS - car.travelMs, remaining)
    car.travelMs += spent; remaining -= spent
    const t = car.travelMs / POLICE_TILE_MS
    car.x = car.tile % SIZE + (car.next % SIZE - car.tile % SIZE) * t
    car.y = Math.floor(car.tile / SIZE) + (Math.floor(car.next / SIZE) - Math.floor(car.tile / SIZE)) * t
    if (car.phase === 'TRANSPORTING') { pete.x = car.x; pete.y = car.y; pete.tile = car.tile }
    if (car.travelMs >= POLICE_TILE_MS - 1e-8) { car.tile = car.next; car.next = null; car.travelMs = 0 }
  }
}
