import { describe, expect, it } from 'vitest'
import { FramePacer } from './framePacing'
import type { GraphicsMode } from './framePacing'
import { createWorld, placeBuilding } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { encodeSave } from '../persistence/saveGame'
import { waterLife } from './landscapeWater'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function run(mode: (time: number) => GraphicsMode, hz = 120) {
  const pacer = new FramePacer(), world = createWorld(() => .5, { nature: false, water: false })
  placeBuilding(world, 18, 20, 'generator', 'east'); placeBuilding(world, 19, 20, 'powerPole', 'east')
  placeBuilding(world, 20, 20, 'miner', 'east'); placeBuilding(world, 21, 20, 'belt', 'east'); placeBuilding(world, 22, 20, 'storage', 'east')
  let frames = 0
  for (let n = 0; n <= hz * 10; n++) {
    const time = n * 1000 / hz, delta = pacer.frame(time, mode(time))
    if (delta !== null) { advanceWorld(world, delta); frames++ }
  }
  return { world, frames }
}
describe('complete-frame pacing', () => {
  it.each([60, 120, 144, 240])('caps normal %s Hz scheduling without deadline drift', hz => {
    expect(run(() => 'standard', hz).frames).toBe(601)
    expect(run(() => 'energy-saving', hz).frames).toBe(301)
  })
  it('preserves fixed ticks, production, NPCs, research, save state and simulation-clock animation across modes', () => {
    const normal = run(() => 'standard'), saving = run(() => 'energy-saving'), switching = run(time => time < 4000 ? 'standard' : 'energy-saving')
    for (const result of [normal, saving, switching]) {
      expect(result.world.timeMs).toBe(10000)
      expect(result.world.mined.iron).toBeGreaterThan(0)
      expect(result.world.remainder).toBeCloseTo(0)
      result.world.remainder = 0
      expect(encodeSave(result.world, view, '2026-10-21T00:00:00.000Z')).toBe(encodeSave(normal.world, view, '2026-10-21T00:00:00.000Z'))
      expect(waterLife([1, 2, 3], [2], result.world.timeMs)).toEqual(waterLife([1, 2, 3], [2], normal.world.timeMs))
    }
  })
  it('keeps actual elapsed time through irregular callbacks and skips missed frames without bursts', () => {
    const p = new FramePacer()
    expect(p.frame(0, 'energy-saving')).toBe(0)
    expect(p.frame(11, 'energy-saving')).toBeNull()
    expect(p.frame(36, 'energy-saving')).toBe(36)
    expect(p.frame(72, 'energy-saving')).toBe(36)
    expect(p.frame(72, 'energy-saving')).toBeNull()
    expect(p.frame(100, 'energy-saving')).toBe(28)
    expect(p.frame(10000, 'energy-saving')).toBe(250)
    expect(p.frame(10001, 'energy-saving')).toBeNull()
  })
  it('discards hidden time and resumes at zero delta without losing an existing fixed-step remainder', () => {
    const p = new FramePacer(), w = createWorld(() => .5)
    p.frame(0, 'standard'); advanceWorld(w, p.frame(20, 'standard')!)
    expect(w.remainder).toBe(20)
    expect(p.frame(3000, 'standard', true)).toBeNull()
    expect(p.frame(60000, 'standard')).toBe(0)
    expect(w.timeMs).toBe(0)
    advanceWorld(w, p.frame(60034, 'standard')!)
    expect(w.timeMs).toBe(50); expect(w.remainder).toBe(4)
    p.reset(); expect(p.frame(90000, 'standard')).toBe(0)
  })
})
