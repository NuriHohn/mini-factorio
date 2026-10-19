import { buildingAt, offsets, opposite } from './world'
import type { Belt, Building, Direction, Item, World } from './world'
export const BELT_TRAVEL_MS = 500

function receiver(world: World, source: Building, direction: Direction): Building | null {
  const offset = offsets[direction]
  const target = buildingAt(world, source.x + offset.x, source.y + offset.y)
  if (target?.kind === 'storage') return target
  if (target?.kind === 'belt' && !target.item && target.direction !== opposite(direction)) return target
  return null
}
function accept(target: Building, item: Item, direction: Direction): void {
  if (target.kind === 'storage') target.inventory++
  if (target.kind === 'belt') {
    target.item = item
    target.progress = 0
    target.entry = opposite(direction)
  }
}
export function advanceTransport(world: World, delta: number): Set<Building> {
  const transfers: { source: Belt; target: Building; item: Item }[] = []
  const reserved = new Set<Building>()
  // Tile order resolves competing inputs. Occupancy is unchanged until commit.
  for (const source of world.buildings) {
    if (source?.kind !== 'belt' || !source.item) continue
    source.progress = Math.min(1, source.progress + delta / BELT_TRAVEL_MS)
    if (source.progress < 1 - 1e-8) continue
    source.progress = 1
    const target = receiver(world, source, source.direction)
    if (!target || (target.kind === 'belt' && reserved.has(target))) continue
    transfers.push({ source, target, item: source.item })
    reserved.add(target)
  }
  for (const { source, target, item } of transfers) {
    accept(target, item, source.direction)
    source.item = null
    source.progress = 0
  }
  return new Set(transfers.map(({ source }) => source))
}
export function outputMiners(world: World, vacated: ReadonlySet<Building>): void {
  for (const source of world.buildings) {
    if (source?.kind !== 'miner' || !source.item) continue
    const target = receiver(world, source, source.direction)
    // Miners require a belt; chests receive only transported ore.
    if (target?.kind !== 'belt' || vacated.has(target)) continue
    accept(target, source.item, source.direction)
    source.item = null
  }
}
