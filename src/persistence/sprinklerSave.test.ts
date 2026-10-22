import { createUnlockedWorld } from '../simulation/testFixtures'
import { createAnalytics } from '../simulation/analytics'
import { describe, expect, it } from 'vitest'
import { advanceWorld } from '../simulation/step'
import { placeBuilding, removeBuilding } from '../simulation/world'
import type { World } from '../simulation/world'
import { decodeSave, encodeSave, SAVE_VERSION } from './saveGame'
import type { SaveDocument } from './saveGame'
const view = { scrollX: 44, scrollY: 88, zoom: 1.5, direction: 'north' as const, powerOverlay: true }
const date = '2026-10-20T12:00:00.000Z'
const document = (world: World): SaveDocument => JSON.parse(encodeSave(world, view, date))
function setup() {
  const world = createUnlockedWorld(() => .5)
  Object.assign(world.pete, { x: 8, y: 8, tile: 328 })
  placeBuilding(world, 9, 8, 'sprinkler', 'east')
  placeBuilding(world, 9, 7, 'powerPole', 'east'); placeBuilding(world, 9, 6, 'generator', 'east')
  return world
}
describe('sprinkler and water-reaction persistence', () => {
  it.each([[425.5, 'SPRAYED'], [1425.5, 'SLIPPING'], [2425.5, 'COMPLAINING'], [5425.5, 'WATER_FLEEING'], [13225.5, 'WANDERING']] as const)('restores at %i ms in %s and continues identically', (ms, mode) => {
    const world = setup(); advanceWorld(world, ms)
    expect(world.pete.mode).toBe(mode)
    const data = document(world), loaded = decodeSave(JSON.stringify(data)).world
    expect(document(loaded)).toEqual(data)
    for (const delta of [50, 21, 779, 950, 50, 2000, 7500, 3000]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(document(loaded)).toEqual(document(world))
    }
  })
  it('preserves a powered-off partial spray, resumes once, and does not reset cooldown', () => {
    const world = setup(); advanceWorld(world, 375)
    removeBuilding(world, 9, 6); advanceWorld(world, 600)
    const loaded = decodeSave(encodeSave(world, view, date)).world
    expect(loaded.pete.water!.remainingMs).toBe(700)
    advanceWorld(world, 5000); advanceWorld(loaded, 5000)
    expect(document(loaded)).toEqual(document(world))
    for (const w of [world, loaded]) { placeBuilding(w, 9, 6, 'generator', 'east'); advanceWorld(w, 700) }
    expect(loaded.pete.mode).toBe('SLIPPING')
    expect(document(loaded)).toEqual(document(world))
  })
  it('preserves an ongoing reaction after its source building is deliberately removed', () => {
    const world = setup(); advanceWorld(world, 250); removeBuilding(world, 9, 8)
    const loaded = decodeSave(encodeSave(world, view, date)).world
    expect(loaded.pete.mode).toBe('SLIPPING'); expect(loaded.pete.water!.source).toBeNull()
    advanceWorld(world, 10000); advanceWorld(loaded, 10000)
    expect(document(loaded)).toEqual(document(world))
  })
  it('explicitly upgrades real version-1 fields without changing their authoritative values', () => {
    // Sprint 9's schema had exactly these same fields, except Pete.water and sprinklers.
    const world = createUnlockedWorld(() => .5)
    placeBuilding(world, 20, 20, 'miner', 'east'); placeBuilding(world, 21, 20, 'belt', 'south')
    advanceWorld(world, 725.5)
    const current = document(world), legacy = structuredClone(current)
    Object.assign(legacy, { version: 1 }); Reflect.deleteProperty(legacy.game, 'personality'); Reflect.deleteProperty(legacy.game, 'water'); Reflect.deleteProperty(legacy.game.pete, 'water'); Reflect.deleteProperty(legacy.game.pete, 'trappedBy'); Reflect.deleteProperty(legacy.game.pete, 'ignoredWebs'); Reflect.deleteProperty(legacy.game, 'webs'); Reflect.deleteProperty(legacy.game, 'analytics'); Reflect.deleteProperty(legacy.game, 'research'); Reflect.deleteProperty(legacy.game, 'peace'); Reflect.deleteProperty(legacy.game, 'nature'); Reflect.deleteProperty(legacy.game, 'revenge'); legacy.game.pete.travelMs *= 1.3
    const loaded = decodeSave(JSON.stringify(legacy))
    expect(loaded.world.pete.water).toBeNull()
    expect(document(loaded.world)).toEqual({ ...current, game: { ...current.game, analytics: createAnalytics(world.timeMs) } })
    expect(document(loaded.world).version).toBe(SAVE_VERSION)
  })
  it('rejects pretending new water fields or buildings are version 1 and preserves unknown-version rejection', () => {
    const current = document(setup())
    for (const version of [0, 1, SAVE_VERSION + 1, '3']) {
      const copy = structuredClone(current); Object.assign(copy, { version }); Reflect.deleteProperty(copy.game, 'personality'); Reflect.deleteProperty(copy.game, 'water')
      expect(() => decodeSave(JSON.stringify(copy))).toThrow()
    }
    const fake = structuredClone(current); Object.assign(fake, { version: 1 }); Reflect.deleteProperty(fake.game, 'personality'); Reflect.deleteProperty(fake.game, 'water'); Reflect.deleteProperty(fake.game.pete, 'water'); Reflect.deleteProperty(fake.game, 'webs'); Reflect.deleteProperty(fake.game, 'analytics'); Reflect.deleteProperty(fake.game, 'research'); Reflect.deleteProperty(fake.game, 'peace'); Reflect.deleteProperty(fake.game, 'nature'); Reflect.deleteProperty(fake.game, 'revenge')
    expect(() => decodeSave(JSON.stringify(fake))).toThrow('sprinklers require save version 2')
  })
  it.each([
    ['missing phase state', (d: SaveDocument) => { d.game.pete.water = null }],
    ['missing source', (d: SaveDocument) => { d.game.pete.water!.source = null }],
    ['wrong source', (d: SaveDocument) => { d.game.pete.water!.source = 289 }],
    ['wrong origin', (d: SaveDocument) => { d.game.pete.water!.origin.x = 10 }],
    ['negative timer', (d: SaveDocument) => { d.game.pete.water!.remainingMs = -1 }],
    ['excessive timer', (d: SaveDocument) => { d.game.pete.water!.remainingMs = 1050 }],
    ['fractional tick', (d: SaveDocument) => { d.game.pete.water!.remainingMs = 123 }],
    ['unknown complaint', (d: SaveDocument) => { d.game.pete.water!.complaint = 4 }],
    ['wrong mode', (d: SaveDocument) => { d.game.pete.mode = 'WANDERING' }],
    ['overlapping grace', (d: SaveDocument) => { d.game.pete.graceUntilMs = d.game.timeMs + 1000 }],
    ['invalid cooldown', (d: SaveDocument) => { const b = d.game.buildings[329]!; if (b.kind === 'sprinkler') b.cooldownUntilMs = d.game.timeMs + 10001 }],
    ['negative spray count', (d: SaveDocument) => { const b = d.game.buildings[329]!; if (b.kind === 'sprinkler') b.sprays = -1 }],
  ] as const)('rejects %s transactionally', (_label, mutate) => {
    const world = setup(); advanceWorld(world, 350)
    const before = document(world), invalid = structuredClone(before)
    mutate(invalid)
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow()
    expect(document(world)).toEqual(before)
  })
})
