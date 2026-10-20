import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { arrestStage, arrestVisual, RESTRAINT_EFFECT_MS } from './arrestVisuals'
import { drawPoliceEffects } from './policeVisuals'
import { createWorld, placeBuilding } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { damageWalker, recordArrest } from '../simulation/revenge'
import { decodeSave, encodeSave, SAVE_VERSION } from '../persistence/saveGame'

function arrest(ordinal: number, elapsed = 0, threshold = 9) {
  const world = createWorld(() => .5)
  world.timeMs = 1000 + elapsed
  world.revenge.threshold = threshold; world.revenge.arrests = ordinal - 1
  placeBuilding(world, 0, 1, 'prison', 'east')
  const prison = world.buildings[40]!
  if (prison.kind !== 'prison') throw Error('fixture')
  Object.assign(world.pete, { mode: 'ARRESTED', prison, x: 17.5 + .5 * elapsed / 750, y: 23, next: null, travelMs: 0 })
  world.police.car = { x: 18, y: 23, tile: 938, next: null, travelMs: 0, path: [], pathRevision: -1, target: 937, phase: 'ARRESTING', arrestElapsedMs: elapsed, arrestStartedAtMs: 1000, arrestFrom: { x: 17.5, y: 23 }, prison }
  return world
}
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const save = (world: ReturnType<typeof createWorld>) => encodeSave(world, view, '2026-10-21T00:00:00.000Z')
function graphics() {
  const calls: { name: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, key) => (...args: unknown[]) => { calls.push({ name: String(key), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
describe('cycle-based arrest presentation', () => {
  it('keeps the first arrest unrestrained and draws Pete as a green car passenger', () => {
    const world = arrest(1, 400), { g, calls } = graphics()
    const before = structuredClone(world)
    expect(arrestVisual(world)).toMatchObject({ stage: 1, active: false, caption: null, wobble: 0 })
    drawPoliceEffects(g, world, 32)
    expect(calls.some(c => c.name === 'strokeCircle')).toBe(false)
    expect(world).toEqual(before)
    advanceWorld(world, 350); drawPoliceEffects(g, world, 32)
    expect(calls.some(c => c.name === 'fillCircle' && c.args[2] === 5.5)).toBe(true)
  })
  it('shows oversized cuffs/CLICK for arrest two and only pauses rendered pickup', () => {
    const world = arrest(2, 200), before = structuredClone(world), { g, calls } = graphics()
    expect(arrestVisual(world)).toMatchObject({ stage: 2, active: true, rope: false, caption: 'CLICK!', pete: { x: 17.5, y: 23 } })
    expect(world.pete.x).toBeGreaterThan(17.5)
    drawPoliceEffects(g, world, 32)
    expect(calls.filter(c => c.name === 'strokeCircle' && c.args[2] === 9)).toHaveLength(2)
    expect(world).toEqual(before)
  })
  it.each([3, 4, 5, 7])('caps arrest #%i at cuffs plus rope without repeating cuff-only pickup', ordinal => {
    const world = arrest(ordinal, 200)
    expect(arrestVisual(world)).toMatchObject({ stage: 3, caption: 'CLICK!', rope: false })
    advanceWorld(world, 200)
    expect(arrestVisual(world)).toMatchObject({ stage: 3, caption: 'CLICK! ZURR!', rope: true })
    advanceWorld(world, 250)
    const { g, calls } = graphics(), before = structuredClone(world)
    expect(arrestVisual(world)!.wobble).not.toBe(0)
    drawPoliceEffects(g, world, 32)
    expect(calls.filter(c => c.name === 'strokeEllipse' && c.args[2] === 34)).toHaveLength(6)
    expect(world).toEqual(before)
  })
  it('resets presentation from the existing boss-defeat counter at higher thresholds', () => {
    const world = createWorld(() => .5)
    for (let i = 0; i < 3; i++) recordArrest(world)
    advanceWorld(world, 5000); damageWalker(world, 100); advanceWorld(world, 7000)
    expect(world.revenge).toMatchObject({ arrests: 0, threshold: 5, stage: 'idle' })
    expect(arrestStage(world)).toBe(1)
    for (const threshold of [5, 7, 9]) {
      const first = arrest(1, 100, threshold), fourth = arrest(4, 100, threshold)
      expect(arrestStage(first)).toBe(1); expect(arrestStage(fourth)).toBe(3)
    }
  })
  it('keeps the 750ms arrest, once-only count, transport and prison timing identical across stages', () => {
    const worlds = [1, 2, 3, 4].map(n => arrest(n))
    advanceWorld(worlds[0], 700)
    for (const world of worlds.slice(1)) advanceWorld(world, 700)
    for (const world of worlds) expect(world.police.car!.phase).toBe('ARRESTING')
    for (const world of worlds) advanceWorld(world, 50)
    worlds.forEach((world, i) => {
      expect(world.revenge.arrests).toBe(i + 1)
      expect(world.police.car!.phase).toBe('TRANSPORTING')
      expect(world.police.car!.arrestElapsedMs).toBe(750)
      const baseline = worlds[0]
      expect(world.pete).toEqual(baseline.pete); expect(world.police).toEqual(baseline.police)
    })
    for (const world of worlds) advanceWorld(world, 30000)
    for (const world of worlds) {
      expect(world.pete.mode).toBe('IMPRISONED')
      expect(world.pete.imprisonedAtMs).toBe(worlds[0].pete.imprisonedAtMs)
    }
  })
  it.each([0, 200, 400, 650, 750, 850, 900])('restores at %ims without replay or timer reset', elapsed => {
    const world = arrest(3)
    advanceWorld(world, elapsed)
    const loaded = decodeSave(save(world)).world
    expect(SAVE_VERSION).toBe(6)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(world)))
    expect(arrestVisual(loaded)).toEqual(arrestVisual(world))
    for (const delta of [50, 200, 400, 500]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(arrestVisual(loaded)).toEqual(arrestVisual(world))
      expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(world)))
    }
  })
  it('ends overlays at 900ms and does not replay them on older in-transit saves', () => {
    const world = arrest(2)
    advanceWorld(world, RESTRAINT_EFFECT_MS - 50)
    expect(arrestVisual(world)!.active).toBe(true)
    advanceWorld(world, 50)
    expect(arrestVisual(world)!.active).toBe(false)
    const old = JSON.parse(save(world)); delete old.game.police.car.arrestStartedAtMs
    const loaded = decodeSave(JSON.stringify(old)).world
    expect(arrestVisual(loaded)!.active).toBe(false)
    expect(loaded.revenge).toEqual(world.revenge)
  })
  it('supports existing v6 mid-pickup files without a timestamp and rejects malformed new clocks', () => {
    const world = arrest(2, 400), old = JSON.parse(save(world))
    delete old.game.police.car.arrestStartedAtMs
    expect(arrestVisual(decodeSave(JSON.stringify(old)).world)).toMatchObject({ stage: 2, caption: 'CLICK!' })
    for (const at of [-1, 1001, world.timeMs + 50, 1050]) {
      const malformed = JSON.parse(save(world)); malformed.game.police.car.arrestStartedAtMs = at
      expect(() => decodeSave(JSON.stringify(malformed))).toThrow('Invalid save')
    }
  })
})
