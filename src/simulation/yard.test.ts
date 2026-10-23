import { beforeAll, describe, expect, it } from 'vitest'
import { createBareWorld, ecoProjectWood } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { paintWater } from './waterLandscaping'
import { supplyWood } from './supplyCrate'
import { enclosedRun, enclosedYard, planYard, yardBoundary, yardInterior, yardSiteClear } from './yard'
import { neighboringTiles, reachableTiles, tilePath } from './navigation'
import { poultryGround, refreshPoultry } from './poultry'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-22T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function until(w: World, ready: () => boolean, limit = 900000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 500
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east'); supplyWood(template, 824, 21)
  until(template, () => template.campfireProject?.phase === 'complete')
})
const world = () => structuredClone(template)
const crate = (w: World) => w.buildings[824] as SupplyCrate
function complete() { const w = world(); supplyWood(w, 824, 100); until(w, () => w.yard?.phase === 'complete'); return w }
describe('Pete’s enclosed yard', () => {
  it('builds other sections around a late obstacle and preserves reordered paid work through saving', () => {
    const w = world(); supplyWood(w, 824, 140)
    until(w, () => (w.yard?.built ?? 0) >= 1)
    const y = w.yard!, blocked = y.tiles[y.built]
    expect(placeBuilding(w, blocked % SIZE, Math.floor(blocked / SIZE), 'storage', 'east')).toBe(true)
    until(w, () => y.built >= 4)
    expect(y.tiles.slice(0, y.built)).not.toContain(blocked)
    const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
    removeBuilding(w, blocked % SIZE, Math.floor(blocked / SIZE))
    until(w, () => y.phase === 'complete')
    expect(enclosedYard(w)).toBe(y)
  })
  it('builds a distinct paid chicken run with coop access and saved daytime containment', () => {
    const w = complete()
    until(w, () => w.gateProject?.phase === 'complete')
    crate(w).wood = 190
    const planned = planYard(w, true)
    expect(planned).not.toBeNull()
    until(w, () => (w.chickenRun?.elapsedMs ?? 0) >= 500)
    expect(snapshot(load(w))).toEqual(snapshot(w))
    until(w, () => w.chickenRun?.phase === 'complete', 600000)
    const run = w.chickenRun!
    expect(run.kind).toBe('run'); expect(enclosedRun(w)).toBe(run)
    expect(yardInterior(run, w.poultry!.coop)).toBe(true)
    expect(yardInterior(run, w.peace.home!)).toBe(false)
    expect([...poultryGround(w, w.poultry!.coop).keys()].every(i => yardInterior(run, i))).toBe(true)
    expect(w.personality.rewardedProjects.filter(id => id === 'run')).toHaveLength(1)
    for (const version of [34, 35]) {
      const legacy = snapshot(w); Object.assign(legacy, { version })
      expect(() => decodeSave(JSON.stringify(legacy))).toThrow('Invalid save')
    }
    const invalid = snapshot(w); invalid.game.chickenRun!.tiles[0] = invalid.game.chickenRun!.entrance
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow('Invalid save')
    const restored = load(w)
    advanceWorld(w, 20000); advanceWorld(restored, 20000)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(placeBuilding(w, run.entrance % SIZE, Math.floor(run.entrance / SIZE), 'storage', 'east')).toBe(false)
  }, 30000)
  it('sometimes visits the coop to cover it before sleep and removes the cover after waking', () => {
    const w = world()
    until(w, () => w.peace.activity === 'covering', 1200000)
    expect(neighboringTiles(w.poultry!.coop)).toContain(w.pete.tile)
    expect(snapshot(load(w))).toEqual(snapshot(w))
    const invalid = snapshot(w); invalid.game.poultry!.cover!.stage = 'covered'
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow('Invalid save')
    const missing = snapshot(w); Reflect.deleteProperty(missing.game, 'poultry')
    expect(() => decodeSave(JSON.stringify(missing))).toThrow('Invalid save')
    until(w, () => w.peace.activity === 'resting' && w.poultry?.cover?.stage === 'covered')
    expect(snapshot(load(w))).toEqual(snapshot(w))
    until(w, () => w.peace.activity === 'uncovering')
    expect(neighboringTiles(w.poultry!.coop)).toContain(w.pete.tile)
    const restored = load(w)
    advanceWorld(w, 3000); advanceWorld(restored, 3000)
    expect(w.poultry!.cover).toBeUndefined()
    expect(snapshot(restored)).toEqual(snapshot(w))
  })

  it('plans a compact connected perimeter including house/coop, reuses fences and preserves reachable space', () => {
    const w = world(), original = structuredClone(w.project), y = planYard(w)!
    expect(y).not.toBeNull(); expect(y.reused.length).toBeGreaterThan(0)
    expect(yardInterior(y, 820)).toBe(true); expect(yardInterior(y, w.coopProject!.tiles[0])).toBe(true)
    expect(yardSiteClear(w, y)).toBe(true); expect(w.project).toEqual(original)
    expect(y.tiles.some(i => w.buildings[i])).toBe(false)
    expect(new Set([...y.tiles, ...y.reused, y.entrance]).size).toBe(yardBoundary(y).length)
  })
  it('waits for Wood and builds gradually with exact two-Wood pickups per missing section', () => {
    const w = world(); advanceWorld(w, 30000); expect(w.yard).toBeNull()
    supplyWood(w, 824, 1); advanceWorld(w, 30000); expect(w.yard).toBeNull()
    supplyWood(w, 824, 99); until(w, () => w.yard?.phase === 'building')
    const y = w.yard!; expect(y.carried).toBe(2); expect(crate(w).wood + ecoProjectWood(w)).toBe(98)
    until(w, () => y.elapsedMs >= 500); const count = w.buildings.filter(b => b?.kind === 'peteFence').length
    advanceWorld(w, 4000 - y.elapsedMs - 50); expect(w.buildings.filter(b => b?.kind === 'peteFence')).toHaveLength(count)
    advanceWorld(w, 50); expect(y.built).toBe(1); expect(y.carried).toBe(0); expect(y.phase).toBe('collecting')
    expect(enclosedYard(w)).toBeNull()
    expect([...poultryGround(w, w.poultry!.coop).keys()]).toEqual([...poultryGround({ ...w, yard: null }, w.poultry!.coop).keys()])
    until(w, () => y.phase === 'complete'); expect(crate(w).wood + ecoProjectWood(w)).toBe(100 - y.tiles.length * 2)
    expect(w.buildings.filter(b => b?.kind === 'peteFence')).toHaveLength(3 + y.tiles.length)
    expect(enclosedYard(w)).toBe(y)
  })
  it('adapts its rectangle around buildings/water and declines impossible sites without changing old chicken behavior', () => {
    const w = world(), initial = planYard(w)!, block = initial.tiles.find(i => !w.buildings[i])!
    expect(placeBuilding(w, block % SIZE, Math.floor(block / SIZE), 'storage', 'east')).toBe(true)
    const adapted = planYard(w)!; expect(adapted).not.toBeNull(); expect(adapted.tiles).not.toContain(block)
    const waterWorld = world(), wet = initial.tiles[0]; waterWorld.water[wet] = true
    const waterSafe = planYard(waterWorld)!; expect(waterSafe).not.toBeNull(); expect(waterSafe.tiles).not.toContain(wet)
    for (let row = 16; row <= 26; row++) for (let x = 16; x <= 27; x++) if (!w.buildings[row * SIZE + x] && row * SIZE + x !== w.pete.tile) w.water[row * SIZE + x] = true
    expect(planYard(w)).toBeNull(); expect(w.yard).toBeNull(); expect(enclosedYard(w)).toBeNull()
    const bare = world(), ground = poultryGround(bare, bare.poultry!.coop)
    supplyWood(bare, 824, 1); advanceWorld(bare, 1000)
    expect([...poultryGround(bare, bare.poultry!.coop).keys()]).toEqual([...ground.keys()])
  })
  it('keeps a dry open entrance and access to the house, coop and supply crate, without a gate', () => {
    const w = complete(), y = w.yard!, paths = reachableTiles(w, w.pete.tile)
    expect(w.buildings[y.entrance]).toBeNull(); expect(w.water[y.entrance]).toBe(false)
    expect(paths.has(y.entrance)).toBe(true)
    const entrance = { x: y.entrance % SIZE, y: Math.floor(y.entrance / SIZE) }, stock = w.nature.wood
    expect(placeBuilding(w, entrance.x, entrance.y, 'storage', 'east')).toBe(false)
    expect(paintWater(w, entrance, entrance, 'water', 1)).toBe(0); expect(w.nature.wood).toBe(stock)
    for (const tile of [820, w.coopProject!.tiles[0], 824]) expect(neighboringTiles(tile).some(i => paths.has(i) && !w.buildings[i])).toBe(true)
    const outside = (y.top - 1) * SIZE + y.left
    expect(tilePath(paths, outside)).not.toBeNull()
    expect(yardBoundary(y).every(i => i === y.entrance || w.buildings[i]?.kind === 'peteFence')).toBe(true)
  })
  it('contains adults and chicks over time, including entrance/corners, while still laying and collecting eggs', () => {
    const w = complete(), y = w.yard!, ground = poultryGround(w, w.poultry!.coop), eggs = w.poultry!.collected
    expect(ground.has(y.entrance)).toBe(false)
    Object.assign(w.poultry!.birds[0], { mode: 'pecking', tile: y.entrance, next: null, travelMs: 0, untilMs: w.timeMs + 1000 })
    refreshPoultry(w); expect(w.poultry!.birds[0].tile).toBeNull()
    for (let t = 0; t < 90000; t += 50) {
      advanceWorld(w, 50)
      for (const b of w.poultry!.birds) for (const i of [b.tile, b.next]) if (i !== null) { expect(yardInterior(y, i)).toBe(true); expect(w.water[i]).toBe(false); expect(w.buildings[i]).toBeNull() }
    }
    until(w, () => w.poultry!.collected > eggs, 300000) // Gate building may occupy the first post-yard rest.
    expect(w.poultry!.birds).toHaveLength(5); expect(w.poultry!.collected).toBeGreaterThan(eggs)
    expect([...ground.keys()].every(i => yardInterior(y, i))).toBe(true)
  })
  it('retains partial hammer work while building other sections and never replays a pickup', () => {
    const w = world(); supplyWood(w, 824, 100); until(w, () => (w.yard?.elapsedMs ?? 0) >= 500)
    const y = w.yard!, tile = y.tiles[y.built], stock = crate(w).wood + ecoProjectWood(w)
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', 'east')).toBe(true)
    const built = y.built, elapsed = y.elapsedMs, carried = y.carried
    until(w, () => y.built > built)
    expect(y.deferredWork).toContainEqual({ tile, elapsedMs: elapsed })
    expect(crate(w).wood + ecoProjectWood(w) + y.carried + (y.built - built) * 2).toBe(stock + carried)
    expect(() => load(w)).not.toThrow()
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); until(w, () => y.phase === 'complete')
    expect(crate(w).wood + ecoProjectWood(w)).toBe(100 - y.tiles.length * 2)
  })
  it('persists pickup/work/completion and deterministic chicken behavior across equivalent time partitions', () => {
    const w = world(); supplyWood(w, 824, 100)
    for (const ready of [() => w.yard?.phase === 'collecting', () => (w.yard?.elapsedMs ?? 0) >= 1000, () => (w.yard?.built ?? 0) >= 3, () => w.yard?.phase === 'complete']) {
      until(w, ready); const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
      advanceWorld(w, 1765); for (const ms of [17, 101, 200, 1447]) advanceWorld(restored, ms)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
    const before = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(before)
  })
  it('disables containment safely after demolition and never rebuilds a duplicate yard', () => {
    const w = complete(), y = w.yard!, before = crate(w).wood + ecoProjectWood(w), i = y.tiles[0]
    removeBuilding(w, 20, 20); expect(enclosedYard(w)).toBe(y); expect(() => load(w)).not.toThrow()
    removeBuilding(w, i % SIZE, Math.floor(i / SIZE)); refreshPoultry(w)
    expect(enclosedYard(w)).toBeNull(); expect(() => load(w)).not.toThrow()
    advanceWorld(w, 30000); expect(w.buildings[i]).toBeNull(); expect(crate(w).wood + ecoProjectWood(w)).toBe(before)
    expect(w.yard).toBe(y); expect(y.phase).toBe('complete')
  })
  it('loads a real version-18 world unchanged, then allows the new project', () => {
    const w = world(); w.peace.nextProjectCheckAtMs = 0; w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
    const old = snapshot(w); Reflect.deleteProperty(old.game.peace, 'nextProjectCheckAtMs'); Object.assign(old, { version: 18 }); Reflect.deleteProperty(old.game, 'personality')
    const restored = decodeSave(JSON.stringify(old)).world
    expect(restored.yard).toBeNull(); expect(restored.project).toEqual(w.project); expect(restored.poultry).toEqual(w.poultry)
    supplyWood(restored, 824, 100); until(restored, () => restored.yard?.phase === 'complete')
  })
  it('rejects malformed perimeter, entrance, ownership and resource progress', () => {
    const w = complete()
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'yard') },
      (d: SaveDocument) => { d.game.yard!.entrance = 820 },
      (d: SaveDocument) => { d.game.yard!.left++ },
      (d: SaveDocument) => { d.game.yard!.tiles.pop() },
      (d: SaveDocument) => { d.game.yard!.reused.push(10) },
      (d: SaveDocument) => { d.game.yard!.carried = 2 },
      (d: SaveDocument) => { d.game.yard!.spots[0] = 820 },
      (d: SaveDocument) => { Object.assign(d, { version: 18 }); Reflect.deleteProperty(d.game, 'personality') },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
