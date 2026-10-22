import { neighboringTiles, peteReachableTiles, tilePath } from './navigation'
import { enclosedYard, yardDirection } from './yard'
import type { SecretProject } from './secretProject'
import type { PeteGate, World } from './world'
export const GATE_WOOD = 3
export const GATE_OPEN_MS = 250
export const GATE_HOLD_MS = 600
export function gardenGate(world: World): PeteGate | null {
  const entry = world.yard?.entrance, b = entry === undefined ? null : world.buildings[entry]
  return b?.kind === 'peteGate' ? b : null
}
export function planGate(world: World): SecretProject | null {
  const yard = enclosedYard(world)
  if (!yard || world.buildings[yard.entrance]) return null
  const parents = peteReachableTiles(world, world.pete.tile)
  const spots = neighboringTiles(yard.entrance).filter(i => !world.water[i] && !world.buildings[i] && parents.has(i) && !world.buildings.some(b => b?.kind === 'prison' && b.exit === i)).sort((a, b) => (tilePath(parents, a)?.length ?? Infinity) - (tilePath(parents, b)?.length ?? Infinity) || a - b)
  return spots.length ? { kind: 'gate', home: yard.home, direction: yardDirection(yard, yard.entrance), tiles: [yard.entrance], spots: [spots[0]], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 } : null
}
export function gateSiteClear(world: World, project: SecretProject): boolean {
  const entry = project.tiles[0], spot = project.spots[0]
  if (!enclosedYard(world) || world.yard?.entrance !== entry || world.buildings[entry] || world.water[entry] || world.buildings[spot] || world.water[spot]) return false
  // Collection and travel may cross the future doorway; only the actual build must wait for traffic.
  const atWork = project.phase === 'building' && world.pete.tile === spot && world.pete.next === null
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])]
  return !atWork || !actors.some(a => a.tile === entry || a.next === entry)
}
export function preparePeteGate(world: World, next: number): boolean {
  const b = world.buildings[next]
  if (b?.kind !== 'peteGate') return true
  b.holdUntilMs = world.timeMs + GATE_HOLD_MS
  return b.openMs === GATE_OPEN_MS
}
export function advanceGate(world: World, delta: number): void {
  const gate = gardenGate(world)
  if (!gate) return
  const entry = world.yard!.entrance, p = world.pete
  const approaching = !['TRANSPORTED', 'IMPRISONED'].includes(p.mode) && (p.tile === entry || p.next === entry || (neighboringTiles(entry).includes(p.tile) && p.path[0] === entry))
  const traffic = gate.openMs === GATE_OPEN_MS && [world.police.car, world.revenge.boss].some(a => a && (a.tile === entry || a.next === entry))
  if (approaching || traffic) gate.holdUntilMs = world.timeMs + GATE_HOLD_MS
  gate.openMs = world.timeMs < gate.holdUntilMs ? Math.min(GATE_OPEN_MS, gate.openMs + delta) : Math.max(0, gate.openMs - delta)
}
