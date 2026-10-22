import { beforeAll, describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { World } from './world'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import { paintWater } from './waterLandscaping'
import { neighboringTiles } from './navigation'
import { CHICK_DELAY_MS, collectEgg, eggAt, MAX_EGGS, nearCoop, poultryGround, refreshPoultry } from './poultry'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-22T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function until(w: World, ready: () => boolean, limit = 180000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 100
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east')
  supplyWood(template, 824, 16)
  until(template, () => template.coopProject?.phase === 'complete')
})
const world = () => structuredClone(template)
function unattended() { const w = world(); removeBuilding(w, 20, 20); return w }
describe('coop chickens, eggs and chicks', () => {
  it('populates only a completed standing coop, without changing factory inventory', () => {
    const empty = createBareWorld(() => .5); advanceWorld(empty, 50000); expect(empty.poultry).toBeNull()
    const w = world(); expect(w.poultry?.birds).toHaveLength(3)
    expect(w.poultry?.birds.every(b => b.kind === 'adult' && b.mode === 'inside')).toBe(true)
    expect(w.buildings[824]).toMatchObject({ wood: 0 })
    const legacy = snapshot(w); Object.assign(legacy, { version: 16 }); Reflect.deleteProperty(legacy.game, 'personality'); Reflect.deleteProperty(legacy.game, 'poultry'); Reflect.deleteProperty(legacy.game, 'campfireProject')
    const restored = decodeSave(JSON.stringify(legacy)).world
    expect(restored.poultry).toBeNull(); expect(restored.coopProject).toEqual(w.coopProject)
    advanceWorld(restored, 50); expect(restored.poultry?.birds).toHaveLength(3)
  })
  it('leaves, walks, pecks and returns inside while avoiding blocked ground and water', () => {
    const w = unattended(), s = w.poultry!, modes = new Set<string>(), positions = new Set<number>()
    const outside = new Set<number>(), returned = new Set<number>()
    const ground = [...poultryGround(w, s.coop).keys()]
    w.water[ground[ground.length - 1]] = true
    const blocked = ground.find(i => i !== s.coop && !w.water[i])!
    placeBuilding(w, blocked % SIZE, Math.floor(blocked / SIZE), 'storage', 'east')
    for (let t = 0; t < 90000; t += 50) {
      advanceWorld(w, 50)
      for (const b of s.birds) {
        modes.add(b.mode)
        if (b.tile !== null) outside.add(b.id)
        else if (outside.has(b.id)) returned.add(b.id)
        for (const tile of [b.tile, b.next]) if (tile !== null) { positions.add(tile); expect(nearCoop(s.coop, tile)).toBe(true); expect(w.water[tile]).toBe(false); expect(w.buildings[tile]).toBeNull() }
      }
    }
    expect([...modes].sort()).toEqual(['inside', 'pecking', 'walking']); expect(positions.size).toBeGreaterThan(5); expect(returned.size).toBeGreaterThan(0)
  })
  it('recovers safely from flooded or fully blocked ground and resumes once cleared', () => {
    const w = unattended(), s = w.poultry!
    advanceWorld(w, 10000)
    const ground = [...poultryGround(w, s.coop).keys()]
    Object.assign(w.pete, { tile: 410, x: 10, y: 10, next: null, path: [], travelMs: 0, pathRevision: -1 })
    for (const i of ground) w.water[i] = true
    refreshPoultry(w); expect(s.birds.every(b => b.tile === null)).toBe(true)
    advanceWorld(w, 10000); expect(s.birds.every(b => b.tile === null)).toBe(true); expect(() => load(w)).not.toThrow()
    for (const i of ground) w.water[i] = false
    until(w, () => s.birds.some(b => b.tile !== null), 10000)
  })
  it('spawns exactly two chicks at 150 simulation seconds, never early or twice after loading', () => {
    const w = unattended(), s = w.poultry!
    advanceWorld(w, CHICK_DELAY_MS - 50); expect(s.birds).toHaveLength(3); expect(s.chicksSpawned).toBe(false)
    const restored = load(w); advanceWorld(restored, 0); expect(restored.poultry?.birds).toHaveLength(3)
    advanceWorld(restored, 50); expect(restored.poultry?.birds.map(b => b.kind)).toEqual(['adult', 'adult', 'adult', 'chick', 'chick'])
    const again = load(restored); advanceWorld(again, 180000)
    expect(again.poultry?.birds).toHaveLength(5); expect(again.poultry?.chicksAtMs).toBe(s.populatedAtMs + CHICK_DELAY_MS)
    expect(again.poultry?.birds.filter(b => b.kind === 'chick').every(b => b.tile === null || poultryGround(again, s.coop).has(b.tile))).toBe(true)
  })
  it('lays bounded visible eggs only from adults, with no industrial item additions', () => {
    const w = unattended(), s = w.poultry!, stock = structuredClone(w.buildings[824])
    advanceWorld(w, 44950); expect(s.eggs).toHaveLength(0)
    until(w, () => s.eggs.length === MAX_EGGS, 500000)
    expect(s.eggs.every(e => e.laidBy < 3 && eggAt(w, e.tile) === e)).toBe(true)
    advanceWorld(w, 240000); expect(s.eggs).toHaveLength(MAX_EGGS); expect(s.collected).toBe(0)
    expect(w.buildings[824]).toEqual(stock)
  })
  it('peaceful Pete visits reachable eggs, animates collection, and credits each egg only once', () => {
    const w = world(), s = w.poultry!
    until(w, () => w.peace.activity === 'collectingEgg', 500000)
    const egg = eggAt(w, w.peace.destination)!, previous = s.collected
    expect(collectEgg(w)).toBe(false); expect(s.collected).toBe(previous)
    const remaining = w.peace.untilMs - w.timeMs, restored = load(w)
    advanceWorld(w, remaining - 50); expect(s.eggs.some(e => e.id === egg.id)).toBe(true)
    advanceWorld(w, 50); expect(s.collected).toBe(previous + 1); expect(s.eggs.some(e => e.id === egg.id)).toBe(false)
    expect(collectEgg(w)).toBe(false)
    advanceWorld(restored, remaining); expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('cancels collection safely if the egg is covered or coop is removed', () => {
    for (const removeCoop of [false, true]) {
      const w = world(); until(w, () => w.peace.activity === (removeCoop ? 'collectingEgg' : 'eggward'), 500000)
      const s = w.poultry!, count = s.collected, tile = removeCoop ? s.coop : w.peace.destination!
      if (removeCoop) removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE))
      else placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')
      expect(w.peace.activity).toBe('homeward'); expect(s.collected).toBe(count)
      expect(() => load(w)).not.toThrow(); advanceWorld(w, 5000); expect(s.collected).toBe(count)
      if (removeCoop) { expect(s.eggs).toHaveLength(0); expect(s.birds.every(b => b.tile === null)).toBe(true) }
    }
  })
  it('preserves deterministic movement, egg schedules and chick positions across partitions and saves', () => {
    const w = unattended(); advanceWorld(w, 160000)
    until(w, () => w.poultry!.birds.some(b => b.kind === 'chick' && b.mode === 'walking'), 15000)
    const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
    advanceWorld(w, 30765)
    for (const ms of [17, 101, 200, 30447]) advanceWorld(restored, ms)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('chicks follow nearby adults using dry cardinal steps and pause freezes every poultry clock', () => {
    const w = unattended(); advanceWorld(w, CHICK_DELAY_MS)
    const s = w.poultry!, ground = poultryGround(w, s.coop), start = [...ground.keys()][0]
    const target = neighboringTiles(start).find(i => ground.has(i))!
    for (const b of s.birds) Object.assign(b, { tile: null, next: null, mode: 'inside', travelMs: 0, untilMs: w.timeMs + 5000 })
    Object.assign(s.birds[0], { tile: target, mode: 'pecking' })
    Object.assign(s.birds[3], { tile: start, mode: 'pecking', untilMs: w.timeMs })
    s.seed = 1 // First decision stays outside; second chooses to follow an adult.
    advanceWorld(w, 50)
    expect(s.birds[3]).toMatchObject({ mode: 'walking', next: target })
    const before = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(before)
  })
  it('real water landscaping evacuates birds immediately and preserves valid saves', () => {
    const w = unattended(); advanceWorld(w, 10000)
    until(w, () => w.poultry!.birds.some(b => b.tile !== null && b.next === null && b.tile !== w.pete.tile))
    const b = w.poultry!.birds.find(b => b.tile !== null && b.next === null && b.tile !== w.pete.tile)!, tile = b.tile!
    const pos = { x: tile % SIZE, y: Math.floor(tile / SIZE) }
    expect(paintWater(w, pos, pos, 'water', 1)).toBe(1)
    expect(b.tile).toBeNull(); expect(() => load(w)).not.toThrow()
    expect(paintWater(w, pos, pos, 'land', 1)).toBe(1)
    advanceWorld(w, 10000); expect(() => load(w)).not.toThrow()
  })
  it('rejects malformed identities, schedules, occupancy and egg accounting', () => {
    const w = unattended(); until(w, () => w.poultry!.eggs.length > 0)
    for (const mutate of [
      (d: SaveDocument) => { d.game.poultry!.birds[0].id = 1 },
      (d: SaveDocument) => { d.game.poultry!.birds[0].kind = 'chick' },
      (d: SaveDocument) => { d.game.poultry!.chicksSpawned = true },
      (d: SaveDocument) => { d.game.poultry!.chicksAtMs += 50 },
      (d: SaveDocument) => { d.game.poultry!.collected = 100 },
      (d: SaveDocument) => { d.game.poultry!.eggs[0].laidBy = 3 },
      (d: SaveDocument) => { d.game.poultry!.birds[0].travelMs = 1 },
      (d: SaveDocument) => { d.game.poultry!.eggs.push(...Array(4).fill(d.game.poultry!.eggs[0])) },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'coopProject') },
      (d: SaveDocument) => { Object.assign(d, { version: 16 }); Reflect.deleteProperty(d.game, 'personality') },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
