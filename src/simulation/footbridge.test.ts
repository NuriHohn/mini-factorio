import { expect, it } from 'vitest'
import { createUnlockedWorld } from './testFixtures'
import { placeBuilding, removeBuilding, removalError, SIZE } from './world'
import { commitConstruction, planConstruction } from './construction'
import { FOOTBRIDGE_WOOD } from './footbridge'
import { reachableTiles, walkableTile } from './navigation'
import { advanceWorld } from './step'
import { paintWater } from './waterLandscaping'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { ConstructionDrag } from '../game/constructionDrag'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
export function river(width = 3) {
  const w = createUnlockedWorld(() => .5)
  w.nature.wood = 50
  for (let y = 0; y < SIZE; y++) for (let x = 10; x < 10 + width; x++) w.water[y * SIZE + x] = true
  return w
}
it.each([1, 3, 5])('builds and reuses a complete %s-tile crossing atomically, charging only new decks', width => {
  const w = river(width), start = { x: 9, y: 10 }, end = { x: 10 + width, y: 10 }
  const before = structuredClone(w), plan = planConstruction(w, start, end, 'footbridge', 'east', true)
  expect(plan.error).toBeNull(); expect(plan.wood).toBe(width * FOOTBRIDGE_WOOD)
  expect(w).toEqual(before)
  expect(reachableTiles(w, 409).has(410 + width)).toBe(false)
  expect(commitConstruction(w, start, end, 'footbridge', 'east', true)).toMatchObject({ error: null, placed: width, wood: width * 3 })
  expect(w.nature.wood).toBe(50 - width * 3)
  expect(reachableTiles(w, 409).has(410 + width)).toBe(true)
  expect(reachableTiles(w, 409, false).has(410 + width)).toBe(false)
  const revision = w.topologyRevision
  expect(commitConstruction(w, end, start, 'footbridge', 'west', true)).toMatchObject({ error: null, placed: 0, wood: 0 })
  expect(w.topologyRevision).toBe(revision)
})
it('builds a vertical footbridge and rejects diagonal, dry, overlong and occupied proposals without mutations', () => {
  const w = createUnlockedWorld(() => .5); w.nature.wood = 20
  for (let y = 10; y < 13; y++) w.water[y * SIZE + 10] = true
  expect(commitConstruction(w, { x: 10, y: 9 }, { x: 10, y: 13 }, 'footbridge', 'south', true).placed).toBe(3)
  expect(w.buildings[410]).toMatchObject({ kind: 'footbridge', direction: 'south' })
  for (const [start, end] of [[{ x: 9, y: 9 }, { x: 13, y: 13 }], [{ x: 20, y: 20 }, { x: 20, y: 23 }], [{ x: -1, y: 10 }, { x: 10, y: 10 }]]) {
    const before = structuredClone(w)
    expect(commitConstruction(w, start, end, 'footbridge', 'east', true).error).toBeTruthy(); expect(w).toEqual(before)
  }
  const wide = river(6), before = structuredClone(wide)
  expect(commitConstruction(wide, { x: 9, y: 10 }, { x: 16, y: 10 }, 'footbridge', 'east', true).error).toMatch(/1–5/)
  expect(wide).toEqual(before)
})
it('rejects insufficient funds, building/belt conflicts, occupied shores and direct single-segment placement', () => {
  const w = river(), start = { x: 9, y: 10 }, end = { x: 13, y: 10 }
  w.nature.wood = 8
  expect(planConstruction(w, start, end, 'footbridge', 'east', true)).toMatchObject({ unaffordable: true, wood: 9 })
  expect(commitConstruction(w, start, end, 'footbridge', 'east', true).placed).toBe(0)
  expect(w.nature.wood).toBe(8); w.nature.wood = 50
  expect(placeBuilding(w, 10, 10, 'footbridge', 'east')).toBe(false)
  placeBuilding(w, 9, 10, 'storage', 'east')
  expect(commitConstruction(w, start, end, 'footbridge', 'east', true).error).toBeTruthy()
  removeBuilding(w, 9, 10)
  expect(commitConstruction(w, start, end, 'belt', 'east', true).error).toBeNull()
  const before = structuredClone(w)
  expect(commitConstruction(w, start, end, 'footbridge', 'east', true).error).toBeTruthy(); expect(w).toEqual(before)
})
it('uses the normal drag transaction and safe cancel/world replacement controls', () => {
  const w = river(), drag = new ConstructionDrag(), start = { x: 9, y: 10 }
  expect(drag.begin(w, start, 'footbridge', 'east')).toBeNull()
  drag.move({ x: 13, y: 10 }); expect(drag.preview()?.error).toBeNull()
  expect(drag.cancel()).toBe(true); expect(drag.finish(w)).toBeNull()
  expect(w.nature.wood).toBe(50)
  drag.begin(w, start, 'footbridge', 'east'); drag.move({ x: 13, y: 10 })
  expect(drag.finish(structuredClone(w))).toBeNull()
  drag.begin(w, start, 'footbridge', 'east'); drag.move({ x: 13, y: 10 })
  w.nature.wood = 0
  expect(drag.finish(w)?.placed).toBe(0)
  expect(w.buildings[410]).toBeNull()
})
it('lets Pete cross water while keeping unbridged water impassable and persists mid-step', () => {
  const w = river()
  commitConstruction(w, { x: 9, y: 10 }, { x: 13, y: 10 }, 'footbridge', 'east', true)
  Object.assign(w.pete, { tile: 409, x: 9, y: 10, next: null, travelMs: 0, mode: 'FLEEING', escape: 413, path: [410, 411, 412, 413], pathRevision: w.topologyRevision })
  advanceWorld(w, 300)
  expect(w.pete.x).toBeGreaterThan(10)
  const loaded = decodeSave(encodeSave(w, view)).world
  advanceWorld(w, 1000); advanceWorld(loaded, 1000)
  expect(loaded.pete).toEqual(w.pete)
  expect(w.pete.tile).toBe(413)
  expect(walkableTile(w, 450)).toBe(false)
})
it('blocks occupied or reserved-next demolition, then removes the whole crossing and clears stale routes', () => {
  const w = river()
  commitConstruction(w, { x: 9, y: 10 }, { x: 13, y: 10 }, 'footbridge', 'east', true)
  Object.assign(w.pete, { tile: 409, x: 9, y: 10, next: 410, travelMs: 0 })
  expect(removalError(w, 11, 10)).toMatch(/in use/)
  expect(removeBuilding(w, 11, 10)).toBe(false)
  Object.assign(w.pete, { next: null, path: [410, 411, 412, 413], pathRevision: w.topologyRevision })
  expect(removeBuilding(w, 11, 10)).toBe(true)
  expect([410, 411, 412].every(i => w.buildings[i] === null)).toBe(true)
  expect(w.pete.path).toEqual([]); expect(w.pete.pathRevision).toBe(-1)
  expect(w.nature.wood).toBe(41)
  expect(() => encodeSave(w, view)).not.toThrow()
})
it('protects landings and water beneath footbridges from construction and landscaping', () => {
  const w = river()
  commitConstruction(w, { x: 9, y: 10 }, { x: 13, y: 10 }, 'footbridge', 'east', true)
  expect(placeBuilding(w, 9, 10, 'storage', 'east')).toBe(false)
  expect(paintWater(w, { x: 9, y: 10 }, { x: 9, y: 10 }, 'water', 1)).toBe(0)
  expect(paintWater(w, { x: 11, y: 10 }, { x: 11, y: 10 }, 'land', 1)).toBe(0)
})
it.each(['missing', 'direction', 'bank', 'old-version', 'water'] as const)('rejects malformed %s crossings and retains old-save compatibility', bad => {
  const w = river()
  commitConstruction(w, { x: 9, y: 10 }, { x: 13, y: 10 }, 'footbridge', 'east', true)
  const save = JSON.parse(encodeSave(w, view))
  if (bad === 'missing') save.game.buildings[411] = null
  if (bad === 'direction') save.game.buildings[411].direction = 'south'
  if (bad === 'bank') save.game.buildings[409] = { kind: 'powerPole', x: 9, y: 10 }
  if (bad === 'old-version') { save.version = 12; delete save.game.personality }
  if (bad === 'water') save.game.water[411] = false
  expect(() => decodeSave(JSON.stringify(save))).toThrow('Invalid save')
  const old = river(); const legacy = JSON.parse(encodeSave(old, view)); legacy.version = 12; delete legacy.game.personality; delete legacy.game.peace.nextProjectCheckAtMs
  expect(decodeSave(JSON.stringify(legacy)).world.water).toEqual(old.water)
})

