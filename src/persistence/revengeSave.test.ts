import { createBareWorld as createWorld } from '../simulation/testFixtures'
import { emptyInventory } from '../simulation/items'
import { describe, expect, it } from 'vitest'
import { placeBuilding } from '../simulation/world'
import type { CraftingMachine, World } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { attackWalker, createRevenge, damageWalker, recordArrest } from '../simulation/revenge'
import { createResearch, SPRINT11_TECHNOLOGIES } from '../simulation/research'
import { decodeSave, encodeSave } from './saveGame'
import type { SaveDocument } from './saveGame'
const view = { scrollX: 12, scrollY: 34, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const snapshot = (world: World): SaveDocument => JSON.parse(encodeSave(world, view, '2026-10-20T12:00:00.000Z'))
function setup(stage: 'warning' | 'hunting' | 'stomp' | 'phase2' | 'defeating' | 'stunned') {
  const world = createWorld(() => .5)
  for (let i = 0; i < 3; i++) recordArrest(world)
  if (stage === 'warning') { advanceWorld(world, 1250); return world }
  advanceWorld(world, 5000)
  if (['stomp', 'phase2'].includes(stage)) damageWalker(world, 50)
  if (stage === 'phase2') advanceWorld(world, 1500)
  if (['defeating', 'stunned'].includes(stage)) damageWalker(world, 100)
  if (stage === 'stunned') advanceWorld(world, 2000)
  return world
}
describe('Revenge versioned persistence', () => {
  it.each(['warning', 'hunting', 'stomp', 'phase2', 'defeating', 'stunned'] as const)('resumes %s exactly without duplicated attacks, threshold changes or ejections', stage => {
    const world = setup(stage)
    if (stage === 'hunting') attackWalker(world, 'flySwatter', { x: 15, y: 15 })
    advanceWorld(world, 137.5)
    const before = snapshot(world), loaded = decodeSave(JSON.stringify(before)).world
    expect(snapshot(loaded)).toEqual(before)
    for (const delta of [12.5, 50, 500, 950, 2000, 4950, 50]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(snapshot(loaded)).toEqual(snapshot(world))
    }
  })
  it.each([false, true])('persists moving or EMP-attacking walkers (EMP=%s) without replaying the impact', emp => {
    const world = setup('hunting'), boss = world.revenge.boss!
    if (emp) Object.assign(boss, { x: 4, y: 0, tile: 4, empAtMs: world.timeMs + 50 })
    placeBuilding(world, 10, 0, 'furnace', 'east')
    placeBuilding(world, 10, 1, 'powerPole', 'east'); placeBuilding(world, 11, 1, 'generator', 'east')
    const furnace = world.buildings[10] as CraftingMachine
    Object.assign(furnace, { recipeMode: 'ironSmelting', recipeLocked: true, recipeId: 'ironSmelting', job: { recipeId: 'ironSmelting', elapsedMs: 0, inputs: { ...emptyInventory(), iron: 1 }, outputs: { ...emptyInventory(), ironPlate: 1 } } })
    advanceWorld(world, emp ? 50 : 1000)
    if (emp) expect(world.revenge.blast?.position).toEqual({ x: 10, y: 0 })
    else expect(boss.travelMs).toBeGreaterThan(0)
    const loaded = decodeSave(JSON.stringify(snapshot(world))).world
    for (const delta of [50, 500, 1000, 5000]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(snapshot(loaded)).toEqual(snapshot(world))
    }
  })
  it('migrates a legacy 1500-ms traversal without changing coordinates or Revenge progress', () => {
    const w = setup('hunting'), legacy = snapshot(w), boss = legacy.game.revenge.boss!
    Object.assign(boss, { next: 1, travelMs: 1450, x: 1450 / 1500 })
    Reflect.deleteProperty(boss, 'targetInactiveMs')
    const loaded = decodeSave(JSON.stringify(legacy)).world
    expect(loaded.revenge.boss).toMatchObject({ x: boss.x, y: boss.y, travelMs: 725, targetInactiveMs: 0 })
    expect(loaded.revenge.arrests).toBe(w.revenge.arrests)
    const again = decodeSave(encodeSave(loaded, view)).world
    advanceWorld(loaded, 50); advanceWorld(again, 50)
    expect(again.revenge).toEqual(loaded.revenge)
    expect(loaded.revenge.boss).toMatchObject({ tile: 1, travelMs: 0 })
  })
  it.each([1, 2, 3, 4, 5])('migrates version %i with zero progress, threshold 3 and locked Revenge research', version => {
    const world = createWorld(() => .5)
    world.research = createResearch(true)
    world.research.balanceUnits = '1234567890123'
    const legacy = snapshot(world)
    Object.assign(legacy, { version }); Reflect.deleteProperty(legacy.game, 'personality'); Reflect.deleteProperty(legacy.game, 'water'); Reflect.deleteProperty(legacy.game, 'peace'); Reflect.deleteProperty(legacy.game, 'nature'); Reflect.deleteProperty(legacy.game, 'revenge')
    if (version < 5) Reflect.deleteProperty(legacy.game, 'research')
    if (version < 4) Reflect.deleteProperty(legacy.game, 'analytics')
    if (version < 3) {
      Reflect.deleteProperty(legacy.game, 'webs'); Reflect.deleteProperty(legacy.game.pete, 'trappedBy'); Reflect.deleteProperty(legacy.game.pete, 'ignoredWebs')
    }
    if (version === 1) Reflect.deleteProperty(legacy.game.pete, 'water')
    const loaded = decodeSave(JSON.stringify(legacy)).world
    expect(loaded.revenge).toEqual(createRevenge())
    expect(loaded.research.unlocked).toEqual(SPRINT11_TECHNOLOGIES)
    expect(loaded.research.balanceUnits).toBe(version === 5 ? '1234567890123' : '0')
    expect(loaded.buildings).toEqual(world.buildings)
    expect(loaded.analytics).toEqual(world.analytics)
    expect(loaded.pete).toEqual(world.pete)
  })
  it('preserves a version-5 player’s partial research exactly instead of granting other technologies', () => {
    const world = createWorld(() => .5)
    world.research.unlocked.push('automation1'); world.research.balanceUnits = '901'
    const legacy = snapshot(world); Object.assign(legacy, { version: 5 }); Reflect.deleteProperty(legacy.game, 'personality'); Reflect.deleteProperty(legacy.game, 'water'); Reflect.deleteProperty(legacy.game, 'peace'); Reflect.deleteProperty(legacy.game, 'nature'); Reflect.deleteProperty(legacy.game, 'revenge')
    expect(decodeSave(JSON.stringify(legacy)).world.research).toEqual(world.research)
  })
  it.each([
    ['missing encounter', (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'revenge') }],
    ['even threshold', (d: SaveDocument) => { d.game.revenge.threshold = 4 }],
    ['negative progress', (d: SaveDocument) => { d.game.revenge.arrests = -1 }],
    ['duplicate progress', (d: SaveDocument) => { d.game.revenge.arrests++ }],
    ['missing boss', (d: SaveDocument) => { d.game.revenge.boss = null }],
    ['invalid HP', (d: SaveDocument) => { d.game.revenge.boss!.hp = 101 }],
    ['zero HP active boss', (d: SaveDocument) => { d.game.revenge.boss!.hp = 0 }],
    ['wrong phase', (d: SaveDocument) => { d.game.revenge.boss!.phase = 2 }],
    ['repeated stomp', (d: SaveDocument) => { d.game.revenge.boss!.stomped = true }],
    ['invalid position', (d: SaveDocument) => { d.game.revenge.boss!.x += 1 }],
    ['nonadjacent movement', (d: SaveDocument) => { d.game.revenge.boss!.next = 1000 }],
    ['negative target inactivity', (d: SaveDocument) => { d.game.revenge.boss!.targetInactiveMs = -50 }],
    ['fractional target inactivity', (d: SaveDocument) => { d.game.revenge.boss!.targetInactiveMs = 1 }],
    ['targetless inactivity', (d: SaveDocument) => { d.game.revenge.boss!.targetInactiveMs = 50 }],
    ['bad target', (d: SaveDocument) => { d.game.revenge.boss!.target = 1600 }],
    ['autonomous pilot', (d: SaveDocument) => { d.game.pete.escape = 100 }],
    ['blast during warning', (d: SaveDocument) => { d.game.revenge.stage = 'warning'; d.game.revenge.boss = null; d.game.revenge.untilMs = d.game.timeMs + 5000; d.game.revenge.blast = { kind: 'emp', position: { x: 0, y: 0 }, atMs: d.game.timeMs } }],
    ['unknown state', (d: SaveDocument) => { Object.assign(d.game.revenge, { stage: 'angry' }) }],
    ['hidden fields', (d: SaveDocument) => { Object.assign(d.game.revenge.boss!, { weapon: 'laser' }) }],
    ['future EMP', (d: SaveDocument) => { d.game.revenge.boss!.empAtMs = d.game.timeMs + 8050 }],
    ['fractional cooldown boundary', (d: SaveDocument) => { d.game.revenge.playerCooldownMs = 1000; d.game.revenge.playerReadyAtMs = d.game.timeMs + 1 }],
    ['invented cooldown', (d: SaveDocument) => { d.game.revenge.playerCooldownMs = 700 }],
    ['missing research prerequisite', (d: SaveDocument) => { d.game.research.unlocked.push('revengeDefense2') }],
    ['new technologies in old schema', (d: SaveDocument) => { Object.assign(d, { version: 5 }); Reflect.deleteProperty(d.game, 'personality'); Reflect.deleteProperty(d.game, 'water'); Reflect.deleteProperty(d.game, 'revenge'); d.game.research.unlocked.push('revengeDefense1') }],
  ] as const)('rejects %s without altering a live encounter', (_name, mutate) => {
    const world = setup('hunting'), before = snapshot(world), bad = structuredClone(before)
    mutate(bad)
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    expect(snapshot(world)).toEqual(before)
  })
})
