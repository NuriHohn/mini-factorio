import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { arrestStage, arrestVisual } from './arrestVisuals'
import { drawPoliceEffects } from './policeVisuals'
import { createWorld, placeBuilding } from '../simulation/world'
import { ARREST_MS, LEGACY_ARREST_MS, arrestBoardingProgress } from '../simulation/police'
import { advanceWorld } from '../simulation/step'
import { damageWalker, recordArrest } from '../simulation/revenge'
import { decodeSave, encodeSave, SAVE_VERSION } from '../persistence/saveGame'

function arrest(ordinal: number, elapsed = 0, threshold = 9, legacy = false) {
  const world = createWorld(() => .5)
  world.timeMs = 1000 + elapsed
  world.revenge.threshold = threshold; world.revenge.arrests = ordinal - 1
  placeBuilding(world, 0, 1, 'prison', 'east')
  const prison = world.buildings[40]!
  if (prison.kind !== 'prison') throw Error('fixture')
  world.police.car = { x: 18, y: 23, tile: 938, next: null, travelMs: 0, path: [], pathRevision: -1, target: 937, phase: 'ARRESTING', arrestElapsedMs: elapsed, arrestStartedAtMs: 1000, ...(legacy ? {} : { arrestDurationMs: ARREST_MS }), arrestFrom: { x: 17.5, y: 23 }, prison }
  Object.assign(world.pete, { mode: 'ARRESTED', prison, x: 17.5 + .5 * arrestBoardingProgress(world.police.car), y: 23, next: null, travelMs: 0 })
  return world
}
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const save = (world: ReturnType<typeof createWorld>) => encodeSave(world, view, '2026-10-21T00:00:00.000Z')
function graphics() {
  const calls: { name: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, key) => (...args: unknown[]) => { calls.push({ name: String(key), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
describe('gentle cycle-based arrest scenes', () => {
  it('holds the first arrest without restraints, then eases Pete into the visible passenger seat', () => {
    const world = arrest(1, 1500), { g, calls } = graphics(), before = structuredClone(world)
    expect(arrestVisual(world)).toMatchObject({ stage: 1, active: false, caption: 'This way, Pete.', boarding: 0, wobble: 0 })
    drawPoliceEffects(g, world, 32)
    expect(calls.some(c => c.name === 'strokeCircle')).toBe(false)
    expect(world).toEqual(before)
    advanceWorld(world, 1600)
    expect(arrestVisual(world)).toMatchObject({ phase: 'boarding', boarding: .5, passenger: false })
    expect(world.pete.x).toBe(17.75)
    advanceWorld(world, 250); drawPoliceEffects(g, world, 32)
    expect(arrestVisual(world)!.passenger).toBe(true)
    expect(calls.some(c => c.name === 'fillCircle' && c.args[2] === 5.5)).toBe(true)
  })
  it.each([[0, 'arrival'], [500, 'reaction'], [1200, 'restraints'], [2800, 'boarding']] as const)('shows a readable %s ms / %s phase', (elapsed, phase) => {
    expect(arrestVisual(arrest(2, elapsed))).toMatchObject({ phase })
  })
  it('shows oversized cuffs with a gentle fade and CLICK for the second arrest', () => {
    const world = arrest(2, 1600), before = structuredClone(world), { g, calls } = graphics()
    expect(arrestVisual(world)).toMatchObject({ stage: 2, active: true, alpha: 1, rope: false, caption: 'CLICK!', pete: { x: 17.5, y: 23 } })
    drawPoliceEffects(g, world, 32)
    expect(calls.filter(c => c.name === 'strokeCircle' && c.args[2] === 9)).toHaveLength(2)
    expect(world).toEqual(before)
    expect(arrestVisual(arrest(2, 1300))!.alpha).toBeCloseTo(.4)
    expect(arrestVisual(arrest(2, 3300))!.alpha).toBeCloseTo(.25)
  })
  it.each([3, 4, 5, 7])('caps arrest #%i at cuffs followed by rope and a one-pixel wobble', ordinal => {
    const world = arrest(ordinal, 1600)
    expect(arrestVisual(world)).toMatchObject({ stage: 3, caption: 'CLICK!', rope: false })
    advanceWorld(world, 600)
    expect(arrestVisual(world)).toMatchObject({ stage: 3, caption: 'CLICK! ZURR!', rope: true })
    const { g, calls } = graphics(), before = structuredClone(world)
    expect(Math.abs(arrestVisual(world)!.wobble)).toBeLessThanOrEqual(1)
    expect(arrestVisual(world)!.wobble).not.toBe(0)
    drawPoliceEffects(g, world, 32)
    expect(calls.filter(c => c.name === 'strokeEllipse' && c.args[2] === 34)).toHaveLength(6)
    expect(world).toEqual(before)
  })
  it('resets after boss defeat and respects higher Revenge thresholds', () => {
    const world = createWorld(() => .5)
    for (let i = 0; i < 3; i++) recordArrest(world)
    advanceWorld(world, 5000); damageWalker(world, 100); advanceWorld(world, 7000)
    expect(world.revenge).toMatchObject({ arrests: 0, threshold: 5, stage: 'idle' })
    expect(arrestStage(world)).toBe(1)
    for (const threshold of [5, 7, 9]) {
      expect(arrestStage(arrest(1, 100, threshold))).toBe(1)
      expect(arrestStage(arrest(4, 100, threshold))).toBe(3)
    }
  })
  it('uses 3.4 seconds at every stage, counts once, then follows the same transport route and prison timing', () => {
    const worlds = [1, 2, 3, 4].map(n => arrest(n))
    for (const world of worlds) advanceWorld(world, ARREST_MS - 50)
    for (const world of worlds) expect(world.police.car!.phase).toBe('ARRESTING')
    for (const world of worlds) advanceWorld(world, 50)
    worlds.forEach((world, i) => {
      expect(world.revenge.arrests).toBe(i + 1)
      expect(world.police.car!.phase).toBe('TRANSPORTING')
      expect(world.police.car!.arrestElapsedMs).toBe(ARREST_MS)
      expect(arrestVisual(world)).toMatchObject({ active: false, phase: 'transport', passenger: true })
      expect(world.pete).toEqual(worlds[0].pete); expect(world.police).toEqual(worlds[0].police)
    })
    for (const world of worlds) advanceWorld(world, 30000)
    for (const world of worlds) {
      expect(world.pete.mode).toBe('IMPRISONED')
      expect(world.pete.imprisonedAtMs).toBe(worlds[0].pete.imprisonedAtMs)
    }
  })
  it.each([0, 500, 1200, 1600, 2000, 2800, 3100, 3350, 3400, 4000])('restores at %ims without replay or timer reset', elapsed => {
    const world = arrest(3)
    advanceWorld(world, elapsed)
    const loaded = decodeSave(save(world)).world
    expect(SAVE_VERSION).toBe(40)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(world)))
    expect(arrestVisual(loaded)).toEqual(arrestVisual(world))
    for (const delta of [50, 200, 400, 500, 2500]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(arrestVisual(loaded)).toEqual(arrestVisual(world))
      expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(world)))
    }
  })
  it('keeps legacy 750ms pickups on their original clock, with or without 12.1 metadata', () => {
    for (const timestamp of [true, false]) {
      const world = arrest(2, 400, 9, true)
      if (!timestamp) delete world.police.car!.arrestStartedAtMs
      const loaded = decodeSave(save(world)).world
      advanceWorld(loaded, LEGACY_ARREST_MS - 400 - 50)
      expect(loaded.pete.mode).toBe('ARRESTED')
      advanceWorld(loaded, 50)
      expect(loaded.pete.mode).toBe('TRANSPORTED')
      expect(loaded.revenge.arrests).toBe(2)
      expect(arrestVisual(loaded)!.active).toBe(false)
      const inTransit = decodeSave(save(loaded)).world
      expect(arrestVisual(inTransit)).toMatchObject({ active: false, phase: 'transport', caption: null })
      advanceWorld(inTransit, 1000)
      expect(inTransit.revenge.arrests).toBe(2)
    }
  })
  it('rejects malformed duration/clock pairs without accepting a replayed transport', () => {
    const world = arrest(2, 1600)
    for (const duration of [-1, 750, 3450, '3400', null]) {
      const bad = JSON.parse(save(world)); bad.game.police.car.arrestDurationMs = duration
      expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    }
    for (const at of [-1, 1001, world.timeMs + 50, 1050, undefined]) {
      const bad = JSON.parse(save(world)); bad.game.police.car.arrestStartedAtMs = at
      expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    }
  })
  it('rejects a completed pickup still in the arresting phase and incomplete transport progress', () => {
    const completed = JSON.parse(save(arrest(2, 3350)))
    completed.game.timeMs += 50
    completed.game.police.car.arrestElapsedMs = ARREST_MS
    expect(() => decodeSave(JSON.stringify(completed))).toThrow('Invalid save')
    const world = arrest(2); advanceWorld(world, ARREST_MS)
    const transit = JSON.parse(save(world)); transit.game.police.car.arrestElapsedMs = 3350
    expect(() => decodeSave(JSON.stringify(transit))).toThrow('Invalid save')
  })
  it('keeps factory production, research and analytics advancing independently of the longer pickup', () => {
    const world = arrest(1)
    world.tiles[821] = 'iron'
    for (const [x, y, kind] of [[21, 19, 'powerPole'], [21, 18, 'generator'], [21, 20, 'miner'], [22, 20, 'belt'], [23, 20, 'storage']] as const) expect(placeBuilding(world, x, y, kind, 'east')).toBe(true)
    const legacy = structuredClone(world)
    delete legacy.police.car!.arrestDurationMs
    advanceWorld(world, ARREST_MS); advanceWorld(legacy, ARREST_MS)
    expect(world.mined.iron).toBeGreaterThan(0)
    expect(world.mined).toEqual(legacy.mined)
    expect(world.buildings).toEqual(legacy.buildings)
    expect(world.analytics).toEqual(legacy.analytics)
    expect(world.research).toEqual(legacy.research)
  })
  it('freezes when simulation does not advance and stays deterministic across frame partitions', () => {
    const a = arrest(3), b = structuredClone(a), before = structuredClone(a)
    const frozen = arrestVisual(a)
    for (let i = 0; i < 20; i++) expect(arrestVisual(a)).toEqual(frozen)
    expect(a).toEqual(before)
    advanceWorld(a, 4200)
    for (let i = 0; i < 42; i++) for (const delta of [17, 33, 50]) advanceWorld(b, delta)
    expect(b).toEqual(a)
  })
})
