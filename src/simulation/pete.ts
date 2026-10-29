import { flightPose } from './peteLeisure'
import { peteUnavailable } from './revenge'
import type { WaterReaction } from './sprinklers'
import { SIZE } from './world'
import type { Building, Position, Prison, World } from './world'

export const PETE_WALK_MS = 1000 / 1.3
export const PETE_FLEE_MS = PETE_WALK_MS / (1.5 * 3)
export const PETE_COOLDOWN_MS = 2000
export const SABOTAGE_MS = 10000
export const PUMPKIN_FLIGHT_MS = 400
export interface Pete extends Position {
  mode: 'WANDERING' | 'FLEEING' | 'CRYING' | 'ARRESTED' | 'TRANSPORTED' | 'IMPRISONED' | 'SPRAYED' | 'SLIPPING' | 'COMPLAINING' | 'WATER_FLEEING' | 'TRAPPED'
  trappedBy: number | null
  ignoredWebs: number[]
  water: WaterReaction | null
  prison: Prison | null
  imprisonedAtMs: number | null
  graceUntilMs: number
  jailbreak: { position: Position; untilMs: number } | null
  tile: number
  next: number | null
  travelMs: number
  seed: number
  cooldownMs: number
  cryingMs: number
  escape: number | null
  path: number[]
  pathRevision: number
  webMs: number
  pumpkin: { target: Building; index: number; from: Position; elapsedMs: number } | null
}
export function createPete(): Pete {
  return { trappedBy: null, ignoredWebs: [], water: null, prison: null, imprisonedAtMs: null, graceUntilMs: 0, jailbreak: null, x: 17, y: 23, tile: 23 * SIZE + 17, next: null, travelMs: 0, seed: 0x70657465, mode: 'WANDERING', cooldownMs: PETE_COOLDOWN_MS, cryingMs: 0, escape: null, path: [], pathRevision: -1, webMs: 0, pumpkin: null }
}
export function sabotageRemaining(world: World, building: Building): number {
  return Math.max(0, (building.sabotageUntilMs ?? 0) - world.timeMs)
}
export function peteHit(world: World, position: Position): boolean {
  if (peteUnavailable(world)) return false
  return Math.hypot((flightPose(world) ?? world.pete).x - position.x, (flightPose(world) ?? world.pete).y - position.y) <= .8
}
export function peteOccupiesTile(world: World, x: number, y: number): boolean {
  const tile = y * SIZE + x
  if (world.pete.mode === 'IMPRISONED') return false
  return world.pete.tile === tile || world.pete.next === tile
}
