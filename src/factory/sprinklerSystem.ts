import { peaceful } from '../simulation/peace'
import { bossAlive, peteUnavailable } from '../simulation/revenge'
import { damageWalker } from './revengeSystem'
import { withinRange } from '../simulation/power'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import { beginSlip, sprinklerPowered, sprinklerDetects, SPRINKLER_RANGE, SPRINKLER_COOLDOWN_MS, SPRAY_MS, WATER_COMPLAINTS } from '../simulation/sprinklers'

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
