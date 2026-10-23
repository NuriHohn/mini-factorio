import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { awardActivity } from './personality'
import { advanceSecretProject, currentProject, projectCandidates, trySecretProject } from './secretProject'
import { harvestTreeReady, planHarvest } from './forestry'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World) => w.buildings[824] as SupplyCrate
function world() {
  const w = createBareWorld(() => .5); w.nature.wood = 100; placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); awardActivity(w.personality, { path: 'eco', xp: 20 })
  w.buildings[980] = { kind: 'tree', x: 20, y: 24, species: 'oak', origin: 'natural', bornAtMs: -300000, nextReproductionAtMs: 300000 }
  Object.assign(w.pete, { tile: 860, x: 20, y: 21, next: null, path: [], travelMs: 0 })
  return w
}
function until(w: World, predicate: () => boolean) { for (let n = 0; n < 12000 && !predicate(); n++) advanceWorld(w, 50); expect(predicate()).toBe(true) }
function choose(w: World) { const cs = projectCandidates(w); expect(cs.map(c => c.definition.id)).toEqual(['harvesting']); expect(trySecretProject(w)).toBe(true); expect(currentProject(w)).toBe(w.harvestProject) }
function working() { const w = world(); choose(w); until(w, () => (w.harvestProject?.elapsedMs ?? 0) >= 500); return w }
describe('Pete mature-tree forestry', () => {
  it('chooses only mature nearby reachable trees and requires three free supply slots without spending stock or RNG', () => {
    const w = world(), before = structuredClone(w), plan = planHarvest(w)!
    expect(plan.tiles).toEqual([980]); expect(w).toEqual(before)
    const tree = w.buildings[980]!
    if (tree.kind !== 'tree') throw Error('fixture')
    tree.bornAtMs = 0; expect(planHarvest(w)).toBeNull()
    tree.bornAtMs = -300000; crate(w).wood = 198; expect(planHarvest(w)).toBeNull()
    crate(w).wood = 197; expect(planHarvest(w)).not.toBeNull()
    for (const tile of [940, 979, 981, 1020]) w.water[tile] = true
    expect(planHarvest(w)).toBeNull()
  })
  it('cuts only after six seconds, carries exactly three Wood and rewards only delivery once across saves', () => {
    const w = working(), globalWood = w.nature.wood, p = w.harvestProject!, remaining = 6000 - p.elapsedMs
    const restored = load(w)
    advanceWorld(w, remaining - 50); expect(w.buildings[980]?.kind).toBe('tree'); expect(p.carried).toBe(0)
    advanceWorld(w, 50); advanceWorld(restored, remaining)
    expect(snapshot(restored)).toEqual(snapshot(w)); expect(w.buildings[980]).toBeNull()
    expect(p).toMatchObject({ phase: 'collecting', carried: 3 }); expect(w.nature.wood).toBe(globalWood); expect(crate(w).wood).toBe(0); expect(w.personality.paths.eco.xp).toBe(20)
    const carrying = load(w); until(w, () => p.phase === 'complete'); advanceWorld(carrying, w.timeMs - carrying.timeMs)
    expect(snapshot(carrying)).toEqual(snapshot(w)); expect(crate(w).wood).toBe(3); expect(w.personality.paths.eco.xp).toBe(23)
    expect(p).toMatchObject({ carried: 0, completedCycles: 1, readyAtMs: w.timeMs + 120000 })
    const idle = load(w), selected = currentProject(idle); if (selected) delete selected.selected
    advanceSecretProject(idle, 6000); expect(crate(idle).wood).toBe(3); expect(idle.personality.paths.eco.xp).toBe(23)
  })
  it('uses harvested supply Wood to replant and later harvests that fully grown tree without global Wood creation', () => {
    const w = world(), globalWood = w.nature.wood
    choose(w); until(w, () => w.harvestProject?.completedCycles === 1)
    until(w, () => w.plantProject?.phase === 'complete')
    expect(crate(w).wood).toBe(1)
    const tile = w.plantProject!.tiles[0], tree = w.buildings[tile]!
    if (tree.kind !== 'tree') throw Error('fixture')
    advanceWorld(w, tree.bornAtMs + 299950 - w.timeMs)
    expect(w.buildings[tile]?.kind).toBe('tree'); expect(w.harvestProject?.completedCycles).toBe(1)
    until(w, () => w.harvestProject?.completedCycles === 2)
    expect(crate(w).wood).toBe(4); expect(w.nature.wood).toBe(globalWood)
    expect(w.harvestProject?.manualCycles).toBe(1); expect(w.personality.paths.eco.xp).toBe(31)
    expect(() => load(w)).not.toThrow()
  })
  it('retains harvested Wood when a destination fills or disappears and resumes without cutting or generating twice', () => {
    const w = working(); until(w, () => w.harvestProject?.carried === 3)
    crate(w).wood = 200; advanceWorld(w, 1000)
    expect(w.harvestProject?.carried).toBe(3); expect(w.personality.paths.eco.xp).toBe(20)
    removeBuilding(w, 24, 20); const restored = load(w); advanceWorld(restored, 1000)
    expect(restored.harvestProject?.carried).toBe(3)
    placeBuilding(restored, 24, 20, 'supplyCrate', 'east'); until(restored, () => restored.harvestProject?.phase === 'complete')
    expect(crate(restored).wood).toBe(3); expect(restored.personality.paths.eco.xp).toBe(23)
  })
  it('does not cut a replacement sapling, retains interrupted work and preserves partitions and strict snapshots', () => {
    const w = working(), before = snapshot(w), tree = w.buildings[980]!
    if (tree.kind !== 'tree') throw Error('fixture')
    tree.bornAtMs = 0; tree.nextReproductionAtMs = 600000
    expect(harvestTreeReady(w, w.harvestProject!)).toBe(false); advanceWorld(w, 1000)
    expect(w.buildings[980]?.kind).toBe('tree'); expect(w.harvestProject?.carried).toBe(0); expect(w.personality.paths.eco.xp).toBe(20)
    const original = decodeSave(JSON.stringify(before)).world; removeBuilding(original, 20, 20); const away = load(original)
    advanceWorld(away, 1000); expect(away.harvestProject?.elapsedMs).toBe(original.harvestProject?.elapsedMs)
    placeBuilding(away, 20, 20, 'treehouse', 'east'); const split = load(away)
    advanceWorld(away, 20017); for (const ms of [17, 1000, 5000, 14000]) advanceWorld(split, ms)
    expect(snapshot(split)).toEqual(snapshot(away))
    for (const mutate of [
      (d: SaveDocument) => { d.game.harvestProject!.carried = 2 },
      (d: SaveDocument) => { d.game.harvestProject!.completedCycles = 0 },
      (d: SaveDocument) => { d.game.harvestProject!.readyAtMs!++ },
      (d: SaveDocument) => { d.game.harvestProject!.treeBornAtMs = d.game.timeMs },
      (d: SaveDocument) => { Object.assign(d, { version: 33 }) },
    ]) { const d = snapshot(away); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
