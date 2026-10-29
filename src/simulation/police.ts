import { peaceful } from './peace'
import { bossAlive } from './revenge'
import { walkableTile } from './navigation'
import { withinRange } from './power'
import { SIZE } from './world'
import type { Building, Position, Prison, World } from './world'

export const RADAR_RANGE = 3
export const RADAR_KW = 5
export const POLICE_TILE_MS = 1000 / 6
export const ARREST_MS = 3400
export const LEGACY_ARREST_MS = 750
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
  arrestDurationMs?: typeof ARREST_MS
  arrestStartedAtMs?: number
  arrestElapsedMs: number
  arrestFrom: Position
  prison: Prison
}
// Missing duration explicitly identifies a pre-12.2 pickup; keep its remaining time.
export function arrestDuration(car: PoliceCar): number { return car.arrestDurationMs ?? LEGACY_ARREST_MS }
export function arrestBoardingProgress(car: PoliceCar): number {
  if (car.arrestDurationMs === undefined) return car.arrestElapsedMs / LEGACY_ARREST_MS
  const t = Math.max(0, Math.min(1, (car.arrestElapsedMs - 2800) / 600))
  return t * t * (3 - 2 * t)
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
  return !peaceful(world) && !!radar && radarPowered(world, index) && withinRange(radar, bossAlive(world) ? world.revenge.boss! : world.pete, RADAR_RANGE)
}
export function policeOccupiesTile(world: World, x: number, y: number): boolean {
  const tile = y * SIZE + x, car = world.police.car
  return car?.tile === tile || car?.next === tile || world.buildings.some(b => b?.kind === 'prison' && b.exit === tile)
}
export function validPrison(world: World, prison: Prison): boolean { return world.buildings[prison.y * SIZE + prison.x] === prison }
export function releaseFromCustody(world: World, escaped: boolean): void {
  const pete = world.pete, prison = pete.prison, car = world.police.car
  let tile = pete.mode === 'IMPRISONED' && prison ? prison.exit : car?.tile ?? pete.tile
  if (!walkableTile(world, tile)) {
    // Defensive fallback for stale state; supported construction keeps the exit reserved.
    const origin = tile
    const distance = (i: number) => Math.abs(i % SIZE - origin % SIZE) + Math.abs(Math.floor(i / SIZE) - Math.floor(origin / SIZE))
    const free = world.buildings.map((b, i) => b || world.water[i] ? -1 : i).filter(i => i >= 0).sort((a, b) => distance(a) - distance(b) || a - b)[0]
    if (free === undefined) return
    tile = free
  }
  if (escaped && prison) pete.jailbreak = { position: { x: prison.x, y: prison.y }, untilMs: world.timeMs + 1200 }
  Object.assign(pete, { mode: 'WANDERING', tile, x: tile % SIZE, y: Math.floor(tile / SIZE), next: null, travelMs: 0, prison: null, imprisonedAtMs: null, escape: null, cryingMs: 0, path: [], pathRevision: -1, graceUntilMs: world.timeMs + REARREST_GRACE_MS })
  world.police.car = null
  world.police.retryAtMs = 0
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
