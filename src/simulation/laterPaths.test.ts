import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeCopper } from './petesWorld'
import { advanceWorld } from './step'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function until(w: World, done: () => boolean, ms = 1800000) {
  for (let t = 0; t < ms && !done(); t += 50) advanceWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, h: w.homestead, paths: w.personality.paths, stock: w.buildings[w.homestead!.store ?? 0] })).toBe(true)
}
describe('raw copper grows into ordinary paid connections', () => {
  let w: World
  beforeAll(() => { w = createPetesWorld(); expect(placeCopper(w, 24, 20)).toBeNull(); until(w, () => w.homestead!.expansion.copperFurnace !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.copperMiner !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'copper')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.filter(p => ['copper', 'cableFeed', 'cableReturn'].includes(p.kind)).length === 3) }, 60000)
  it('builds all three copper-family connections without iron or fabricated stock', () => {
    expect(w.mined.iron).toBe(0)
    expect(w.produced.copperCable).toBeGreaterThan(0)
    const loaded = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 5000); advanceWorld(loaded, 5000)
    expect(JSON.parse(encodeSave(loaded, view, '2026-10-27T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z')))
  })
})
