import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { createBareWorld } from '../simulation/testFixtures'
import { planRowboat } from '../simulation/rowboat'
import { drawRowboat } from './rowboatVisuals'
function fixture() {
  const w = createBareWorld(() => .5)
  for (let x = 11; x < 18; x++) w.water[10 * 40 + x] = true
  w.peace.boat = planRowboat(w, { kind: 'fishingDock', x: 10, y: 10, direction: 'east' })!
  w.peace.activity = 'boating'; w.peace.sinceMs = 0
  return w
}
function graphics() {
  const calls: { method: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push({ method: String(name), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
it.each(['boarding', 'rowing', 'landing'] as const)('draws a bounded cozy boat and visible Pete during %s without gameplay writes', phase => {
  const w = fixture(), { g, calls } = graphics()
  w.peace.boat!.phase = phase; w.timeMs = phase === 'boarding' ? 1350 : phase === 'landing' ? 150 : 500
  const before = structuredClone(w)
  drawRowboat(g, w, 32)
  expect(calls.some(c => c.method === 'fillEllipse')).toBe(true)
  expect(calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x91dd60)).toBe(true)
  expect(calls.filter(c => c.method === 'save')).toHaveLength(1)
  expect(calls.filter(c => c.method === 'restore')).toHaveLength(1)
  expect(w).toEqual(before)
  const first = structuredClone(calls)
  calls.length = 0; drawRowboat(g, w, 32)
  expect(calls).toEqual(first)
})
it('animates only with simulation time and clears naturally on culling or world replacement', () => {
  const w = fixture(), { g, calls } = graphics()
  w.peace.boat!.phase = 'rowing'
  drawRowboat(g, w, 32)
  const first = structuredClone(calls)
  w.timeMs += 500; calls.length = 0; drawRowboat(g, w, 32)
  expect(calls).not.toEqual(first)
  calls.length = 0
  drawRowboat(g, w, 32, { x: 2000, y: 2000, width: 100, height: 100 })
  expect(calls).toHaveLength(0)
  drawRowboat(g, createBareWorld(() => .5), 32)
  expect(calls).toHaveLength(0)
})
