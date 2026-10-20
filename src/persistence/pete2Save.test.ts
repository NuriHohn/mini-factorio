import { createUnlockedWorld } from '../simulation/testFixtures'
import { createAnalytics } from '../simulation/analytics'
import { describe, expect, it } from 'vitest'
import { placeBuilding, removeBuilding } from '../simulation/world'
import type { World } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { shootWeb } from '../simulation/webs'
import { decodeSave, encodeSave } from './saveGame'
import type { SaveDocument } from './saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const date = '2026-10-20T12:00:00.000Z'
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, date))
function setup() {
  const w = createUnlockedWorld(() => .5)
  for (const [x, y] of [[16, 23], [17, 22], [17, 24]]) placeBuilding(w, x, y, 'storage', 'east')
  shootWeb(w, { x: 18, y: 23 })
  return w
}
function restore(w: World) { return decodeSave(encodeSave(w, view, date)).world }
describe('Pete 2.0 versioned persistence and continuation', () => {
  it.each([0, 150, 300, 400, 1100, 8000, 10250, 10300])('round trips at %i ms without replaying flights or extending traps', ms => {
    const w = setup(); advanceWorld(w, ms)
    const loaded = restore(w)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    for (const delta of [17, 33, 50, 200, 1000, 9000, 50]) {
      advanceWorld(w, delta); advanceWorld(loaded, delta)
      expect(snapshot(loaded)).toEqual(snapshot(w))
    }
  })
  it('preserves direct-release immunity and the original ground web lifetime', () => {
    const w = setup(); advanceWorld(w, 400); shootWeb(w, w.pete)
    const loaded = restore(w)
    expect(loaded.pete).toMatchObject({ mode: 'FLEEING', trappedBy: null, ignoredWebs: [1] })
    expect(loaded.webs.patches[0].expiresAtMs).toBe(10300)
    advanceWorld(w, 12000); advanceWorld(loaded, 12000)
    expect(snapshot(loaded)).toEqual(snapshot(w))
  })
  it.each([1, 2])('upgrades version %i with movement interpolation and old remaining cooldown intact', version => {
    const w = createUnlockedWorld(() => .5); advanceWorld(w, 350); w.pete.cooldownMs = 12345
    const before = snapshot(w), legacy = structuredClone(before)
    Object.assign(legacy, { version }); Reflect.deleteProperty(legacy.game, 'webs'); Reflect.deleteProperty(legacy.game, 'analytics'); Reflect.deleteProperty(legacy.game, 'research')
    for (const key of ['trappedBy', 'ignoredWebs', ...(version === 1 ? ['water'] : [])]) Reflect.deleteProperty(legacy.game.pete, key)
    legacy.game.pete.travelMs *= 1.3
    const loaded = decodeSave(JSON.stringify(legacy)).world
    expect(loaded.pete.x).toBe(w.pete.x); expect(loaded.pete.y).toBe(w.pete.y)
    expect(loaded.pete.travelMs).toBeCloseTo(w.pete.travelMs)
    expect(loaded.pete.cooldownMs).toBe(12345); expect(loaded.webs).toEqual({ nextId: 1, patches: [] })
    expect(snapshot(loaded)).toEqual({ ...before, game: { ...before.game, analytics: createAnalytics(w.timeMs) } })
  })
  it('upgrades a version-2 active water escape without moving Pete or resetting its remaining duration', () => {
    const w = createUnlockedWorld(() => .5)
    placeBuilding(w, 18, 23, 'sprinkler', 'east'); placeBuilding(w, 18, 22, 'powerPole', 'east'); placeBuilding(w, 18, 21, 'generator', 'east')
    advanceWorld(w, 4750)
    expect(w.pete.mode).toBe('WATER_FLEEING')
    const before = snapshot(w), legacy = structuredClone(before)
    Object.assign(legacy, { version: 2 }); Reflect.deleteProperty(legacy.game, 'webs'); Reflect.deleteProperty(legacy.game, 'analytics'); Reflect.deleteProperty(legacy.game, 'research'); Reflect.deleteProperty(legacy.game.pete, 'trappedBy'); Reflect.deleteProperty(legacy.game.pete, 'ignoredWebs')
    legacy.game.pete.travelMs *= 1.3
    const loaded = decodeSave(JSON.stringify(legacy)).world
    expect(snapshot(loaded)).toEqual({ ...before, game: { ...before.game, analytics: createAnalytics(w.timeMs) } })
    w.analytics = createAnalytics(w.timeMs) // Old files have no analytics history to restore.
    advanceWorld(w, 8000); advanceWorld(loaded, 8000); expect(snapshot(loaded)).toEqual(snapshot(w))
  })
  it('preserves disabled generators/inserters and carried items through reconstruction and recovery', () => {
    const w = createUnlockedWorld(() => .5)
    placeBuilding(w, 1, 1, 'powerPole', 'east'); placeBuilding(w, 2, 1, 'generator', 'east'); placeBuilding(w, 1, 2, 'inserter', 'east')
    const arm = w.buildings[81]!, gen = w.buildings[42]!
    if (arm.kind === 'inserter') Object.assign(arm, { phase: 'carrying', item: 'ironPlate', elapsedMs: 250, sabotageUntilMs: 10000 })
    gen.sabotageUntilMs = 10000
    const loaded = restore(w)
    expect(loaded.power!.networks[0].capacityKw).toBe(0)
    advanceWorld(w, 9950); advanceWorld(loaded, 9950)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    advanceWorld(w, 50); advanceWorld(loaded, 50)
    expect(loaded.power!.networks[0].capacityKw).toBe(100)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    removeBuilding(loaded, 1, 2); expect(loaded.buildings[81]).toBeNull()
  })
  it.each([
    ['duplicate identity', (d: SaveDocument) => { d.game.webs.patches.push(structuredClone(d.game.webs.patches[0])) }],
    ['invalid tile', (d: SaveDocument) => { d.game.webs.patches[0].tile = 1600 }],
    ['negative timer', (d: SaveDocument) => { d.game.webs.patches[0].expiresAtMs = -1 }],
    ['extended lifetime', (d: SaveDocument) => { d.game.webs.patches[0].expiresAtMs++ }],
    ['invalid sequence', (d: SaveDocument) => { d.game.webs.nextId = 1 }],
    ['dangling trap', (d: SaveDocument) => { d.game.pete.trappedBy = 99 }],
    ['missing trap', (d: SaveDocument) => { d.game.pete.trappedBy = null }],
    ['wrong trap tile', (d: SaveDocument) => { d.game.webs.patches[0].tile = 0 }],
    ['non-landed trap', (d: SaveDocument) => { const p = d.game.webs.patches[0]; p.launchedAtMs = 200; p.landsAtMs = 500; p.expiresAtMs = 10500 }],
    ['unknown immune ID', (d: SaveDocument) => { d.game.pete.ignoredWebs = [999] }],
    ['ignoring own trap', (d: SaveDocument) => { d.game.pete.ignoredWebs = [1] }],
    ['hidden legacy webs', (d: SaveDocument) => { Object.assign(d, { version: 2 }) }],
  ] as const)('rejects %s without changing a running factory', (_name, mutate) => {
    const w = setup(); advanceWorld(w, 400)
    const before = snapshot(w), invalid = structuredClone(before); mutate(invalid)
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow()
    expect(snapshot(w)).toEqual(before)
  })
})
