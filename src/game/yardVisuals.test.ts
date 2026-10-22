import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawYardCorner, drawYardEntrance, yardCorner } from './yardVisuals'
import { yardBoundary } from '../simulation/yard'
import type { Yard } from '../simulation/yard'
import { createBareWorld } from '../simulation/testFixtures'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
function yard(): Yard {
  const bounds = { left: 10, right: 14, top: 10, bottom: 14 }, entrance = 412, tiles = yardBoundary(bounds).filter(i => i !== entrance)
  return { kind: 'yard', ...bounds, entrance, home: 492, reused: [], direction: 'east', tiles, spots: [], phase: 'complete', built: tiles.length, carried: 0, elapsedMs: 0, crate: null }
}
describe('yard fence joins and reserved entrance', () => {
  it('draws gradual joined corner rails instead of a straight fence crossing', () => {
    const y = yard(), { g, calls } = graphics()
    expect(yardCorner(y, 410)).toBe(true); expect(yardCorner(y, 411)).toBe(false)
    drawYardCorner(g, { kind: 'peteFence', x: 10, y: 10, direction: 'east' }, y, 32, .2)
    expect(calls.some(c => c[0] === 'lineBetween')).toBe(false)
    calls.length = 0; drawYardCorner(g, { kind: 'peteFence', x: 10, y: 10, direction: 'east' }, y, 32)
    const rails = calls.filter(c => c[0] === 'lineBetween'); expect(rails).toHaveLength(4)
    expect(rails.every(([, args]) => Number(args[2]) >= Number(args[0]) && Number(args[3]) >= Number(args[1]))).toBe(true)
  })
  it('shows a visibly open entrance with two posts, culls it and does not mutate gameplay', () => {
    const w = createBareWorld(() => .5); w.yard = yard(); const before = structuredClone(w), { g, calls } = graphics()
    drawYardEntrance(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 }); expect(calls).toEqual([])
    drawYardEntrance(g, w, 32); expect(calls.filter(c => c[0] === 'fillTriangle')).toHaveLength(2)
    expect(calls.some(c => c[0] === 'lineBetween')).toBe(false); expect(w).toEqual(before)
    calls.length = 0; w.water[w.yard.entrance] = true; drawYardEntrance(g, w, 32); expect(calls).toEqual([])
  })
})
