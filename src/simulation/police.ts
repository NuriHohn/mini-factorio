import { bossAlive, damageWalker, peteUnavailable, recordArrest } from './revenge'
import { releaseWebTrap } from './webs'
import { edgeTile, reachableTiles, tilePath } from './navigation'
import { withinRange } from './power'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { Building, Position, Prison, World } from './world'

export const RADAR_RANGE = 3
export const RADAR_KW = 5
export const POLICE_TILE_MS = 1000 / 6
export const ARREST_MS = 750
export const IMPRISONMENT_MS = 60000
export const REARREST_GRACE_MS = 10000
export interface PoliceCar extends Position {
  tile: number
  next: number | null
  travelMs: number
  path: number[]
  pathRevision: number
  target: number
  phase: 'RESPONDING' | 'ARRESTING' | 'TRANSPORTING'
  arrestElapsedMs: number
  arrestFrom: Position
  prison: Prison
}
export interface PoliceState {
  car: PoliceCar | null
  flash: { position: Position; untilMs: number } | null
  retryAtMs: number
  radarRevision: number
  radars: number[]
}
export function createPolice(): PoliceState { return { car: null, flash: null, retryAtMs: 0, radarRevision: -1, radars: [] } }
export function radarPowered(world: World, index: number): boolean {
  return world.buildings[index]?.kind === 'radar' && (world.power?.consumers[index]?.suppliedKw ?? 0) >= RADAR_KW - 1e-8
}
export function radarDetects(world: World, index: number): boolean {
  const radar = world.buildings[index]
  return !!radar && radarPowered(world, index) && withinRange(radar, bossAlive(world) ? world.revenge.boss! : world.pete, RADAR_RANGE)
}
export function policeOccupiesTile(world: World, x: number, y: number): boolean {
  const tile = y * SIZE + x, car = world.police.car
  return car?.tile === tile || car?.next === tile || world.buildings.some(b => b?.kind === 'prison' && b.exit === tile)
}
function validPrison(world: World, prison: Prison): boolean { return world.buildings[prison.y * SIZE + prison.x] === prison }
function prisonFor(world: World, reachable: Map<number, number>, start = world.pete.tile): Prison | null {
  for (const building of world.buildings) if (building?.kind === 'prison' && reachable.has(building.exit) && !world.buildings[building.exit]) return building
  // The prison appears only when a dispatch is possible. Reserve an edge bay for arrival/release.
  for (const tile of [...reachable.keys()].sort((a, b) => a - b)) {
    if (!edgeTile(tile) || tile === world.pete.tile || tile === world.pete.next) continue
    const x = tile % SIZE, y = Math.floor(tile / SIZE)
    if (placeBuilding(world, x, y, 'prison', 'east')) {
      const prison = world.buildings[tile] as Prison
      const routes = reachableTiles(world, start)
      if (routes.has(prison.exit) && [...routes.keys()].some(i => edgeTile(i) && i !== world.pete.tile && i !== world.pete.next && !world.buildings[i])) return prison
      removeBuilding(world, x, y)
    }
  }
  return null
}
function dispatch(world: World): void {
  const pete = world.pete
  if ((peteUnavailable(world) && !bossAlive(world)) || pete.water || world.police.car || world.timeMs < world.police.retryAtMs || world.timeMs < pete.graceUntilMs || pete.mode === 'ARRESTED' || pete.mode === 'TRANSPORTED' || pete.mode === 'IMPRISONED') return
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
  const edge = [...routes.keys()].sort((a, b) => a - b).find(tile => edgeTile(tile) && tile !== pursued.tile && tile !== pursued.next && !world.buildings[tile])
  if (edge === undefined || !routes.has(prison.exit)) { world.police.retryAtMs = world.timeMs + 1000; return }
  const position = { x: edge % SIZE, y: Math.floor(edge / SIZE) }
  world.police.car = { ...position, tile: edge, next: null, travelMs: 0, path: [], pathRevision: -1, target: pursued.tile, phase: 'RESPONDING', arrestElapsedMs: 0, arrestFrom: { x: pete.x, y: pete.y }, prison }
  const radar = world.buildings[index]!
  world.police.flash = { position: { x: radar.x, y: radar.y }, untilMs: world.timeMs + 350 }
}
function releaseFromCustody(world: World, escaped: boolean): void {
  const pete = world.pete, prison = pete.prison, car = world.police.car
  let tile = pete.mode === 'IMPRISONED' && prison ? prison.exit : car?.tile ?? pete.tile
  if (world.buildings[tile]) {
    // Defensive fallback for stale state; supported construction keeps the exit reserved.
    const origin = tile
    const distance = (i: number) => Math.abs(i % SIZE - origin % SIZE) + Math.abs(Math.floor(i / SIZE) - Math.floor(origin / SIZE))
    const free = world.buildings.map((b, i) => b ? -1 : i).filter(i => i >= 0).sort((a, b) => distance(a) - distance(b) || a - b)[0]
    if (free === undefined) return
    tile = free
  }
  if (escaped && prison) pete.jailbreak = { position: { x: prison.x, y: prison.y }, untilMs: world.timeMs + 1200 }
  Object.assign(pete, { mode: 'WANDERING', tile, x: tile % SIZE, y: Math.floor(tile / SIZE), next: null, travelMs: 0, prison: null, imprisonedAtMs: null, escape: null, cryingMs: 0, path: [], pathRevision: -1, graceUntilMs: world.timeMs + REARREST_GRACE_MS })
  world.police.car = null
}
export function releasePete(world: World, index: number, expectedAtMs: number): boolean {
  const pete = world.pete
  if (pete.mode !== 'IMPRISONED' || !pete.prison || !validPrison(world, pete.prison) || pete.prison.y * SIZE + pete.prison.x !== index || pete.imprisonedAtMs !== expectedAtMs) return false
  releaseFromCustody(world, false)
  return true
}
export function removePoliceBuilding(world: World, building: Building): void {
  if (building.kind !== 'prison') return
  if (world.pete.prison === building) releaseFromCustody(world, false)
  if (world.police.car?.prison === building) world.police.car = null
}
function beginArrest(world: World, car: PoliceCar): void {
  const pete = world.pete
  releaseWebTrap(world)
  car.phase = 'ARRESTING'; car.arrestElapsedMs = 0; car.arrestFrom = { x: pete.x, y: pete.y }
  Object.assign(pete, { mode: 'ARRESTED', prison: car.prison, next: null, travelMs: 0, pumpkin: null, webMs: 0 })
}
export function advancePolice(world: World, delta: number): void {
  const pete = world.pete
  if (peteUnavailable(world) && !bossAlive(world)) return
  if (world.police.flash && world.timeMs >= world.police.flash.untilMs) world.police.flash = null
  if (pete.mode === 'IMPRISONED') {
    if (!pete.prison || !validPrison(world, pete.prison)) releaseFromCustody(world, false)
    else if (world.timeMs - pete.imprisonedAtMs! >= IMPRISONMENT_MS) releaseFromCustody(world, true)
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
    car.arrestElapsedMs = Math.min(ARREST_MS, car.arrestElapsedMs + delta)
    const t = car.arrestElapsedMs / ARREST_MS
    pete.x = car.arrestFrom.x + (car.x - car.arrestFrom.x) * t
    pete.y = car.arrestFrom.y + (car.y - car.arrestFrom.y) * t
    if (car.arrestElapsedMs === ARREST_MS) { recordArrest(world); car.phase = 'TRANSPORTING'; pete.mode = 'TRANSPORTED'; car.pathRevision = -1 }
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
    if (world.buildings[car.next]) { car.next = null; car.pathRevision = -1; continue }
    const spent = Math.min(POLICE_TILE_MS - car.travelMs, remaining)
    car.travelMs += spent; remaining -= spent
    const t = car.travelMs / POLICE_TILE_MS
    car.x = car.tile % SIZE + (car.next % SIZE - car.tile % SIZE) * t
    car.y = Math.floor(car.tile / SIZE) + (Math.floor(car.next / SIZE) - Math.floor(car.tile / SIZE)) * t
    if (car.phase === 'TRANSPORTING') { pete.x = car.x; pete.y = car.y; pete.tile = car.tile }
    if (car.travelMs >= POLICE_TILE_MS - 1e-8) { car.tile = car.next; car.next = null; car.travelMs = 0 }
  }
}
