import { expect, it } from 'vitest'
import { DIRECTIONS, offsets, placeBuilding, removeBuilding } from './world'
import { createBareWorld } from './testFixtures'
import { dockAtSpot, FISHING_MS, reachableFishingSpot } from './fishingDock'
import { advanceWorld } from './step'
import { paintWater } from './waterLandscaping'
import { placementInfo } from './construction'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { inspectBuilding } from './inspection'
import { createPeace, requestToilet, TOILET_MS } from './peace'
import { recordArrest } from '../factory/revengeSystem'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: ReturnType<typeof fixture>) => JSON.parse(encodeSave(w, view, '2026-10-21T00:00:00.000Z'))
function fixture() {
  const w = createBareWorld(() => .5)
  w.nature.wood = 40
  placeBuilding(w, 18, 23, 'treehouse', 'east')
  w.water[941] = true
  expect(placeBuilding(w, 20, 23, 'fishingDock', 'east')).toBe(true)
  Object.assign(w.peace, { activity: 'resting', sinceMs: 0, untilMs: 12000, seed: 1 })
  return w
}
function startFishing(w = fixture()) {
  advanceWorld(w, 12000)
  expect(w.peace.activity).toBe('dockward')
  for (let i = 0; i < 160 && w.peace.activity !== 'fishing'; i++) advanceWorld(w, 50)
  expect(w.peace.activity).toBe('fishing')
  return w
}
it.each(DIRECTIONS)('places on dry land facing %s water and charges once without a refund', direction => {
  const w = createBareWorld(() => .5), d = offsets[direction]
  w.nature.wood = 8; w.water[(10 + d.y) * 40 + 10 + d.x] = true
  const before = structuredClone(w)
  expect(placementInfo(w, { x: 10, y: 10 }, 'fishingDock', direction)).toMatchObject({ state: 'valid', wood: 8 })
  expect(w).toEqual(before)
  expect(placeBuilding(w, 10, 10, 'fishingDock', direction)).toBe(true)
  expect(w.buildings[410]).toMatchObject({ kind: 'fishingDock', direction })
  expect(w.nature.wood).toBe(0)
  expect(placeBuilding(w, 10, 10, 'fishingDock', direction)).toBe(false)
  removeBuilding(w, 10, 10); expect(w.nature.wood).toBe(0)
})
it('rejects invalid sites, wrong-facing or diagonal water and insufficient Wood', () => {
  const w = createBareWorld(() => .5); w.nature.wood = 8; w.water[451] = true
  expect(placeBuilding(w, 10, 10, 'fishingDock', 'east')).toBe(false)
  w.water[411] = true
  expect(placeBuilding(w, 11, 10, 'fishingDock', 'south')).toBe(false)
  expect(placeBuilding(w, 10, 10, 'fishingDock', 'north')).toBe(false)
  placeBuilding(w, 10, 10, 'storage', 'east')
  expect(placeBuilding(w, 10, 10, 'fishingDock', 'east')).toBe(false)
  removeBuilding(w, 10, 10); w.nature.wood = 7
  expect(placementInfo(w, { x: 10, y: 10 }, 'fishingDock', 'east').state).toBe('unaffordable')
  expect(placeBuilding(w, 10, 10, 'fishingDock', 'east')).toBe(false)
  expect(placeBuilding(w, 0, 0, 'fishingDock', 'north')).toBe(false)
  expect(w.nature.wood).toBe(7)
})
it('visits a reachable dock, fishes on a reserved land approach, then leaves without producing anything', () => {
  const w = fixture(), economy = structuredClone({ wood: w.nature.wood, mined: w.mined, produced: w.produced })
  startFishing(w)
  expect(w.pete.tile).toBe(939); expect(w.pete.next).toBeNull()
  expect(dockAtSpot(w, w.peace.destination)).toBe(w.buildings[940])
  expect(inspectBuilding(w, 940)).toMatchObject({ kind: 'fishingDock', direction: 'east', fishing: true })
  advanceWorld(w, FISHING_MS - 50); expect(w.peace.activity).toBe('fishing')
  advanceWorld(w, 50); expect(w.peace.activity).toBe('walking')
  advanceWorld(w, 5000); expect(['walking', 'waving', 'flowers']).toContain(w.peace.activity)
  expect(w.peace.destination).toBeNull()
  expect(inspectBuilding(w, 940)).toMatchObject({ fishing: false })
  expect({ wood: w.nature.wood, mined: w.mined, produced: w.produced }).toEqual(economy)
})
it('skips unreachable docks without consuming fishing RNG and can visit after a route opens', () => {
  const w = fixture()
  for (const y of [22, 24]) placeBuilding(w, 19, y, 'storage', 'east')
  expect(reachableFishingSpot(w)).toBeNull()
  advanceWorld(w, 12000); expect(w.peace.activity).toBe('walking'); expect(w.peace.seed).toBe((Math.imul(1664525, 1) + 1013904223) >>> 0) // Rest choice only; no fishing draw.
  for (const y of [22, 24]) removeBuilding(w, 19, y)
  expect(reachableFishingSpot(w)).toBe(939)
})
it.each(['dockward', 'fishing'] as const)('safely cancels %s when the dock or its water is removed, including immediate saves', phase => {
  for (const edit of ['dock', 'water']) {
    const w = fixture()
    if (phase === 'fishing') startFishing(w)
    else advanceWorld(w, 12100)
    expect(w.peace.activity).toBe(phase)
    if (edit === 'dock') removeBuilding(w, 20, 23)
    else expect(paintWater(w, { x: 21, y: 23 }, { x: 21, y: 23 }, 'land', 1)).toBe(1)
    expect(w.peace.activity).toBe('homeward'); expect(w.pete.next).toBeNull()
    expect(() => encodeSave(w, view)).not.toThrow()
    advanceWorld(w, 5000)
    expect(w.peace.activity).not.toBe('fishing')
    expect(w.pete.mode).toBe('WANDERING')
  }
})
it('protects the dock/approach from flooding and safely ends fishing when peace ends', () => {
  const w = startFishing()
  expect(paintWater(w, { x: 20, y: 23 }, { x: 20, y: 23 }, 'water', 1)).toBe(0)
  expect(paintWater(w, { x: 19, y: 23 }, { x: 19, y: 23 }, 'water', 1)).toBe(0)
  removeBuilding(w, 18, 23)
  expect(w.peace.home).toBeNull(); expect(w.peace.destination).toBeNull()
  expect(w.peace.activity).toBe('homeward'); expect(w.pete.mode).toBe('WANDERING')
  expect(() => encodeSave(w, view)).not.toThrow()
})
it('replans or cancels when the approach becomes occupied while Pete is travelling', () => {
  const w = fixture(); advanceWorld(w, 12050)
  expect(w.peace.activity).toBe('dockward')
  expect(placeBuilding(w, 19, 23, 'storage', 'east')).toBe(true)
  expect(w.peace.activity).toBe('homeward')
  advanceWorld(w, 5000); expect(w.pete.mode).toBe('WANDERING')
})
it.each(['dockward', 'fishing'] as const)('restores %s mid-activity deterministically without replaying visits', phase => {
  const w = fixture()
  if (phase === 'fishing') startFishing(w)
  else advanceWorld(w, 12100)
  const loaded = decodeSave(encodeSave(w, view)).world
  expect(snapshot(loaded)).toEqual(snapshot(w))
  advanceWorld(w, 0); expect(snapshot(loaded)).toEqual(snapshot(w))
  for (const delta of [16, 34, 750, 4000, 20000, 5000]) {
    advanceWorld(w, delta); advanceWorld(loaded, delta)
    expect(snapshot(loaded)).toEqual(snapshot(w))
  }
})
it('keeps no-dock peaceful routines and version-10 saves unchanged', () => {
  const w = fixture(); removeBuilding(w, 20, 23)
  w.peace.nextProjectCheckAtMs = 0; w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
  const original = snapshot(w); original.version = 10; delete original.game.personality; delete original.game.peace.nextProjectCheckAtMs
  const loaded = decodeSave(JSON.stringify(original)).world
  expect(snapshot(loaded)).toEqual(snapshot(w))
  for (let i = 0; i < 10; i++) { advanceWorld(w, 5000); advanceWorld(loaded, 5000) }
  expect(snapshot(loaded)).toEqual(snapshot(w))
})
it.each(['hostile', 'boss', 'prison'] as const)('does not affect %s Pete behavior or counters', situation => {
  const w = createBareWorld(() => .5); w.nature.wood = 8; w.water[411] = true
  placeBuilding(w, 10, 10, 'fishingDock', 'east')
  if (situation === 'boss') { for (let i = 0; i < 3; i++) recordArrest(w); advanceWorld(w, 5000) }
  if (situation === 'prison') {
    placeBuilding(w, 0, 0, 'prison', 'east')
    Object.assign(w.pete, { mode: 'IMPRISONED', prison: w.buildings[0], imprisonedAtMs: w.timeMs, x: 0, y: 0, tile: 0, next: null, travelMs: 0 })
  }
  const control = structuredClone(w); control.buildings[410] = { kind: 'storage', x: 10, y: 10, inventory: { ...w.mined } }
  advanceWorld(w, 1000); advanceWorld(control, 1000)
  expect(w.peace).toEqual(createPeace()); expect(w.pete).toEqual(control.pete)
  expect(w.revenge).toEqual(control.revenge); expect(w.police).toEqual(control.police)
})
it.each(['old-kind', 'old-activity', 'destination', 'direction', 'clock'] as const)('rejects malformed %s save data', mutation => {
  const w = startFishing(), save = snapshot(w)
  if (mutation === 'old-kind') { save.version = 10; delete save.game.personality }
  if (mutation === 'old-activity') { save.version = 10; delete save.game.personality; save.game.buildings[940] = null }
  if (mutation === 'destination') save.game.peace.destination = 1
  if (mutation === 'direction') save.game.buildings[940].direction = 'diagonal'
  if (mutation === 'clock') save.game.peace.untilMs += 50
  expect(() => decodeSave(JSON.stringify(save))).toThrow(/Invalid save/)
})

