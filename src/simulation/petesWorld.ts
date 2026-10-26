import { createHomestead, homesteadHint } from './homestead'
import { preparePeteGate } from './gardenGate'
import { PETE_PROJECTS } from './projectRegistry'
import { awardActivity } from './personality'
import { changeCraftingRecipe } from './crafting'
import { MATURE_TREE_MS, plantTree, REPRODUCTION_MS, refreshNatureSchedule } from './nature'
import { neighboringTiles, peteReachableTiles, peteWalkableTile, tilePath } from './navigation'
import { PETE_WALK_MS } from './pete'
import { createWorld, inside, placeBuilding, SIZE } from './world'
import type { BuildingKind, World } from './world'
import { expansionLayout } from './homesteadExpansion'
import { invalidateTerrain } from './waterTerrain'

export interface MiniFactory { anchor: number | null; built: number; elapsedMs: number; nextCheckAtMs: number }
export interface MiniStep { tile: number; kind: BuildingKind; label: string }
export const MINI_BUILD_MS = 3000
export function miniLayout(anchor: number): MiniStep[] {
  const x = anchor % SIZE, y = Math.floor(anchor / SIZE)
  const parts: [number, number, BuildingKind, string][] = [
    [1, 2, 'powerPole', 'Strommast'], [2, 2, 'generator', 'Generator'],
    [5, 2, 'powerPole', 'Strommast'], [4, 2, 'generator', 'Generator'],
    [0, 0, 'forester', 'Forststation'], [1, 0, 'belt', 'Holz-Förderband'],
    [2, 0, 'sawmill', 'Sägewerk'], [3, 0, 'belt', 'Holzplatten-Förderband'],
    [4, 0, 'assembler', 'Assembler für Holzkisten'], [5, 0, 'belt', 'Kisten-Förderband'], [6, 0, 'storage', 'Produktlager'],
  ]
  return parts.map(([dx, dy, kind, label]) => ({ tile: (y + dy) * SIZE + x + dx, kind, label }))
}
export function createPetesWorld(): World {
  const world = createWorld(() => .42, { nature: false })
  world.tiles.fill(null)
  world.nature.wood = 20
  placeBuilding(world, 20, 20, 'treehouse', 'east')
  Object.assign(world.pete, { tile: 21 * SIZE + 20, x: 20, y: 21 })
  world.research.unlocked = ['basicIndustry', 'automation1']
  world.miniFactory = { anchor: null, built: 0, elapsedMs: 0, nextCheckAtMs: 0 }
  world.homestead = createHomestead()
  return world
}
export function groveError(world: World, x: number, y: number): string | null {
  if (world.buildings.filter(b => b?.kind === 'tree' && b.origin === 'natural').length > 311) return 'Für neue Waldgruppen brauchen wir wieder etwas freien Waldplatz.'
  return resourceAreaError(world, x, y)
}
export function ironError(world: World, x: number, y: number): string | null {
  if (world.tiles.filter(t => t === 'iron').length >= 144) return 'Es gibt schon genug Eisenvorkommen in dieser Welt.'
  return resourceAreaError(world, x, y)
}
export function copperError(world: World, x: number, y: number): string | null {
  if (world.tiles.filter(t => t === 'copper').length >= 144) return 'Es gibt schon genug Kupfervorkommen in dieser Welt.'
  return resourceAreaError(world, x, y)
}
function resourceAreaError(world: World, x: number, y: number): string | null {
  if (!world.miniFactory || world.peace.home === null) return 'Ressourcengruppen gibt es in Petes Welt.'
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inside(x, y)) return 'Wähle eine Fläche innerhalb der Welt.'
  const home = world.peace.home
  const distance = Math.max(Math.abs(x - home % SIZE), Math.abs(y - Math.floor(home / SIZE)))
  if (distance < 4 || distance > 10) return 'Wähle eine Fläche 4–10 Felder vom Baumhaus entfernt.'
  const anchor = world.miniFactory.anchor
  const reserved = anchor === null ? [] : Array.from({ length: 28 }, (_, i) => anchor + Math.floor(i / 7) * SIZE + i % 7)
  reserved.push(...(world.rebuilding?.jobs.map(j => j.tile) ?? []))
  const h = world.homestead
  if (h?.expansion.plan) reserved.push(...expansionLayout(h.expansion.plan).map(s => s.tile))
  if (h?.task === 'buildStore' && h.target !== null) reserved.push(h.target)
  if (h?.millAnchor !== null && h?.millAnchor !== undefined && h.millBuilt < 3) reserved.push(h.millAnchor, h.millAnchor + SIZE, h.millAnchor + SIZE + 1)
  for (const { state } of PETE_PROJECTS) { const project = world[state]; if (project && project.phase !== 'complete') reserved.push(...project.tiles, ...project.spots) }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tx = x + dx, ty = y + dy, tile = ty * SIZE + tx
    if (!inside(tx, ty) || world.water[tile] || world.tiles[tile] || world.buildings[tile] || reserved.includes(tile) || world.pete.tile === tile || world.pete.next === tile || world.poultry?.birds.some(b => b.tile === tile || b.next === tile)) return 'Die ganze 3×3-Fläche braucht freie, trockene Felder ohne andere Ressourcen.'
  }
  const parents = peteReachableTiles(world, world.pete.tile)
  if (!neighboringTiles(y * SIZE + x).some(i => parents.has(i))) return 'Pete braucht einen erreichbaren Weg zum Wald.'
  return null
}
export function placeIron(world: World, x: number, y: number): string | null {
  const error = ironError(world, x, y)
  if (error) return error
  const changed: number[] = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tile = (y + dy) * SIZE + x + dx; world.tiles[tile] = 'iron'; changed.push(tile) }
  invalidateTerrain(world, changed)
  world.topologyRevision++
  return null
}
export function placeCopper(world: World, x: number, y: number): string | null {
  const error = copperError(world, x, y)
  if (error) return error
  const changed: number[] = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tile = (y + dy) * SIZE + x + dx; world.tiles[tile] = 'copper'; changed.push(tile) }
  invalidateTerrain(world, changed)
  world.topologyRevision++
  return null
}
export function placeGrove(world: World, x: number, y: number): string | null {
  const error = groveError(world, x, y)
  if (error) return error
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    plantTree(world, x + dx, y + dy, 'oak')
    const tree = world.buildings[(y + dy) * SIZE + x + dx]
    if (tree?.kind === 'tree') { tree.origin = 'natural'; tree.bornAtMs = world.timeMs - MATURE_TREE_MS; tree.nextReproductionAtMs = world.timeMs + REPRODUCTION_MS }
  }
  refreshNatureSchedule(world)
  return null
}
export function miniApproach(world: World, tile: number): number | null {
  const parents = peteReachableTiles(world, world.pete.tile)
  return neighboringTiles(tile).filter(i => peteWalkableTile(world, i) && parents.has(i)).sort((a, b) => tilePath(parents, a)!.length - tilePath(parents, b)!.length || a - b)[0] ?? null
}
function planMini(world: World): number | null {
  const home = world.peace.home!
  const trees = world.buildings.flatMap(b => b?.kind === 'tree' ? [b] : [])
  const seen = new Set<number>(), candidates: { anchor: number; trees: number; distance: number }[] = []
  for (const tree of trees) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = tree.x + dx, y = tree.y + dy, anchor = y * SIZE + x
    if (seen.has(anchor)) continue
    seen.add(anchor)
    const distance = Math.max(Math.abs(x - home % SIZE), Math.abs(y - Math.floor(home / SIZE)))
    if (x < 1 || x + 6 >= SIZE - 1 || y < 1 || y + 3 >= SIZE - 1 || distance > 12) continue
    const layout = miniLayout(anchor)
    if (layout.some(s => world.buildings[s.tile] || world.water[s.tile] || s.tile === world.pete.tile || s.tile === world.pete.next)) continue
    if (Array.from({ length: 7 }, (_, n) => (y + 1) * SIZE + x + n).some(i => world.buildings[i] || world.water[i])) continue
    candidates.push({ anchor, distance, trees: trees.filter(t => Math.abs(t.x - x) <= 3 && Math.abs(t.y - y) <= 3).length })
  }
  candidates.sort((a, b) => b.trees - a.trees || a.distance - b.distance || a.anchor - b.anchor)
  for (const candidate of candidates) {
    if (miniLayout(candidate.anchor).every(s => miniApproach(world, s.tile) !== null)) return candidate.anchor
  }
  return null
}
export function miniWalk(world: World, destination: number, delta: number): boolean {
  const p = world.pete
  if (world.peace.activity !== 'walking') { world.peace.sinceMs = world.timeMs; world.peace.untilMs = world.timeMs }
  world.peace.activity = 'walking'; world.peace.destination = destination
  if (p.next !== null && !peteWalkableTile(world, p.next)) { p.next = null; p.travelMs = 0; p.x = p.tile % SIZE; p.y = Math.floor(p.tile / SIZE) }
  if (p.next === null) {
    p.path = tilePath(peteReachableTiles(world, p.tile), destination) ?? []
    p.pathRevision = world.topologyRevision
    p.next = p.path.shift() ?? null
  }
  if (p.next === null) return p.tile === destination
  if (!preparePeteGate(world, p.next)) return false
  p.travelMs = Math.min(PETE_WALK_MS, p.travelMs + delta)
  const t = p.travelMs / PETE_WALK_MS
  p.x = p.tile % SIZE + (p.next % SIZE - p.tile % SIZE) * t
  p.y = Math.floor(p.tile / SIZE) + (Math.floor(p.next / SIZE) - Math.floor(p.tile / SIZE)) * t
  if (p.travelMs >= PETE_WALK_MS) { p.tile = p.next; p.next = null; p.travelMs = 0 }
  return p.tile === destination && p.next === null
}
export function advanceMiniFactory(world: World, delta: number): void {
  const s = world.miniFactory
  if (!s || world.peace.home === null) return
  // Keep ordinary peace deadlines valid while this mode owns Pete's routine.
  world.peace.nextGiftAtMs = world.timeMs + 300000
  if (s.anchor === null) {
    if (world.timeMs < s.nextCheckAtMs) return
    s.nextCheckAtMs = world.timeMs + 2000
    s.anchor = planMini(world)
    if (s.anchor === null) return
  }
  const steps = miniLayout(s.anchor), step = steps[s.built]
  if (!step) {
    // Short inspectable visits along the finished factory, with pauses.
    if (world.timeMs < s.nextCheckAtMs) return
    const target = miniApproach(world, steps[world.pete.tile % 2 ? 4 : 10].tile)
    if (target !== null && miniWalk(world, target, delta)) { world.peace.activity = 'waving'; world.peace.destination = null; world.peace.sinceMs = world.timeMs; world.peace.untilMs = world.timeMs + 5000; world.pete.path = []; s.nextCheckAtMs = world.timeMs + 5000 }
    return
  }
  if (world.buildings[step.tile] || world.water[step.tile]) return
  const target = miniApproach(world, step.tile)
  if (target === null || !miniWalk(world, target, delta)) return
  s.elapsedMs = Math.min(MINI_BUILD_MS, s.elapsedMs + delta)
  if (s.elapsedMs < MINI_BUILD_MS) return
  if (!placeBuilding(world, step.tile % SIZE, Math.floor(step.tile / SIZE), step.kind, 'east')) return
  if (step.kind === 'assembler') changeCraftingRecipe(world, step.tile % SIZE, Math.floor(step.tile / SIZE), 'woodenCrate')
  s.built++; s.elapsedMs = 0
  awardActivity(world.personality, { path: 'eco', xp: 1 })
}
export function miniStatus(world: World): string | null {
  const s = world.miniFactory
  if (!s) return null
  if (world.homestead && (s.anchor === null || s.built === 11)) return homesteadHint(world)
  if (s.anchor === null) return world.buildings.some(b => b?.kind === 'tree') ? 'Ich suche Platz für meine Öko-Fabrik. Neben dem Wald brauche ich eine freie Fläche von etwa 7×4 Feldern.' : 'Platziere eine Waldgruppe in meiner Nähe. Ich baue daraus selbst eine kleine Öko-Fabrik.'
  const steps = miniLayout(s.anchor), step = steps[s.built]
  if (!step) return 'Meine Öko-Fabrik arbeitet: Wald → Holz → Holzplatten → Holzkisten. Klicke die Maschinen an, um zuzusehen.'
  if (world.buildings[step.tile] || world.water[step.tile] || miniApproach(world, step.tile) === null) return `Für ${step.label} fehlt mir Platz oder ein freier Weg. Mein Baufortschritt bleibt erhalten.`
  return `Ich baue ${step.label} · ${s.built + 1}/${steps.length} · ${Math.floor(s.elapsedMs / MINI_BUILD_MS * 100)} %. Du brauchst keine Maschinen zu platzieren.`
}
