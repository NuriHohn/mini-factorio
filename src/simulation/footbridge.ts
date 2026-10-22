import { bridgeCrossing, MAX_BRIDGE_SPAN } from './waterTerrain'
import { inside, SIZE } from './world'
import type { Position, World } from './world'
import type { ConstructionCell, ConstructionPlan } from './construction'
import { neighboringTiles } from './navigation'

export const FOOTBRIDGE_WOOD = 3
export function footbridgeBankError(world: World, p: Position): string | null {
  return !inside(p.x, p.y) || world.water[p.y * SIZE + p.x] || world.buildings[p.y * SIZE + p.x] ? 'Start and finish on empty, dry shoreline tiles.' : null
}
export function footbridgeSpan(world: World, index: number): number[] | null {
  const b = world.buildings[index]
  if (b?.kind !== 'footbridge') return null
  return bridgeCrossing(world, b.x, b.y, b.direction)
}
export function footbridgeBanks(world: World, index: number): number[] {
  const b = world.buildings[index], span = footbridgeSpan(world, index)?.sort((a, b) => a - b)
  if (b?.kind !== 'footbridge' || !span) return []
  const step = b.direction === 'east' ? 1 : SIZE
  return [span[0] - step, span[span.length - 1] + step]
}
export function footbridgeBank(world: World, tile: number): boolean {
  return neighboringTiles(tile).some(i => world.buildings[i]?.kind === 'footbridge' && footbridgeBanks(world, i).includes(tile))
}
export function planFootbridge(world: World, start: Position, end: Position): ConstructionPlan {
  const direction = start.y === end.y ? 'east' : 'south'
  const fail = (error: string): ConstructionPlan => ({ kind: 'footbridge', cells: [start, end].map(p => ({ ...p, direction, reuse: false, error })), error })
  const bankError = footbridgeBankError(world, start) ?? footbridgeBankError(world, end)
  if (bankError) return fail(bankError)
  if ((start.x !== end.x && start.y !== end.y) || (start.x === end.x && start.y === end.y)) return fail('Drag a straight footbridge from one shoreline to the opposite shore.')
  const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y) - 1
  if (length < 1 || length > MAX_BRIDGE_SPAN) return fail('Footbridges span 1–5 consecutive water tiles.')
  const dx = Math.sign(end.x - start.x), dy = Math.sign(end.y - start.y)
  const cells: ConstructionCell[] = Array.from({ length }, (_, i) => {
    const x = start.x + dx * (i + 1), y = start.y + dy * (i + 1), index = y * SIZE + x, b = world.buildings[index]
    const reuse = b?.kind === 'footbridge' && b.direction === direction
    const occupied = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])].some(a => a.tile === index || a.next === index)
    const error = !world.water[index] ? 'The entire span must cross consecutive water.' : b && !reuse ? 'A building or another bridge blocks this crossing.' : occupied && !reuse ? 'Keep NPC positions clear.' : null
    return { x, y, direction, reuse, error }
  })
  const wood = cells.filter(c => !c.reuse).length * FOOTBRIDGE_WOOD
  const error = cells.find(c => c.error)?.error ?? (wood > world.nature.wood ? `Needs ${wood} Wood · ${world.nature.wood} available.` : null)
  return { kind: 'footbridge', cells, error, wood, unaffordable: wood > world.nature.wood }
}
export function commitFootbridge(world: World, start: Position, end: Position) {
  const plan = planFootbridge(world, start, end)
  if (plan.error) return { error: plan.error, placed: 0 }
  for (const cell of plan.cells) if (!cell.reuse) world.buildings[cell.y * SIZE + cell.x] = { kind: 'footbridge', x: cell.x, y: cell.y, direction: cell.direction === 'east' ? 'east' : 'south' }
  world.nature.wood -= plan.wood ?? 0
  const placed = plan.cells.filter(c => !c.reuse).length
  if (placed) world.topologyRevision++
  return { error: null, placed, wood: plan.wood }
}
export function footbridgeRemovalError(world: World, index: number): string | null {
  const span = footbridgeSpan(world, index)
  if (!span) return 'Choose a complete footbridge.'
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : [])]
  return actors.some(a => span.includes(a.tile) || (a.next !== null && span.includes(a.next))) ? 'Footbridge in use. Wait until Pete and the police have cleared it.' : null
}
export function removeFootbridge(world: World, index: number): void {
  const span = footbridgeSpan(world, index)!
  for (const i of span) world.buildings[i] = null
  for (const actor of [world.pete, ...(world.police.car ? [world.police.car] : [])]) {
    if (actor.path.some(i => span.includes(i))) { actor.path = []; actor.pathRevision = -1 }
  }
  world.topologyRevision++
}
