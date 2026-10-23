import { flightPose } from './peteLeisure'
import { allocatePower, withinRange } from './power'
import { SPRINKLER_COOLDOWN_MS, SPRINKLER_RANGE, sprinklerPowered } from './sprinklers'
import { SIZE } from './world'
import type { Position, World } from './world'
export interface PlayfulSpray { source: number; target: Position; startedAtMs: number; untilMs: number; wetPete: boolean; wetBirds: number[] }
export function playfulSpray(world: World, target: Position): boolean {
  if (![target.x, target.y].every(Number.isFinite) || target.x < 0 || target.y < 0 || target.x > SIZE - 1 || target.y > SIZE - 1) return false
  allocatePower(world)
  const candidates = world.buildings.flatMap((b, source) => b?.kind === 'sprinkler' && sprinklerPowered(world, source) && b.cooldownUntilMs <= world.timeMs && withinRange(b, target, SPRINKLER_RANGE) ? [source] : [])
  const source = candidates.sort((a, b) => Math.hypot(a % SIZE - target.x, Math.floor(a / SIZE) - target.y) - Math.hypot(b % SIZE - target.x, Math.floor(b / SIZE) - target.y) || a - b)[0]
  if (source === undefined) return false
  const sprinkler = world.buildings[source]!
  if (sprinkler.kind !== 'sprinkler') return false
  sprinkler.cooldownUntilMs = world.timeMs + SPRINKLER_COOLDOWN_MS
  sprinkler.sprays++
  world.playfulSpray = { source, target: { ...target }, startedAtMs: world.timeMs, untilMs: world.timeMs + 3000, wetPete: withinRange(flightPose(world) ?? world.pete, target, .8), wetBirds: world.poultry?.birds.filter(b => b.tile !== null && withinRange({ x: b.tile % SIZE, y: Math.floor(b.tile / SIZE) }, target, .8)).map(b => b.id) ?? [] }
  return true
}
