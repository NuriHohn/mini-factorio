import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeGrove, placeIron } from './petesWorld'
import { advancePetesWorld as advanceWorld } from '../pete/simulation'
import { materialStore } from './homestead'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function until(w: World, done: () => boolean, limit: number) {
  for (let t = 0; t < limit && !done(); t += 50) advanceWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, h: w.homestead, stock: materialStore(w), paths: w.personality.paths, activity: w.peace.activity })).toBe(true)
}
describe('actual iron-only Craftsman production and cargo upgrade', () => {
  let w: World
  beforeAll(() => {
    w = createPetesWorld(); expect(placeIron(w, 26, 18)).toBeNull()
    until(w, () => w.homestead!.expansion.miner !== null && w.verandaProject?.phase === 'complete', 1800000)
  }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.gearAssembler !== null, 1800000) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.cargoBicycle, 1800000) }, 60000)
  it('funds a real gear assembler and paid bicycle upgrade from iron alone', () => {
    expect(w.produced.ironGear).toBeGreaterThanOrEqual(6)
    expect(w.personality.paths.craftsman.level).toBeGreaterThanOrEqual(4)
    expect(w.personality.paths.eco.xp).toBe(0)
    expect(w.bicycleProject?.phase).toBe('complete')
    expect(w.pressProject).toBeUndefined()
    expect(w.homestead!.bikeTile).toBe(w.pete.tile)
  })
  it('preserves the upgraded vehicle and real inventories across exact ongoing simulation', () => {
    const loaded = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 3000); advanceWorld(loaded, 3000)
    const stamp = '2026-10-27T00:00:00.000Z'
    expect(JSON.parse(encodeSave(loaded, view, stamp))).toEqual(JSON.parse(encodeSave(w, view, stamp)))
  })
})
describe('actual Eco dock, fishing and rowboat alongside production', () => {
  let w: World, sawBoat = false
  beforeAll(() => {
    w = createPetesWorld()
    for (const [x, y] of [[26, 15], [14, 15], [14, 25], [26, 25]]) expect(placeGrove(w, x, y)).toBeNull()
    until(w, () => w.orchardProject?.phase === 'complete', 1800000)
  }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.waterworks.dock !== null, 1800000) }, 60000)
  beforeAll(() => {
    for (let t = 0; t < 1800000 && !sawBoat; t += 50) { advanceWorld(w, 50); sawBoat ||= !!w.peace.boat }
  }, 60000)
  it('pays for a standing dock and uses a real safe return trip without stopping development', () => {
    expect(sawBoat).toBe(true)
    expect(w.buildings[w.homestead!.waterworks.dock!.tile]?.kind).toBe('fishingDock')
    expect(w.homestead!.millBuilt).toBe(3)
    expect(w.produced.woodPanel).toBeGreaterThan(0)
    expect(() => decodeSave(encodeSave(w, view))).not.toThrow()
  })
})
it('autonomously opens access to an offered deposit across a real river using nearby Wood', () => {
  const w = createPetesWorld()
  w.water.fill(false)
  for (let y = 0; y < 40; y++) w.water[y * 40 + 24] = true
  expect(placeGrove(w, 14, 18)).toBeNull()
  expect(placeIron(w, 28, 18)).toBeNull()
  until(w, () => w.homestead!.waterworks.bridges.length > 0, 1800000)
  expect(w.buildings.some(b => b?.kind === 'footbridge')).toBe(true)
  expect(w.homestead!.waterworks.bridges.length).toBe(1)
  expect(() => decodeSave(encodeSave(w, view))).not.toThrow()
}, 60000)
