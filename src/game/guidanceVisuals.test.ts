import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawGuidance } from './guidanceVisuals'
import { createBareWorld } from '../simulation/testFixtures'
it('renders the actual route and destination read-only and removes the overlay when dismissed', () => {
  const w = createBareWorld(() => .5), calls: string[] = []
  const g = new Proxy({}, { get: (_t, name) => () => { calls.push(String(name)); return g } }) as Phaser.GameObjects.Graphics
  w.peace.home = 820; w.peace.destination = 782
  Object.assign(w.pete, { tile: 780, next: 781, path: [782], pathRevision: w.topologyRevision })
  const before = structuredClone(w); drawGuidance(g, w, 32, true, null, false)
  expect(calls.filter(n => n === 'lineBetween')).toHaveLength(2); expect(calls).toContain('strokeCircle'); expect(w).toEqual(before)
  calls.length = 0; drawGuidance(g, w, 32, false, null, false); expect(calls).toEqual([])
})
