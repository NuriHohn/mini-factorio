import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawAnnexWalkway, drawDevelopment, drawDevelopmentActivity } from './developmentVisuals'
import { DEVELOPMENT_KINDS } from '../simulation/peteDevelopments'
import { createBareWorld } from '../simulation/testFixtures'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_t, n) => (...a: unknown[]) => { calls.push([String(n), a]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
it('separates foundation, frame and finished structures and removes the parked bicycle during a ride', () => {
  const { g, calls } = graphics()
  for (const kind of DEVELOPMENT_KINDS) {
    const phases = [.1, .3, 1].map(p => { calls.length = 0; drawDevelopment(g, kind, 20, 20, 32, 1000, p); return JSON.stringify(calls) })
    expect(new Set(phases).size).toBe(3)
  }
  calls.length = 0; drawDevelopment(g, 'bicycle', 20, 20, 32, 1000, 1, 0, false, false)
  expect(calls.some(([n]) => n === 'strokeCircle')).toBe(false)
})
it('draws elevated planks and rails only for the attached home, without changing navigation or state', () => {
  const w = createBareWorld(() => .5), { g, calls } = graphics(); w.peace.home = 820
  w.buildings[820] = { kind: 'treehouse', x: 20, y: 20, placedAtMs: 0 }
  w.houseProject = { kind: 'house', home: 820, tiles: [823], spots: [783], direction: 'east', phase: 'complete', built: 1, elapsedMs: 0, carried: 0, crate: null }
  const before = structuredClone(w)
  drawAnnexWalkway(g, w, 32); expect(calls.length).toBeGreaterThan(12); expect(w).toEqual(before)
  calls.length = 0; w.peace.home = null; drawAnnexWalkway(g, w, 32); expect(calls).toEqual([])
})
it('renders bounded work progress from the simulation clock without awarding XP', () => {
  const w = createBareWorld(() => .5), { g, calls } = graphics()
  Object.assign(w.peace, { activity: 'developmentWork', sinceMs: 1000, untilMs: 7000 }); w.timeMs = 4000
  const before = structuredClone(w); drawDevelopmentActivity(g, w, 32)
  expect(calls.some(([n, args]) => n === 'lineStyle' && args[1] === 0xc4d889)).toBe(true); expect(w).toEqual(before)
})
