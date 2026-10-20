import { clickPete, peteHit } from './pete'
import { inside, SIZE } from './world'
import type { Position, World } from './world'
export const WEB_FLIGHT_MS = 300
export const WEB_LIFETIME_MS = 10000
export const MAX_GROUND_WEBS = 128
export interface GroundWeb { id: number; tile: number; from: Position; launchedAtMs: number; landsAtMs: number; expiresAtMs: number }
export interface WebState { nextId: number; patches: GroundWeb[] }
export function createWebs(): WebState { return { nextId: 1, patches: [] } }
export function peteWebTile(world: World): number { return Math.floor(world.pete.y + .5) * SIZE + Math.floor(world.pete.x + .5) }
function activeUnderPete(world: World): GroundWeb[] {
  return world.webs.patches.filter(w => w.tile === peteWebTile(world) && w.landsAtMs <= world.timeMs && w.expiresAtMs > world.timeMs)
}
export function releaseWebTrap(world: World): void {
  const p = world.pete
  if (p.trappedBy === null) return
  // Ignore overlapping live patches too: they cannot extend this trap after release.
  p.ignoredWebs = [...new Set([...p.ignoredWebs, ...activeUnderPete(world).map(w => w.id)])]
  p.trappedBy = null
  if (p.mode === 'TRAPPED') p.mode = 'WANDERING'
}
export function tryWebTrap(world: World): boolean {
  const p = world.pete
  if (p.mode !== 'WANDERING' || p.water) return false
  const web = activeUnderPete(world).find(w => !p.ignoredWebs.includes(w.id))
  if (!web) return false
  p.trappedBy = web.id; p.mode = 'TRAPPED'; p.pumpkin = null
  return true
}
export function advanceWebs(world: World): void {
  world.webs.patches = world.webs.patches.filter(w => w.expiresAtMs > world.timeMs)
  world.pete.ignoredWebs = world.pete.ignoredWebs.filter(id => world.webs.patches.some(w => w.id === id))
  if (world.pete.trappedBy !== null && !world.webs.patches.some(w => w.id === world.pete.trappedBy)) releaseWebTrap(world)
  tryWebTrap(world)
}
// The input layer gates this command on the selected tool. Direct hits need no second collision.
export function shootWeb(world: World, position: Position): 'hit' | 'ground' | 'outside' | 'full' {
  if (peteHit(world, position)) { clickPete(world, position); return 'hit' }
  const x = Math.floor(position.x + .5), y = Math.floor(position.y + .5)
  if (!inside(x, y)) return 'outside'
  if (world.webs.patches.length >= MAX_GROUND_WEBS || world.webs.nextId === Number.MAX_SAFE_INTEGER) return 'full'
  world.webs.patches.push({ id: world.webs.nextId++, tile: y * SIZE + x, from: { x: Math.max(0, x - 1.5), y: Math.max(0, y - 1.5) }, launchedAtMs: world.timeMs, landsAtMs: world.timeMs + WEB_FLIGHT_MS, expiresAtMs: world.timeMs + WEB_FLIGHT_MS + WEB_LIFETIME_MS })
  return 'ground'
}
