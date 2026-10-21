import { describe, expect, it } from 'vitest'
import { commitConstruction, placementInfo, planConstruction } from './construction'
import { createBareWorld } from './testFixtures'
import { placeBuilding, SIZE } from './world'
import { allocatePower, polesConnect } from './power'
import { ConstructionDrag } from '../game/constructionDrag'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const point = (x: number, y: number) => ({ x, y })
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
describe('deterministic atomic belt construction', () => {
  it.each(['east', 'south', 'west', 'north'] as const)('keeps a single click oriented %s and completely free', direction => {
    const w = createBareWorld(() => .5), before = structuredClone(w.nature)
    expect(commitConstruction(w, point(10, 10), point(10, 10), 'belt', direction)).toEqual({ error: null, placed: 1 })
    expect(w.buildings[410]).toMatchObject({ kind: 'belt', direction })
    expect(w.nature).toEqual(before)
  })
  it('plans straight cells and one horizontal-first turn with outgoing corner orientation', () => {
    const w = createBareWorld(() => .5), before = structuredClone(w)
    const p = planConstruction(w, point(10, 10), point(13, 12), 'belt', 'east')
    expect(p.cells.map(c => [c.x, c.y, c.direction])).toEqual([[10, 10, 'east'], [11, 10, 'east'], [12, 10, 'east'], [13, 10, 'south'], [13, 11, 'south'], [13, 12, 'south']])
    expect(w).toEqual(before)
    expect(planConstruction(w, point(10, 10), point(10, 16), 'belt', 'east').cells).toHaveLength(7)
    expect(planConstruction(w, point(13, 12), point(10, 10), 'belt', 'north').cells.map(c => [c.x, c.y])).toEqual([[13, 12], [13, 11], [13, 10], [12, 10], [11, 10], [10, 10]])
  })
  it('rejects occupied, actor, tree and out-of-world cells without building any partial path', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 12, 10, 'storage', 'east')
    for (const [a, b] of [[point(10, 10), point(15, 10)], [point(10, 23), point(20, 23)], [point(10, 10), point(40, 10)]]) {
      const before = structuredClone(w)
      expect(commitConstruction(w, a, b, 'belt', 'east')).toMatchObject({ placed: 0 })
      expect(w).toEqual(before)
    }
    placeBuilding(w, 10, 12, 'tree', 'east')
    expect(commitConstruction(w, point(8, 12), point(12, 12), 'belt', 'east').error).toContain('tree')
  })
  it('revalidates a changed world at release, commits once, and does not overwrite existing belts', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    drag.begin(w, point(10, 10), 'belt', 'east'); drag.move(point(15, 10))
    expect(drag.preview()?.error).toBeNull()
    placeBuilding(w, 13, 10, 'storage', 'east')
    expect(drag.preview()?.error).not.toBeNull()
    const before = structuredClone(w)
    expect(drag.finish(w)?.placed).toBe(0); expect(w).toEqual(before)
    drag.begin(w, point(10, 11), 'belt', 'east'); drag.move(point(15, 11))
    expect(drag.finish(w)).toEqual({ placed: 6, error: null }); expect(drag.finish(w)).toBeNull()
    const after = structuredClone(w)
    expect(commitConstruction(w, point(10, 11), point(15, 11), 'belt', 'west').placed).toBe(0)
    expect(w).toEqual(after)
  })
  it('transports around the constructed corner through existing belt transfer logic and survives exact save/load', () => {
    const w = createBareWorld(() => .5)
    commitConstruction(w, point(10, 10), point(13, 12), 'belt', 'east')
    placeBuilding(w, 13, 13, 'storage', 'east')
    const belt = w.buildings[410]!
    if (belt.kind !== 'belt') throw Error('fixture')
    belt.item = 'iron'
    const restored = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 4000); advanceWorld(restored, 4000)
    expect(restored.buildings).toEqual(w.buildings)
    expect(w.buildings[13 * SIZE + 13]).toMatchObject({ inventory: { iron: 1 } })
  })
})
describe('minimum direct-corridor pole connections', () => {
  it.each([[0, 0, 39, 0, 8], [0, 0, 12, 12, 4], [10, 10, 10, 10, 1]])('spaces %i,%i → %i,%i into %i connected poles', (x, y, ex, ey, count) => {
    const w = createBareWorld(() => .5), before = structuredClone(w)
    const plan = planConstruction(w, point(x, y), point(ex, ey), 'powerPole', 'east')
    expect(plan.error).toBeNull(); expect(plan.cells).toHaveLength(count)
    expect(w).toEqual(before)
    for (let i = 1; i < plan.cells.length; i++) expect(polesConnect(plan.cells[i - 1], plan.cells[i])).toBe(true)
    expect(commitConstruction(w, point(x, y), point(ex, ey), 'powerPole', 'east')).toEqual({ error: null, placed: count })
    const power = allocatePower(w)
    expect(power.networks).toHaveLength(1); expect(w.nature.wood).toBe(0)
  })
  it('avoids occupied intermediate cells when a connected spacing is possible and reuses existing endpoints', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 0, 0, 'powerPole', 'east'); placeBuilding(w, 12, 0, 'powerPole', 'east'); placeBuilding(w, 6, 0, 'storage', 'east')
    const p = planConstruction(w, point(0, 0), point(12, 0), 'powerPole', 'east')
    expect(p.error).toBeNull(); expect(p.cells.every(c => c.x !== 6)).toBe(true)
    expect(p.cells[0].reuse).toBe(true); expect(p.cells.at(-1)?.reuse).toBe(true)
    expect(commitConstruction(w, point(0, 0), point(12, 0), 'powerPole', 'east').placed).toBe(2)
    expect(w.buildings[6]?.kind).toBe('storage'); expect(allocatePower(w).networks).toHaveLength(1)
  })
  it('prefers reusing an already connected corridor rather than adding unnecessary poles', () => {
    const w = createBareWorld(() => .5)
    for (const x of [0, 5, 11, 12]) placeBuilding(w, x, 0, 'powerPole', 'east')
    const before = structuredClone(w)
    expect(commitConstruction(w, point(0, 0), point(12, 0), 'powerPole', 'east')).toEqual({ error: null, placed: 0 })
    expect(w).toEqual(before)
  })
  it('fails a blocked direct corridor atomically instead of silently placing disconnected poles', () => {
    const w = createBareWorld(() => .5)
    for (let x = 1; x < 12; x++) placeBuilding(w, x, 0, 'storage', 'east')
    const before = structuredClone(w)
    expect(planConstruction(w, point(0, 0), point(12, 0), 'powerPole', 'east').error).toContain('No clear')
    expect(commitConstruction(w, point(0, 0), point(12, 0), 'powerPole', 'east').placed).toBe(0)
    expect(w).toEqual(before)
  })
})
describe('funding and UI gesture safety', () => {
  it('separates insufficient Wood from geometry, checks research and never consumes preview resources', () => {
    const w = createBareWorld(() => .5), before = structuredClone(w)
    expect(placementInfo(w, point(10, 10), 'treehouse')).toMatchObject({ state: 'unaffordable', wood: 20, available: 0 })
    expect(placementInfo(w, point(40, 10), 'treehouse').state).toBe('invalid')
    expect(placementInfo(w, point(10, 10), 'assembler').error).toContain('Automation I')
    expect(placementInfo(w, point(10, 10), 'belt')).toMatchObject({ state: 'valid', wood: 0 })
    expect(placementInfo(w, point(10, 10), 'powerPole')).toMatchObject({ state: 'valid', wood: 0 })
    expect(w).toEqual(before)
  })
  it('cancels without world mutations and drops stale gestures on world replacement', () => {
    const w = createBareWorld(() => .5), before = structuredClone(w), drag = new ConstructionDrag()
    drag.begin(w, point(10, 10), 'belt', 'east'); drag.move(point(30, 10)); expect(drag.active).toBe(true)
    expect(drag.cancel()).toBe(true); expect(drag.finish(w)).toBeNull(); expect(w).toEqual(before)
    drag.begin(w, point(10, 10), 'powerPole', 'east')
    expect(drag.finish(createBareWorld(() => .5))).toBeNull(); expect(w).toEqual(before)
  })
})
