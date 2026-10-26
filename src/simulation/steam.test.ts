import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding } from './world'
import { advanceWorld } from './step'
import { allocatePower, generationKw } from './power'
import { canReceive, deliverItem } from './transport'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { inspectBuilding } from './inspection'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function setup() {
  const w = createBareWorld(() => .4)
  placeBuilding(w, 20, 20, 'steamEngine', 'east')
  const engine = w.buildings[820]!
  if (engine.kind !== 'steamEngine') throw new Error('missing engine')
  return { w, engine }
}
describe('coal-fired closed-loop steam work', () => {
  it('accepts only physical coal, respects capacity and reservations, consumes one coal per ten seconds', () => {
    const { w, engine } = setup()
    expect(deliverItem(engine, 'iron', 'east')).toBe(false)
    for (let i = 0; i < 6; i++) expect(deliverItem(engine, 'coal', 'east')).toBe(true)
    expect(deliverItem(engine, 'coal', 'east')).toBe(false)
    engine.fuel = 5
    expect(canReceive(engine, 'coal', 'east', { coal: 1 })).toBe(false)
    engine.fuel = 1
    advanceWorld(w, 9950)
    expect(engine).toMatchObject({ fuel: 0, burnRemainingMs: 50, cycles: 0 })
    expect(generationKw(w, engine)).toBe(50)
    advanceWorld(w, 50)
    expect(engine).toMatchObject({ fuel: 0, burnRemainingMs: 0, cycles: 1 })
    expect(generationKw(w, engine)).toBe(0)
    advanceWorld(w, 20000); expect(engine.cycles).toBe(1)
    expect(w.produced.ironGear + w.produced.ironPlate).toBe(0)
  })
  it('exports ordinary pole power, pauses sabotage and resumes exact fuel work across saves', () => {
    const { w, engine } = setup()
    placeBuilding(w, 20, 19, 'powerPole', 'east')
    w.tiles[818] = 'iron'; placeBuilding(w, 18, 20, 'miner', 'east')
    engine.fuel = 2
    expect(allocatePower(w).networks[0].capacityKw).toBe(50)
    advanceWorld(w, 750)
    engine.sabotageUntilMs = w.timeMs + 1000
    const remaining = engine.burnRemainingMs
    advanceWorld(w, 500)
    expect(engine.burnRemainingMs).toBe(remaining)
    expect(generationKw(w, engine)).toBe(0)
    const restored = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 23000); advanceWorld(restored, 23000)
    expect(JSON.parse(encodeSave(restored, view, '2026-10-26T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-26T00:00:00.000Z')))
    expect(engine.cycles).toBe(2)
    expect(w.mined.iron).toBeGreaterThan(0)
    expect(inspectBuilding(w, 820)).toMatchObject({ kind: 'steamEngine', fuel: 0, cycles: 2 })
  })
  it('rejects malformed fuel/timers and legacy steam without changing the source', () => {
    const { w } = setup(), stamp = '2026-10-26T00:00:00.000Z', original = encodeSave(w, view, stamp)
    for (const [key, value] of [['fuel', 7], ['burnRemainingMs', 51], ['cycles', -1]] as const) {
      const save = JSON.parse(original); save.game.buildings[820][key] = value
      expect(() => decodeSave(JSON.stringify(save))).toThrow()
    }
    const old = JSON.parse(original); old.version = 45
    expect(() => decodeSave(JSON.stringify(old))).toThrow(/version 46/)
    expect(encodeSave(w, view, stamp)).toBe(original)
  })
})
