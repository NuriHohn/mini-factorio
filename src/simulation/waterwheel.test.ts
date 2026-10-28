import { stripVersion52State } from './testFixtures'
import { expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { DIRECTIONS, offsets, placeBuilding, placementError, removeBuilding } from './world'
import type { Waterwheel } from './world'
import { WATERWHEEL_KW, WATERWHEEL_WOOD, waterwheelWater } from './waterwheel'
import { allocatePower, generationKw, powerOverview } from './power'
import { placementInfo } from './construction'
import { advanceWorld } from './step'
import { paintWater } from './waterLandscaping'
import { inspectBuilding } from './inspection'
import { inspectionSummary } from '../game/inspectionSummary'
import { PlacementRotation } from '../game/placementRotation'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
function fixture() {
  const w = createBareWorld(() => .5)
  w.nature.wood = 30; w.water[411] = true
  expect(placeBuilding(w, 10, 10, 'waterwheel', 'east')).toBe(true)
  expect(placeBuilding(w, 10, 9, 'powerPole', 'east')).toBe(true)
  for (const y of [9, 10]) { w.tiles[y * 40 + 12] = 'iron'; placeBuilding(w, 12, y, 'miner', 'east') }
  return w
}
it.each(DIRECTIONS)('places a land waterwheel facing adjacent %s water and charges exactly once', direction => {
  const w = createBareWorld(() => .5), d = offsets[direction]
  w.nature.wood = WATERWHEEL_WOOD
  w.water[(10 + d.y) * 40 + 10 + d.x] = true
  const before = structuredClone(w)
  expect(placementInfo(w, { x: 10, y: 10 }, 'waterwheel', direction)).toMatchObject({ state: 'valid', wood: 10 })
  expect(w).toEqual(before)
  expect(placeBuilding(w, 10, 10, 'waterwheel', direction)).toBe(true)
  expect(w.buildings[410]).toMatchObject({ kind: 'waterwheel', direction, rotationMs: 0 })
  expect(w.nature.wood).toBe(0)
  expect(placeBuilding(w, 10, 10, 'waterwheel', direction)).toBe(false)
  expect(w.nature.wood).toBe(0)
  expect(removeBuilding(w, 10, 10)).toBe(true)
  expect(w.nature.wood).toBe(0)
})
it('rejects wrong-facing, diagonal, flooded, occupied, unaffordable and boundary sites without charging', () => {
  const w = createBareWorld(() => .5); w.nature.wood = 30
  w.water[411] = true; w.water[451] = true
  expect(placementError(w, 10, 10, 'waterwheel', 'west')).toContain('adjacent water')
  expect(waterwheelWater(w, { x: 10, y: 11 }, 'north')).toBe(false)
  expect(placeBuilding(w, 11, 10, 'waterwheel', 'south')).toBe(false)
  expect(placeBuilding(w, 0, 0, 'waterwheel', 'north')).toBe(false)
  placeBuilding(w, 10, 10, 'storage', 'east')
  expect(placeBuilding(w, 10, 10, 'waterwheel', 'east')).toBe(false)
  removeBuilding(w, 10, 10); w.nature.wood = 9
  expect(placementInfo(w, { x: 10, y: 10 }, 'waterwheel', 'east').state).toBe('unaffordable')
  expect(placeBuilding(w, 10, 10, 'waterwheel', 'east')).toBe(false)
  expect(w.nature.wood).toBe(9)
})
it('uses anchored mouse rotation and preserves costs until release', () => {
  const w = createBareWorld(() => .5), gesture = new PlacementRotation()
  w.nature.wood = 10; w.water[450] = true
  gesture.begin(w, { x: 10, y: 10 }, { x: 100, y: 100 }, 'waterwheel', 'east')
  expect(gesture.preview()?.info.state).toBe('invalid')
  gesture.move({ x: 100, y: 124 })
  expect(gesture.preview()).toMatchObject({ direction: 'south', info: { state: 'valid', wood: 10 } })
  expect(w.nature.wood).toBe(10)
  expect(gesture.finish(w)?.error).toBeNull()
  expect(w.buildings[410]).toMatchObject({ direction: 'south' }); expect(w.nature.wood).toBe(0)
})
it('supplies 50 kW proportionally, stops on dry banks and resumes without losing progress', () => {
  const w = fixture(), wheel = w.buildings[410] as Waterwheel
  advanceWorld(w, 500)
  expect(powerOverview(w)).toMatchObject({ installedKw: 50, connectedKw: 50, suppliedKw: 50 })
  expect(w.power!.consumers[372].speedFraction).toBeCloseTo(50 / 60)
  expect(wheel.rotationMs).toBe(500)
  const miner = structuredClone(w.buildings[372])
  expect(paintWater(w, { x: 11, y: 10 }, { x: 11, y: 10 }, 'land', 1)).toBe(1)
  advanceWorld(w, 500)
  expect(powerOverview(w)).toMatchObject({ installedKw: 50, connectedKw: 0, suppliedKw: 0 })
  expect(wheel.rotationMs).toBe(500); expect(w.buildings[372]).toEqual(miner)
  expect(inspectionSummary(inspectBuilding(w, 410)!).state).toContain('Needs water')
  expect(paintWater(w, { x: 10, y: 10 }, { x: 10, y: 10 }, 'water', 1)).toBe(0)
  expect(paintWater(w, { x: 11, y: 10 }, { x: 11, y: 10 }, 'water', 1)).toBe(1)
  advanceWorld(w, 500)
  expect(wheel.rotationMs).toBe(1000); expect(powerOverview(w).connectedKw).toBe(WATERWHEEL_KW)
})
it('shares mixed-generator load by capacity and handles sabotage, disconnection and demolition', () => {
  const w = fixture(), wheel = w.buildings[410] as Waterwheel
  placeBuilding(w, 9, 9, 'generator', 'east'); allocatePower(w)
  expect(powerOverview(w).connectedKw).toBe(150)
  expect(inspectBuilding(w, 410)).toMatchObject({ capacityKw: 50, actualKw: 20 })
  expect(inspectBuilding(w, 369)).toMatchObject({ capacityKw: 100, actualKw: 40 })
  wheel.sabotageUntilMs = 500; advanceWorld(w, 450)
  expect(generationKw(w, wheel)).toBe(0); expect(wheel.rotationMs).toBe(0)
  advanceWorld(w, 50); expect(generationKw(w, wheel)).toBe(50); expect(wheel.rotationMs).toBe(50)
  removeBuilding(w, 10, 9); allocatePower(w)
  expect(powerOverview(w).connectedKw).toBe(0)
  expect(inspectBuilding(w, 410)).toMatchObject({ actualKw: 0, electrical: { networkId: null } })
  removeBuilding(w, 10, 10); expect(w.nature.wood).toBe(20)
})
it('keeps animation and power deterministic across frame partitions, pause and save/load', () => {
  const w = fixture(), other = structuredClone(w)
  advanceWorld(w, 750)
  for (let i = 0; i < 45; i++) advanceWorld(other, 750 / 45)
  expect(other.remainder).toBeCloseTo(w.remainder)
  expect(other.buildings).toEqual(w.buildings)
  const snapshot = encodeSave(w, view), loaded = decodeSave(snapshot).world
  advanceWorld(loaded, 0); expect(JSON.parse(encodeSave(loaded, view, '2026-10-21T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-21T00:00:00.000Z')))
  for (const delta of [50, 1250, 8000]) { advanceWorld(w, delta); advanceWorld(loaded, delta) }
  expect(loaded.buildings).toEqual(w.buildings); expect(loaded.power).toEqual(w.power)
})
it('loads and resumes an inactive wheel, and accepts existing version-9 saves unchanged', () => {
  const w = fixture(); advanceWorld(w, 150)
  paintWater(w, { x: 11, y: 10 }, { x: 11, y: 10 }, 'land', 1)
  const loaded = decodeSave(encodeSave(w, view)).world
  advanceWorld(loaded, 100); expect(loaded.buildings[410]).toMatchObject({ rotationMs: 150 })
  paintWater(loaded, { x: 11, y: 10 }, { x: 11, y: 10 }, 'water', 1)
  advanceWorld(loaded, 50); expect(loaded.buildings[410]).toMatchObject({ rotationMs: 200 })
  removeBuilding(w, 10, 10)
  const legacy = JSON.parse(encodeSave(w, view)); stripVersion52State(legacy.game); legacy.version = 9; delete legacy.game.personality; delete legacy.game.peace.nextProjectCheckAtMs
  const restored = decodeSave(JSON.stringify(legacy)).world
  expect(JSON.parse(encodeSave(restored, view, '2026-10-21T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-21T00:00:00.000Z')))
})
it.each(['direction', 'rotation', 'extra', 'water', 'legacy'] as const)('rejects malformed %s waterwheel save data', mutation => {
  const w = fixture(), save = JSON.parse(encodeSave(w, view)), b = save.game.buildings[410]
  if (mutation === 'direction') b.direction = 'diagonal'
  if (mutation === 'rotation') b.rotationMs = 25
  if (mutation === 'extra') b.fuel = 5
  if (mutation === 'water') save.game.water[410] = true
  if (mutation === 'legacy') { save.version = 9; delete save.game.personality }
  expect(() => decodeSave(JSON.stringify(save))).toThrow(/Invalid save/)
})
