import { peaceful } from './peace'
import { bossAlive, damageWalker, peteUnavailable } from './revenge'
import { neighboringTiles, reachableTiles, tilePath } from './navigation'
import { PETE_FLEE_MS, PETE_WALK_MS } from './pete'
import { withinRange } from './power'
import { SIZE } from './world'
import type { Building, Position, Sprinkler, World } from './world'

export const SPRINKLER_RANGE = 3
export const SPRINKLER_KW = 5
export const SPRAY_MS = 1000
export const SLIP_MS = 1000
export const COMPLAIN_MS = 2000
export const WATER_FLEE_MS = 8000
export const SPRINKLER_COOLDOWN_MS = 10000
export const WATER_COMPLAINTS = ['HEY!', 'NOT AGAIN!', 'I HATE WATER!', 'GRRR!'] as const
export interface WaterReaction { origin: Position; source: number | null; remainingMs: number; complaint: number }
export function sprinklerPowered(world: World, index: number): boolean {
  return world.buildings[index]?.kind === 'sprinkler' && (world.power?.consumers[index]?.suppliedKw ?? 0) >= SPRINKLER_KW - 1e-8
}
export function sprinklerDetects(world: World, index: number): boolean {
  const building = world.buildings[index]
  return !peaceful(world) && building?.kind === 'sprinkler' && sprinklerPowered(world, index) && withinRange(building, world.pete, SPRINKLER_RANGE)
}
export function sprinklerState(world: World, building: Sprinkler): 'Unpowered' | 'Ready' | 'Spraying' | 'Cooling down' {
  const index = building.y * SIZE + building.x
  if (!sprinklerPowered(world, index)) return 'Unpowered'
  if (world.pete.mode === 'SPRAYED' && world.pete.water?.source === index) return 'Spraying'
  return building.cooldownUntilMs > world.timeMs ? 'Cooling down' : 'Ready'
}
function beginSlip(world: World): void {
  const water = world.pete.water!
  water.source = null; water.remainingMs = SLIP_MS
  world.pete.mode = 'SLIPPING'
}
export function removeSprinkler(world: World, building: Building): void {
  if (building.kind === 'sprinkler' && world.pete.mode === 'SPRAYED' && world.pete.water?.source === building.y * SIZE + building.x) beginSlip(world)
}
// Called after current power allocation and police dispatch: a committed police case wins.
export function advanceSprinklers(world: World, delta: number, allowDetection = true): void {
  if (peaceful(world)) return
  if (bossAlive(world)) {
    const r = world.revenge
    if (world.timeMs < r.sprinklerReadyAtMs) return
    const source = world.buildings.find(b => b?.kind === 'sprinkler' && b.cooldownUntilMs <= world.timeMs && sprinklerPowered(world, b.y * SIZE + b.x) && withinRange(b, r.boss!, SPRINKLER_RANGE))
    if (source?.kind === 'sprinkler') {
      source.cooldownUntilMs = world.timeMs + SPRINKLER_COOLDOWN_MS; source.sprays++
      r.sprinklerReadyAtMs = world.timeMs + 2000
      damageWalker(world, 2)
    }
    return
  }
  if (peteUnavailable(world)) return
  const pete = world.pete, water = pete.water
  if (pete.mode === 'SPRAYED' && water) {
    const index = water.source!, source = world.buildings[index]
    if (source?.kind !== 'sprinkler') { beginSlip(world); return }
    if (!sprinklerPowered(world, index)) return
    water.remainingMs = Math.max(0, water.remainingMs - delta)
    if (water.remainingMs === 0) {
      source.cooldownUntilMs = world.timeMs + SPRINKLER_COOLDOWN_MS
      source.sprays++
      beginSlip(world)
    }
    return
  }
  if (!allowDetection || pete.mode !== 'WANDERING' || water || world.police.car || world.timeMs < pete.graceUntilMs) return
  const index = world.buildings.findIndex(b => b?.kind === 'sprinkler' && b.cooldownUntilMs <= world.timeMs && sprinklerDetects(world, b.y * SIZE + b.x))
  if (index < 0) return
  const source = world.buildings[index]!
  pete.water = { origin: { x: source.x, y: source.y }, source: index, remainingMs: SPRAY_MS, complaint: (world.timeMs / 50 + index) % WATER_COMPLAINTS.length }
  pete.mode = 'SPRAYED'; pete.pumpkin = null; pete.webMs = 0
  pete.path = []; pete.escape = null; pete.pathRevision = -1
}
function planEscape(world: World): void {
  const pete = world.pete, origin = pete.water!.origin
  const parents = reachableTiles(world, pete.tile)
  const distance = (tile: number) => (tile % SIZE - origin.x) ** 2 + (Math.floor(tile / SIZE) - origin.y) ** 2
  const destination = [...parents.keys()].sort((a, b) => distance(b) - distance(a) || a - b)[0]
  pete.escape = destination; pete.path = tilePath(parents, destination)!; pete.pathRevision = world.topologyRevision
}
function moveAway(world: World, delta: number): void {
  const p = world.pete
  let remaining = delta
  while (remaining > 1e-8) {
    if (p.next === null) {
      if (p.pathRevision !== world.topologyRevision || p.escape === null) planEscape(world)
      p.next = p.path.shift() ?? null
      if (p.next === null) return // Wait at the reachable destination; never enter web crying.
    }
    if (world.water[p.next] || world.buildings[p.next] || !neighboringTiles(p.tile).includes(p.next)) {
      p.next = null; p.travelMs = 0; p.x = p.tile % SIZE; p.y = Math.floor(p.tile / SIZE); p.pathRevision = -1
      continue
    }
    const spent = Math.min(PETE_FLEE_MS - p.travelMs, remaining)
    p.travelMs += spent; remaining -= spent
    const t = p.travelMs / PETE_FLEE_MS
    p.x = p.tile % SIZE + (p.next % SIZE - p.tile % SIZE) * t
    p.y = Math.floor(p.tile / SIZE) + (Math.floor(p.next / SIZE) - Math.floor(p.tile / SIZE)) * t
    if (p.travelMs >= PETE_FLEE_MS - 1e-8) { p.tile = p.next; p.next = null; p.travelMs = 0 }
  }
}
// Pete's ordinary timers advance first. This owns only water reaction phases/movement.
export function advanceWaterReaction(world: World, delta: number): void {
  const p = world.pete, water = p.water!
  if (p.mode === 'SPRAYED') return // Spray progress needs this tick's power allocation.
  if (p.mode === 'WATER_FLEEING') moveAway(world, Math.min(delta, water.remainingMs))
  water.remainingMs = Math.max(0, water.remainingMs - delta)
  if (water.remainingMs > 0) return
  if (p.mode === 'SLIPPING') { p.mode = 'COMPLAINING'; water.remainingMs = COMPLAIN_MS }
  else if (p.mode === 'COMPLAINING') {
    p.mode = 'WATER_FLEEING'; water.remainingMs = WATER_FLEE_MS
    p.travelMs = p.travelMs / PETE_WALK_MS * PETE_FLEE_MS
    p.pathRevision = -1
  } else {
    p.mode = 'WANDERING'; p.water = null
    p.travelMs = p.travelMs / PETE_FLEE_MS * PETE_WALK_MS
    p.path = []; p.escape = null; p.pathRevision = -1
  }
}
