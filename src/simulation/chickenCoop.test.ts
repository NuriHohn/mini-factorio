import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import { COOP_WOOD, COOP_BUILD_MS, currentProject, projectSiteClear } from './secretProject'
import { reachableTiles } from './navigation'
import { inspectBuilding } from './inspection'
import { generationKw, powerRequirement } from './power'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-22T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World) => w.buildings[824] as SupplyCrate
function until(w: World, predicate: () => boolean, limit = 180000) {
  for (let t = 0; t < limit && !predicate(); t += 50) advanceWorld(w, 50)
  expect(predicate()).toBe(true)
}
function home() {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  return w
}
function fenced() {
  const w = home(); supplyWood(w, 824, 6)
  until(w, () => w.project?.phase === 'complete')
  return w
}
const coops = (w: World) => w.buildings.filter(b => b?.kind === 'peteCoop')
describe('Pete’s chicken coop follow-up project', () => {
  it('requires the completed fence, then waits for ten supplied Wood without touching industrial items', () => {
    const w = home(); supplyWood(w, 824, 16); crate(w).inventory.ironGear = 5
    until(w, () => w.project?.phase === 'building')
    expect(w.coopProject).toBeNull(); expect(crate(w).wood).toBe(10)
    until(w, () => w.project?.phase === 'complete')
    const fence = structuredClone(w.project), fenceTiles = [...w.project!.tiles]
    until(w, () => w.coopProject?.phase === 'collecting')
    expect(crate(w).wood).toBe(10); expect(w.coopProject?.carried).toBe(0)
    until(w, () => w.coopProject?.phase === 'building')
    expect(crate(w).wood).toBe(0); expect(w.coopProject?.carried).toBe(10)
    expect(crate(w).inventory.ironGear).toBe(5)
    expect(w.project).toEqual(fence)
    for (const i of fenceTiles) expect(w.buildings[i]?.kind).toBe('peteFence')
    expect(currentProject(w)).toBe(w.coopProject)
  })
  it('needs the full ten Wood, builds visibly over twelve seconds, then never duplicates after load or demolition', () => {
    const w = fenced(); supplyWood(w, 824, COOP_WOOD - 1)
    advanceWorld(w, 50000); expect(w.coopProject).toBeNull(); expect(crate(w).wood).toBe(9)
    supplyWood(w, 824, 3) // Existing six-Wood icon batches can leave two surplus Wood.
    until(w, () => (w.coopProject?.elapsedMs ?? 0) >= 500)
    const p = w.coopProject!, wood = w.nature.wood
    expect(crate(w).wood).toBe(2); expect(p.carried).toBe(10); expect(coops(w)).toHaveLength(0)
    const elapsed = p.elapsedMs; advanceWorld(w, 0); expect(p.elapsedMs).toBe(elapsed)
    advanceWorld(w, COOP_BUILD_MS - elapsed - 50); expect(coops(w)).toHaveLength(0)
    advanceWorld(w, 50); expect(coops(w)).toHaveLength(1)
    expect(p).toMatchObject({ phase: 'complete', built: 1, carried: 0, elapsedMs: 0 })
    expect(w.nature.wood).toBe(wood)
    const loaded = load(w), tile = p.tiles[0]
    supplyWood(loaded, 824, 10); advanceWorld(loaded, 60000)
    expect(coops(loaded)).toHaveLength(1); expect(crate(loaded).wood).toBe(12)
    removeBuilding(loaded, tile % SIZE, Math.floor(tile / SIZE)); advanceWorld(loaded, 60000)
    expect(coops(loaded)).toHaveLength(0); expect(loaded.coopProject?.phase).toBe('complete')
  })
  it('waits for safe space, rejects water/buildings/fences/paths, and resumes blocked work without re-collecting', () => {
    const w = fenced()
    for (const i of [823, 940, 817]) placeBuilding(w, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')
    supplyWood(w, 824, 10); advanceWorld(w, 50000)
    expect(w.coopProject).toBeNull(); expect(crate(w).wood).toBe(10)
    removeBuilding(w, 23, 20)
    until(w, () => w.coopProject?.phase === 'building')
    const p = w.coopProject!, tile = p.tiles[0]
    expect(tile).toBe(823); expect(projectSiteClear(w, p)).toBe(true)
    w.water[tile] = true; expect(projectSiteClear(w, p)).toBe(false); w.water[tile] = false
    w.pete.path.push(tile); expect(projectSiteClear(w, p)).toBe(false); w.pete.path = []
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', 'east')).toBe(true)
    advanceWorld(w, 5000); expect(p.carried).toBe(10); expect(coops(w)).toHaveLength(0)
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); until(w, () => p.phase === 'complete')
    expect(crate(w).wood).toBe(0)
    const paths = reachableTiles(w, w.pete.tile)
    expect(paths.has(p.spots[0])).toBe(true); expect(paths.has(860)).toBe(true)
    expect(w.buildings.filter(b => b?.kind === 'peteFence')).toHaveLength(3)
  })
  it('waits for a reachable crate and pauses safely across home/crate demolition', () => {
    const w = fenced()
    for (const i of [784, 825, 864, 823]) placeBuilding(w, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')
    supplyWood(w, 824, 10); advanceWorld(w, 50000); expect(w.coopProject).toBeNull()
    removeBuilding(w, 24, 19)
    until(w, () => w.coopProject?.phase === 'collecting')
    advanceWorld(w, 50); removeBuilding(w, 24, 20)
    expect(w.coopProject?.crate).toBeNull(); expect(() => load(w)).not.toThrow()
    placeBuilding(w, 24, 20, 'supplyCrate', 'east'); supplyWood(w, 824, 10)
    until(w, () => (w.coopProject?.elapsedMs ?? 0) >= 500)
    const project = structuredClone(w.coopProject)
    removeBuilding(w, 20, 20); advanceWorld(w, 5000)
    expect(w.coopProject).toEqual(project); expect(() => load(w)).not.toThrow()
    removeBuilding(w, 24, 20); placeBuilding(w, 20, 20, 'treehouse', 'east')
    until(w, () => w.coopProject?.phase === 'complete')
    expect(w.coopProject?.carried).toBe(0)
  })
  it('round-trips collection, carrying, hammering and completion without debit replay or timing drift', () => {
    const w = fenced(); supplyWood(w, 824, 12)
    for (const ready of [() => w.coopProject?.phase === 'collecting', () => w.coopProject?.phase === 'building', () => (w.coopProject?.elapsedMs ?? 0) >= 4000, () => w.coopProject?.phase === 'complete']) {
      until(w, ready)
      const loaded = load(w); expect(snapshot(loaded)).toEqual(snapshot(w))
      advanceWorld(w, 765); for (const ms of [17, 101, 200, 447]) advanceWorld(loaded, ms)
      expect(snapshot(loaded)).toEqual(snapshot(w))
    }
    expect(crate(w).wood).toBe(2)
  })
  it('migrates real version-15 active/completed fence saves and preserves their exact state and stock', () => {
    const w = home(); supplyWood(w, 824, 16)
    until(w, () => (w.project?.elapsedMs ?? 0) >= 500)
    for (const complete of [false, true]) {
      if (complete) until(w, () => w.project?.phase === 'complete')
      const old = snapshot(w); Object.assign(old, { version: 15 })
      const loaded = decodeSave(JSON.stringify(old)).world
      expect(loaded.project).toEqual(w.project); expect(loaded.coopProject).toBeNull()
      expect(crate(loaded).wood).toBe(crate(w).wood)
      until(loaded, () => loaded.coopProject?.phase === 'complete')
      expect(crate(loaded).wood).toBe(0)
    }
  })
  it('validates prerequisites, accounting, geometry and ownership strictly and offers no player placement or production', () => {
    const w = fenced(); supplyWood(w, 824, 10)
    until(w, () => (w.coopProject?.elapsedMs ?? 0) >= 500)
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'project') },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'coopProject') },
      (d: SaveDocument) => { d.game.coopProject!.carried = 9 },
      (d: SaveDocument) => { d.game.coopProject!.elapsedMs = 12000 },
      (d: SaveDocument) => { d.game.coopProject!.elapsedMs++ },
      (d: SaveDocument) => { d.game.coopProject!.tiles.push(10) },
      (d: SaveDocument) => { d.game.coopProject!.spots[0]++ },
      (d: SaveDocument) => { d.game.buildings[41] = { kind: 'peteCoop', x: 1, y: 1 } },
      (d: SaveDocument) => { Object.assign(d, { version: 15 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
    until(w, () => w.coopProject?.phase === 'complete')
    const tile = w.coopProject!.tiles[0], coop = w.buildings[tile]!
    expect(placeBuilding(w, 1, 1, 'peteCoop', 'east')).toBe(false)
    expect(inspectBuilding(w, tile)).toEqual({ kind: 'peteCoop' })
    expect(powerRequirement(coop)).toBe(0); expect(generationKw(w, coop)).toBe(0)
    expect(Object.keys(coop).sort()).toEqual(['kind', 'x', 'y'])
  })
})
