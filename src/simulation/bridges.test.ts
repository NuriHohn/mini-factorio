import { describe, expect, it } from 'vitest'
import { commitConstruction, planConstruction } from './construction'
import { createBareWorld } from './testFixtures'
import { bridgeCrossing } from './waterTerrain'
import { placeBuilding, removeBuilding, SIZE } from './world'
import { advanceWorld } from './step'
import { ConstructionDrag } from '../game/constructionDrag'
import { deliverItem } from './transport'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const p = (x: number, y: number) => ({ x, y })
function crossing(n: number, vertical = false) {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  for (let j = 0; j < SIZE; j++) for (let k = 0; k < n; k++) w.water[vertical ? (10 + k) * SIZE + j : j * SIZE + 10 + k] = true
  return w
}
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
describe('atomic belt bridges', () => {
  it.each([1, 3, 5])('builds a %i-water-tile straight crossing and charges only new water cells', n => {
    const w = crossing(n), before = structuredClone(w), a = p(8, 10), b = p(11 + n, 10)
    const plan = planConstruction(w, a, b, 'belt', 'east')
    expect(plan.error).toBeNull(); expect(plan.wood).toBe(3 * n)
    expect(plan.cells.filter(c => c.bridge)).toHaveLength(n); expect(w).toEqual(before)
    expect(commitConstruction(w, a, b, 'belt', 'east')).toEqual({ error: null, placed: n + 4, wood: 3 * n })
    expect(w.nature.wood).toBe(100 - 3 * n)
    for (let x = 10; x < 10 + n; x++) expect(w.buildings[400 + x]).toMatchObject({ kind: 'belt', bridge: true, direction: 'east', entry: 'west' })
    const paid = w.nature.wood
    expect(commitConstruction(w, a, b, 'belt', 'east')).toEqual({ error: null, placed: 0 })
    expect(w.nature.wood).toBe(paid)
    expect(bridgeCrossing(w, 10, 10, 'east')).toHaveLength(n)
  })
  it('builds vertical crossings with the same speed and cost', () => {
    const w = crossing(3, true)
    expect(commitConstruction(w, p(12, 8), p(12, 14), 'belt', 'south')).toMatchObject({ error: null, wood: 9 })
    placeBuilding(w, 12, 15, 'storage', 'east')
    const b = w.buildings[8 * SIZE + 12]!
    if (b.kind !== 'belt') throw Error('fixture')
    b.item = 'copper'; advanceWorld(w, 4000)
    expect(w.buildings[15 * SIZE + 12]).toMatchObject({ inventory: { copper: 1 } })
  })
  it('rejects six-water spans and open-water endpoints without a partial bridge or resource loss', () => {
    const w = crossing(6), before = structuredClone(w)
    expect(commitConstruction(w, p(8, 10), p(17, 10), 'belt', 'east').error).toContain('at most 5')
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(8, 10), p(12, 10), 'belt', 'east').error).toContain('both ends')
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(12, 10), p(17, 10), 'belt', 'east').placed).toBe(0)
    expect(w).toEqual(before)
  })
  it('uses a land detour around an invalid width and never turns on water', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 100
    for (let y = 9; y <= 11; y++) for (let x = 10; x <= 15; x++) w.water[y * SIZE + x] = true
    const plan = planConstruction(w, p(8, 10), p(17, 10), 'belt', 'east')
    expect(plan.error).toBeNull(); expect(plan.detour).toBe(true)
    for (let i = 1; i < plan.cells.length; i++) if (plan.cells[i].bridge) expect(plan.cells[i].direction).toBe(plan.cells[i - 1].direction)
    expect(plan.cells.every(c => !c.bridge)).toBe(true)
  })
  it('replaces an intended water corner with a valid straight crossing or land route', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 100
    for (let x = 10; x <= 12; x++) w.water[10 * SIZE + x] = true
    for (let y = 11; y <= 13; y++) w.water[y * SIZE + 12] = true
    const plan = planConstruction(w, p(8, 10), p(12, 14), 'belt', 'east')
    expect(plan.error).toBeNull(); expect(plan.detour).toBe(true)
    for (let i = 1; i < plan.cells.length; i++) if (plan.cells[i].bridge) expect(plan.cells[i].direction).toBe(plan.cells[i - 1].direction)
  })
  it('applies the span limit to separate crossings independently', () => {
    const w = crossing(2)
    for (let y = 0; y < SIZE; y++) for (const x of [14, 15]) w.water[y * SIZE + x] = true
    expect(commitConstruction(w, p(8, 10), p(17, 10), 'belt', 'east')).toMatchObject({ error: null, wood: 12 })
    expect(w.buildings.filter(b => b?.kind === 'belt' && b.bridge)).toHaveLength(4)
  })
  it('keeps ordinary belts blocked on water, and bridges reject side input and partial reversals', () => {
    const w = crossing(3)
    expect(placeBuilding(w, 10, 10, 'belt', 'east')).toBe(false)
    commitConstruction(w, p(8, 10), p(14, 10), 'belt', 'east')
    const b = w.buildings[410]!
    expect(deliverItem(b, 'iron', 'south')).toBe(false)
    const before = structuredClone(w)
    expect(commitConstruction(w, p(10, 10), p(10, 10), 'belt', 'west').placed).toBe(0)
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(10, 10), p(10, 10), 'belt', 'east')).toEqual({ error: null, placed: 0 })
    expect(commitConstruction(w, p(14, 10), p(8, 10), 'belt', 'west')).toMatchObject({ error: null, placed: 0, reversed: 7 })
    expect(w.nature.wood).toBe(91)
    expect(deliverItem(b, 'iron', 'west')).toBe(true)
  })
  it('preserves bridge packets across exact save/load, then demolishes the whole crossing without a refund', () => {
    const w = crossing(3)
    commitConstruction(w, p(8, 10), p(14, 10), 'belt', 'east'); placeBuilding(w, 15, 10, 'storage', 'east')
    const b = w.buildings[411]!
    if (b.kind !== 'belt') throw Error('fixture')
    b.item = 'iron'; b.progress = .4
    const text = encodeSave(w, view), restored = decodeSave(text).world
    expect(JSON.parse(text).version).toBe(39); expect(restored.water).toEqual(w.water)
    advanceWorld(w, 2500); advanceWorld(restored, 2500)
    expect(restored.buildings).toEqual(w.buildings); expect(w.buildings[415]).toMatchObject({ inventory: { iron: 1 } })
    const wood = w.nature.wood
    expect(removeBuilding(w, 11, 10)).toBe(true)
    for (const x of [10, 11, 12]) expect(w.buildings[400 + x]).toBeNull()
    expect(w.buildings[409]?.kind).toBe('belt'); expect(w.water[411]).toBe(true); expect(w.nature.wood).toBe(wood)
    expect(() => encodeSave(w, view)).not.toThrow()
    expect(commitConstruction(w, p(8, 10), p(14, 10), 'belt', 'east')).toMatchObject({ wood: 9 })
  })
  it('fails funding and live invalidation atomically without reversing old belts or charging twice', () => {
    const w = crossing(3), drag = new ConstructionDrag()
    placeBuilding(w, 8, 10, 'belt', 'west'); w.nature.wood = 8
    const before = structuredClone(w)
    expect(planConstruction(w, p(8, 10), p(14, 10), 'belt', 'east')).toMatchObject({ unaffordable: true, wood: 9 })
    expect(commitConstruction(w, p(8, 10), p(14, 10), 'belt', 'east').error).toContain('Needs 9 Wood')
    expect(w).toEqual(before)
    w.nature.wood = 9; drag.begin(w, p(8, 10), 'belt', 'east'); drag.move(p(14, 10))
    expect(drag.preview()?.error).toBeNull()
    w.nature.wood = 0; expect(drag.preview()?.unaffordable).toBe(true)
    expect(drag.finish(w)?.placed).toBe(0)
    w.nature.wood = 9; drag.begin(w, p(8, 10), 'belt', 'east'); drag.move(p(14, 10)); drag.cancel()
    expect(drag.finish(w)).toBeNull(); expect(w.nature.wood).toBe(9)
    drag.begin(w, p(8, 10), 'belt', 'east'); drag.move(p(14, 10)); expect(drag.finish(w)).toMatchObject({ wood: 9 })
    expect(drag.finish(w)).toBeNull(); expect(w.nature.wood).toBe(0)
  })
})
