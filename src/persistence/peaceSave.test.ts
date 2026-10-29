import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave, SAVE_VERSION } from './saveGame'
import type { SaveDocument } from './saveGame'
import { createBareWorld, poweredWorld } from '../simulation/testFixtures'
import { placeBuilding, removeBuilding } from '../simulation/world'
import type { World } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { collectGift, createPeace } from '../simulation/peace'
import { damageWalker, recordArrest } from '../factory/revengeSystem'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-21T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function home() {
  const w = createBareWorld(() => .5); w.nature.wood = 40
  placeBuilding(w, 18, 23, 'treehouse', 'east')
  return w
}
describe('version 8 peace persistence', () => {
  it.each([0, 50, 1500, 3000, 6000, 17000, 80000, 400000])('restores exact routine, gifts, RNG and time remainder at %i ms', time => {
    const w = home(); advanceWorld(w, time + 12.5)
    const restored = load(w)
    expect(SAVE_VERSION).toBe(53); expect(snapshot(restored)).toEqual(snapshot(w))
    for (const delta of [37.5, 112.5, 1450, 7500]) {
      advanceWorld(w, delta); advanceWorld(restored, delta)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
  })
  it('resumes shutdown midway exactly, never spawning a hostile attack or counting a defeat', () => {
    const w = createBareWorld(() => .5); w.revenge.threshold = 7
    for (let i = 0; i < 7; i++) recordArrest(w)
    advanceWorld(w, 5000); damageWalker(w, 50)
    w.nature.wood = 40; placeBuilding(w, 18, 23, 'treehouse', 'east')
    advanceWorld(w, 2500)
    const restored = load(w)
    expect(restored.peace.shutdown?.atMs).toBe(5000)
    for (const delta of [50, 3449.5, .5, 5000]) { advanceWorld(w, delta); advanceWorld(restored, delta); expect(snapshot(restored)).toEqual(snapshot(w)) }
    expect(w.peace.shutdown).toBeNull(); expect(w.revenge).toMatchObject({ boss: null, arrests: 7, threshold: 7 })
    removeBuilding(w, 18, 23); const demolished = load(w)
    expect(demolished.revenge.untilMs).toBe(w.timeMs + 5000)
    advanceWorld(demolished, 4950); expect(demolished.revenge.boss).toBeNull()
    advanceWorld(demolished, 50); expect(demolished.revenge.stage).toBe('hunting')
  })
  it('does not duplicate gifts or award Wood when saving/loading/collecting/rebuilding', () => {
    const w = home(); advanceWorld(w, w.peace.nextGiftAtMs)
    const restored = load(w), gift = restored.peace.gifts[0]
    expect(gift).toBeDefined()
    const before = restored.nature.wood
    expect(collectGift(restored, gift.tile)).not.toBeNull()
    expect(restored.nature.wood).toBe(before + gift.wood)
    const collected = load(restored)
    expect(collectGift(collected, gift.tile)).toBeNull()
    expect(collected.nature.wood).toBe(before + gift.wood)
    removeBuilding(collected, 18, 23); const conflict = load(collected)
    expect(conflict.peace.gifts).toEqual([])
    placeBuilding(conflict, 18, 23, 'treehouse', 'east')
    expect(load(conflict).nature.wood).toBe(before + gift.wood - 20)
  })
  it('keeps a gift hidden under later construction valid and collectable only after removal', () => {
    const w = home(); advanceWorld(w, w.peace.nextGiftAtMs)
    const gift = w.peace.gifts[0]
    placeBuilding(w, gift.tile % 40, Math.floor(gift.tile / 40), 'storage', 'east')
    const restored = load(w)
    expect(collectGift(restored, gift.tile)).toBeNull()
    removeBuilding(restored, gift.tile % 40, Math.floor(gift.tile / 40))
    expect(collectGift(restored, gift.tile)).not.toBeNull()
    expect(load(restored).peace.gifts).toEqual([])
  })
  it('preserves actual factory power, productive accounting and resources during peace across reload', () => {
    const w = poweredWorld(() => .5)
    placeBuilding(w, 20, 20, 'miner', 'east')
    placeBuilding(w, 21, 20, 'belt', 'east'); placeBuilding(w, 22, 20, 'storage', 'east')
    w.nature.wood = 20; placeBuilding(w, 18, 23, 'treehouse', 'east')
    advanceWorld(w, 2500); const restored = load(w)
    advanceWorld(w, 10000); advanceWorld(restored, 10000)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(w.mined.iron).toBeGreaterThan(5); expect(BigInt(w.research.balanceUnits)).toBeGreaterThan(0n)
    expect(w.nature.wood).toBe(0)
  })
  it('migrates a genuine Sprint 13 version-7 snapshot with exact existing state and no new home/wood', () => {
    const w = poweredWorld(() => .5)
    placeBuilding(w, 20, 20, 'miner', 'east'); w.revenge.arrests = 2; w.revenge.threshold = 5; w.nature.wood = 13
    advanceWorld(w, 1250)
    const old = snapshot(w); Object.assign(old, { version: 7 }); Reflect.deleteProperty(old.game, 'personality'); Reflect.deleteProperty(old.game, 'water'); Reflect.deleteProperty(old.game, 'peace')
    const restored = decodeSave(JSON.stringify(old)).world
    expect(restored.peace).toEqual(createPeace())
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('preserves legacy prison release and new animation metadata instead of silently entering peace', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 0, 1, 'prison', 'east')
    const prison = w.buildings[40]!
    if (prison.kind !== 'prison') throw Error('fixture')
    Object.assign(w.pete, { mode: 'IMPRISONED', prison, imprisonedAtMs: 0, tile: 40, x: 0, y: 1 })
    advanceWorld(w, 59950)
    const old = snapshot(w); Object.assign(old, { version: 7 }); Reflect.deleteProperty(old.game, 'personality'); Reflect.deleteProperty(old.game, 'water'); Reflect.deleteProperty(old.game, 'peace')
    const restored = decodeSave(JSON.stringify(old)).world
    advanceWorld(w, 50); advanceWorld(restored, 50)
    expect(snapshot(restored)).toEqual(snapshot(w)); expect(restored.pete.prison).toBeNull()
  })
  it.each([
    ['missing peace', (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'peace') }],
    ['missing house', (d: SaveDocument) => { d.game.buildings[d.game.peace.home!] = null }],
    ['duplicate house', (d: SaveDocument) => { d.game.buildings[0] = { kind: 'treehouse', x: 0, y: 0, placedAtMs: 0 } }],
    ['conflict with house', (d: SaveDocument) => { d.game.peace.home = null }],
    ['expired gift clock', (d: SaveDocument) => { d.game.peace.nextGiftAtMs = d.game.timeMs }],
    ['premature first gift', (d: SaveDocument) => { d.game.peace.nextGiftAtMs = 50 }],
    ['subtick clock', (d: SaveDocument) => { d.game.peace.sinceMs = 1 }],
    ['unknown activity', (d: SaveDocument) => { Object.assign(d.game.peace, { activity: 'sabotage' }) }],
    ['extra field', (d: SaveDocument) => { Object.assign(d.game.peace, { reward: 100 }) }],
    ['invalid home', (d: SaveDocument) => { d.game.peace.home = 2000 }],
    ['invalid seed', (d: SaveDocument) => { d.game.peace.seed = -1 }],
    ['hostile Pete', (d: SaveDocument) => { d.game.pete.mode = 'FLEEING' }],
    ['active web', (d: SaveDocument) => { d.game.pete.webMs = 50 }],
    ['fake resting', (d: SaveDocument) => { d.game.peace.activity = 'resting' }],
    ['duplicate IDs', (d: SaveDocument) => { d.game.peace.gifts = [{ id: 1, tile: 939, kind: 'wood', wood: 1, atMs: 0 }, { id: 1, tile: 940, kind: 'wood', wood: 1, atMs: 0 }]; d.game.peace.nextId = 2 }],
    ['invalid Wood gift', (d: SaveDocument) => { d.game.peace.gifts = [{ id: 1, tile: 939, kind: 'wood', wood: 0, atMs: 0 }]; d.game.peace.nextId = 2 }],
    ['distant gift', (d: SaveDocument) => { d.game.peace.gifts = [{ id: 1, tile: 0, kind: 'wood', wood: 1, atMs: 0 }]; d.game.peace.nextId = 2 }],
    ['hidden version-8 state', (d: SaveDocument) => { Object.assign(d, { version: 7 }); Reflect.deleteProperty(d.game, 'personality'); Reflect.deleteProperty(d.game, 'water') }],
  ])('rejects %s without touching the running world', (_name, mutate) => {
    const w = home(), before = snapshot(w), bad = structuredClone(before)
    mutate(bad)
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    expect(snapshot(w)).toEqual(before)
  })
})
