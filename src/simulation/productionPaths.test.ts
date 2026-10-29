import { acceptCompletedPath } from './developmentAcceptance.testSupport'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeCoal } from './petesWorld'
import { advanceWorld } from './step'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const heldCargo = new WeakMap<World, string>()
function until(w: World, done: () => boolean, ms = 1800000) {
  for (let t = 0; t < ms && !done(); t += 50) {
    advanceWorld(w, 50)
    if (w.homestead!.infrastructure.loadingCargo !== null && !heldCargo.has(w)) heldCargo.set(w, encodeSave(w, view))
  }
  expect(done(), JSON.stringify({ time: w.timeMs, h: w.homestead, paths: w.personality.paths, stock: w.buildings[w.homestead!.store ?? 0] })).toBe(true)
}
function continuation(w: World) {
  const loaded = decodeSave(encodeSave(w, view)).world
  advanceWorld(w, 10000); advanceWorld(loaded, 10000)
  expect(JSON.parse(encodeSave(loaded, view, '2026-10-27T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z')))
}
describe('raw coal reaches the full real loading chain and paid furnishing', () => {
  let w: World, firstOrder: string
  beforeAll(() => { w = createPetesWorld(); expect(placeCoal(w, 26, 18)).toBeNull(); until(w, () => w.homestead!.expansion.coalMiner !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.steamWorkshop !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'stampFeed')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.steamHoist !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.loading !== null) }, 60000)
  // The earlier loading acceptance shares this genuine coal-only preparation.
  // Capture held cargo before later links/furnishing change the world.
  it('commissions physical buffers and performs actual fuel cargo work with saved continuation', () => {
    const loaded = decodeSave(heldCargo.get(w)!).world
    expect(loaded.homestead!.infrastructure.loadingCargo).not.toBeNull()
    continuation(loaded)
  })
  for (const kind of ['loadingReturn', 'loadingFeed'] as const) beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === kind)) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.industrial > 0); firstOrder = encodeSave(w, view) }, 60000)
  it('retains a coal-only path, actual cargo work and a product-funded Industrial result', () => {
    const w = decodeSave(firstOrder).world
    expect(w.mined.iron + w.mined.copper + w.mined.wood).toBe(0)
    expect(w.homestead!.infrastructure.cargoCycles).toBeGreaterThanOrEqual(10)
    expect(w.homestead!.infrastructure.industrial).toBe(1)
    continuation(w)
  })
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.industrial === 3 && w.personality.paths.industrial.level === 5) }, 60000)
  it('completes Industrial independently, keeps living and restores its paid machines', () => { acceptCompletedPath(w, 'industrial') }, 60000)

})
