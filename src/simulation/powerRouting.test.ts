import { describe, expect, it } from 'vitest'
import { findPowerRoute, POWER_SEARCH_BUDGET, POWER_SEARCH_MARGIN } from './powerRouting'
import { commitConstruction, placementInfo, planConstruction } from './construction'
import { allocatePower, polesConnect } from './power'
import { ConstructionDrag } from '../game/constructionDrag'
import { createBareWorld } from './testFixtures'
import { chopTree } from './nature'
import { placeBuilding, SIZE } from './world'
import type { Position, World } from './world'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const p = (x: number, y: number) => ({ x, y })
const plan = (w: World, a: Position, b: Position) => planConstruction(w, a, b, 'powerPole', 'east')
function connected(points: Position[]) {
  expect(new Set(points.map(c => c.y * SIZE + c.x)).size).toBe(points.length)
  for (let i = 1; i < points.length; i++) expect(polesConnect(points[i - 1], points[i])).toBe(true)
}
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
describe('power-aware routing and minimum new poles', () => {
  it.each([[0, 0, 18, 0, 4], [39, 39, 39, 15, 5], [0, 0, 12, 12, 4], [5, 5, 11, 5, 2]])('builds a minimal connected route %i,%i → %i,%i', (x, y, ex, ey, count) => {
    const w = createBareWorld(() => .5), before = structuredClone(w)
    const route = plan(w, p(x, y), p(ex, ey))
    expect(route.error).toBeNull(); expect(route.cells).toHaveLength(count)
    expect(route.cells[0]).toMatchObject(p(x, y)); expect(route.cells.at(-1)).toMatchObject(p(ex, ey))
    connected(route.cells)
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(x, y), p(ex, ey), 'powerPole', 'east')).toEqual({ error: null, placed: count })
    expect(allocatePower(w).networks).toHaveLength(1)
  })
  it.each(['tree', 'storage', 'belt', 'furnace'] as const)('detours around a group of %s without touching it', kind => {
    const w = createBareWorld(() => .5)
    for (let y = 8; y <= 12; y++) for (let x = 5; x <= 13; x++) placeBuilding(w, x, y, kind, 'east')
    const before = structuredClone(w), route = plan(w, p(2, 10), p(16, 10))
    expect(route.error).toBeNull(); connected(route.cells)
    expect(route.cells.some(c => c.y < 8 || c.y > 12)).toBe(true)
    expect(route.cells.every(c => !before.buildings[c.y * SIZE + c.x])).toBe(true)
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(2, 10), p(16, 10), 'powerPole', 'east').placed).toBe(route.cells.length)
    for (let i = 0; i < before.buildings.length; i++) if (before.buildings[i]) expect(w.buildings[i]).toEqual(before.buildings[i])
    expect(allocatePower(w).networks).toHaveLength(1)
  })
  it('electrically crosses occupied intermediate ground with no line-of-sight or ground-path requirement', () => {
    const w = createBareWorld(() => .5)
    for (let y = 0; y < SIZE; y++) for (let x = 6; x <= 8; x++) placeBuilding(w, x, y, 'tree', 'east')
    const route = plan(w, p(4, 10), p(10, 10))
    expect(route.error).toBeNull(); expect(route.cells).toHaveLength(2); connected(route.cells)
    expect(commitConstruction(w, p(4, 10), p(10, 10), 'powerPole', 'east')).toEqual({ placed: 2, error: null })
    expect(allocatePower(w).networks).toHaveLength(1)
  })
  it('prioritizes zero new poles over a shorter route, reusing infrastructure off the direct corridor', () => {
    const w = createBareWorld(() => .5)
    for (const [x, y] of [[0, 10], [0, 4], [6, 4], [12, 4], [12, 10]]) placeBuilding(w, x, y, 'powerPole', 'west')
    const before = structuredClone(w), route = plan(w, p(0, 10), p(12, 10))
    expect(route.error).toBeNull(); expect(route.cells.every(c => c.reuse)).toBe(true); connected(route.cells)
    expect(commitConstruction(w, p(0, 10), p(12, 10), 'powerPole', 'east')).toEqual({ placed: 0, error: null })
    expect(w).toEqual(before)
  })
  it('snaps an adjacent valid destination to an existing pole, preserves exact starts and single-click placement', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 12, 0, 'powerPole', 'east')
    const route = plan(w, p(0, 0), p(11, 0))
    expect(route.snapFrom).toEqual(p(11, 0)); expect(route.cells.at(-1)).toMatchObject({ x: 12, y: 0, reuse: true })
    expect(route.cells.filter(c => !c.reuse)).toHaveLength(2)
    expect(commitConstruction(w, p(0, 0), p(11, 0), 'powerPole', 'east')).toEqual({ placed: 2, error: null })
    expect(w.buildings[11]).toBeNull(); expect(allocatePower(w).networks).toHaveLength(1)
    expect(plan(w, p(11, 0), p(11, 0)).snapFrom).toBeUndefined()
    expect(commitConstruction(w, p(11, 0), p(11, 0), 'powerPole', 'east')).toEqual({ placed: 1, error: null })
    expect(commitConstruction(w, p(12, 0), p(12, 0), 'powerPole', 'east')).toEqual({ placed: 0, error: null })
  })
  it('does not snap to remote poles or substitute a nearby pole for an invalid destination', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 12, 0, 'powerPole', 'east'); placeBuilding(w, 11, 0, 'storage', 'east')
    const before = structuredClone(w)
    expect(plan(w, p(0, 0), p(10, 0)).snapFrom).toBeUndefined()
    expect(plan(w, p(0, 0), p(10, 0)).cells.at(-1)).toMatchObject(p(10, 0))
    for (const [a, b] of [[p(0, 0), p(11, 0)], [p(11, 0), p(0, 0)], [p(-1, 0), p(10, 0)], [p(0, 0), p(40, 0)]]) {
      expect(commitConstruction(w, a, b, 'powerPole', 'east').placed).toBe(0)
      expect(w).toEqual(before)
    }
  })
  it('keeps exact existing endpoints and joins two networks with actual generator and machine power', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 5, 10, 'powerPole', 'east'); placeBuilding(w, 23, 10, 'powerPole', 'east')
    placeBuilding(w, 5, 11, 'generator', 'east')
    w.tiles[11 * SIZE + 23] = 'iron'; placeBuilding(w, 23, 11, 'miner', 'east')
    w.tiles[14 * SIZE + 23] = 'iron'; placeBuilding(w, 23, 14, 'miner', 'east')
    const poles = [structuredClone(w.buildings[405]), structuredClone(w.buildings[423])]
    expect(allocatePower(w).networks).toHaveLength(2)
    expect(w.power?.consumers[463].suppliedKw).toBe(0)
    const route = plan(w, p(5, 10), p(23, 10))
    expect(route.cells.filter(c => !c.reuse)).toHaveLength(2)
    expect(route.cells[0].reuse).toBe(true); expect(route.cells.at(-1)?.reuse).toBe(true)
    expect(commitConstruction(w, p(5, 10), p(23, 10), 'powerPole', 'east').placed).toBe(2)
    expect(allocatePower(w).networks).toHaveLength(1)
    expect(w.power?.consumers[463]).toMatchObject({ suppliedKw: 30, speedFraction: 1 })
    expect([w.buildings[405], w.buildings[423]]).toEqual(poles)
    expect(w.power?.consumers[583]).toMatchObject({ networkId: null, suppliedKw: 0, speedFraction: 0 })
    advanceWorld(w, 2000)
    expect(w.mined.iron).toBeGreaterThan(0)
  })
  it('uses stable tie-breaking in symmetric alternatives and keeps planning free of world mutation', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 8, 10, 'tree', 'east')
    const before = structuredClone(w), first = findPowerRoute(w, p(2, 10), p(14, 10))
    for (let i = 0; i < 4; i++) expect(findPowerRoute(w, p(2, 10), p(14, 10))).toEqual(first)
    expect(first.points).not.toBeNull(); connected(first.points!)
    expect(w).toEqual(before)
  })
  it('honors search bounds and budget, and returns a graceful failure for a genuinely isolated endpoint', () => {
    const w = createBareWorld(() => .5), before = structuredClone(w)
    expect(findPowerRoute(w, p(0, 0), p(39, 39), 3)).toEqual({ points: null, snapped: false, exhausted: true, expanded: 3 })
    const local = findPowerRoute(w, p(10, 10), p(20, 10))
    expect(local.expanded).toBeLessThanOrEqual(POWER_SEARCH_BUDGET)
    for (const c of local.points!) expect(c.y >= 10 - POWER_SEARCH_MARGIN && c.y <= 10 + POWER_SEARCH_MARGIN).toBe(true)
    expect(w).toEqual(before)
    for (let y = 0; y <= 6; y++) for (let x = 0; x <= 6; x++) if ((x || y) && polesConnect(p(0, 0), p(x, y))) placeBuilding(w, x, y, 'tree', 'east')
    const blocked = structuredClone(w)
    expect(plan(w, p(0, 0), p(12, 0)).error).toContain('No valid power route')
    expect(commitConstruction(w, p(0, 0), p(12, 0), 'powerPole', 'east').placed).toBe(0)
    expect(w).toEqual(blocked)
  })
})
describe('power construction, cache and persistence safety', () => {
  it('counts only new poles, costs zero at zero Wood, and commits/charges once on repeated release', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    placeBuilding(w, 2, 10, 'powerPole', 'east'); placeBuilding(w, 20, 10, 'powerPole', 'east')
    const before = structuredClone({ nature: w.nature, research: w.research, mined: w.mined, produced: w.produced })
    drag.begin(w, p(2, 10), 'powerPole', 'east'); drag.move(p(20, 10))
    const initial = drag.preview()
    w.timeMs += 50
    expect(drag.preview()).toBe(initial)
    expect(initial?.cells.filter(c => !c.reuse)).toHaveLength(2)
    expect(drag.finish(w)).toEqual({ placed: 2, error: null }); expect(drag.finish(w)).toBeNull()
    expect(w.buildings.filter(b => b?.kind === 'powerPole')).toHaveLength(4)
    expect({ nature: w.nature, research: w.research, mined: w.mined, produced: w.produced }).toEqual(before)
    expect(placementInfo(w, p(10, 20), 'powerPole')).toMatchObject({ state: 'valid', wood: 0, available: 0 })
    // There is no insufficient-funds state for free poles; retain the actual paid tool's rule.
    expect(placementInfo(w, p(10, 20), 'treehouse')).toMatchObject({ state: 'unaffordable', wood: 20, available: 0 })
  })
  it('replans after live obstacles/actors and rejects a newly invalid endpoint without partial construction', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    drag.begin(w, p(2, 10), 'powerPole', 'east'); drag.move(p(14, 10))
    const first = drag.preview()!, middle = first.cells[1]
    placeBuilding(w, middle.x, middle.y, 'tree', 'east')
    expect(drag.preview()).not.toBe(first)
    expect(drag.preview()?.error).toBeNull()
    chopTree(w, middle.x, middle.y)
    w.pete.tile = 10 * SIZE + 14; w.pete.next = null
    expect(drag.preview()?.error).toContain('Pete')
    const before = structuredClone(w)
    expect(drag.finish(w)?.placed).toBe(0); expect(w).toEqual(before)
  })
  it('keeps cancellation and stale-world releases harmless and saves only committed infrastructure in version 8', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    placeBuilding(w, 5, 10, 'powerPole', 'east'); placeBuilding(w, 23, 10, 'powerPole', 'east')
    const before = structuredClone(w)
    drag.begin(w, p(5, 10), 'powerPole', 'east'); drag.move(p(23, 10)); drag.preview()
    drag.cancel(); expect(drag.finish(w)).toBeNull(); expect(w).toEqual(before)
    drag.begin(w, p(5, 10), 'powerPole', 'east'); expect(drag.finish(createBareWorld(() => .5))).toBeNull()
    commitConstruction(w, p(5, 10), p(23, 10), 'powerPole', 'east')
    const text = encodeSave(w, view), restored = decodeSave(text).world
    expect(JSON.parse(text).version).toBe(40)
    expect(restored.buildings).toEqual(w.buildings)
    expect(allocatePower(restored).poleConnections).toEqual(allocatePower(w).poleConnections)
    advanceWorld(w, 550); advanceWorld(restored, 550)
    expect(restored.buildings).toEqual(w.buildings); expect(restored.research).toEqual(w.research)
  })
})
