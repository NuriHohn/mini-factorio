import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeCoal, placeCopper, placeIron } from './petesWorld'
import { advanceWorld } from './step'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function until(w: World, done: () => boolean, ms = 1800000) {
  for (let t = 0; t < ms && !done(); t += 50) advanceWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, h: w.homestead, paths: w.personality.paths, stock: w.buildings[w.homestead!.store ?? 0] })).toBe(true)
}
function continuation(w: World) {
  const loaded = decodeSave(encodeSave(w, view)).world
  advanceWorld(w, 10000); advanceWorld(loaded, 10000)
  expect(JSON.parse(encodeSave(loaded, view, '2026-10-27T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z')))
}
describe('raw mixed resources reach autonomous circuit logistics', () => {
  let w: World
  beforeAll(() => { w = createPetesWorld(); expect(placeCopper(w, 24, 20)).toBeNull(); expect(placeIron(w, 16, 20)).toBeNull(); until(w, () => w.homestead!.expansion.copperFurnace !== null && w.homestead!.expansion.furnace !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.cableAssembler !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.copperMiner !== null) }, 60000)
  beforeAll(() => { until(w, () => w.produced.electronicCircuit > 0) }, 60000)
  beforeAll(() => { until(w, () => w.experimentProject?.phase === 'complete', 7200000 - w.timeMs) }, 60000)
  beforeAll(() => { until(w, () => w.treasureProject?.phase === 'complete', 7200000 - w.timeMs) }, 60000)
  beforeAll(() => { until(w, () => w.flightProject?.phase === 'complete', 7200000 - w.timeMs) }, 60000)
  for (const kind of ['copper', 'cableFeed', 'cableReturn'] as const) beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === kind)) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'circuitFeed')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'circuitReturn')) }, 60000)
  it('builds both paid real connections and resumes the mixed material flow exactly', () => {
    expect(w.produced.electronicCircuit).toBeGreaterThan(0)
    expect(w.homestead!.infrastructure.links.filter(p => p.kind.startsWith('circuit'))).toHaveLength(2)
    continuation(w)
  })
})
describe('raw coal reaches the full real loading chain and paid furnishing', () => {
  let w: World
  beforeAll(() => { w = createPetesWorld(); expect(placeCoal(w, 26, 18)).toBeNull(); until(w, () => w.homestead!.expansion.coalMiner !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.steamWorkshop !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'stampFeed')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.steamHoist !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.loading !== null) }, 60000)
  for (const kind of ['loadingReturn', 'loadingFeed'] as const) beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === kind)) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.industrial > 0) }, 60000)
  it('retains a coal-only path, actual cargo work and a product-funded Industrial result', () => {
    expect(w.mined.iron + w.mined.copper + w.mined.wood).toBe(0)
    expect(w.homestead!.infrastructure.cargoCycles).toBeGreaterThanOrEqual(10)
    expect(w.homestead!.infrastructure.industrial).toBe(1)
    continuation(w)
  })
})
