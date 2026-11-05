import type { World } from './world'
import { SIZE, offsets } from './grid'
import type { Resource } from './items'
import { invalidateTerrain } from './waterTerrain'

export const DEPOSIT_CAPACITY = 300
export const DEPOSIT_WARNING = 60
export interface Deposits {
  remaining: Record<number, number>
  retiring: number[]
}
export function createDeposits(): Deposits { return { remaining: {}, retiring: [] } }
// Absent state retains Factory's unlimited deposits. Untouched Pete tiles have a
// full reserve; only changed quantities need to be saved.
export function oreRemaining(world: World, tile: number): number | null {
  return !world.tiles[tile] ? 0 : world.deposits ? world.deposits.remaining[tile] ?? DEPOSIT_CAPACITY : null
}
export function extractOre(world: World, tile: number, resource: Resource, requested: number): number {
  if (!Number.isSafeInteger(requested) || requested <= 0 || world.tiles[tile] !== resource) return 0
  if (!world.deposits) return requested
  const before = oreRemaining(world, tile) ?? 0
  const amount = Math.min(requested, oreRemaining(world, tile) ?? 0)
  const remaining = (oreRemaining(world, tile) ?? 0) - amount
  if (remaining) {
    world.deposits.remaining[tile] = remaining
    if (Math.ceil(before / DEPOSIT_WARNING) !== Math.ceil(remaining / DEPOSIT_WARNING)) invalidateTerrain(world, [tile])
  }
  else {
    delete world.deposits.remaining[tile]
    world.tiles[tile] = null
    invalidateTerrain(world, [tile])
    world.topologyRevision++
  }
  return amount
}
export function miningRoute(world: World, source: number, target: number): number[] {
  const route: number[] = []
  let tile = source
  while (route.length < 13 && !route.includes(tile)) {
    route.push(tile)
    if (tile === target) return route
    const b = world.buildings[tile]
    if (b?.kind !== 'miner' && b?.kind !== 'belt') break
    const next = tile + offsets[b.direction].y * SIZE + offsets[b.direction].x
    if (next < 0 || next >= SIZE * SIZE || Math.abs(next % SIZE - tile % SIZE) > 1) break
    tile = next
  }
  return []
}
// Retirement retains the actual packets until the normal transport has emptied
// them. Power equipment is shared and is deliberately kept in service.
export function retireMiningRoute(world: World, source: number, target: number, retained: readonly number[]): void {
  if (!world.deposits) return
  // Return links own only the suffix from their merge point. That suffix
  // survives a source move and no longer depends on the original miner.
  for (const link of world.homestead?.infrastructure.links ?? []) if (link.inlet && link.receiver !== undefined) link.inlet = link.inlet.slice(link.inlet.indexOf(link.receiver))
  const route = miningRoute(world, source, target)
  const tiles = route.length ? route : [source]
  for (const tile of tiles) {
    const b = world.buildings[tile]
    if (!retained.includes(tile) && !world.homestead?.infrastructure.links.some(link => link.parts.some(part => part.tile === tile) || link.inlet?.includes(tile)) && (b?.kind === 'miner' || b?.kind === 'belt') && !world.deposits.retiring.includes(tile)) world.deposits.retiring.push(tile)
  }
}
export function forgetDeposit(world: World, tile: number): void {
  if (world.deposits) delete world.deposits.remaining[tile]
}

export function mineDeveloped(world: World, key: 'miner' | 'copperMiner' | 'coalMiner'): boolean {
  return world.homestead?.expansion[key] !== null && world.homestead?.expansion[key] !== undefined || !!world.deposits && !!world.rebuilding?.rewarded.includes(`chain:${key}`)
}
