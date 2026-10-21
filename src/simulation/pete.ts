import { peaceful } from './peace'
import { peteUnavailable } from './revenge'
import { isSabotageable } from './buildingCapabilities'
import { releaseWebTrap, tryWebTrap } from './webs'
import { allocatePower } from './power'
import { advanceWaterReaction } from './sprinklers'
import type { WaterReaction } from './sprinklers'
import { neighboringTiles, reachableTiles, tilePath } from './navigation'
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
function random(pete: Pete): number {
  pete.seed = (Math.imul(1664525, pete.seed) + 1013904223) >>> 0
  return pete.seed / 4294967296
}
function escapePath(world: World): void {
  const pete = world.pete, parents = reachableTiles(world, pete.tile)
  const queue = [...parents.keys()]
  const corners = [0, SIZE - 1, SIZE * SIZE - 1, SIZE * (SIZE - 1)]
  const cornerDistance = (tile: number) => Math.min(...corners.map(c => Math.abs(tile % SIZE - c % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(c / SIZE))))
  const destination = queue.slice().sort((a, b) => cornerDistance(a) - cornerDistance(b) || a - b)[0]
  const path = tilePath(parents, destination)!
  pete.escape = destination
  pete.path = path
  pete.pathRevision = world.topologyRevision
}
export function peteHit(world: World, position: Position): boolean {
  if (peteUnavailable(world)) return false
  return Math.hypot(world.pete.x - position.x, world.pete.y - position.y) <= .8
}
// Free web hits replay visuals; water/custody clicks are consumed without a scare.
export function clickPete(world: World, position: Position): boolean {
  if (!peteHit(world, position)) return false
  if (peaceful(world)) return true
  if (world.pete.mode === 'IMPRISONED') return true
  if (world.pete.water) return true
  if (world.pete.mode === 'ARRESTED' || world.pete.mode === 'TRANSPORTED') return true
  const pete = world.pete
  releaseWebTrap(world)
  pete.webMs = 700
  if (pete.mode !== 'WANDERING') return true
  pete.travelMs = pete.travelMs / PETE_WALK_MS * PETE_FLEE_MS
  pete.mode = 'FLEEING'
  pete.escape = null
  pete.pathRevision = -1
  return true
}
export function peteOccupiesTile(world: World, x: number, y: number): boolean {
  const tile = y * SIZE + x
  if (world.pete.mode === 'IMPRISONED') return false
  return world.pete.tile === tile || world.pete.next === tile
}
export function advancePete(world: World, delta: number): void {
  if (peaceful(world)) return
  if (peteUnavailable(world)) return
  const pete = world.pete
  pete.cooldownMs = Math.max(0, pete.cooldownMs - delta)
  pete.webMs = Math.max(0, pete.webMs - delta)
  if (pete.jailbreak && world.timeMs >= pete.jailbreak.untilMs) pete.jailbreak = null
  if (pete.water) { advanceWaterReaction(world, delta); return }
  if (pete.mode === 'TRAPPED' || pete.mode === 'ARRESTED' || pete.mode === 'TRANSPORTED' || pete.mode === 'IMPRISONED') return
  if (pete.pumpkin) {
    const shot = pete.pumpkin
    if (world.buildings[shot.index] !== shot.target) pete.pumpkin = null
    else {
      shot.elapsedMs += delta
      if (shot.elapsedMs >= PUMPKIN_FLIGHT_MS) {
        if (sabotageRemaining(world, shot.target) === 0) shot.target.sabotageUntilMs = world.timeMs + SABOTAGE_MS
        pete.pumpkin = null
      }
    }
  }
  if (pete.mode === 'CRYING') {
    pete.cryingMs = Math.max(0, pete.cryingMs - delta)
    if (pete.cryingMs === 0) { pete.mode = 'WANDERING'; pete.escape = null }
    return
  }
  if (pete.next !== null && world.buildings[pete.next]) { pete.next = null; pete.travelMs = 0; pete.x = pete.tile % SIZE; pete.y = Math.floor(pete.tile / SIZE); pete.pathRevision = -1 }
  // Carry the unused part of a fixed step across tile boundaries at the faster speed.
  let remaining = delta
  while (remaining > 1e-8) {
    if (pete.mode === 'FLEEING' && pete.next === null && pete.pathRevision !== world.topologyRevision) escapePath(world)
    if (pete.next === null) {
      if (pete.mode === 'FLEEING') {
        pete.next = pete.path.shift() ?? null
        if (pete.next === null) { pete.mode = 'CRYING'; pete.cryingMs = SABOTAGE_MS; break }
      } else {
        const choices = neighboringTiles(pete.tile).filter(tile => !world.buildings[tile])
        if (choices.length) pete.next = choices[Math.floor(random(pete) * choices.length)]
        else break
      }
    }
    if (pete.next !== null) {
      const duration = pete.mode === 'FLEEING' ? PETE_FLEE_MS : PETE_WALK_MS
      const spent = Math.min(duration - pete.travelMs, remaining)
      pete.travelMs += spent
      remaining -= spent
      const progress = pete.travelMs / duration
      pete.x = pete.tile % SIZE + (pete.next % SIZE - pete.tile % SIZE) * progress
      pete.y = Math.floor(pete.tile / SIZE) + (Math.floor(pete.next / SIZE) - Math.floor(pete.tile / SIZE)) * progress
      if (tryWebTrap(world)) return
      if (pete.travelMs >= duration - 1e-8) {
        pete.tile = pete.next; pete.next = null; pete.travelMs = 0
        if (pete.mode === 'FLEEING' && pete.tile === pete.escape && pete.path.length === 0) { pete.mode = 'CRYING'; pete.cryingMs = SABOTAGE_MS; break }
      }
    }
  }
  if (pete.mode !== 'WANDERING' || pete.cooldownMs > 0 || pete.pumpkin) return
  const candidates = world.buildings.flatMap((b, i) => b && isSabotageable(b) && sabotageRemaining(world, b) === 0 && Math.hypot(b.x - pete.x, b.y - pete.y) <= 2 ? [i] : [])
  if (!candidates.length) return
  const power = allocatePower(world)
  const operational = (index: number) => {
    const b = world.buildings[index]!
    if (b.kind !== 'generator') return (power.consumers[index]?.suppliedKw ?? 0) > 0
    const network = power.networks.find(n => n.id === power.assignments[index])
    return (network?.suppliedKw ?? 0) > 0
  }
  const eligible = candidates.filter(i => world.buildings[i]!.kind !== 'generator' || operational(i))
  const index = eligible.find(operational) ?? eligible[0] ?? -1
  if (index >= 0) {
    pete.pumpkin = { target: world.buildings[index]!, index, from: { x: pete.x, y: pete.y }, elapsedMs: 0 }
    pete.cooldownMs = PETE_COOLDOWN_MS
  }
}
