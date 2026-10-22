import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawBird } from './poultryVisuals'
import type { Bird } from '../simulation/poultry'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
describe('chicken and chick procedural visuals', () => {
  const adult: Bird = { id: 0, kind: 'adult', mode: 'walking', tile: 820, next: 821, travelMs: 450, untilMs: 0, facing: 'east' }
  it('renders adults with a red comb and chicks smaller and yellow, without mutating actors', () => {
    const { g, calls } = graphics(), before = structuredClone(adult)
    drawBird(g, adult, 1000, 32)
    expect(calls).toContainEqual(['fillStyle', [0xc87558]])
    expect(calls).toContainEqual(['scaleCanvas', [1, 1]])
    calls.length = 0
    drawBird(g, { ...adult, id: 3, kind: 'chick', travelMs: 325 }, 1000, 32)
    expect(calls).toContainEqual(['scaleCanvas', [.6, .6]])
    expect(calls).toContainEqual(['fillStyle', [0xf2d16b]])
    expect(calls).not.toContainEqual(['fillStyle', [0xc87558]])
    expect(adult).toEqual(before)
  })
  it('uses simulation movement for interpolation and hides birds inside', () => {
    const { g, calls } = graphics()
    drawBird(g, { ...adult, tile: null, next: null, mode: 'inside', travelMs: 0 }, 1000, 32)
    expect(calls).toEqual([])
    drawBird(g, adult, 1000, 32); const first = [...calls]
    calls.length = 0; drawBird(g, adult, 1000, 32); expect(calls).toEqual(first)
    calls.length = 0; drawBird(g, { ...adult, travelMs: 850 }, 1000, 32); expect(calls).not.toEqual(first)
  })
})
