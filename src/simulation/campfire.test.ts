import { beforeAll, describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import { CAMPFIRE_BUILD_MS, projectSiteClear } from './secretProject'
import { availableEggs, campfireSpot, COOKING_MS, finishCooking, reachableCampfire } from './campfire'
import { reachableTiles } from './navigation'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
import { inspectBuilding } from './inspection'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-22T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function until(w: World, ready: () => boolean, limit = 500000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 100
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east'); supplyWood(template, 824, 16)
  until(template, () => template.coopProject?.phase === 'complete')
})
const world = () => structuredClone(template)
const crate = (w: World) => w.buildings[824] as SupplyCrate
const surplus = (w: World) => crate(w).wood + 2 * (w.yard?.built ?? 0) + (w.yard?.carried ?? 0)
function fire() { const w = world(); supplyWood(w, 824, 5); until(w, () => w.campfireProject?.phase === 'complete'); return w }
function cooking() { const w = fire(); until(w, () => w.peace.activity === 'cooking'); return w }
describe('Pete’s autonomous campfire and fried eggs', () => {
  it('waits for the coop and exactly five supplied Wood, reusing pickup and six-second construction', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 100
    placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); supplyWood(w, 824, 21)
    until(w, () => w.coopProject?.phase === 'building'); expect(w.campfireProject).toBeNull()
    until(w, () => w.coopProject?.phase === 'complete'); expect(w.campfireProject).toBeNull()
    const unfunded = world(); supplyWood(unfunded, 824, 4); advanceWorld(unfunded, 50000)
    expect(unfunded.campfireProject).toBeNull(); expect(crate(unfunded).wood).toBe(4)
    supplyWood(unfunded, 824, 1); until(unfunded, () => (unfunded.campfireProject?.elapsedMs ?? 0) > 0)
    const p = unfunded.campfireProject!, stock = unfunded.nature.wood
    expect(p.carried).toBe(5); expect(crate(unfunded).wood).toBe(0)
    advanceWorld(unfunded, CAMPFIRE_BUILD_MS - p.elapsedMs - 50); expect(unfunded.buildings[p.tiles[0]]).toBeNull()
    advanceWorld(unfunded, 50); expect(unfunded.buildings[p.tiles[0]]?.kind).toBe('peteCampfire')
    expect(p).toMatchObject({ phase: 'complete', carried: 0, built: 1, elapsedMs: 0 }); expect(unfunded.nature.wood).toBe(stock)
    expect(placeBuilding(unfunded, 1, 1, 'peteCampfire', 'east')).toBe(false)
  })
  it('waits for safe space, preserves access and resumes blocked building without charging twice', () => {
    const w = world(); supplyWood(w, 824, 5)
    for (const i of [940, 817]) expect(placeBuilding(w, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')).toBe(true)
    advanceWorld(w, 50000); expect(w.campfireProject).toBeNull(); expect(crate(w).wood).toBe(5)
    removeBuilding(w, 20, 23); until(w, () => (w.campfireProject?.elapsedMs ?? 0) >= 500)
    const p = w.campfireProject!, tile = p.tiles[0]
    expect(projectSiteClear(w, p)).toBe(true)
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', 'east')).toBe(true)
    advanceWorld(w, 5000); expect(p.carried).toBe(5); expect(() => load(w)).not.toThrow()
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); until(w, () => p.phase === 'complete')
    expect(crate(w).wood).toBe(0); expect(reachableTiles(w, w.pete.tile).has(p.spots[0])).toBe(true)
    expect(w.buildings.filter(b => b?.kind === 'peteFence')).toHaveLength(3)
    expect(w.buildings.filter(b => b?.kind === 'peteCoop')).toHaveLength(1)
  })
  it('round-trips pickup, carrying, building and completion without duplication or debit replay', () => {
    const w = world(); supplyWood(w, 824, 11)
    for (const ready of [() => w.campfireProject?.phase === 'collecting', () => w.campfireProject?.phase === 'building', () => (w.campfireProject?.elapsedMs ?? 0) >= 2000, () => w.campfireProject?.phase === 'complete']) {
      until(w, ready); const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
      advanceWorld(w, 765); for (const ms of [17, 101, 200, 447]) advanceWorld(restored, ms)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
    expect(surplus(w)).toBe(6)
    const restored = load(w), tile = w.campfireProject!.tiles[0]
    removeBuilding(restored, tile % SIZE, Math.floor(tile / SIZE)); advanceWorld(restored, 90000)
    expect(restored.buildings.some(b => b?.kind === 'peteCampfire')).toBe(false); expect(surplus(restored)).toBe(6)
    expect(restored.campfireProject?.phase).toBe('complete'); expect(() => load(restored)).not.toThrow()
  })
  it('needs a real campfire and available eggs; normal peaceful collection leads to cooking', () => {
    const w = world(); until(w, () => availableEggs(w) > 0)
    expect(reachableCampfire(w)).toBeNull(); expect(finishCooking(w)).toBe(false)
    const warmed = fire(); expect(availableEggs(warmed)).toBe(0); expect(reachableCampfire(warmed)).toBeNull()
    until(warmed, () => warmed.peace.activity === 'cooking')
    expect(warmed.pete.tile).toBe(campfireSpot(warmed)); expect(availableEggs(warmed)).toBeGreaterThan(0)
    expect(inspectBuilding(warmed, warmed.campfireProject!.tiles[0])).toEqual({ kind: 'peteCampfire', cooking: true })
  })
  it('consumes exactly one egg only after eight seconds, reacts happily, then resumes normal routines', () => {
    const w = cooking(), s = w.poultry!, collected = s.collected, eaten = s.eaten
    expect(finishCooking(w)).toBe(false)
    advanceWorld(w, COOKING_MS - 50); expect(s.eaten).toBe(eaten)
    advanceWorld(w, 50); expect(s.eaten).toBe(eaten + 1); expect(s.collected).toBe(collected)
    expect(availableEggs(w)).toBe(collected - eaten - 1); expect(w.peace.activity).toBe('campfireHappy'); expect(finishCooking(w)).toBe(false)
    advanceWorld(w, 2000); expect(w.peace.activity).toBe('homeward')
  })
  it('restores frying, eating and happy phases deterministically without replaying egg consumption', () => {
    const w = cooking()
    for (const elapsed of [1000, 5000, 2000]) {
      advanceWorld(w, elapsed); const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
      advanceWorld(w, 365); for (const ms of [17, 101, 247]) advanceWorld(restored, ms)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
    const before = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(before)
    expect(w.poultry!.eaten).toBe(1)
  })
  it('home/fire removal cancels mid-cooking without losing eggs, including after save/load', () => {
    for (const removeHome of [false, true]) {
      const w = cooking(); advanceWorld(w, 5500)
      const before = availableEggs(w), eaten = w.poultry!.eaten, i = removeHome ? 820 : w.campfireProject!.tiles[0]
      removeBuilding(w, i % SIZE, Math.floor(i / SIZE))
      expect(w.peace.activity).toBe('homeward'); expect(availableEggs(w)).toBe(before)
      const restored = load(w); advanceWorld(restored, 10000)
      expect(restored.poultry!.eaten).toBe(eaten); expect(availableEggs(restored)).toBeGreaterThanOrEqual(before)
    }
  })
  it('cancels a blocked approach before cooking without consuming eggs', () => {
    const w = fire(); until(w, () => w.peace.activity === 'campfireward')
    const spot = w.peace.destination!, before = availableEggs(w)
    expect(placeBuilding(w, spot % SIZE, Math.floor(spot / SIZE), 'storage', 'east')).toBe(true)
    expect(w.peace.activity).toBe('homeward'); expect(availableEggs(w)).toBe(before)
    expect(reachableCampfire(w)).toBeNull(); expect(() => load(w)).not.toThrow()
    removeBuilding(w, spot % SIZE, Math.floor(spot / SIZE)); until(w, () => w.peace.activity === 'cooking')
    expect(availableEggs(w)).toBeGreaterThanOrEqual(before)
  })
  it('migrates populated version-17 saves with exact flock/egg state and no cooked eggs', () => {
    const w = world(); until(w, () => availableEggs(w) > 0)
    const old = snapshot(w); Object.assign(old, { version: 17 }); Reflect.deleteProperty(old.game, 'personality'); Reflect.deleteProperty(old.game.poultry!, 'eaten')
    const restored = decodeSave(JSON.stringify(old)).world
    expect(restored.campfireProject).toBeNull(); expect(restored.poultry).toEqual(w.poultry)
    expect(availableEggs(restored)).toBe(w.poultry!.collected)
    supplyWood(restored, 824, 5); until(restored, () => restored.campfireProject?.phase === 'complete')
  })
  it('strictly rejects malformed project prerequisites, costs, egg balances and cooking links', () => {
    const w = cooking()
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'coopProject') },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'campfireProject') },
      (d: SaveDocument) => { d.game.campfireProject!.kind = 'coop' },
      (d: SaveDocument) => { d.game.campfireProject!.carried = 5 },
      (d: SaveDocument) => { d.game.campfireProject!.tiles[0]++ },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game.poultry!, 'eaten') },
      (d: SaveDocument) => { d.game.poultry!.eaten = -1 },
      (d: SaveDocument) => { d.game.poultry!.eaten = d.game.poultry!.collected + 1 },
      (d: SaveDocument) => { d.game.poultry!.eaten = d.game.poultry!.collected },
      (d: SaveDocument) => { d.game.peace.destination = 10 },
      (d: SaveDocument) => { Object.assign(d, { version: 17 }); Reflect.deleteProperty(d.game, 'personality') },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
