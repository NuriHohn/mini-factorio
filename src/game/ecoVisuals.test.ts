import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawVegetableGarden, drawPlanting, drawGardenTending } from './ecoVisuals'
import { createBareWorld } from '../simulation/testFixtures'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_t, n) => (...a: unknown[]) => { calls.push([String(n), a]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
it('shows staged beds and vegetables, and a planted sapling before completion', () => {
  const { g, calls } = graphics(), garden = { kind: 'peteGarden' as const, x: 10, y: 10 }
  drawVegetableGarden(g, garden, 32, .1); const initial = calls.length
  calls.length = 0; drawVegetableGarden(g, garden, 32); expect(calls.length).toBeGreaterThan(initial)
  calls.length = 0; drawPlanting(g, 10, 10, 32, .1); const soil = calls.length
  calls.length = 0; drawPlanting(g, 10, 10, 32, .7); expect(calls.length).toBeGreaterThan(soil)
})
it('culls watering, freezes on pause and never mutates simulation state', () => {
  const w = createBareWorld(() => .5), { g, calls } = graphics()
  w.gardenProject = { kind: 'garden', home: 820, tiles: [700], spots: [740], direction: 'east', phase: 'complete', built: 1, elapsedMs: 0, carried: 0, crate: null, readyAtMs: 60000 }
  w.peace.activity = 'gardening'; Object.assign(w.pete, { x: 20, y: 18 })
  const before = structuredClone(w)
  drawGardenTending(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 }); expect(calls).toEqual([])
  drawGardenTending(g, w, 32); const pose = [...calls]
  calls.length = 0; drawGardenTending(g, w, 32); expect(calls).toEqual(pose); expect(w).toEqual(before)
  calls.length = 0; w.timeMs += 200; drawGardenTending(g, w, 32); expect(calls).not.toEqual(pose)
})
