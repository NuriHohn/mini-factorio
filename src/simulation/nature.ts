import { inside, placementError, placeBuilding, SIZE } from './world'
import type { Position, Tree, World } from './world'

export const TREE_SPECIES = ['oak', 'pine', 'birch'] as const
export type TreeSpecies = typeof TREE_SPECIES[number]
export type TreeStage = 'sapling' | 'young' | 'mature'
export type Decoration = 'flowers' | 'grass'
export type BrushSize = 1 | 3 | 5
export const YOUNG_TREE_MS = 120000
export const MATURE_TREE_MS = 300000
export const REPRODUCTION_MS = 300000
export function naturalTreeCap(): number { return Math.floor(SIZE * SIZE * .2) }
export const NATURE_SEED = 0x74726565
export interface NatureState {
  wood: number
  seed: number
  decorations: (Decoration | null)[]
  // Derived caches, rebuilt on load; not a second source of tree occupancy.
  decorationRevision: number
  nextAttemptAtMs: number | null
}
export function createNature(): NatureState {
  return { wood: 0, seed: NATURE_SEED, decorations: Array<Decoration | null>(SIZE * SIZE).fill(null), decorationRevision: 0, nextAttemptAtMs: null }
}
export function natureRandom(nature: Pick<NatureState, 'seed'>): number {
  nature.seed = (Math.imul(1664525, nature.seed) + 1013904223) >>> 0
  return nature.seed / 4294967296
}
export function treeAge(world: Pick<World, 'timeMs'>, tree: Tree): number { return world.timeMs - tree.bornAtMs }
export function treeStage(world: Pick<World, 'timeMs'>, tree: Tree): TreeStage {
  const age = treeAge(world, tree)
  return age < YOUNG_TREE_MS ? 'sapling' : age < MATURE_TREE_MS ? 'young' : 'mature'
}
export function treeWood(world: Pick<World, 'timeMs'>, tree: Tree): number {
  const stage = treeStage(world, tree)
  return stage === 'mature' ? 3 : stage === 'young' ? 1 : 0
}
export function refreshNatureSchedule(world: World): void {
  let next: number | null = null
  for (const b of world.buildings) if (b?.kind === 'tree' && (next === null || b.nextReproductionAtMs < next)) next = b.nextReproductionAtMs
  world.nature.nextAttemptAtMs = next
}
export function plantTree(world: World, x: number, y: number, species: TreeSpecies): boolean {
  if (!TREE_SPECIES.includes(species) || !placeBuilding(world, x, y, 'tree', 'east')) return false
  const tree = world.buildings[y * SIZE + x] as Tree
  tree.species = species
  return true
}
export function chopTree(world: World, x: number, y: number): { tree: Tree; wood: number } | null {
  if (!inside(x, y)) return null
  const tree = world.buildings[y * SIZE + x]
  if (tree?.kind !== 'tree') return null
  const wood = treeWood(world, tree)
  if (!Number.isSafeInteger(world.nature.wood + wood)) return null
  world.nature.wood += wood
  world.buildings[y * SIZE + x] = null
  world.topologyRevision++
  refreshNatureSchedule(world)
  return { tree, wood }
}
// Chebyshev distance checks occupied grid cells, not only an object's origin.
// Thus every occupied cell of a future multi-tile footprint contributes its buffer.
export function nearFactory(world: World, x: number, y: number): boolean {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (!inside(x + dx, y + dy)) continue
    const b = world.buildings[(y + dy) * SIZE + x + dx]
    if (b && b.kind !== 'tree') return true
  }
  return false
}
export function reproductionTargets(world: World, tree: Tree): number[] {
  const tiles: number[] = []
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = tree.x + dx, y = tree.y + dy
    if ((!dx && !dy) || !inside(x, y) || nearFactory(world, x, y) || placementError(world, x, y, 'tree')) continue
    tiles.push(y * SIZE + x)
  }
  return tiles // row/tile order is stable
}
export function advanceNature(world: World): void {
  if (world.nature.nextAttemptAtMs === null || world.timeMs < world.nature.nextAttemptAtMs) return
  let naturalCount = world.buildings.filter(b => b?.kind === 'tree' && b.origin === 'natural').length
  for (let i = 0; i < world.buildings.length; i++) {
    const tree = world.buildings[i]
    if (tree?.kind !== 'tree' || tree.nextReproductionAtMs > world.timeMs) continue
    tree.nextReproductionAtMs += REPRODUCTION_MS
    // One independent roll per mature tree/attempt, including capped/blocked attempts.
    if (natureRandom(world.nature) >= .2 || naturalCount >= naturalTreeCap()) continue
    const targets = reproductionTargets(world, tree)
    if (!targets.length) continue
    const tile = targets[Math.floor(natureRandom(world.nature) * targets.length)]
    if (plantTree(world, tile % SIZE, Math.floor(tile / SIZE), tree.species)) {
      (world.buildings[tile] as Tree).origin = 'natural'
      naturalCount++
    }
  }
  refreshNatureSchedule(world)
}
export function generateNature(world: World, seed: number): void {
  world.nature.seed = seed >>> 0
  // Fixed scattered group anchors preserve a generous 21x21 starter clearing and map edges.
  for (const [cx, cy] of [[5, 6], [33, 7], [6, 33], [33, 33], [7, 18], [34, 24]]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
      const roll = natureRandom(world.nature)
      if (dx * dx / 9 + dy * dy / 4 > 1 || roll > .6) continue
      const x = cx + dx, y = cy + dy
      if ((x >= 10 && x <= 30 && y >= 10 && y <= 30) || placementError(world, x, y, 'tree')) continue
      const species = TREE_SPECIES[Math.floor(natureRandom(world.nature) * TREE_SPECIES.length)]
      const age = [0, 180000, MATURE_TREE_MS][Math.floor(natureRandom(world.nature) * 3)]
      world.buildings[y * SIZE + x] = { kind: 'tree', x, y, species, origin: 'natural', bornAtMs: -age, nextReproductionAtMs: REPRODUCTION_MS + MATURE_TREE_MS - age }
    }
  }
  for (const [cx, cy] of [[11, 8], [31, 17], [13, 30], [14, 24]]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
      const roll = natureRandom(world.nature)
      if (dx * dx / 9 + dy * dy / 4 <= 1 && roll < .75) world.nature.decorations[(cy + dy) * SIZE + cx + dx] = roll < .55 ? 'flowers' : 'grass'
    }
  }
  world.topologyRevision++
  refreshNatureSchedule(world)
}
export function brushTiles(from: Position, to: Position, size: BrushSize): number[] {
  if (![1, 3, 5].includes(size) || ![from.x, from.y, to.x, to.y].every(Number.isSafeInteger)) return []
  const radius = (size - 1) / 2, low = -radius, high = SIZE - 1 + radius
  // Clip the actual segment before rasterizing; off-map clicks do not snap to an edge.
  let enter = 0, leave = 1
  for (const [origin, delta] of [[from.x, to.x - from.x], [from.y, to.y - from.y]]) {
    if (delta === 0) { if (origin < low || origin > high) return [] }
    else {
      const a = (low - origin) / delta, b = (high - origin) / delta
      enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b))
      if (enter > leave) return []
    }
  }
  let x = Math.round(from.x + (to.x - from.x) * enter), y = Math.round(from.y + (to.y - from.y) * enter)
  const endX = Math.round(from.x + (to.x - from.x) * leave), endY = Math.round(from.y + (to.y - from.y) * leave)
  const dx = Math.abs(endX - x), dy = -Math.abs(endY - y)
  const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1
  let error = dx + dy
  const tiles = new Set<number>()
  while (true) {
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) if (inside(xx, yy)) tiles.add(yy * SIZE + xx)
    if (x === endX && y === endY) break
    const twice = error * 2
    if (twice >= dy) { error += dy; x += sx }
    if (twice <= dx) { error += dx; y += sy }
  }
  return [...tiles]
}
export function paintLandscape(world: World, from: Position, to: Position, decoration: Decoration | null, size: BrushSize): number {
  if (decoration !== null && decoration !== 'grass' && decoration !== 'flowers') return 0
  let changed = 0
  for (const tile of brushTiles(from, to, size)) if (world.nature.decorations[tile] !== decoration) {
    world.nature.decorations[tile] = decoration
    changed++
  }
  if (changed) world.nature.decorationRevision++
  return changed
}
