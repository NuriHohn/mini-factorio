import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { awardActivity } from './personality'
import { projectCandidates, trySecretProject, advanceSecretProject } from './secretProject'
import { feedGarden } from './feeding'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function until(w: World, predicate: () => boolean) { for (let n = 0; n < 12000 && !predicate(); n++) advanceWorld(w, 50); expect(predicate()).toBe(true) }
function choose(w: World, id: string) {
  const cs = projectCandidates(w), index = cs.findIndex(c => c.definition.id === id); expect(index).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((n, c) => n + c.priorityWeight, 0), low = cs.slice(0, index).reduce((n, c) => n + c.priorityWeight, 0) / total, high = low + cs[index].priorityWeight / total
  for (let seed = 0; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) { w.peace.seed = seed; break } }
  expect(trySecretProject(w)).toBe(true)
}
function world() {
  const w = createBareWorld(() => .5); w.nature.wood = 500; placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); awardActivity(w.personality, { path: 'eco', xp: 20 })
  const crate = w.buildings[824] as SupplyCrate
  for (const [id, cost, ready] of [['fence', 6, () => w.project?.phase === 'complete'], ['coop', 10, () => w.coopProject?.phase === 'complete'], ['garden', 12, () => w.gardenProject?.phase === 'complete']] as const) { crate.wood = cost; choose(w, id); until(w, ready) }
  return w
}
function working() { const w = world(); feedGarden(w)!.feed = 1; choose(w, 'feeding'); until(w, () => (w.feedingProject?.elapsedMs ?? 0) >= 500); return w }
describe('garden-to-coop feeding', () => {
  it('grows feed only after completed care, caps stock and physically collects a single portion before feeding', () => {
    const w = world(); expect(feedGarden(w)?.feed).toBe(0); expect(projectCandidates(w).some(c => c.definition.id === 'feeding')).toBe(false)
    const crate = w.buildings[824] as SupplyCrate; crate.wood = 2; choose(w, 'gardenCare'); until(w, () => w.careProject?.phase === 'building')
    expect(feedGarden(w)?.feed).toBe(0); until(w, () => w.careProject?.phase === 'complete'); expect(feedGarden(w)?.feed).toBe(1)
    const before = structuredClone(w); projectCandidates(w); expect(w).toEqual(before)
    choose(w, 'feeding'); expect(feedGarden(w)?.feed).toBe(1); until(w, () => w.feedingProject?.phase === 'building')
    expect(feedGarden(w)?.feed).toBe(0); expect(w.feedingProject?.carriedFeed).toBe(1)
    const xp = w.personality.paths.eco.xp, restored = load(w)
    until(w, () => w.feedingProject!.elapsedMs >= 500); advanceWorld(restored, w.timeMs - restored.timeMs)
    const remaining = 4000 - w.feedingProject!.elapsedMs
    advanceWorld(w, remaining - 50); expect(w.personality.paths.eco.xp).toBe(xp)
    advanceWorld(w, 50); advanceWorld(restored, remaining)
    expect(snapshot(restored)).toEqual(snapshot(w)); expect(w.personality.paths.eco.xp).toBe(xp + 2)
    expect(w.feedingProject).toMatchObject({ phase: 'complete', carriedFeed: 0, completedCycles: 1, readyAtMs: w.timeMs + 180000 })
    advanceSecretProject(w, 4000); expect(w.personality.paths.eco.xp).toBe(xp + 2)
    feedGarden(w)!.feed = 4; advanceWorld(w, 179950); expect(projectCandidates(w).some(c => c.definition.id === 'feeding')).toBe(false)
    expect(feedGarden(w)!.feed).toBeLessThanOrEqual(4)
  })
  it('caps feed grown by real completed care and never grows it during cosmetic watering', () => {
    const w = world(); feedGarden(w)!.feed = 4
    const crate = w.buildings[824] as SupplyCrate; crate.wood = 2
    choose(w, 'gardenCare'); until(w, () => w.careProject?.phase === 'complete')
    expect(feedGarden(w)!.feed).toBe(4)
    const doc = snapshot(w), garden = doc.game.buildings[w.gardenProject!.tiles[0]]!
    if (garden.kind === 'peteGarden') garden.feed = 5
    expect(() => decodeSave(JSON.stringify(doc))).toThrow('Invalid save')
  })
  it('retains carried food/work through home loss and never rewards a removed coop', () => {
    const w = working(), xp = w.personality.paths.eco.xp, elapsed = w.feedingProject!.elapsedMs
    removeBuilding(w, 20, 20); const restored = load(w); advanceWorld(restored, 5000)
    expect(restored.feedingProject).toMatchObject({ carriedFeed: 1, elapsedMs: elapsed }); expect(restored.personality.paths.eco.xp).toBe(xp)
    placeBuilding(restored, 20, 20, 'treehouse', 'east'); until(restored, () => restored.feedingProject?.phase === 'complete')
    expect(restored.personality.paths.eco.xp).toBe(xp + 2)
    const blocked = working(), tile = blocked.coopProject!.tiles[0], beforeXp = blocked.personality.paths.eco.xp
    removeBuilding(blocked, tile % 40, Math.floor(tile / 40)); advanceWorld(blocked, 5000)
    expect(blocked.feedingProject?.carriedFeed).toBe(1); expect(blocked.personality.paths.eco.xp).toBe(beforeXp); expect(() => load(blocked)).not.toThrow()
  })
  it('preserves partitions and rejects forged feed balances, cooldowns, links and earlier schemas', () => {
    const w = working(); advanceWorld(w, 17); const split = load(w)
    advanceWorld(w, 10017); for (const ms of [17, 1000, 2000, 7000]) advanceWorld(split, ms)
    expect(snapshot(split)).toEqual(snapshot(w)); const before = snapshot(w)
    for (const mutate of [
      (d: SaveDocument) => { d.game.feedingProject!.carriedFeed = 1 },
      (d: SaveDocument) => { d.game.feedingProject!.completedCycles = 0 },
      (d: SaveDocument) => { d.game.feedingProject!.readyAtMs!++ },
      (d: SaveDocument) => { d.game.feedingProject!.tiles = [41] },
      (d: SaveDocument) => { Object.assign(d, { version: 32 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
    expect(snapshot(w)).toEqual(before)
  })
})
