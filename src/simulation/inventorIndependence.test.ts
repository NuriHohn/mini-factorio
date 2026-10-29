import { acceptCompletedPath } from './developmentAcceptance.testSupport'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeCopper } from './petesWorld'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function until(w: World, done: () => boolean) {
  for (let ms = 0; ms < 1800000 && !done(); ms += 50) advanceWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, h: w.homestead, paths: w.personality.paths, stock: w.buildings[w.homestead!.store ?? 0] })).toBe(true)
}
describe('independent Inventor progression from raw copper alone', () => {
  let w: World
  beforeAll(() => { w = createPetesWorld(); expect(placeCopper(w, 26, 18)).toBeNull(); until(w, () => w.homestead!.expansion.copperFurnace !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.cableAssembler !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.copperMiner !== null) }, 60000)
  beforeAll(() => { until(w, () => w.produced.electronicCircuit > 0) }, 60000)
  beforeAll(() => { until(w, () => w.flightProject?.phase === 'complete') }, 60000)
  for (const kind of ['copper', 'cableFeed', 'cableReturn', 'circuitFeed', 'circuitReturn'] as const) beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === kind)) }, 60000)
  it('reaches the flight workshop and real circuit logistics without a foreign resource or machine', () => {
    expect(w.mined.iron + w.mined.coal + w.mined.wood + w.produced.ironPlate + w.produced.ironGear).toBe(0)
    expect(w.personality.paths.craftsman.xp + w.personality.paths.industrial.xp + w.personality.paths.eco.xp).toBe(0)
    expect(w.homestead!.expansion.furnace).toBeNull(); expect(w.homestead!.expansion.steamEngine).toBeNull()
    const machine = w.buildings[w.homestead!.expansion.circuitAssembler!]!
    expect(machine.kind === 'assembler' && machine.recipeId).toBe('peteCircuit')
    const loaded = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 5000); advanceWorld(loaded, 5000)
    expect(JSON.parse(encodeSave(loaded, view, '2026-10-28T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-28T00:00:00.000Z')))
  })
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.inventor === 3 && w.personality.paths.inventor.level === 5 && w.treasureProject?.phase === 'complete') }, 60000)
  it('completes Inventor independently, keeps living and restores its paid machines', () => { acceptCompletedPath(w, 'inventor') }, 60000)

})
