import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { supplyWood, SUPPLY_CRATE_CAPACITY } from './supplyCrate'
import { PROJECT_WOOD, FENCE_SEGMENT_MS, projectSiteClear } from './secretProject'
import { reachableTiles } from './navigation'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
import { deliverItem } from './transport'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-22T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World) => w.buildings[824] as SupplyCrate
function setup(fund = true) {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  if (fund) expect(supplyWood(w, 824, PROJECT_WOOD)).toBe(true)
  return w
}
function until(w: World, predicate: () => boolean, limit = 180000) {
  for (let t = 0; t < limit && !predicate(); t += 50) advanceWorld(w, 50)
  expect(predicate()).toBe(true)
}
const fences = (w: World) => w.buildings.filter(b => b?.kind === 'peteFence')
describe('Pete’s one autonomous fence project', () => {
  it('transfers existing Wood atomically and shares the crate capacity with delivered items', () => {
    const w = setup(false), before = w.nature.wood
    expect(supplyWood(w, 824, 0)).toBe(false); expect(supplyWood(w, 824, .5)).toBe(false)
    expect(supplyWood(w, 824, before + 1)).toBe(false); expect(supplyWood(w, 0, 6)).toBe(false)
    crate(w).inventory.iron = SUPPLY_CRATE_CAPACITY - 5
    expect(supplyWood(w, 824, 6)).toBe(false); expect(w.nature.wood).toBe(before)
    expect(supplyWood(w, 824, 5)).toBe(true)
    expect(crate(w).wood).toBe(5); expect(w.nature.wood).toBe(before - 5)
    expect(deliverItem(crate(w), 'iron', 'east')).toBe(false)
  })
  it('walks to funded supplies before collecting exactly six Wood, then builds three visible timed segments once', () => {
    const w = setup(), wood = w.nature.wood
    until(w, () => w.project?.phase === 'collecting')
    expect(crate(w).wood).toBe(6); expect(w.project?.carried).toBe(0); expect(fences(w)).toHaveLength(0)
    until(w, () => w.project?.phase === 'building')
    expect(crate(w).wood).toBe(0); expect(w.project?.carried).toBe(6); expect(w.nature.wood).toBe(wood)
    until(w, () => (w.project?.elapsedMs ?? 0) >= 500)
    expect(fences(w)).toHaveLength(0)
    const progress = w.project!.elapsedMs
    advanceWorld(w, 0); expect(w.project!.elapsedMs).toBe(progress)
    until(w, () => w.project!.built === 1)
    expect(fences(w)).toHaveLength(1); expect(w.project!.carried).toBe(4)
    until(w, () => w.project!.phase === 'complete')
    expect(fences(w)).toHaveLength(3); expect(w.project).toMatchObject({ built: 3, carried: 0, elapsedMs: 0 })
    const tiles = [...w.project!.tiles], reachable = reachableTiles(w, w.pete.tile)
    for (const spot of w.project!.spots) expect(reachable.has(spot)).toBe(true)
    expect(reachable.has(19 * SIZE + 20)).toBe(true)
    supplyWood(w, 824, 6); advanceWorld(w, 180000)
    expect(fences(w)).toHaveLength(3); expect(crate(w).wood).toBe(6)
    removeBuilding(w, tiles[0] % SIZE, Math.floor(tiles[0] / SIZE)); advanceWorld(w, 30000)
    expect(fences(w)).toHaveLength(2); expect(w.project!.phase).toBe('complete')
  })
  it('waits for resources, reachability and compact safe space, then resumes after blockers are cleared', () => {
    const w = setup(false)
    advanceWorld(w, 50000); expect(w.project).toBeNull()
    for (const i of [700, 823, 940, 817]) { // One cell in each three-segment candidate line.
      if (!w.buildings[i]) placeBuilding(w, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')
    }
    supplyWood(w, 824, 6); advanceWorld(w, 50000)
    expect(w.project).toBeNull(); expect(crate(w).wood).toBe(6)
    for (const i of [700, 823, 940, 817]) removeBuilding(w, i % SIZE, Math.floor(i / SIZE))
    until(w, () => w.project?.phase === 'building')
    const target = w.project!.tiles[0]
    expect(placeBuilding(w, target % SIZE, Math.floor(target / SIZE), 'storage', 'east')).toBe(true)
    advanceWorld(w, 5000); expect(w.project!.built).toBe(0); expect(w.project!.carried).toBe(6)
    removeBuilding(w, target % SIZE, Math.floor(target / SIZE))
    until(w, () => w.project!.phase === 'complete')
    expect(crate(w).wood).toBe(0)
  })
  it('keeps a mid-walk pickup stable when a closer crate receives Wood, including immediate save/load', () => {
    const w = setup()
    until(w, () => w.project?.crate === 824 && w.pete.next !== null)
    const candidates = [w.pete.tile - 1, w.pete.tile + 1, w.pete.tile + SIZE, w.pete.tile - SIZE]
    const tile = candidates.find(i => !w.project!.tiles.includes(i) && !w.project!.spots.includes(i) && placeBuilding(w, i % SIZE, Math.floor(i / SIZE), 'supplyCrate', 'east'))!
    expect(tile).toBeDefined(); expect(supplyWood(w, tile, 6)).toBe(true)
    advanceWorld(w, 50)
    expect(w.project!.crate).toBe(824); expect(() => load(w)).not.toThrow()
    until(w, () => w.project!.phase === 'building')
    expect(crate(w).wood).toBe(0); expect((w.buildings[tile] as SupplyCrate).wood).toBe(6)
  })
  it('does not sever a narrow corridor or reserve water, buildings, actor paths or bridge landings', () => {
    const w = setup()
    until(w, () => !!w.project)
    const project = w.project!, tile = project.tiles[0]
    expect(projectSiteClear(w, project)).toBe(true)
    w.water[tile] = true; expect(projectSiteClear(w, project)).toBe(false); w.water[tile] = false
    w.pete.path = [tile]; expect(projectSiteClear(w, project)).toBe(false); w.pete.path = []
    // A full-height wall with one opening in the proposed fence would be sealed.
    const x = tile % SIZE
    for (let y = 0; y < SIZE; y++) if (y * SIZE + x !== tile && !project.tiles.includes(y * SIZE + x) && !w.buildings[y * SIZE + x]) w.buildings[y * SIZE + x] = { kind: 'storage', x, y, inventory: { ...crate(w).inventory } }
    expect(projectSiteClear(w, project)).toBe(false)
  })
  it('waits when all funded crate approaches are enclosed, and requires supplied Wood rather than industrial stock', () => {
    const w = setup(false); crate(w).inventory.iron = 20
    advanceWorld(w, 30000); expect(w.project).toBeNull()
    supplyWood(w, 824, 6)
    for (const i of [784, 825, 864, 823]) placeBuilding(w, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')
    advanceWorld(w, 30000); expect(w.project).toBeNull(); expect(crate(w).wood).toBe(6)
    removeBuilding(w, 24, 19); until(w, () => w.project?.phase === 'complete')
    expect(crate(w).inventory.iron).toBe(20)
  })
  it('keeps carried Wood and progress across home removal/rebuild and supply demolition before collection', () => {
    const w = setup(); until(w, () => w.project?.phase === 'collecting')
    removeBuilding(w, 24, 20); expect(w.project!.crate).toBeNull(); expect(() => load(w)).not.toThrow()
    placeBuilding(w, 24, 20, 'supplyCrate', 'east'); supplyWood(w, 824, 6)
    until(w, () => (w.project?.elapsedMs ?? 0) >= 500)
    const before = { ...w.project! }
    removeBuilding(w, 20, 20); advanceWorld(w, 10000)
    expect(w.project).toEqual(before); expect(() => load(w)).not.toThrow()
    placeBuilding(w, 20, 20, 'treehouse', 'east'); until(w, () => w.project!.phase === 'complete')
    expect(w.project!.carried).toBe(0); expect(crate(w).wood).toBe(0)
  })
  it('round-trips collecting, carrying, hammering and completion with deterministic equivalent time partitions', () => {
    const w = setup()
    for (const ready of [() => w.project?.phase === 'collecting', () => w.project?.phase === 'building', () => (w.project?.elapsedMs ?? 0) >= 1000, () => w.project?.built === 1, () => w.project?.phase === 'complete']) {
      until(w, ready)
      const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
      advanceWorld(w, 765); for (const d of [17, 101, 200, 447]) advanceWorld(restored, d)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
    expect(FENCE_SEGMENT_MS).toBe(4000)
  })
  it('migrates version 14 with exact stocks and rejects malformed project and Wood state', () => {
    const w = setup(false); crate(w).inventory.ironGear = 7
    const old = snapshot(w)
    Object.assign(old, { version: 14 }); Reflect.deleteProperty(old.game.buildings[824]!, 'wood')
    const loaded = decodeSave(JSON.stringify(old)).world
    expect(loaded.project).toBeNull(); expect(crate(loaded).wood).toBe(0)
    expect(crate(loaded).inventory).toEqual(crate(w).inventory)
    supplyWood(w, 824, 6); until(w, () => (w.project?.elapsedMs ?? 0) >= 500)
    for (const mutate of [
      (d: SaveDocument) => { d.game.project!.carried++ },
      (d: SaveDocument) => { d.game.project!.elapsedMs = 1 },
      (d: SaveDocument) => { d.game.project!.tiles[0]++ },
      (d: SaveDocument) => { d.game.project!.spots[0]++ },
      (d: SaveDocument) => { d.game.project!.phase = 'complete' },
      (d: SaveDocument) => { (d.game.buildings[824] as SupplyCrate).wood = 201 },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'project') },
      (d: SaveDocument) => { Object.assign(d, { version: 14 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