it('routes peaceful Pete home across the footbridge without ever stepping onto unbridged water', () => {
  const w = river()
  commitConstruction(w, { x: 9, y: 10 }, { x: 13, y: 10 }, 'footbridge', 'east', true)
  Object.assign(w.pete, { tile: 415, x: 15, y: 10, next: null, travelMs: 0 })
  expect(placeBuilding(w, 9, 11, 'treehouse', 'east')).toBe(true)
  let crossed = false
  for (let i = 0; i < 220; i++) {
    advanceWorld(w, 50)
    if (w.water[w.pete.tile]) { crossed = true; expect(w.buildings[w.pete.tile]?.kind).toBe('footbridge') }
  }
  expect(crossed).toBe(true)
  expect(['entering', 'resting']).toContain(w.peace.activity)
})
it('lets the responding police car and its arrested passenger cross, count once and resume mid-bridge saves', () => {
  const w = river()
  commitConstruction(w, { x: 9, y: 10 }, { x: 13, y: 10 }, 'footbridge', 'east', true)
  expect(placeBuilding(w, 0, 0, 'prison', 'east')).toBe(true)
  placeBuilding(w, 15, 9, 'radar', 'east'); placeBuilding(w, 15, 8, 'powerPole', 'east'); placeBuilding(w, 15, 7, 'generator', 'east')
  Object.assign(w.pete, { tile: 415, x: 15, y: 10, next: null, travelMs: 0, mode: 'CRYING', cryingMs: 10000 })
  const crossings = new Set<string>()
  let loaded: typeof w | null = null
  for (let i = 0; i < 400; i++) {
    advanceWorld(w, 50)
    const car = w.police.car
    if (car && w.water[car.tile]) {
      expect(w.buildings[car.tile]?.kind).toBe('footbridge')
      crossings.add(car.phase)
      expect(removeBuilding(w, 11, 10)).toBe(false)
      if (!loaded) loaded = decodeSave(encodeSave(w, view)).world
    }
  }
  expect(crossings.has('RESPONDING')).toBe(true)
  expect(crossings.has('TRANSPORTING')).toBe(true)
  expect(w.pete.mode).toBe('IMPRISONED')
  expect(w.revenge.arrests).toBe(1)
  expect(loaded).not.toBeNull()
  advanceWorld(loaded!, 20000)
  expect(loaded!.pete.mode).toBe('IMPRISONED')
  expect(loaded!.revenge.arrests).toBe(1)
  expect(removeBuilding(w, 11, 10)).toBe(true)
  expect(() => encodeSave(w, view)).not.toThrow()
})
it('clears a police route before departure when a free crossing is demolished', () => {
  const w = river()
  commitConstruction(w, { x: 9, y: 10 }, { x: 13, y: 10 }, 'footbridge', 'east', true)
  placeBuilding(w, 0, 0, 'prison', 'east')
  const prison = w.buildings[0]
  if (prison?.kind !== 'prison') throw new Error('Missing prison')
  w.police.car = { tile: 409, x: 9, y: 10, next: null, travelMs: 0, path: [410, 411, 412, 413], pathRevision: w.topologyRevision, target: 413, phase: 'RESPONDING', arrestElapsedMs: 0, arrestFrom: { x: 17, y: 23 }, prison }
  expect(removeBuilding(w, 11, 10)).toBe(true)
  expect(w.police.car.path).toEqual([])
  expect(w.police.car.pathRevision).toBe(-1)
  expect(() => encodeSave(w, view)).not.toThrow()
  advanceWorld(w, 50)
  expect(w.police.car).toBeNull()
})
