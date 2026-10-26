import { recordProduction } from './analytics'
import { awardActivity } from './personality'
import { sabotageRemaining } from './pete'
import { SIZE } from './world'
import type { SteamEngine, World } from './world'
export const STEAM_KW = 50
export const STEAM_FUEL_CAPACITY = 6
export const STEAM_CYCLE_MS = 10000
export function steamRunning(world: World, engine: SteamEngine): boolean {
  return engine.cycles < Number.MAX_SAFE_INTEGER && sabotageRemaining(world, engine) === 0 && (engine.burnRemainingMs > 0 || engine.fuel > 0)
}
// One physical coal powers ten seconds of shaft work in a closed water circuit.
// The integrated test load also works off-grid; an ordinary pole exports electricity.
export function advanceSteam(world: World, delta: number): void {
  for (const engine of world.buildings) {
    if (engine?.kind !== 'steamEngine' || !steamRunning(world, engine)) continue
    if (!engine.burnRemainingMs) { engine.fuel--; engine.burnRemainingMs = STEAM_CYCLE_MS; recordProduction(world, {}, { coal: 1 }) }
    engine.burnRemainingMs = Math.max(0, engine.burnRemainingMs - delta)
    if (engine.burnRemainingMs === 0) {
      engine.cycles++
      if (world.homestead?.expansion.steamEngine === engine.y * SIZE + engine.x) awardActivity(world.personality, { path: 'industrial', xp: 2 })
    }
  }
}