it('cancels the chosen dock when two docks share an approach instead of switching mid-fishing', () => {
  const w = fixture(); w.nature.wood += 8; w.water[859] = true
  expect(placeBuilding(w, 19, 22, 'fishingDock', 'north')).toBe(true)
  startFishing(w)
  expect(dockAtSpot(w, w.peace.destination)).toBe(w.buildings[899])
  expect(inspectBuilding(w, 899)).toMatchObject({ fishing: true })
  expect(inspectBuilding(w, 940)).toMatchObject({ fishing: false })
  removeBuilding(w, 19, 22)
  expect(w.peace.activity).toBe('homeward')
  expect(reachableFishingSpot(w)).toBe(939)
  expect(() => encodeSave(w, view)).not.toThrow()
})

it('always uses a reachable tree-side toilet before fishing and walks back to the dock', () => {
  const w = fixture()
  w.buildings[937] = { kind: 'tree', x: 17, y: 23, species: 'oak', origin: 'natural', bornAtMs: 0, nextReproductionAtMs: 300000 }
  w.topologyRevision++
  advanceWorld(w, 12000)
  for (let i = 0; i < 400 && w.peace.activity !== 'toiletward'; i++) advanceWorld(w, 50)
  expect(w.peace.activity).toBe('toiletward')
  expect(w.peace.toilet?.dock).toBe(939)
  expect([897, 938, 977, 936]).toContain(w.peace.toilet?.spot)
  for (let i = 0; i < 400 && w.peace.toilet?.phase !== 'working'; i++) advanceWorld(w, 50)
  expect(['peeing', 'pooping']).toContain(w.peace.activity)
  expect(w.pete.tile).toBe(w.peace.toilet?.spot)
  advanceWorld(w, TOILET_MS - 50)
  expect(w.peace.toilet?.phase).toBe('working')
  advanceWorld(w, 50)
  expect(w.peace.toilet?.phase).toBe('returning')
  for (let i = 0; i < 400 && w.peace.activity !== 'fishing'; i++) advanceWorld(w, 50)
  expect(w.peace.activity).toBe('fishing')
  expect(w.pete.tile).toBe(939)
  expect(w.peace.toilet).toBeUndefined()
})
it.each(['pee', 'poop'] as const)('accepts a selected tile for %s, waits for fishing, and resumes deterministically through saves', kind => {
  const w = startFishing()
  expect(requestToilet(w, 899, kind)).toBeNull()
  expect(w.peace.activity).toBe('fishing')
  expect(requestToilet(w, 939, kind)).toContain('schon')
  const phases = new Set<string>()
  for (let i = 0; i < 800; i++) {
    const phase = w.peace.toilet?.phase
    if (phase && !phases.has(phase)) {
      phases.add(phase)
      const restored = decodeSave(encodeSave(w, view)).world
      advanceWorld(w, 62.5); advanceWorld(restored, 62.5)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
    advanceWorld(w, 50)
    if (!w.peace.toilet) break
  }
  expect([...phases]).toEqual(['pending', 'walking', 'working'])
  expect(w.peace.toilet).toBeUndefined()
  expect(w.pete.tile).toBe(899)
})
it('rejects water, occupied and unreachable targets without changing state, and cancels a lost home', () => {
  const w = fixture(), before = snapshot(w)
  for (const tile of [-1, 1600, 1.5, 940, 941]) expect(requestToilet(w, tile, 'pee')).not.toBeNull()
  expect(snapshot(w)).toEqual(before)
  expect(requestToilet(w, 899, 'poop')).toBeNull()
  removeBuilding(w, 18, 23)
  expect(w.peace.toilet).toBeUndefined()
  expect(requestToilet(w, 899, 'pee')).not.toBeNull()
})
it('saves every automatic toilet phase, rejects corrupt state and keeps version 61 strict', () => {
  const w = fixture()
  advanceWorld(w, 12000)
  const phases = new Set<string>()
  for (let i = 0; i < 400 && w.peace.activity !== 'fishing'; i++) {
    const phase = w.peace.toilet?.phase
    if (phase && !phases.has(phase)) {
      phases.add(phase)
      const restored = decodeSave(encodeSave(w, view)).world
      advanceWorld(w, 12.5); advanceWorld(restored, 12.5)
      expect(snapshot(restored)).toEqual(snapshot(w))
      const bad = snapshot(w); bad.game.peace.toilet.kind = 'invalid'
      expect(() => decodeSave(JSON.stringify(bad))).toThrow()
      const legacy = snapshot(w); legacy.version = 61
      expect(() => decodeSave(JSON.stringify(legacy))).toThrow()
    }
    advanceWorld(w, 50)
  }
  expect([...phases]).toEqual(['walking', 'working', 'returning'])
  const legacy = snapshot(fixture()); legacy.version = 61
  expect(decodeSave(JSON.stringify(legacy)).world.peace.toilet).toBeUndefined()
})
it('cancels a toilet detour if its fishing dock disappears', () => {
  const w = fixture(); advanceWorld(w, 12000)
  for (let i = 0; i < 400 && !w.peace.toilet; i++) advanceWorld(w, 50)
  expect(w.peace.toilet).toBeDefined()
  removeBuilding(w, 20, 23)
  expect(w.peace.toilet).toBeUndefined()
  expect(w.peace.activity).toBe('homeward')
  expect(() => decodeSave(encodeSave(w, view))).not.toThrow()
})

it('finishes sleep before a manual toilet visit and preserves fixed-step partitioning', () => {
  const a = fixture(), b = fixture()
  for (const w of [a, b]) expect(requestToilet(w, 899, 'pee')).toBeNull()
  advanceWorld(a, 1000)
  for (let i = 0; i < 20; i++) advanceWorld(b, 50)
  expect(a.peace.activity).toBe('resting')
  expect(snapshot(a)).toEqual(snapshot(b))
  advanceWorld(a, 22000)
  for (let i = 0; i < 440; i++) advanceWorld(b, 50)
  expect(snapshot(a)).toEqual(snapshot(b))
  expect(a.peace.toilet).toBeUndefined()
})

it('keeps a manual request pending while Pete has committed repair work', () => {
  const w = fixture()
  Object.assign(w.peace, { activity: 'waving', untilMs: 4000 })
  w.rebuilding = { active: 900, jobs: [], rewarded: [] }
  expect(requestToilet(w, 899, 'poop')).toBeNull()
  advanceWorld(w, 50)
  expect(w.peace.toilet?.phase).toBe('pending')
  expect(w.peace.activity).toBe('waving')
  w.rebuilding.active = null
  advanceWorld(w, 50)
  expect(w.peace.activity).toBe('toiletward')
})

it('cancels an unreachable dock return without leaving an unsaveable toilet phase', () => {
  const w = fixture()
  w.buildings[937] = { kind: 'tree', x: 17, y: 23, species: 'oak', origin: 'natural', bornAtMs: 0, nextReproductionAtMs: 600000 }
  w.topologyRevision++
  advanceWorld(w, 12000)
  for (let i = 0; i < 800 && w.peace.toilet?.phase !== 'returning'; i++) advanceWorld(w, 50)
  expect(w.peace.toilet?.phase).toBe('returning')
  expect(placeBuilding(w, 19, 22, 'storage', 'east')).toBe(true)
  expect(placeBuilding(w, 19, 24, 'storage', 'east')).toBe(true)
  advanceWorld(w, 50)
  expect(w.peace.toilet).toBeUndefined()
  expect(w.peace.activity).toBe('homeward')
  expect(() => decodeSave(encodeSave(w, view))).not.toThrow()
})
