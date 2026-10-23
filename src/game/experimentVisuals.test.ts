import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawExperimentTable, drawExperimentActivity } from './experimentVisuals'
import { createBareWorld } from '../simulation/testFixtures'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_t, n) => (...a: unknown[]) => { calls.push([String(n), a]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
it('stages legs, tabletop, copper coil and glass bulb', () => {
  const { g, calls } = graphics(), shop = { kind: 'peteExperiment' as const, x: 10, y: 10 }, counts: number[] = []
  for (const p of [.1, .4, .7, 1]) { calls.length = 0; drawExperimentTable(g, shop, 32, p); counts.push(calls.length) }
  expect(counts[1]).toBeGreaterThan(counts[0]); expect(counts[2]).toBeGreaterThan(counts[1]); expect(counts[3]).toBeGreaterThan(counts[2])
})
it('culls experiments, freezes its pose on pause and never writes simulation state', () => {
  const w = createBareWorld(() => .5), { g, calls } = graphics()
  w.experimentProject = { kind: 'experiment', home: 820, tiles: [700], spots: [740], direction: 'east', phase: 'complete', built: 1, elapsedMs: 0, carried: 0, carriedCopper: 0, carriedGears: 0, crate: null, readyAtMs: 0 }
  w.peace.activity = 'experimenting'; Object.assign(w.pete, { x: 20, y: 18 })
  const before = structuredClone(w)
  drawExperimentActivity(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 }); expect(calls).toEqual([])
  drawExperimentActivity(g, w, 32); const pose = [...calls]
  calls.length = 0; drawExperimentActivity(g, w, 32); expect(calls).toEqual(pose); expect(w).toEqual(before)
  calls.length = 0; w.timeMs += 200; drawExperimentActivity(g, w, 32); expect(calls).not.toEqual(pose)
})
