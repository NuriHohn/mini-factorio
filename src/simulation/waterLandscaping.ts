import { dockAtSpot } from './fishingDock'
import { refreshFishing } from './peace'
import { brushTiles } from './nature'
import type { BrushSize } from './nature'
import { inside, offsets, SIZE } from './world'
import type { Position, World } from './world'
import { invalidateTerrain } from './waterTerrain'
export type WaterBrush = 'water' | 'land'
export interface WaterProtection { reserved: Set<number>; banks: Set<number> }
// One bounded reservation scan per brush/preview, never one scan per brush tile.
export function waterProtection(world: World): WaterProtection {
  const reserved = new Set<number>(), banks = new Set<number>()
  const actors = [world.pete, ...(world.police.car ? [world.police.car] : []), ...(world.revenge.boss ? [world.revenge.boss] : [])]
  for (const actor of actors) {
    reserved.add(actor.tile)
    if (actor.next !== null) reserved.add(actor.next)
    if ('path' in actor) for (const tile of actor.path) reserved.add(tile)
  }
  if (world.peace.destination !== null) reserved.add(world.peace.destination)
  for (const gift of world.peace.gifts) reserved.add(gift.tile)
  for (const building of world.buildings) {
    if (building?.kind === 'prison') reserved.add(building.exit)
    if (building?.kind !== 'belt' || !building.bridge) continue
    const d = offsets[building.direction]
    for (const sign of [-1, 1]) {
      const x = building.x + sign * d.x, y = building.y + sign * d.y
      if (inside(x, y) && !world.water[y * SIZE + x]) banks.add(y * SIZE + x)
    }
  }
  return { reserved, banks }
}
export function waterEditError(world: World, tile: number, mode: WaterBrush, protection?: WaterProtection): string | null {
  if (!Number.isInteger(tile) || tile < 0 || tile >= SIZE * SIZE) return 'Choose a tile inside the world.'
  if (world.water[tile] === (mode === 'water')) return null
  const building = world.buildings[tile]
  if (building) return building.kind === 'belt' && building.bridge ? 'Keep water beneath bridges. Remove the crossing first.' : 'Keep buildings and trees on dry land.'
  if (mode === 'land') return null
  const p = protection ?? waterProtection(world)
  if (p.banks.has(tile)) return 'Keep both bridge banks dry.'
  if (p.reserved.has(tile)) return 'Keep NPC positions, reserved paths, gifts and prison exits dry.'
  return null
}
// Bresenham decoration strokes are diagonally connected. A one-cell water
// channel also fills the horizontal corner step, keeping its surface connected.
export function waterBrushTiles(from: Position, to: Position, size: BrushSize): number[] {
  const tiles = brushTiles(from, to, size)
  if (size !== 1) return tiles
  const connected = new Set<number>()
  let previous: number | null = null
  for (const tile of tiles) {
    if (previous !== null && tile % SIZE !== previous % SIZE && Math.floor(tile / SIZE) !== Math.floor(previous / SIZE)) connected.add(Math.floor(previous / SIZE) * SIZE + tile % SIZE)
    connected.add(tile); previous = tile
  }
  return [...connected]
}
export function paintWater(world: World, from: Position, to: Position, mode: WaterBrush, size: BrushSize): number {
  if (mode !== 'water' && mode !== 'land') return 0
  const previousDock = dockAtSpot(world, world.peace.destination)
  const protection = waterProtection(world), changed: number[] = []
  let decorationChanged = false
  for (const tile of waterBrushTiles(from, to, size)) {
    if (world.water[tile] === (mode === 'water') || waterEditError(world, tile, mode, protection)) continue
    world.water[tile] = mode === 'water'
    if (world.water[tile] && world.nature.decorations[tile] !== null) { world.nature.decorations[tile] = null; decorationChanged = true }
    changed.push(tile)
  }
  if (changed.length) {
    refreshFishing(world, previousDock)
    world.topologyRevision++ // Existing route and actor caches must see terrain changes.
    if (decorationChanged) world.nature.decorationRevision++
    invalidateTerrain(world, changed)
  }
  return changed.length
}
