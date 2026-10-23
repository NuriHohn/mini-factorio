import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { awardActivity } from './personality'
import { projectCandidates, trySecretProject, advanceSecretProject } from './secretProject'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import type { SaveDocument } from '../persistence/saveGame'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: World) => encodeSave(w, view, '2026-10-23T00:00:00.000Z')
const load = (w: World) => decodeSave(save(w)).world
const crate = (w: World) => w.buildings[824] as SupplyCrate
function until(w: World, predicate: () => boolean) { for (let n = 0; n < 12000 && !predicate(); n++) advanceWorld(w, 50); expect(predicate()).toBe(true) }
function choose(w: World, id: string) {
  const candidates = projectCandidates(w), index = candidates.findIndex(p => p.definition.id === id)
  expect(index).toBeGreaterThanOrEqual(0)
  const total = candidates.reduce((sum, p) => sum + p.priorityWeight, 0), low = candidates.slice(0, index).reduce((sum, p) => sum + p.priorityWeight, 0) / total, high = low + candidates[index].priorityWeight / total
  for (let seed = 0; seed < 100000; seed++) { const roll = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (roll >= low && roll < high) { w.peace.seed = seed; break } }
  expect(trySecretProject(w)).toBe(true)
}
function garden() {
  const w = createBareWorld(() => .5); w.nature.wood = 500
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); awardActivity(w.personality, { path: 'eco', xp: 20 })
  supplyWood(w, 824, 12); choose(w, 'garden'); until(w, () => w.gardenProject?.phase === 'complete')
  return w
}
function working() { const w = garden(); supplyWood(w, 824, 2); choose(w, 'gardenCare'); until(w, () => (w.careProject?.elapsedMs ?? 0) >= 500); return w }
describe('paid repeatable garden care', () => {
  it('loads a version-30 garden without inventing care work, spending Wood or granting XP', () => {
    const w = garden(), document = JSON.parse(save(w))
    document.version = 30; delete document.game.buildings[w.gardenProject!.tiles[0]].feed
    const restored = decodeSave(JSON.stringify(document)).world
    expect(restored.careProject).toBeUndefined()
    expect(restored.personality).toEqual(w.personality)
    expect(restored.buildings).toEqual(w.buildings)
    expect(JSON.parse(save(restored))).toEqual(JSON.parse(save(w)))
  })
  it('requires two Wood in one reachable crate, physically collects once and grants XP only on completion', () => {
    const w = garden(); supplyWood(w, 824, 1)
    placeBuilding(w, 30, 20, 'supplyCrate', 'east'); supplyWood(w, 830, 1)
    expect(projectCandidates(w).some(p => p.definition.id === 'gardenCare')).toBe(false)
    supplyWood(w, 824, 1); const before = structuredClone(w); projectCandidates(w); expect(w).toEqual(before)
    choose(w, 'gardenCare'); expect(crate(w).wood).toBe(2)
    until(w, () => w.careProject?.phase === 'building')
    expect(w.careProject).toMatchObject({ carried: 2, completedCycles: 0 }); expect(crate(w).wood).toBe(0); expect(w.personality.paths.eco.xp).toBe(40)
    until(w, () => w.careProject!.elapsedMs >= 500)
    const revision = w.topologyRevision, restored = load(w), remaining = 4000 - w.careProject!.elapsedMs
    advanceWorld(w, remaining - 50); expect(w.personality.paths.eco.xp).toBe(40)
    advanceWorld(w, 50); advanceWorld(restored, remaining)
    expect(JSON.parse(save(restored))).toEqual(JSON.parse(save(w)))
    expect(w.careProject).toMatchObject({ phase: 'complete', carried: 0, completedCycles: 1, readyAtMs: w.timeMs + 60000 })
    expect(w.personality.paths.eco.xp).toBe(44); expect(w.topologyRevision).toBe(revision)
    expect(w.buildings[w.gardenProject!.tiles[0]]?.kind).toBe('peteGarden')
    advanceSecretProject(w, 4000); expect(w.personality.paths.eco.xp).toBe(44)
    advanceWorld(w, 59950); expect(projectCandidates(w).some(p => p.definition.id === 'gardenCare')).toBe(false)
    advanceWorld(w, 50); supplyWood(w, 824, 2); choose(w, 'gardenCare'); until(w, () => w.careProject?.phase === 'complete')
    expect(w.careProject?.completedCycles).toBe(2); expect(w.personality.paths.eco.xp).toBe(48)
    expect(() => load(w)).not.toThrow()
  })
  it('retains paid progress across home loss and blocked sites without another debit', () => {
    const w = working(), elapsed = w.careProject!.elapsedMs
    removeBuilding(w, 20, 20); const restored = load(w); advanceWorld(restored, 5000)
    expect(restored.careProject).toMatchObject({ phase: 'building', carried: 2, elapsedMs: elapsed, completedCycles: 0 })
    placeBuilding(restored, 20, 20, 'treehouse', 'east'); until(restored, () => restored.careProject?.phase === 'complete')
    expect(crate(restored).wood).toBe(0); expect(restored.personality.paths.eco.xp).toBe(44)
    const blocked = working(), tile = blocked.gardenProject!.tiles[0]
    removeBuilding(blocked, tile % SIZE, Math.floor(tile / SIZE)); advanceWorld(blocked, 10000)
    expect(blocked.careProject?.carried).toBe(2); expect(blocked.personality.paths.eco.xp).toBe(40); expect(() => load(blocked)).not.toThrow()
  })
  it('preserves partitioned timing, pause and strict save accounting with detached failures', () => {
    const w = working(); advanceWorld(w, 17); const split = load(w), before = save(w)
    advanceWorld(w, 0); expect(save(w)).toBe(before)
    advanceWorld(w, 10017); for (const ms of [17, 1000, 2000, 7000]) advanceWorld(split, ms)
    expect(JSON.parse(save(split))).toEqual(JSON.parse(save(w)))
    const unchanged = save(w)
    for (const mutate of [
      (d: SaveDocument) => { d.game.careProject!.carried = 1 },
      (d: SaveDocument) => { d.game.careProject!.completedCycles = 0 },
      (d: SaveDocument) => { d.game.careProject!.readyAtMs!++ },
      (d: SaveDocument) => { d.game.careProject!.tiles = [41] },
      (d: SaveDocument) => { d.game.personality.paths.eco.xp = 20 },
      (d: SaveDocument) => { Object.assign(d, { version: 30 }) },
    ]) { const d = JSON.parse(save(w)); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
    expect(save(w)).toBe(unchanged)
  })
})
