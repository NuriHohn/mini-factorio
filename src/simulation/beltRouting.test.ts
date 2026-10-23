import { describe, expect, it } from 'vitest'
import { BELT_SEARCH_BUDGET, findBeltRoute } from './beltRouting'
import { commitConstruction, planConstruction } from './construction'
import { ConstructionDrag } from '../game/constructionDrag'
import { createBareWorld } from './testFixtures'
import { placeBuilding, SIZE } from './world'
import type { Position } from './world'
import { chopTree } from './nature'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const p = (x: number, y: number) => ({ x, y })
const coords = (cells: Position[]) => cells.map(c => [c.x, c.y])
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
describe('smart belt routing', () => {
  it('preserves a valid direct L route, selected axis and single-click direction', () => {
    const w = createBareWorld(() => .5)
    expect(coords(planConstruction(w, p(5, 5), p(7, 7), 'belt', 'east').cells)).toEqual([[5, 5], [6, 5], [7, 5], [7, 6], [7, 7]])
    expect(coords(planConstruction(w, p(5, 5), p(7, 7), 'belt', 'north').cells)).toEqual([[5, 5], [5, 6], [5, 7], [6, 7], [7, 7]])
    expect(planConstruction(w, p(5, 5), p(7, 7), 'belt', 'east').detour).toBe(false)
    expect(planConstruction(w, p(5, 5), p(5, 5), 'belt', 'west').cells[0].direction).toBe('west')
  })
  it.each(['tree', 'storage', 'belt', 'generator'] as const)('routes around %s without removing or modifying it or any other world state', kind => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 7, 5, kind, kind === 'belt' ? 'south' : 'west')
    const before = structuredClone(w), plan = planConstruction(w, p(5, 5), p(9, 5), 'belt', 'east')
    expect(plan).toMatchObject({ error: null, detour: true })
    expect(plan.cells).toHaveLength(7)
    expect(plan.cells.some(c => c.x === 7 && c.y === 5)).toBe(false)
    expect(plan.cells.every(c => !c.error && !c.reuse)).toBe(true)
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(5, 5), p(9, 5), 'belt', 'east')).toEqual({ placed: 7, error: null })
    expect(w.buildings[207]).toEqual(before.buildings[207])
  })
  it('selects deterministically between equal alternatives and minimizes turns after length', () => {
    const run = () => findBeltRoute(p(5, 5), p(9, 5), 'east', (x, y) => x !== 7 || y !== 5)
    const first = run()
    for (let i = 0; i < 5; i++) expect(run()).toEqual(first)
    expect(first.points).toHaveLength(7)
    // Two turns is the minimum for this obstacle: leave the row immediately,
    // follow one parallel row, then return at the endpoint (no zigzags).
    const a = first.points!
    const delta = a.slice(1).map((b, i) => `${b.x - a[i].x},${b.y - a[i].y}`)
    expect(delta.filter((d, i) => i > 0 && d !== delta[i - 1])).toHaveLength(2)
  })
  it.each([[0, 0, 4, 0, 2, 0], [39, 39, 35, 39, 37, 39], [0, 4, 0, 0, 0, 2]])('stays cardinal and inside map edges', (x, y, ex, ey, bx, by) => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, bx, by, 'tree', 'east')
    const plan = planConstruction(w, p(x, y), p(ex, ey), 'belt', 'west')
    expect(plan.error).toBeNull(); expect(plan.detour).toBe(true)
    for (let i = 0; i < plan.cells.length; i++) {
      const c = plan.cells[i]
      expect(c.x >= 0 && c.x < SIZE && c.y >= 0 && c.y < SIZE).toBe(true)
      if (i) expect(Math.abs(c.x - plan.cells[i - 1].x) + Math.abs(c.y - plan.cells[i - 1].y)).toBe(1)
    }
    expect(planConstruction(w, p(x, y), p(-1, 0), 'belt', 'east').error).toContain('inside')
  })
  it('rejects enclosed destinations and blocked endpoints atomically with useful feedback', () => {
    const w = createBareWorld(() => .5)
    for (const [x, y] of [[9, 10], [11, 10], [10, 9], [10, 11]]) placeBuilding(w, x, y, 'storage', 'east')
    const before = structuredClone(w)
    expect(commitConstruction(w, p(5, 10), p(10, 10), 'belt', 'east')).toMatchObject({ placed: 0, error: expect.stringContaining('No free path') })
    expect(planConstruction(w, p(5, 10), p(9, 10), 'belt', 'east').error).toContain('building')
    expect(w).toEqual(before)
  })
  it('bounds work and fails gracefully on exhausted budget or a detour outside the search margin', () => {
    let calls = 0
    const limited = findBeltRoute(p(5, 5), p(35, 35), 'east', () => { calls++; return true }, 4)
    expect(limited).toEqual({ points: null, exhausted: true, expanded: 4 })
    // Each expansion now checks outgoing and incoming directions separately.
    expect(calls).toBeLessThanOrEqual(2 + 8 * limited.expanded)
    // The map has a route around the bottom of the wall, outside this local search.
    expect(findBeltRoute(p(4, 4), p(8, 4), 'east', (x, y) => x !== 6 || y === 20)).toMatchObject({ points: null, exhausted: false })
    expect(findBeltRoute(p(0, 0), p(39, 39), 'east', () => true).points).not.toBeNull()
    const w = createBareWorld(() => .5)
    placeBuilding(w, 38, 39, 'storage', 'east'); placeBuilding(w, 39, 38, 'storage', 'east')
    const before = structuredClone(w)
    expect(commitConstruction(w, p(0, 0), p(39, 39), 'belt', 'east')).toMatchObject({ placed: 0, error: expect.stringContaining('search limit') })
    expect(w).toEqual(before)
    expect(findBeltRoute(p(0, 0), p(39, 39), 'east', (x, y) => !(x === 38 && y === 39) && !(x === 39 && y === 38)).expanded).toBe(BELT_SEARCH_BUDGET)
  })
  it('reuses previews until relevant geometry changes and revalidates a new detour at release exactly once', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    drag.begin(w, p(5, 5), 'belt', 'east'); drag.move(p(9, 5))
    const initial = drag.preview()
    w.timeMs += 50 // Simulation clock alone does not change placement geometry.
    expect(drag.preview()).toBe(initial)
    placeBuilding(w, 7, 5, 'tree', 'east')
    expect(drag.preview()).not.toBe(initial); expect(drag.preview()?.detour).toBe(true)
    // Another obstruction after preview must be respected by the release command.
    placeBuilding(w, 7, 6, 'storage', 'east')
    const stock = structuredClone({ nature: w.nature, mined: w.mined, produced: w.produced, research: w.research })
    const result = drag.finish(w)
    expect(result?.error).toBeNull(); expect(result?.placed).toBe(7)
    expect(drag.finish(w)).toBeNull()
    expect(w.buildings[247]?.kind).toBe('storage')
    expect({ nature: w.nature, mined: w.mined, produced: w.produced, research: w.research }).toEqual(stock)
  })
  it('drops a cached detour when obstacles disappear or actor reservations change; cancellation builds nothing', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    placeBuilding(w, 7, 5, 'tree', 'east')
    drag.begin(w, p(5, 5), 'belt', 'east'); drag.move(p(9, 5))
    expect(drag.preview()?.detour).toBe(true)
    chopTree(w, 7, 5)
    expect(drag.preview()?.detour).toBe(false)
    w.pete.tile = 207; w.pete.next = null; w.pete.x = 7; w.pete.y = 5
    expect(drag.preview()?.detour).toBe(true)
    w.pete.mode = 'IMPRISONED'
    expect(drag.preview()?.detour).toBe(false)
    w.pete.mode = 'WANDERING'
    expect(drag.preview()?.detour).toBe(true)
    const before = structuredClone(w)
    drag.cancel(); expect(drag.finish(w)).toBeNull(); expect(w).toEqual(before)
  })
  it.each(['east', 'north', 'west', 'south'] as const)('transports through detour corners %s with unchanged timing, costs and version-8 saves', facing => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 7, 5, 'tree', 'east')
    const plan = planConstruction(w, p(5, 5), p(9, 5), 'belt', facing)
    expect(commitConstruction(w, p(5, 5), p(9, 5), 'belt', facing).placed).toBe(plan.cells.length)
    const last = plan.cells.at(-1)!, prior = plan.cells.at(-2)!
    placeBuilding(w, last.x + last.x - prior.x, last.y + last.y - prior.y, 'storage', 'east')
    const first = w.buildings[205]!
    if (first.kind !== 'belt') throw Error('fixture')
    first.item = 'iron'
    const text = encodeSave(w, view), restored = decodeSave(text).world
    expect(JSON.parse(text).version).toBe(37)
    advanceWorld(w, 4500); advanceWorld(restored, 4500)
    expect(restored.buildings).toEqual(w.buildings)
    expect(w.buildings.filter(b => b?.kind === 'storage')).toEqual([expect.objectContaining({ inventory: expect.objectContaining({ iron: 1 }) })])
    expect(w.nature.wood).toBe(0)
  })
})
