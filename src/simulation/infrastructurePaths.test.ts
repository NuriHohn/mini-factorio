import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeGrove, placeIron } from './petesWorld'
import { advanceWorld } from './step'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'

function until(w: World, done: () => boolean, limit = 1800000) {
  for (let t = 0; t < limit && !done(); t += 50) advanceWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, h: w.homestead, stock: w.buildings[w.homestead!.store ?? 0], paths: w.personality.paths, activity: w.peace.activity })).toBe(true)
}
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
describe('raw iron supply grows into connected Craftsman production', () => {
  let w: World
  beforeAll(() => { w = createPetesWorld(); expect(placeIron(w, 26, 18)).toBeNull(); until(w, () => w.homestead!.expansion.miner !== null && w.verandaProject?.phase === 'complete') }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.cargoBicycle) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'iron')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.length === 3) }, 60000)
  it('builds three paid ordinary links from iron alone and preserves exact ongoing simulation', () => {
    expect(w.homestead!.infrastructure.links.map(p => p.kind)).toEqual(['iron', 'gearFeed', 'gearReturn'])
    const loaded = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 5000); advanceWorld(loaded, 5000)
    expect(JSON.parse(encodeSave(loaded, view, '2026-10-27T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z')))
    expect(w.personality.paths.eco.xp).toBe(0)
  })
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.craftsman > 0) }, 60000)
  it('uses real gears for a visible later workshop order', () => { expect(w.homestead!.infrastructure.craftsman).toBeGreaterThan(0) })
})
describe('raw groves fund Eco wheel and later visible orders', () => {
  let w: World
  beforeAll(() => { w = createPetesWorld(); for (const [x, y] of [[26, 15], [14, 15], [14, 25], [26, 25]]) expect(placeGrove(w, x, y)).toBeNull(); until(w, () => w.homestead!.millBuilt === 3) }, 60000)
  beforeAll(() => { until(w, () => w.orchardProject?.phase === 'complete') }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.assembler !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.waterworks.dock !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.wheel !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.eco > 0) }, 60000)
  it('funds real water power and a product-consuming yard improvement without player Wood', () => {
    expect(w.homestead!.infrastructure.wheel).not.toBeNull()
    expect(w.homestead!.infrastructure.eco).toBeGreaterThan(0)
    expect(w.nature.wood).toBe(0)
    expect(() => decodeSave(encodeSave(w, view))).not.toThrow()
  })
})
