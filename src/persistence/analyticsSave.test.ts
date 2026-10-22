import { describe, expect, it } from 'vitest'
import { analyticsSnapshot, createAnalytics } from '../simulation/analytics'
import { changeCraftingRecipe } from '../simulation/crafting'
import { advanceWorld } from '../simulation/step'
import { poweredWorld } from '../simulation/testFixtures'
import { buildingAt, placeBuilding, removeBuilding } from '../simulation/world'
import type { Assembler, World } from '../simulation/world'
import { decodeSave, encodeSave } from './saveGame'
import type { SaveDocument } from './saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const date = '2026-10-20T12:00:00.000Z'
function setup() {
  const world = poweredWorld(() => .5)
  placeBuilding(world, 20, 20, 'assembler', 'east'); changeCraftingRecipe(world, 20, 20, 'copperCable')
  const machine = buildingAt(world, 20, 20) as Assembler; machine.input.copperPlate = 2
  return world
}
function document(world: World): SaveDocument { return JSON.parse(encodeSave(world, view, date)) }
function restore(world: World) { return decodeSave(encodeSave(world, view, date)).world }
describe('analytics persistence and deterministic continuation', () => {
  it.each([50, 1050, 4050, 16050, 59950, 60000, 60050, 120050])('preserves all analytics at %i ms and resumes identically', cut => {
    const world = setup(); advanceWorld(world, cut)
    const loaded = restore(world)
    expect(loaded.analytics).toEqual(world.analytics)
    expect(analyticsSnapshot(loaded)).toEqual(analyticsSnapshot(world))
    expect((loaded.buildings[820] as Assembler).recipeId).toBe('copperCable')
    for (const delta of [17, 33, 1000, 14000]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(document(loaded)).toEqual(document(world))
    }
  })
  it('retains consumed inputs and history after machine removal and repeated reloads', () => {
    const world = setup(); advanceWorld(world, 4050)
    removeBuilding(world, 20, 20)
    const snapshot = analyticsSnapshot(world)
    let loaded = restore(world)
    for (let n = 0; n < 3; n++) loaded = restore(loaded)
    expect(analyticsSnapshot(loaded)).toEqual(snapshot)
    expect(snapshot).toMatchObject({ produced: { copperCable: 4 }, consumed: { copperPlate: 2 }, configuredMachines: 0 })
    expect(loaded.analytics.machines).toEqual({})
  })
  it('preserves an almost mature bottleneck timer instead of restarting it', () => {
    const world = setup(); advanceWorld(world, 4050); advanceWorld(world, 9950)
    const loaded = restore(world)
    expect(analyticsSnapshot(loaded).problems).toEqual([])
    advanceWorld(world, 50); advanceWorld(loaded, 50)
    expect(analyticsSnapshot(loaded).problems).toEqual(analyticsSnapshot(world).problems)
    expect(analyticsSnapshot(loaded).problems[0]).toMatchObject({ cause: 'Output Blocked', durationMs: 10000 })
  })
  it('starts legacy analytics at the load boundary without inventing historical production', () => {
    const world = setup(); advanceWorld(world, 1050)
    const legacy = document(world)
    Object.assign(legacy, { version: 3 }); Reflect.deleteProperty(legacy.game, 'personality'); Reflect.deleteProperty(legacy.game, 'water'); Reflect.deleteProperty(legacy.game, 'analytics'); Reflect.deleteProperty(legacy.game, 'research'); Reflect.deleteProperty(legacy.game, 'peace'); Reflect.deleteProperty(legacy.game, 'nature'); Reflect.deleteProperty(legacy.game, 'revenge')
    const loaded = decodeSave(JSON.stringify(legacy)).world
    expect(loaded.analytics).toEqual(createAnalytics(1050))
    expect(loaded.produced).toEqual(world.produced)
    expect(loaded.buildings).toEqual(world.buildings)
    advanceWorld(loaded, 1000)
    expect(analyticsSnapshot(loaded)).toMatchObject({ produced: { copperCable: 2 }, consumed: { copperPlate: 1 } }) // second job commits, first job input predates analytics
  })
  it('keeps legacy locked Auto stock and jobs, but requires a manual choice for undecided legacy assemblers', () => {
    const world = setup(); advanceWorld(world, 1050)
    const legacy = document(world), machine = legacy.game.buildings[820] as Assembler
    machine.recipeMode = 'auto'
    Object.assign(legacy, { version: 3 }); Reflect.deleteProperty(legacy.game, 'personality'); Reflect.deleteProperty(legacy.game, 'water'); Reflect.deleteProperty(legacy.game, 'analytics'); Reflect.deleteProperty(legacy.game, 'research'); Reflect.deleteProperty(legacy.game, 'peace'); Reflect.deleteProperty(legacy.game, 'nature'); Reflect.deleteProperty(legacy.game, 'revenge')
    const loaded = decodeSave(JSON.stringify(legacy)).world
    expect((loaded.buildings[820] as Assembler).job).toEqual(machine.job)
    advanceWorld(loaded, 1000)
    expect(loaded.produced.copperCable).toBe(2)
    machine.job = null; machine.recipeLocked = false; machine.recipeId = 'ironGear'; machine.autoWaitElapsedMs = 500
    machine.input.copperPlate = 1
    const undecided = decodeSave(JSON.stringify(legacy)).world
    expect(undecided.buildings[820]).toMatchObject({ recipeId: null, recipeLocked: false, input: { copperPlate: 1 } })
    advanceWorld(undecided, 5000)
    expect((undecided.buildings[820] as Assembler).job).toBeNull()
    expect(changeCraftingRecipe(undecided, 20, 20, 'ironGear')).toContain('incompatible')
    expect(changeCraftingRecipe(undecided, 20, 20, 'copperCable')).toBeNull()
  })
  it.each([
    ['future sample', (d: SaveDocument) => { d.game.analytics.samples[0].timeMs = d.game.timeMs + 50 }],
    ['duplicate sample', (d: SaveDocument) => { d.game.analytics.samples.push(d.game.analytics.samples[0]) }],
    ['negative count', (d: SaveDocument) => { d.game.analytics.samples[0].produced.copperCable = -1 }],
    ['fractional count', (d: SaveDocument) => { d.game.analytics.samples[0].consumed.copperPlate = .5 }],
    ['unknown analytics field', (d: SaveDocument) => { Object.assign(d.game.analytics, { cache: true }) }],
    ['stale machine reference', (d: SaveDocument) => { d.game.buildings[820] = null }],
    ['wrong task', (d: SaveDocument) => { d.game.analytics.machines[820].task = 'ironGear' }],
    ['invalid productive time', (d: SaveDocument) => { d.game.analytics.machines[820].productiveMs = 50000 }],
    ['inconsistent cause timer', (d: SaveDocument) => { d.game.analytics.machines[820].sinceMs = 0 }],
    ['inconsistent bucket', (d: SaveDocument) => { d.game.analytics.buckets[0].consumed.copperPlate = 0 }],
    ['future history', (d: SaveDocument) => { d.game.analytics.buckets[0].startMs = 60000 }],
    ['future recency', (d: SaveDocument) => { d.game.analytics.lastProducedAt.iron = 50000 }],
  ] as const)('rejects %s without touching the live world', (_name, mutate) => {
    const world = setup(); advanceWorld(world, 1050)
    const before = document(world), invalid = structuredClone(before)
    mutate(invalid)
    expect(() => decodeSave(JSON.stringify(invalid))).toThrow('Invalid save')
    expect(document(world)).toEqual(before)
  })
})
