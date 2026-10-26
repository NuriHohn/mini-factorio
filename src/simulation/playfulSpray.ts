import { flightPose } from './peteLeisure'
import { allocatePower, withinRange } from './power'
import { SPRINKLER_RANGE, sprinklerPowered } from './sprinklers'
import { SIZE } from './world'
import type { Position, World } from './world'
export interface PlayfulSpray { source: number; target: Position; startedAtMs: number; untilMs: number; wetPete: boolean; wetBirds: number[] }
export const MANUAL_SPRAY_MS = 1000
export function playfulSpray(world: World, target: Position, source: number): boolean {
  if (![target.x, target.y].every(Number.isFinite) || target.x < 0 || target.y < 0 || target.x > SIZE - 1 || target.y > SIZE - 1) return false
  allocatePower(world)
  const sprinkler = world.buildings[source]
  if (sprinkler?.kind !== 'sprinkler' || !sprinklerPowered(world, source) || (sprinkler.manualReadyAtMs ?? 0) > world.timeMs || !withinRange(sprinkler, target, SPRINKLER_RANGE) || (world.pete.mode === 'SPRAYED' && world.pete.water?.source === source)) return false
  sprinkler.manualReadyAtMs = world.timeMs + MANUAL_SPRAY_MS
  world.playfulSpray = { source, target: { ...target }, startedAtMs: world.timeMs, untilMs: world.timeMs + 3000, wetPete: withinRange(flightPose(world) ?? world.pete, target, .8), wetBirds: world.poultry?.birds.filter(b => b.tile !== null && withinRange({ x: b.tile % SIZE, y: Math.floor(b.tile / SIZE) }, target, .8)).map(b => b.id) ?? [] }
  return true
}
