import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { paintWater } from '../simulation/waterLandscaping'
import { LandscapeWater, waterLife } from './landscapeWater'
import { createBareWorld } from '../simulation/testFixtures'
import { isWater } from '../simulation/waterTerrain'
describe('lightweight cosmetic living water', () => {
  it('has bounded deterministic bubbles/fish/ripples with long quiet periods and pause-safe timing', () => {
    const sites = [82, 83, 84, 122, 123, 124], deep = [123]
    expect(waterLife([], [], 5000)).toEqual([])
    expect(waterLife(sites, deep, 10000)).toEqual([])
    let fish = 0, bubbles = 0, quiet = 0
    for (let t = 0; t <= 100000; t += 100) {
      const effects = waterLife(sites, deep, t)
      expect(effects.length).toBeLessThanOrEqual(3)
      expect(waterLife(sites, deep, t)).toEqual(effects)
      if (!effects.length) quiet++
      for (const e of effects) {
        expect(e.alpha).toBeGreaterThanOrEqual(0); expect(e.alpha).toBeLessThanOrEqual(.65)
        expect(e.t).toBeGreaterThanOrEqual(0); expect(e.t).toBeLessThan(1)
        if (e.kind === 'fish') { fish++; expect(deep).toContain(e.tile) } else bubbles++
      }
    }
    expect(fish).toBeGreaterThan(0); expect(bubbles).toBeGreaterThan(0); expect(quiet).toBeGreaterThan(600)
  })
  it('refreshes life sites after painting/removal and keeps tiny ponds quiet and observational', () => {
    const w = createBareWorld(() => .5), visuals = new LandscapeWater(), calls: string[] = []
    const graphics = new Proxy({}, { get: (_target, name) => () => { calls.push(String(name)); return graphics } }) as Phaser.GameObjects.Graphics
    const view = { x: 0, y: 0, width: 1280, height: 1280 }
    w.timeMs = 5000
    visuals.draw(graphics, w, view, 32); expect(calls).toEqual(['clear'])
    paintWater(w, { x: 5, y: 5 }, { x: 5, y: 5 }, 'water', 3)
    calls.length = 0; const before = structuredClone(w)
    visuals.draw(graphics, w, view, 32); expect(calls).toContain('strokeCircle'); expect(w).toEqual(before)
    paintWater(w, { x: 5, y: 5 }, { x: 5, y: 5 }, 'land', 3)
    calls.length = 0; visuals.draw(graphics, w, view, 32); expect(calls).toEqual(['clear'])
    for (let t = 0; t < 100000; t += 200) expect(waterLife([205], [], t).length).toBeLessThanOrEqual(1)
  })
  it('uses water-only sites and no simulation entities or random state', () => {
    const w = createBareWorld(() => .5)
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) w.water[y * 40 + x] = true
    const before = structuredClone(w), sites = w.water.flatMap((v, i) => v ? [i] : []), deep = [4 * 40 + 4]
    for (let t = 0; t < 50000; t += 500) for (const e of waterLife(sites, deep, t)) expect(isWater(w, e.tile % 40, Math.floor(e.tile / 40))).toBe(true)
    expect(w).toEqual(before)
    expect(waterLife(sites, [], 0).every(e => e.kind === 'bubbles')).toBe(true)
  })
})
