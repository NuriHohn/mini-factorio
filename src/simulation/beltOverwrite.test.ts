import { describe, expect, it } from 'vitest'
import { commitConstruction, planConstruction } from './construction'
import { ConstructionDrag } from '../game/constructionDrag'
import { beltPathPoint } from '../game/beltPath'
import { createBareWorld } from './testFixtures'
import { placeBuilding, opposite, SIZE } from './world'
import type { Belt, Direction, World } from './world'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const p = (x: number, y: number) => ({ x, y })
const plan = (w: World, x: number, y: number, ex: number, ey: number, d: Direction = 'east') => planConstruction(w, p(x, y), p(ex, ey), 'belt', d)
function belt(w: World, x: number, y: number): Belt {
  const b = w.buildings[y * SIZE + x]
  if (b?.kind !== 'belt') throw Error('fixture')
  return b
}
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
describe('axis-aware single belt overwrite', () => {
  it.each(['east', 'west', 'north', 'south'] as const)('reuses %s without recreating an entity or touching packet state', direction => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 10, 10, 'belt', direction)
    const b = belt(w, 10, 10); b.item = 'iron'; b.progress = .4
    const before = structuredClone(w)
    expect(plan(w, 10, 10, 10, 10, direction).cells[0]).toMatchObject({ reuse: true, reverse: false, error: null })
    expect(commitConstruction(w, p(10, 10), p(10, 10), 'belt', direction)).toEqual({ error: null, placed: 0 })
    expect(belt(w, 10, 10)).toBe(b); expect(w).toEqual(before)
  })
  it.each(['east', 'west', 'north', 'south'] as const)('reverses %s in place and preserves the straight packet position', direction => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 10, 10, 'belt', direction)
    const b = belt(w, 10, 10); b.item = 'copper'; b.progress = .25
    const position = beltPathPoint(b.entry, b.direction, b.progress), before = structuredClone(w), next = opposite(direction)
    expect(plan(w, 10, 10, 10, 10, next).cells[0]).toMatchObject({ reuse: true, reverse: true })
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(10, 10), p(10, 10), 'belt', next)).toEqual({ error: null, placed: 0, reversed: 1 })
    expect(belt(w, 10, 10)).toBe(b)
    expect(b).toMatchObject({ direction: next, item: 'copper', progress: .75, entry: direction })
    const after = beltPathPoint(b.entry, b.direction, b.progress)
    expect(after.x).toBeCloseTo(position.x); expect(after.y).toBeCloseTo(position.y)
    expect(w.nature).toEqual(before.nature); expect(w.research).toEqual(before.research)
    expect(w.topologyRevision).toBe(before.topologyRevision + 1)
    commitConstruction(w, p(10, 10), p(10, 10), 'belt', direction)
    expect(b).toEqual(before.buildings[410])
  })
  it.each(['east', 'west', 'north', 'south'] as const)('rotates a single %s belt to either perpendicular direction and delivers its packet once', from => {
    for (const to of (['east', 'west', 'north', 'south'] as const).filter(d => (d === 'east' || d === 'west') !== (from === 'east' || from === 'west'))) {
      const w = createBareWorld(() => .5); placeBuilding(w, 10, 10, 'belt', from)
      const b = belt(w, 10, 10); b.item = 'ironGear'; b.progress = .4
      const offset = to === 'east' ? p(1, 0) : to === 'west' ? p(-1, 0) : to === 'south' ? p(0, 1) : p(0, -1)
      placeBuilding(w, 10 + offset.x, 10 + offset.y, 'storage', 'east')
      const before = structuredClone(w), proposal = plan(w, 10, 10, 10, 10, to)
      expect(proposal.error).toBeNull()
      expect(proposal.cells[0]).toMatchObject({ direction: to, reuse: true, reverse: true, error: null })
      expect(w).toEqual(before)
      expect(commitConstruction(w, p(10, 10), p(10, 10), 'belt', to)).toEqual({ error: null, placed: 0, reversed: 1 })
      expect(belt(w, 10, 10)).toBe(b)
      expect(b).toMatchObject({ direction: to, item: 'ironGear', progress: .4 })
      expect(w.nature).toEqual(before.nature)
      expect(w.topologyRevision).toBe(before.topologyRevision + 1)
      const loaded = decodeSave(encodeSave(w, view)).world
      advanceWorld(w, 300); advanceWorld(loaded, 300)
      expect(loaded.buildings).toEqual(w.buildings)
      expect(b.item).toBeNull()
      const receiver = w.buildings[(10 + offset.y) * SIZE + 10 + offset.x]
      expect(receiver).toMatchObject({ inventory: { ironGear: 1 } })
      advanceWorld(w, 1000)
      expect(receiver).toMatchObject({ inventory: { ironGear: 1 } })
    }
  })
  it('keeps a side-entered item valid when its old entry becomes the new output', () => {
    const w = createBareWorld(() => .5); placeBuilding(w, 10, 10, 'belt', 'east')
    const b = belt(w, 10, 10); Object.assign(b, { entry: 'north', item: 'iron', progress: .7 })
    placeBuilding(w, 10, 9, 'storage', 'east')
    commitConstruction(w, p(10, 10), p(10, 10), 'belt', 'north')
    expect(b).toMatchObject({ entry: 'south', direction: 'north', item: 'iron', progress: .7 })
    const loaded = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 1000); advanceWorld(loaded, 1000)
    expect(loaded.buildings).toEqual(w.buildings)
    expect(b.item).toBeNull()
    expect(w.buildings[370]).toMatchObject({ inventory: { iron: 1 } })
  })
  it('does not treat dragging away and returning as a single-click overwrite', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    placeBuilding(w, 10, 10, 'belt', 'east')
    const before = structuredClone(w)
    expect(drag.begin(w, p(10, 10), 'belt', 'north')).toBeNull()
    expect(drag.preview()?.error).toBeNull()
    drag.move(p(10, 9))
    expect(drag.preview()?.cells.find(c => c.x === 10 && c.y === 10)).toMatchObject({ direction: 'east', reuse: true, reverse: false })
    drag.move(p(10, 10))
    expect(drag.preview()?.error).not.toBeNull()
    expect(drag.finish(w)?.error).not.toBeNull()
    expect(w).toEqual(before)
  })
  it('keeps side-entered packets valid and transfers each item exactly once after reversal/save/load', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 10, 10, 'belt', 'east'); placeBuilding(w, 9, 10, 'storage', 'east'); placeBuilding(w, 11, 10, 'storage', 'east')
    const b = belt(w, 10, 10); b.item = 'iron'; b.progress = .4; b.entry = 'north'
    commitConstruction(w, p(10, 10), p(10, 10), 'belt', 'west')
    expect(b).toMatchObject({ entry: 'north', progress: .4, item: 'iron', direction: 'west' })
    const text = encodeSave(w, view), restored = decodeSave(text).world
    expect(JSON.parse(text).version).toBe(41)
    advanceWorld(w, 300); advanceWorld(restored, 300)
    expect(restored.buildings).toEqual(w.buildings)
    expect(w.buildings[409]).toMatchObject({ inventory: { iron: 1 } })
    expect(w.buildings[411]).toMatchObject({ inventory: { iron: 0 } })
    expect(b.item).toBeNull()
    advanceWorld(w, 2000); expect(w.buildings[409]).toMatchObject({ inventory: { iron: 1 } })
  })
  it('moves a mirrored straight packet in its new direction on the next fixed step', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 10, 10, 'belt', 'east'); placeBuilding(w, 9, 10, 'storage', 'east')
    const b = belt(w, 10, 10); b.item = 'iron'; b.progress = .2
    commitConstruction(w, p(10, 10), p(10, 10), 'belt', 'west')
    advanceWorld(w, 50); expect(b.progress).toBeCloseTo(.9); expect(b.item).toBe('iron')
    advanceWorld(w, 50); expect(b.item).toBeNull(); expect(w.buildings[409]).toMatchObject({ inventory: { iron: 1 } })
  })
})
describe('deliberate versus incidental route edits and atomicity', () => {
  it('mixes new, unchanged and reversed segments, charging only the three new free cells', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 6, 10, 'belt', 'east'); placeBuilding(w, 7, 10, 'belt', 'west')
    const unchanged = belt(w, 6, 10), reversed = belt(w, 7, 10); unchanged.item = 'iron'; reversed.item = 'copper'
    const before = structuredClone(w), route = plan(w, 5, 10, 9, 10)
    expect(route.cells.filter(c => !c.reuse)).toHaveLength(3)
    expect(route.cells.filter(c => c.reverse)).toHaveLength(1)
    expect(w).toEqual(before)
    expect(commitConstruction(w, p(5, 10), p(9, 10), 'belt', 'east')).toEqual({ placed: 3, reversed: 1, error: null })
    expect(belt(w, 6, 10)).toBe(unchanged); expect(belt(w, 7, 10)).toBe(reversed)
    expect(unchanged).toEqual(before.buildings[406]); expect(reversed.item).toBe('copper')
    expect(w.nature).toEqual(before.nature); expect(w.mined).toEqual(before.mined); expect(w.produced).toEqual(before.produced)
  })
  it.each(['horizontal', 'vertical'])('reverses a deliberately dragged %s line without a detour or object replacement', axis => {
    const w = createBareWorld(() => .5), horizontal = axis === 'horizontal'
    for (let i = 5; i <= 12; i++) placeBuilding(w, horizontal ? i : 10, horizontal ? 10 : i, 'belt', horizontal ? 'east' : 'south')
    const refs = w.buildings.filter(b => b?.kind === 'belt'), a = horizontal ? p(12, 10) : p(10, 12), b = horizontal ? p(5, 10) : p(10, 5), d = horizontal ? 'west' : 'north'
    expect(planConstruction(w, a, b, 'belt', d).detour).toBe(false)
    expect(commitConstruction(w, a, b, 'belt', d)).toEqual({ placed: 0, reversed: 8, error: null })
    for (const ref of refs) { expect(w.buildings[ref!.y * SIZE + ref!.x]).toBe(ref); expect(ref).toMatchObject({ direction: d }) }
  })
  it.each(['horizontal', 'vertical'])('cannot cross an uninterrupted %s line and leaves the whole world unchanged', axis => {
    const w = createBareWorld(() => .5), horizontal = axis === 'horizontal'
    for (let i = 0; i < SIZE; i++) placeBuilding(w, horizontal ? i : 20, horizontal ? 10 : i, 'belt', horizontal ? 'east' : 'south')
    const before = structuredClone(w), a = horizontal ? p(20, 5) : p(15, 20), b = horizontal ? p(20, 15) : p(25, 20)
    expect(commitConstruction(w, a, b, 'belt', horizontal ? 'north' : 'east').error).not.toBeNull()
    expect(w).toEqual(before)
  })
  it('routes around a finite perpendicular line without altering it', () => {
    const w = createBareWorld(() => .5)
    for (let x = 10; x <= 14; x++) placeBuilding(w, x, 10, 'belt', 'east')
    const before = w.buildings.map(b => b && structuredClone(b)), route = plan(w, 12, 14, 12, 6, 'north')
    expect(route.error).toBeNull(); expect(route.detour).toBe(true)
    expect(route.cells.every(c => !c.reverse)).toBe(true)
    commitConstruction(w, p(12, 14), p(12, 6), 'belt', 'north')
    for (let x = 10; x <= 14; x++) expect(w.buildings[400 + x]).toEqual(before[400 + x])
  })
  it('does not reverse incidental bands and prefers correctly flowing reused segments on equal-length detours', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 7, 5, 'tree', 'east')
    for (let x = 6; x <= 8; x++) placeBuilding(w, x, 6, 'belt', 'east')
    const first = plan(w, 5, 5, 9, 5)
    expect(first.error).toBeNull(); expect(first.cells.filter(c => c.reuse)).toHaveLength(3)
    expect(first.cells.every(c => !c.reverse)).toBe(true)
    const incidental = belt(w, 7, 6); incidental.direction = 'west'; w.topologyRevision++
    const before = structuredClone(incidental), next = plan(w, 5, 5, 9, 5)
    expect(next.error).toBeNull(); expect(next.cells.some(c => c.x === 7 && c.y === 6)).toBe(false)
    expect(next.cells.every(c => !c.reverse)).toBe(true)
    expect(plan(w, 5, 5, 9, 5)).toEqual(next)
    commitConstruction(w, p(5, 5), p(9, 5), 'belt', 'east'); expect(incidental).toEqual(before)
  })
  it('preserves several occupied reversed belts across save/load and deterministic time partitions', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 9, 10, 'storage', 'east')
    for (const [i, item] of (['iron', 'copper', 'ironGear'] as const).entries()) {
      placeBuilding(w, 10 + i, 10, 'belt', 'east')
      const b = belt(w, 10 + i, 10); b.item = item; b.progress = (i + 1) / 4
    }
    const refs = [belt(w, 10, 10), belt(w, 11, 10), belt(w, 12, 10)]
    expect(commitConstruction(w, p(12, 10), p(10, 10), 'belt', 'west')).toEqual({ placed: 0, reversed: 3, error: null })
    const restored = decodeSave(encodeSave(w, view)).world
    for (let i = 0; i < 3; i++) expect(belt(w, 10 + i, 10)).toBe(refs[i])
    advanceWorld(w, 3000)
    for (let i = 0; i < 60; i++) advanceWorld(restored, 50)
    expect(restored.buildings).toEqual(w.buildings)
    expect(w.buildings[409]).toMatchObject({ inventory: { iron: 1, copper: 1, ironGear: 1 } })
    expect(refs.every(b => b.item === null)).toBe(true)
  })
  it('revalidates endpoints before applying any new placement or reversal, and cancel/repeated release are harmless', () => {
    const w = createBareWorld(() => .5), drag = new ConstructionDrag()
    placeBuilding(w, 7, 10, 'belt', 'west')
    drag.begin(w, p(5, 10), 'belt', 'east'); drag.move(p(9, 10)); expect(drag.preview()?.error).toBeNull()
    const preview = drag.preview(); expect(drag.preview()).toBe(preview)
    placeBuilding(w, 9, 10, 'tree', 'east')
    const before = structuredClone(w)
    expect(drag.finish(w)?.placed).toBe(0); expect(w).toEqual(before)
    drag.begin(w, p(7, 10), 'belt', 'east'); drag.cancel(); expect(drag.finish(w)).toBeNull(); expect(w).toEqual(before)
    drag.begin(w, p(7, 10), 'belt', 'east')
    expect(drag.finish(w)).toMatchObject({ reversed: 1 }); expect(drag.finish(w)).toBeNull()
  })
})
describe('conservative endpoint connections', () => {
  it('turns a new endpoint into one unambiguous rear connection matching selected facing, with live item delivery', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 11, 12, 'belt', 'east'); placeBuilding(w, 12, 12, 'storage', 'east')
    const receiver = belt(w, 11, 12), before = structuredClone(receiver), route = plan(w, 10, 15, 10, 12)
    expect(route.beltSnap).toEqual(p(11, 12)); expect(route.cells.at(-1)?.direction).toBe('east')
    commitConstruction(w, p(10, 15), p(10, 12), 'belt', 'east')
    expect(belt(w, 10, 12).direction).toBe(route.cells.at(-1)?.direction); expect(receiver).toEqual(before)
    belt(w, 10, 15).item = 'iron'; advanceWorld(w, 4000)
    expect(w.buildings[492]).toMatchObject({ inventory: { iron: 1 } })
  })
  it('does not join parallel independent lines or guess between multiple valid receivers', () => {
    const w = createBareWorld(() => .5)
    for (let x = 8; x <= 16; x++) placeBuilding(w, x, 11, 'belt', 'east')
    const before = structuredClone(w)
    expect(plan(w, 8, 12, 16, 12).beltSnap).toBeUndefined()
    expect(plan(w, 8, 12, 16, 12).cells.at(-1)?.direction).toBe('east')
    expect(w).toEqual(before)
    placeBuilding(w, 11, 15, 'belt', 'east'); placeBuilding(w, 10, 14, 'belt', 'north')
    const ambiguous = plan(w, 10, 18, 10, 15)
    expect(ambiguous.beltSnap).toBeUndefined(); expect(ambiguous.cells.at(-1)?.direction).toBe('north')
  })
  it('respects selected manual orientation, exact single clicks and opposing/side-facing receivers', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 11, 12, 'belt', 'east')
    expect(plan(w, 10, 15, 10, 12, 'west').beltSnap).toBeUndefined()
    expect(plan(w, 10, 15, 10, 12, 'west').cells.at(-1)?.direction).toBe('north')
    expect(plan(w, 10, 12, 10, 12, 'north').cells[0].direction).toBe('north')
    belt(w, 11, 12).direction = 'west'
    expect(plan(w, 10, 15, 10, 12).beltSnap).toBeUndefined()
    belt(w, 11, 12).direction = 'north'
    expect(plan(w, 10, 15, 10, 12).beltSnap).toBeUndefined()
  })
  it('approaches an existing endpoint on its own axis rather than rotating it perpendicularly', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 13, 12, 'belt', 'north')
    const receiver = belt(w, 13, 12), before = structuredClone(receiver), route = plan(w, 10, 12, 13, 12)
    expect(route.error).toBeNull(); expect(route.cells.at(-1)).toMatchObject({ direction: 'north', reuse: true, reverse: false })
    commitConstruction(w, p(10, 12), p(13, 12), 'belt', 'east')
    expect(receiver).toEqual(before)
  })
})
