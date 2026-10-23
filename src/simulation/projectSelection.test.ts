import { beforeAll, describe, expect, it } from 'vitest'
import { PETE_PROJECTS, projectUnlocked } from './projectRegistry'
import type { ProjectDefinition } from './projectRegistry'
import { currentProject, projectCandidates, trySecretProject } from './secretProject'
import { awardActivity } from './personality'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World) => w.buildings[824] as SupplyCrate
function until(w: World, ready: () => boolean, limit = 300000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 500
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east')
  supplyWood(template, 824, 6); until(template, () => template.project?.phase === 'complete')
})
function choose(w: World, id: string): void {
  const candidates = projectCandidates(w), total = candidates.reduce((sum, c) => sum + c.weight, 0)
  const index = candidates.findIndex(c => c.definition.id === id)
  expect(index).toBeGreaterThanOrEqual(0)
  const low = candidates.slice(0, index).reduce((sum, c) => sum + c.weight, 0) / total, high = low + candidates[index].weight / total
  let seed = 0
  while (seed < 100000) {
    const roll = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296
    if (roll >= low && roll < high) break
    seed++
  }
  expect(seed).toBeLessThan(100000); w.peace.seed = seed
  expect(trySecretProject(w)).toBe(true)
  expect(currentProject(w)).toBe(w[candidates[index].definition.state])
}
describe('data-driven autonomous project selection', () => {
  it('registers the five existing once-only Eco level-one projects with their unchanged costs', () => {
    expect(PETE_PROJECTS.filter(p => p.minimumLevel === 1).map(p => [p.id, p.path, p.minimumLevel, p.resources.wood, p.repeatable])).toEqual([
      ['fence', 'eco', 1, 6, false], ['coop', 'eco', 1, 10, false], ['campfire', 'eco', 1, 5, false], ['yard', 'eco', 1, 2, false], ['gate', 'eco', 1, 3, false],
    ])
    const w = createBareWorld(() => .5)
    expect(projectUnlocked(w, PETE_PROJECTS[0])).toBe(true)
    expect(projectUnlocked(w, PETE_PROJECTS[1])).toBe(false)
    expect(projectUnlocked(w, PETE_PROJECTS[4])).toBe(false)
  })
  it('checks each relevant path level independently, prerequisites and repeatable metadata', () => {
    const w = structuredClone(template), definition: ProjectDefinition = { ...PETE_PROJECTS[1], path: 'inventor', minimumLevel: 2 }
    expect(projectUnlocked(w, definition)).toBe(false)
    awardActivity(w.personality, { path: 'eco', xp: 450 }); expect(projectUnlocked(w, definition)).toBe(false)
    awardActivity(w.personality, { path: 'inventor', xp: 20 }); expect(projectUnlocked(w, definition)).toBe(true)
    expect(projectUnlocked(w, PETE_PROJECTS[0])).toBe(false)
    expect(projectUnlocked(w, { ...PETE_PROJECTS[0], repeatable: true })).toBe(true)
  })
  it('considers feasible affordable candidates without spending stock, awarding XP or drawing randomness', () => {
    const w = structuredClone(template)
    expect(projectCandidates(w)).toEqual([]); supplyWood(w, 824, 10)
    crate(w).inventory.iron = 90
    const before = snapshot(w), candidates = projectCandidates(w)
    expect(candidates.map(c => [c.definition.id, c.weight])).toEqual([['coop', 1], ['campfire', 2]])
    expect(snapshot(w)).toEqual(before)
    supplyWood(w, 824, 10)
    expect(projectCandidates(w).map(c => c.weight)).toEqual([2, 4])
    expect(placeBuilding(w, 10, 10, 'supplyCrate', 'east')).toBe(true); supplyWood(w, 410, 100)
    for (const [x, y] of [[9, 10], [11, 10], [10, 9], [10, 11]]) placeBuilding(w, x, y, 'storage', 'east')
    expect(projectCandidates(w).map(c => c.weight)).toEqual([2, 4])
    w.water[823] = true; w.water[940] = true; w.water[817] = true
    expect(projectCandidates(w)).toEqual([])
  })
  it('uses weighted intervals to choose either follow-up, allowing campfire before coop', () => {
    for (const id of ['coop', 'campfire']) {
      const w = structuredClone(template); supplyWood(w, 824, 15); const xp = w.personality.paths.eco.xp
      choose(w, id)
      expect(crate(w).wood).toBe(15); expect(w.personality.paths.eco.xp).toBe(xp)
      const project = currentProject(w)!, seed = w.peace.seed
      supplyWood(w, 824, 100)
      expect(trySecretProject(w)).toBe(true); expect(currentProject(w)).toBe(project); expect(w.peace.seed).toBe(seed)
      until(w, () => project.phase === 'complete')
      expect(w.personality.rewardedProjects.filter(reward => reward === id)).toHaveLength(1)
      if (id === 'campfire') expect(w.coopProject).toBeNull()
      expect(() => load(w)).not.toThrow()
    }
  })
  it('retains carried stock and progress on a real blockage, chooses another feasible project and later resumes', () => {
    const w = structuredClone(template); supplyWood(w, 824, 15); choose(w, 'coop')
    until(w, () => (w.coopProject?.elapsedMs ?? 0) >= 500)
    const project = w.coopProject!, tile = project.tiles[0], elapsedMs = project.elapsedMs
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')).toBe(true)
    until(w, () => w.campfireProject?.phase === 'building')
    const ambiguous = snapshot(w); ambiguous.game.coopProject!.selected = true
    expect(() => decodeSave(JSON.stringify(ambiguous))).toThrow('multiple selected projects')
    until(w, () => w.campfireProject?.phase === 'complete')
    expect(project.selected).toBeUndefined(); expect(project.carried).toBe(10); expect(project.elapsedMs).toBe(elapsedMs)
    const restored = load(w); expect(restored.coopProject).toEqual(project)
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); until(w, () => project.phase === 'complete')
    expect(crate(w).wood).toBe(0); expect(w.personality.rewardedProjects.filter(id => id === 'coop')).toHaveLength(1)
    advanceWorld(w, 30000); expect(w.personality.rewardedProjects.filter(id => id === 'coop')).toHaveLength(1)
  })
  it('tries another layout when an unfunded pending plan reserves the first available site', () => {
    const w = structuredClone(template); supplyWood(w, 824, 10); choose(w, 'coop')
    const original = w.coopProject!, tile = original.tiles[0]
    removeBuilding(w, 24, 20); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); supplyWood(w, 824, 5)
    expect(trySecretProject(w)).toBe(true)
    expect(currentProject(w)).toBe(w.campfireProject); expect(w.campfireProject!.tiles).not.toContain(tile)
    expect(w.coopProject).toBe(original); expect(original.carried).toBe(0)
    until(w, () => w.campfireProject?.phase === 'complete')
    supplyWood(w, 824, 10); until(w, () => original.phase === 'complete')
    expect(crate(w).wood).toBe(0); expect(w.personality.rewardedProjects.filter(id => id === 'coop')).toHaveLength(1)
  })
  it('keeps normal peaceful routines when nothing is eligible and never draws for an empty selection', () => {
    const w = structuredClone(template), seed = w.peace.seed
    expect(trySecretProject(w)).toBe(false); expect(w.peace.seed).toBe(seed)
    advanceWorld(w, 30000); expect(w.peace.activity).not.toBe('project'); expect(w.coopProject).toBeNull()
  })
  it('preserves selected plans and RNG across saves and equivalent fixed-step partitions', () => {
    const w = structuredClone(template); supplyWood(w, 824, 15); choose(w, 'campfire')
    until(w, () => (w.campfireProject?.elapsedMs ?? 0) >= 500)
    advanceWorld(w, 17)
    const split = load(w), restored = load(w)
    expect(snapshot(restored)).toEqual(snapshot(w))
    advanceWorld(w, 120017); advanceWorld(restored, 120017)
    for (let i = 0; i < 120; i++) advanceWorld(split, 1000)
    advanceWorld(split, 17)
    expect(snapshot(restored)).toEqual(snapshot(w)); expect(snapshot(split)).toEqual(snapshot(w))
    expect(w.coopProject?.phase).toBe('complete'); expect(w.campfireProject?.phase).toBe('complete')
    expect(crate(w).wood).toBe(0)
  })
  it('migrates a version-21 active project without redrawing, spending or losing its pickup', () => {
    const w = structuredClone(template); supplyWood(w, 824, 15); choose(w, 'coop')
    until(w, () => w.coopProject?.crate === 824 && w.pete.next !== null)
    const old = snapshot(w); Object.assign(old, { version: 21 }); Reflect.deleteProperty(old.game.coopProject!, 'selected')
    const restored = decodeSave(JSON.stringify(old)).world
    expect(currentProject(restored)).toBe(restored.coopProject); expect(snapshot(restored)).toEqual(snapshot(w))
    advanceWorld(w, 5000); advanceWorld(restored, 5000); expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('rejects malformed, completed or ambiguous selections while retaining old strict schemas', () => {
    const w = structuredClone(template); supplyWood(w, 824, 15); choose(w, 'coop')
    const before = snapshot(w)
    for (const mutate of [
      (d: SaveDocument) => { Object.assign(d.game.coopProject!, { selected: false }) },
      (d: SaveDocument) => { d.game.project!.selected = true },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game.coopProject!, 'selected') },
      (d: SaveDocument) => { Object.assign(d, { version: 21 }) },
    ]) {
      const d = structuredClone(before); mutate(d)
      expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save'); expect(snapshot(w)).toEqual(before)
    }
  })
})
