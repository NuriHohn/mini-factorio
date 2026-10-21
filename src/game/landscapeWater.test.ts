import { describe, expect, it } from 'vitest'
import { waterLife } from './landscapeWater'
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
  it('uses water-only sites and no simulation entities or random state', () => {
    const w = createBareWorld(() => .5)
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) w.water[y * 40 + x] = true
    const before = structuredClone(w), sites = w.water.flatMap((v, i) => v ? [i] : []), deep = [4 * 40 + 4]
    for (let t = 0; t < 50000; t += 500) for (const e of waterLife(sites, deep, t)) expect(isWater(w, e.tile % 40, Math.floor(e.tile / 40))).toBe(true)
    expect(w).toEqual(before)
    expect(waterLife(sites, [], 0).every(e => e.kind === 'bubbles')).toBe(true)
  })
})
