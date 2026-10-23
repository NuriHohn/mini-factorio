import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave, SAVE_VERSION } from './saveGame'
import { chopTree, createNature, MATURE_TREE_MS, paintLandscape, plantTree, refreshNatureSchedule } from '../simulation/nature'
import { createWorld, placeBuilding, SIZE } from '../simulation/world'
import type { Tree, World } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { createResearch } from '../simulation/research'
import type { SaveDocument } from './saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-21T00:00:00.000Z'))
const restore = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function setup() {
  const w = createWorld(() => .5, { nature: false, water: false })
  plantTree(w, 5, 5, 'oak'); plantTree(w, 8, 5, 'pine'); plantTree(w, 8, 8, 'birch')
  paintLandscape(w, { x: 5, y: 5 }, { x: 15, y: 15 }, 'flowers', 3)
  paintLandscape(w, { x: 8, y: 8 }, { x: 8, y: 8 }, 'grass', 5)
  placeBuilding(w, 20, 20, 'storage', 'east')
  w.nature.seed = 2000
  return w
}
describe('version 7 nature persistence and legacy compatibility', () => {
  it('round trips a generated landscape without regenerating forests or consuming RNG', () => {
    const world = createWorld(() => .5), loaded = restore(world)
    expect(SAVE_VERSION).toBe(28)
    expect(snapshot(loaded)).toEqual(snapshot(world))
    expect(loaded.nature.seed).toBe(world.nature.seed)
    expect(loaded.nature.nextAttemptAtMs).toBe(world.nature.nextAttemptAtMs)
  })
  it.each([0, 119950, 120000, 299950, 300000, 599950, 600000])('continues from age %i through growth/reproduction/chopping exactly', ms => {
    const w = setup()
    // Jump to the boundary under test; Pete remains at a valid frozen initial tile.
    w.timeMs = ms
    if (ms === 600000) {
      w.timeMs -= 50; advanceWorld(w, 50)
    }
    const loaded = restore(w)
    for (const delta of [17, 33, 50, 1000]) {
      advanceWorld(w, delta); advanceWorld(loaded, delta)
      expect(snapshot(loaded)).toEqual(snapshot(w))
    }
    for (const world of [w, loaded]) chopTree(world, 5, 5)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    const again = restore(loaded)
    expect(chopTree(again, 5, 5)).toBe(null)
    expect(again.nature.wood).toBe(loaded.nature.wood)
  })
  it.each([1, 2, 3, 4, 5, 6])('loads version %i with empty nature, keeping existing gameplay state', version => {
    const w = createWorld(() => .5, { nature: false, water: false })
    placeBuilding(w, 20, 20, 'storage', 'east')
    w.research = createResearch(true)
    w.revenge.arrests = version >= 6 ? 2 : 0
    const old = snapshot(w)
    Object.assign(old, { version }); Reflect.deleteProperty(old.game, 'personality'); Reflect.deleteProperty(old.game, 'water'); Reflect.deleteProperty(old.game, 'peace'); Reflect.deleteProperty(old.game, 'nature')
    if (version < 6) Reflect.deleteProperty(old.game, 'revenge')
    if (version < 5) Reflect.deleteProperty(old.game, 'research')
    if (version < 4) Reflect.deleteProperty(old.game, 'analytics')
    if (version < 3) { Reflect.deleteProperty(old.game, 'webs'); Reflect.deleteProperty(old.game.pete, 'trappedBy'); Reflect.deleteProperty(old.game.pete, 'ignoredWebs') }
    if (version === 1) Reflect.deleteProperty(old.game.pete, 'water')
    const loaded = decodeSave(JSON.stringify(old)).world
    expect(loaded.nature).toEqual(createNature())
    expect(loaded.buildings).toEqual(w.buildings); expect(loaded.tiles).toEqual(w.tiles)
    expect(loaded.pete).toEqual(w.pete); expect(loaded.revenge).toEqual(w.revenge)
    expect(loaded.research).toEqual(w.research)
    expect(loaded.buildings.some(b => b?.kind === 'tree')).toBe(false)
    expect(restore(loaded).nature.wood).toBe(0)
  })
  it('preserves tree origin, exact pending deadline and collected wood without saved cosmetic stumps', () => {
    const w = setup(); w.timeMs = MATURE_TREE_MS
    const t = w.buildings[205] as Tree
    t.origin = 'natural'
    refreshNatureSchedule(w)
    expect(chopTree(w, 8, 5)?.wood).toBe(3)
    const loaded = restore(w)
    expect(loaded.nature.wood).toBe(3)
    expect(loaded.buildings[205]).toEqual(t)
    expect(loaded.nature.nextAttemptAtMs).toBe(600000)
    expect(Object.keys(snapshot(w).game.nature)).toEqual(['wood', 'seed', 'decorations'])
  })
  it.each([
    ['missing nature', (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'nature') }],
    ['negative wood', (d: SaveDocument) => { d.game.nature.wood = -1 }],
    ['fractional wood', (d: SaveDocument) => { d.game.nature.wood = .5 }],
    ['overflow seed', (d: SaveDocument) => { d.game.nature.seed = 4294967296 }],
    ['short decorations', (d: SaveDocument) => { d.game.nature.decorations.pop() }],
    ['unknown decoration', (d: SaveDocument) => { Reflect.set(d.game.nature.decorations, 0, 'water') }],
    ['unknown nature field', (d: SaveDocument) => { Reflect.set(d.game.nature, 'animals', []) }],
    ['unknown species', (d: SaveDocument) => { Reflect.set(d.game.buildings[205]!, 'species', 'palm') }],
    ['unknown origin', (d: SaveDocument) => { Reflect.set(d.game.buildings[205]!, 'origin', 'gift') }],
    ['future birth', (d: SaveDocument) => { (d.game.buildings[205] as Tree).bornAtMs = 50 }],
    ['manual ancient birth', (d: SaveDocument) => { (d.game.buildings[205] as Tree).bornAtMs = -50 }],
    ['fractional clock', (d: SaveDocument) => { (d.game.buildings[205] as Tree).bornAtMs = .5 }],
    ['wrong cadence', (d: SaveDocument) => { (d.game.buildings[205] as Tree).nextReproductionAtMs = 600050 }],
    ['premature reproduction', (d: SaveDocument) => { (d.game.buildings[205] as Tree).nextReproductionAtMs = 300000 }],
    ['wrong tile', (d: SaveDocument) => { (d.game.buildings[205] as Tree).x = 7 }],
  ] as const)('rejects %s without altering the live world', (_label, corrupt) => {
    const w = setup(), before = snapshot(w), bad = structuredClone(before)
    corrupt(bad)
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    expect(snapshot(w)).toEqual(before)
  })
  it('rejects tree occupancy hidden inside a legacy version and invalid natural-cap saves', () => {
    const w = setup(), bad = snapshot(w)
    Object.assign(bad, { version: 6 }); Reflect.deleteProperty(bad.game, 'personality'); Reflect.deleteProperty(bad.game, 'water'); Reflect.deleteProperty(bad.game, 'peace'); Reflect.deleteProperty(bad.game, 'nature')
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('trees require save version 7')
    for (let i = 0; i < SIZE * SIZE && w.buildings.filter(b => b?.kind === 'tree').length < 324; i++) if (plantTree(w, i % SIZE, Math.floor(i / SIZE), 'oak')) (w.buildings[i] as Tree).origin = 'natural'
    expect(() => snapshot(w)).toThrow('natural tree cap exceeded')
  })
})
