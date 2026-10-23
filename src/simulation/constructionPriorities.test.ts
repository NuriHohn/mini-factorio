import { deliverItem } from './transport'
import { WORKSHOP_ACTIVITY_MS } from './workshop'
import { beforeAll, describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import { GIFT_MIN_MS, GIFT_MAX_MS, PROJECT_CHECK_MS } from './peace'
import { constructionHint, currentProject, projectCandidates } from './secretProject'
import { peteReachableTiles } from './navigation'
import { SUPPLY_INSPECTION_MS } from './supplyCrate'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World) => w.buildings[824] as SupplyCrate
function until(w: World, ready: () => boolean, limit = 180000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 500
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east')
  supplyWood(template, 824, 6)
  until(template, () => template.project?.phase === 'complete')
})
function obstructed() {
  const w = structuredClone(template)
  for (const tile of [823, 940, 817]) expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')).toBe(true)
  expect(supplyWood(w, 824, 90)).toBe(true)
  return w
}
describe('construction placement and daily priorities', () => {
  it('finds alternatives after the completed fence and obstacles block all four original sites', () => {
    const w = obstructed()
    expect(crate(w).wood).toBe(90)
    expect(w.project?.built).toBe(3)
    expect(projectCandidates(w).map(c => c.definition.id)).toEqual(expect.arrayContaining(['coop', 'campfire']))
    until(w, () => w.coopProject?.phase === 'complete' && w.campfireProject?.phase === 'complete')
    for (const p of [w.coopProject!, w.campfireProject!]) {
      expect([700, 823, 940, 817]).not.toContain(p.tiles[0])
      expect(w.water[p.tiles[0]]).toBe(false)
    }
    for (const tile of [823, 940, 817]) expect(w.buildings[tile]?.kind).toBe('storage')
    expect(crate(w).wood).toBe(75)
    expect(w.personality.rewardedProjects.filter(id => id === 'coop')).toHaveLength(1)
    expect(w.personality.rewardedProjects.filter(id => id === 'campfire')).toHaveLength(1)
    expect(() => load(w)).not.toThrow()
  })
  it('starts affordable construction promptly without waiting for a cosmetic activity and sleep', () => {
    const w = structuredClone(template); supplyWood(w, 824, 15)
    Object.assign(w.peace, { activity: 'flowers', sinceMs: w.timeMs, untilMs: w.timeMs + 5000, destination: null })
    advanceWorld(w, PROJECT_CHECK_MS)
    expect(w.peace.activity).toBe('project')
  })
  it('chains funded construction at completion without another trip home or rest', () => {
    const w = structuredClone(template); supplyWood(w, 824, 15)
    until(w, () => w.coopProject?.phase === 'complete' || w.campfireProject?.phase === 'complete')
    expect(w.peace.activity).toBe('project')
    expect(currentProject(w)?.phase).toBe('collecting')
    expect(w.coopProject?.phase === 'complete' && w.campfireProject?.phase === 'complete').toBe(false)
    until(w, () => w.coopProject?.phase === 'complete' && w.campfireProject?.phase === 'complete')
    expect(crate(w).wood).toBe(0)
  })
  it('replans a genuinely blocked unpaid follow-up without overwriting obstacles or charging stock', () => {
    const w = obstructed(), original = projectCandidates(w).find(c => c.definition.id === 'coop')!.project
    w.coopProject = { ...original, selected: true }
    const blocked = original.tiles[0]
    expect(placeBuilding(w, blocked % SIZE, Math.floor(blocked / SIZE), 'storage', 'east')).toBe(true)
    const alternative = projectCandidates(w).find(c => c.definition.id === 'coop')!
    expect(alternative.project.tiles).not.toContain(blocked)
    expect(w.coopProject).toMatchObject({ carried: 0, elapsedMs: 0 })
    expect(crate(w).wood).toBe(90)
    until(w, () => w.coopProject?.phase === 'complete')
    expect(w.buildings[blocked]?.kind).toBe('storage')
  })
  it('can reuse the old work approach when relocating an unpaid blocked site', () => {
    const w = obstructed(), original = projectCandidates(w).find(c => c.definition.id === 'coop')!.project
    const tile = original.tiles[0]
    w.coopProject = { ...original, spots: [tile + 1], selected: true }
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')).toBe(true)
    const alternative = projectCandidates(w).find(c => c.definition.id === 'coop')
    expect(alternative).toBeDefined()
    expect(alternative!.project.tiles).not.toContain(tile)
    expect(crate(w).wood).toBe(90)
  })
  it('rejects inaccessible or disconnecting sites and keeps one stable feedback hint between bounded retries', () => {
    const w = structuredClone(template)
    expect(placeBuilding(w, 29, 20, 'supplyCrate', 'east')).toBe(true); supplyWood(w, 829, 90)
    w.water.fill(true)
    for (let i = 0; i < w.buildings.length; i++) if (w.buildings[i]) w.water[i] = false
    // A narrow reachable corridor supplies Pete but cannot safely hold a building.
    for (let x = 20; x <= 29; x++) w.water[19 * SIZE + x] = false
    w.water[w.pete.tile] = false; w.topologyRevision++
    Object.assign(w.pete, { next: null, travelMs: 0, path: [], pathRevision: -1 })
    Object.assign(w.peace, { activity: 'flowers', sinceMs: w.timeMs, untilMs: w.timeMs + 5000, destination: null, nextProjectCheckAtMs: 0 })
    expect(peteReachableTiles(w, w.pete.tile).has(789)).toBe(true)
    expect(projectCandidates(w)).toEqual([])
    advanceWorld(w, 50)
    const hint = constructionHint(w), due = w.peace.nextProjectCheckAtMs, seed = w.peace.seed
    expect(hint).toBe('No safe site for Chicken Coop / Campfire. Clear nearby space.')
    advanceWorld(w, 4000)
    expect(constructionHint(w)).toBe(hint); expect(w.peace.nextProjectCheckAtMs).toBe(due); expect(w.peace.seed).toBe(seed)
    expect((w.buildings[829] as SupplyCrate).wood).toBe(90)
    expect(snapshot(load(w))).toEqual(snapshot(w))
    w.water.fill(false); w.topologyRevision++
    until(w, () => w.peace.activity === 'project', PROJECT_CHECK_MS + 50)
    expect(constructionHint(w)).toBe('')
  })
  it('can inspect, explore and react repeatedly without mandatory home or sleep between activities', () => {
    const w = structuredClone(template)
    Object.assign(w.pete, { tile: 823, x: 23, y: 20, next: null, travelMs: 0, path: [], pathRevision: -1 })
    Object.assign(w.peace, { activity: 'checkingCrate', destination: 823, sinceMs: w.timeMs + 50 - SUPPLY_INSPECTION_MS, untilMs: w.timeMs + 50 })
    // Choose normal exploration rather than the optional rest or repeat crate visit.
    let seed = 0
    for (; seed < 100000; seed++) {
      const first = (Math.imul(1664525, seed) + 1013904223) >>> 0, second = (Math.imul(1664525, first) + 1013904223) >>> 0
      if (first / 4294967296 >= .2 && second / 4294967296 >= 1 / 3) break
    }
    w.peace.seed = seed; advanceWorld(w, 50)
    expect(w.peace.activity).toBe('walking')
    until(w, () => ['waving', 'flowers'].includes(w.peace.activity))
    w.peace.seed = seed; advanceWorld(w, w.peace.untilMs - w.timeMs)
    expect(w.peace.activity).toBe('walking')
    expect(() => load(w)).not.toThrow()
  })
  it('finishes committed workshop work and rewards it once before switching to a newly funded project', () => {
    const w = structuredClone(template); supplyWood(w, 824, 4)
    for (let i = 0; i < 8; i++) expect(deliverItem(crate(w), 'ironPlate', 'east')).toBe(true)
    until(w, () => w.peace.activity === 'hammering', 300000)
    const xp = w.personality.paths.craftsman.xp
    supplyWood(w, 824, 90)
    advanceWorld(w, WORKSHOP_ACTIVITY_MS - 50)
    expect(w.peace.activity).toBe('hammering'); expect(crate(w).wood).toBe(90)
    expect(w.personality.paths.craftsman.xp).toBe(xp)
    advanceWorld(w, 50)
    expect(w.personality.paths.craftsman.xp).toBe(xp + 1)
    expect(w.peace.activity).toBe('project'); expect(currentProject(w)?.phase).toBe('collecting')
    expect(crate(w).wood).toBe(90)
    expect(() => load(w)).not.toThrow()
  })
  it('keeps expanded construction, retry deadlines and routine transitions deterministic through saves', () => {
    const w = obstructed(); until(w, () => (currentProject(w)?.elapsedMs ?? 0) >= 500)
    advanceWorld(w, 17); const restored = load(w)
    expect(snapshot(restored)).toEqual(snapshot(w))
    const paused = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(paused)
    advanceWorld(w, 100017)
    for (const ms of [17, 1000, 9000, 30000, 60000]) advanceWorld(restored, ms)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(w.coopProject?.phase).toBe('complete'); expect(w.campfireProject?.phase).toBe('complete')
  })
  it('uses 15–25 minute gift intervals while preserving a pending legacy gift and its resources', () => {
    expect(GIFT_MIN_MS).toBe(900000); expect(GIFT_MAX_MS).toBe(1500000)
    const w = structuredClone(template); w.peace.nextGiftAtMs = 400000; w.peace.nextProjectCheckAtMs = 0
    const old = snapshot(w); Object.assign(old, { version: 25 }); Reflect.deleteProperty(old.game.peace, 'nextProjectCheckAtMs')
    const restored = decodeSave(JSON.stringify(old)).world
    expect(snapshot(restored)).toEqual(snapshot(w))
    const stock = restored.nature.wood
    advanceWorld(restored, 400000 - restored.timeMs)
    expect(restored.peace.gifts).toHaveLength(1); expect(restored.nature.wood).toBe(stock)
    expect(restored.peace.nextGiftAtMs - restored.timeMs).toBeGreaterThanOrEqual(GIFT_MIN_MS)
    expect(restored.peace.nextGiftAtMs - restored.timeMs).toBeLessThanOrEqual(GIFT_MAX_MS)
    expect(snapshot(load(restored))).toEqual(snapshot(restored))
  })
  it('strictly validates expanded geometry, the retry clock and older schemas', () => {
    const w = obstructed(); until(w, () => (w.coopProject?.elapsedMs ?? 0) >= 500)
    for (const mutate of [
      (d: SaveDocument) => { d.game.coopProject!.tiles[0] = 20 * SIZE + 27 },
      (d: SaveDocument) => { d.game.coopProject!.spots[0] = 820 },
      (d: SaveDocument) => { d.game.peace.nextProjectCheckAtMs = d.game.timeMs + PROJECT_CHECK_MS + 50 },
      (d: SaveDocument) => { d.game.peace.nextProjectCheckAtMs++ },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game.peace, 'nextProjectCheckAtMs') },
      (d: SaveDocument) => { Object.assign(d, { version: 25 }) },
    ]) {
      const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save')
    }
    const legacy = snapshot(w); Object.assign(legacy, { version: 25 }); Reflect.deleteProperty(legacy.game.peace, 'nextProjectCheckAtMs')
    legacy.game.peace.nextGiftAtMs = w.timeMs + 600000
    expect(() => decodeSave(JSON.stringify(legacy))).toThrow('project.tiles')
  })

})
