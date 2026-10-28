import { stripVersion52State } from './testFixtures'
import { expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { DIRECTIONS, offsets, placeBuilding, removeBuilding, SIZE } from './world'
import type { FishingDock } from './world'
import { advanceWorld } from './step'
import { BOARDING_MS, planRowboat, ROWBOAT_RANGE, rowboatPosition } from './rowboat'
import { paintWater } from './waterLandscaping'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { commitConstruction } from './construction'
import { neighboringTiles } from './navigation'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
export function boatWorld(seed = 8) {
  const w = createBareWorld(() => .5)
  w.nature.wood = 40
  expect(placeBuilding(w, 18, 23, 'treehouse', 'east')).toBe(true)
  for (let x = 21; x <= 27; x++) for (let y = 22; y <= 24; y++) w.water[y * SIZE + x] = true
  expect(placeBuilding(w, 20, 23, 'fishingDock', 'east')).toBe(true)
  Object.assign(w.peace, { activity: 'resting', sinceMs: 0, untilMs: 12000, seed })
  return w
}
export function boarding() {
  const w = boatWorld()
  for (let i = 0; i < 400 && w.peace.activity !== 'boating'; i++) advanceWorld(w, 50)
  expect(w.peace.boat?.phase).toBe('boarding')
  return w
}
it.each(DIRECTIONS)('plans a bounded, connected round trip from a %s-facing dock', direction => {
  const w = createBareWorld(() => .5), d = offsets[direction]
  for (let i = 1; i <= 12; i++) w.water[(20 + d.y * i) * SIZE + 20 + d.x * i] = true
  const dock: FishingDock = { kind: 'fishingDock', x: 20, y: 20, direction }
  const before = structuredClone(w), boat = planRowboat(w, dock)!
  expect(boat.path).toHaveLength(ROWBOAT_RANGE * 2)
  expect(boat.path.at(-1)).toBe(boat.tile)
  let previous = boat.tile
  for (const tile of boat.path) { expect(w.water[tile]).toBe(true); expect(neighboringTiles(previous)).toContain(tile); previous = tile }
  expect(w).toEqual(before)
})
it('occasionally boards, rows smoothly on water and returns to the dock before resuming its routine', () => {
  const w = boarding(), economy = structuredClone({ wood: w.nature.wood, mined: w.mined, produced: w.produced })
  const start = w.peace.boat!.tile, visited = new Set<number>(), phases = new Set<string>()
  advanceWorld(w, BOARDING_MS - 50); expect(w.peace.boat?.phase).toBe('boarding')
  advanceWorld(w, 50); expect(w.peace.boat?.phase).toBe('rowing')
  const initial = rowboatPosition(w.peace.boat!)
  advanceWorld(w, 50)
  const moved = rowboatPosition(w.peace.boat!)
  expect(Math.hypot(moved.x - initial.x, moved.y - initial.y)).toBeCloseTo(.025)
  for (let i = 0; i < 600 && w.peace.boat; i++) {
    const boat = w.peace.boat!
    phases.add(boat.phase); visited.add(boat.tile)
    expect(w.water[boat.tile]).toBe(true)
    expect(w.pete.tile).toBe(939); expect(w.pete.next).toBeNull()
    if (boat.phase === 'landing') expect(boat.tile).toBe(start)
    advanceWorld(w, 50)
  }
  expect(phases).toEqual(new Set(['rowing', 'landing']))
  expect(visited.size).toBeGreaterThan(3)
  expect(w.peace.boat).toBeUndefined(); expect(w.peace.activity).toBe('walking')
  expect({ wood: w.nature.wood, mined: w.mined, produced: w.produced }).toEqual(economy)
  advanceWorld(w, 5000); expect(['walking', 'waving', 'flowers']).toContain(w.peace.activity)
})
it('keeps fishing as an alternative instead of launching at every eligible visit', () => {
  const w = boatWorld(1)
  for (let i = 0; i < 400 && w.peace.activity !== 'fishing'; i++) advanceWorld(w, 50)
  expect(w.peace.activity).toBe('fishing'); expect(w.peace.boat).toBeUndefined()
})
it('skips tiny/disconnected water without consuming another routine choice', () => {
  const w = boatWorld()
  for (let x = 21; x <= 27; x++) for (let y = 22; y <= 24; y++) w.water[y * SIZE + x] = false
  w.water[941] = true; w.water[942] = true
  for (let x = 25; x <= 30; x++) for (let y = 20; y < 30; y++) w.water[y * SIZE + x] = true
  expect(planRowboat(w, w.buildings[940] as FishingDock)).toBeNull()
  for (let i = 0; i < 400 && w.peace.activity !== 'fishing'; i++) advanceWorld(w, 50)
  expect(w.peace.activity).toBe('fishing')
  const afterRestChoice = (Math.imul(1664525, 8) + 1013904223) >>> 0
  expect(w.peace.seed).toBe((Math.imul(1664525, afterRestChoice) + 1013904223) >>> 0) // Fishing choice only; no boat draw.
})
it('keeps a map-edge water route in bounds and never connects across row wrapping', () => {
  const w = createBareWorld(() => .5)
  for (let y = 0; y < 10; y++) w.water[y * SIZE + 39] = true
  w.water[40] = true
  const boat = planRowboat(w, { kind: 'fishingDock', x: 38, y: 0, direction: 'east' })!
  expect(boat.path.every(i => i % SIZE === 39)).toBe(true)
  expect(boat.path.every(i => i >= 0 && i < SIZE * SIZE)).toBe(true)
})
it.each(['dock', 'water', 'route', 'home'] as const)('safely interrupts a trip on %s removal and can save immediately', edit => {
  const w = boarding(); advanceWorld(w, BOARDING_MS + 750)
  if (edit === 'dock') removeBuilding(w, 20, 23)
  if (edit === 'home') removeBuilding(w, 18, 23)
  if (edit === 'water' || edit === 'route') {
    const tile = edit === 'water' ? w.peace.boat!.tile : w.peace.boat!.path[2]
    expect(paintWater(w, { x: tile % SIZE, y: Math.floor(tile / SIZE) }, { x: tile % SIZE, y: Math.floor(tile / SIZE) }, 'land', 1)).toBe(1)
  }
  expect(w.peace.boat).toBeUndefined(); expect(w.peace.activity).toBe('homeward')
  expect(w.water[w.pete.tile]).toBe(false)
  expect(() => encodeSave(w, view)).not.toThrow()
  advanceWorld(w, 5000); expect(w.pete.mode).toBe('WANDERING')
})
it.each(['belt', 'footbridge'] as const)('cancels after atomic %s bridge construction intersects a remaining water route, before an immediate save', kind => {
  const w = boarding()
  expect(commitConstruction(w, { x: 23, y: 21 }, { x: 23, y: 25 }, kind, 'south', true).error).toBeNull()
  expect(w.peace.boat).toBeUndefined()
  expect(w.peace.activity).toBe('homeward')
  expect(() => encodeSave(w, view)).not.toThrow()
})
it('keeps equivalent 30/60-frame partitions and zero elapsed time deterministic', () => {
  const w = boarding(), other = structuredClone(w), before = structuredClone(w)
  advanceWorld(w, 0); expect(w).toEqual(before)
  for (let i = 0; i < 180; i++) advanceWorld(w, 1000 / 30)
  for (let i = 0; i < 360; i++) advanceWorld(other, 1000 / 60)
  expect(other.remainder).toBeCloseTo(w.remainder, 10)
  expect({ ...other, remainder: w.remainder }).toEqual(w)
})
it.each(['boarding', 'rowing', 'landing'] as const)('restores %s exactly and continues without replaying the trip', phase => {
  const w = boarding()
  while (w.peace.boat!.phase !== phase) advanceWorld(w, 50)
  advanceWorld(w, 137.5)
  const loaded = decodeSave(encodeSave(w, view)).world
  expect(loaded.peace).toEqual(w.peace)
  for (const delta of [12.5, 50, 750, 4000, 20000, 5000]) {
    advanceWorld(w, delta); advanceWorld(loaded, delta)
    expect(loaded.peace).toEqual(w.peace); expect(loaded.pete).toEqual(w.pete)
  }
})
it('loads legacy version-11 peaceful activity unchanged', () => {
  const w = boatWorld(1)
  for (let i = 0; i < 400 && w.peace.activity !== 'fishing'; i++) advanceWorld(w, 50)
  expect(w.peace.activity).toBe('fishing')
  w.peace.nextProjectCheckAtMs = 0; w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
  const legacy = JSON.parse(encodeSave(w, view)); stripVersion52State(legacy.game); legacy.version = 11; delete legacy.game.personality; delete legacy.game.peace.nextProjectCheckAtMs
  const loaded = decodeSave(JSON.stringify(legacy)).world
  expect(loaded.peace).toEqual(w.peace)
  advanceWorld(w, 30000); advanceWorld(loaded, 30000)
  expect(loaded.peace).toEqual(w.peace)
})
it.each(['old-version', 'missing-trip', 'wrong-dock', 'land', 'disconnected', 'oversized', 'clock', 'phase', 'hidden'] as const)('rejects malformed %s rowboat state', bad => {
  const w = boarding(), save = JSON.parse(encodeSave(w, view)), boat = save.game.peace.boat
  if (bad === 'old-version') { save.version = 11; delete save.game.personality }
  if (bad === 'missing-trip') delete save.game.peace.boat
  if (bad === 'wrong-dock') boat.dock = 1
  if (bad === 'land') boat.tile = 1
  if (bad === 'disconnected') boat.path[1] = boat.path[1] + 3
  if (bad === 'oversized') boat.path = Array(13).fill(boat.tile)
  if (bad === 'clock') boat.travelMs = 1
  if (bad === 'phase') boat.phase = 'swimming'
  if (bad === 'hidden') boat.inventory = 1
  expect(() => decodeSave(JSON.stringify(save))).toThrow('Invalid save')
})
