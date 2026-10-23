import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { deliverItem } from './transport'
import { supplyWood } from './supplyCrate'
import { PETE_PROJECTS, projectUnlocked } from './projectRegistry'
import { currentProject, projectCandidates, projectSiteClear, trySecretProject } from './secretProject'
import { awardActivity } from './personality'
import { advanceWorld } from './step'
import { finishExperiment, EXPERIMENT_ACTIVITY_MS, EXPERIMENT_COOLDOWN_MS, experimentSpot } from './experiment'
import { planYard, yardBoundary, yardInterior } from './yard'
import { neighboringTiles, peteReachableTiles } from './navigation'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World, tile = 824) => w.buildings[tile] as SupplyCrate
function world() {
  const w = createBareWorld(() => .5); w.nature.wood = 500
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  return w
}
function fund(w: World, wood = 0, copper = 8, tile = 824, gears = copper ? 4 : 0) {
  if (wood) expect(supplyWood(w, tile, wood)).toBe(true)
  for (let i = 0; i < copper; i++) expect(deliverItem(crate(w, tile), 'copperPlate', 'east')).toBe(true)
  for (let i = 0; i < gears; i++) expect(deliverItem(crate(w, tile), 'copperCable', 'east')).toBe(true)
}
function until(w: World, ready: () => boolean, limit = 500000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
function choose(w: World) {
  const cs = projectCandidates(w), index = cs.findIndex(c => c.definition.id === 'experiment')
  expect(index).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((sum, c) => sum + c.priorityWeight, 0), low = cs.slice(0, index).reduce((sum, c) => sum + c.priorityWeight, 0) / total, high = low + cs[index].priorityWeight / total
  let seed = 0
  for (; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) break }
  expect(seed).toBeLessThan(100000); w.peace.seed = seed
  expect(trySecretProject(w)).toBe(true); expect(currentProject(w)).toBe(w.experimentProject)
}
function built() { const w = world(); fund(w); choose(w); until(w, () => w.experimentProject?.phase === 'complete'); return w }
describe('Inventor level one experiment', () => {
  it('requires all three materials in one reachable crate and never partially debits missing gears', () => {
    const w = world(); fund(w, 0, 8, 824, 3)
    const before = snapshot(w)
    expect(projectCandidates(w).some(c => c.definition.id === 'experiment')).toBe(false)
    expect(snapshot(w)).toEqual(before)
    placeBuilding(w, 30, 20, 'supplyCrate', 'east'); fund(w, 0, 0, 830, 1)
    expect(projectCandidates(w).some(c => c.definition.id === 'experiment')).toBe(false)
    fund(w, 0, 0, 824, 1); choose(w)
    until(w, () => w.experimentProject?.crate === 824 && w.pete.next !== null)
    crate(w).inventory.copperCable--
    advanceWorld(w, 50)
    expect(crate(w).wood).toBe(0); expect(crate(w).inventory.copperPlate).toBe(8); expect(crate(w).inventory.copperCable).toBe(3)
    expect(w.experimentProject).toMatchObject({ phase: 'collecting', carried: 0, carriedCopper: 0, carriedGears: 0 })
    expect(() => load(w)).not.toThrow()
    fund(w, 0, 0, 824, 1); until(w, () => w.experimentProject?.phase === 'building')
    expect(crate(w).wood).toBe(0); expect(crate(w).inventory.copperPlate).toBe(0); expect(crate(w).inventory.copperCable).toBe(0)
    expect(w.experimentProject?.carriedCable).toBe(4)
  })

  it('keeps paid stock through home removal and cancels experiments without XP on a blocked approach', () => {
    const w = world(); fund(w); choose(w)
    until(w, () => (w.experimentProject?.elapsedMs ?? 0) >= 500)
    removeBuilding(w, 20, 20)
    const restored = load(w)
    expect(restored.experimentProject).toMatchObject({ phase: 'building', carried: 0, carriedCopper: 8, carriedCable: 4, carriedGears: 0 })
    placeBuilding(restored, 20, 20, 'treehouse', 'east')
    until(restored, () => restored.peace.activity === 'experimentward' && restored.pete.tile !== restored.experimentProject!.spots[0] && restored.pete.next !== restored.experimentProject!.spots[0])
    const xp = restored.personality.paths.inventor.xp, spot = restored.experimentProject!.spots[0]
    expect(placeBuilding(restored, spot % SIZE, Math.floor(spot / SIZE), 'belt', 'east')).toBe(true)
    expect(restored.peace.activity).toBe('homeward')
    advanceWorld(restored, 10000)
    expect(restored.personality.paths.inventor.xp).toBe(xp)
    expect(() => load(restored)).not.toThrow()
  })

  it('rejects forged gear balances, orphan tables, old-schema records and experiment clocks without altering the source world', () => {
    const w = world(); fund(w); choose(w)
    until(w, () => (w.experimentProject?.elapsedMs ?? 0) >= 500)
    const before = snapshot(w), bad = snapshot(w)
    bad.game.experimentProject!.carriedGears = 1
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    expect(snapshot(w)).toEqual(before)
    until(w, () => w.peace.activity === 'experimenting')
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'experimentProject') },
      (d: SaveDocument) => { d.game.experimentProject!.carriedGears = 2 },
      (d: SaveDocument) => { d.game.peace.untilMs += 50 },
      (d: SaveDocument) => { Object.assign(d, { version: 26 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
  it('is available independently of dominant personality and responds to copper without changing Eco weights', () => {
    const w = world(), definition = PETE_PROJECTS.find(p => p.id === 'experiment')!
    expect(definition).toMatchObject({ path: 'inventor', minimumLevel: 1, primaryMaterial: 'copperPlate', resources: { copperPlate: 8, copperCable: 4 }, repeatable: false })
    expect(projectUnlocked(w, definition)).toBe(true)
    awardActivity(w.personality, { path: 'industrial', xp: 450 })
    expect(w.personality.dominant).toBe('industrial'); fund(w, 8, 8)
    const before = snapshot(w), cs = projectCandidates(w)
    expect(cs.find(c => c.definition.id === 'experiment')?.weight).toBe(1)
    expect(cs.find(c => c.definition.id === 'fence')?.weight).toBe(1)
    expect(snapshot(w)).toEqual(before)
    fund(w, 0, 8)
    expect(projectCandidates(w).find(c => c.definition.id === 'experiment')?.weight).toBe(2)
    expect(projectCandidates(w).find(c => c.definition.id === 'fence')?.weight).toBe(1)
  })
  it('requires both materials together and never treats ore or inaccessible stock as plates', () => {
    for (const [wood, plates] of [[0, 7], [4, 7]]) {
      const w = world(); fund(w, wood, plates)
      expect(projectCandidates(w).some(c => c.definition.id === 'experiment')).toBe(false)
      expect(crate(w).wood).toBe(wood); expect(crate(w).inventory.copperPlate).toBe(plates)
    }
    const w = world(); fund(w, 4, 0)
    for (let i = 0; i < 8; i++) deliverItem(crate(w), 'copper', 'east')
    expect(projectCandidates(w).some(c => c.definition.id === 'experiment')).toBe(false)
    placeBuilding(w, 10, 10, 'supplyCrate', 'east'); fund(w, 0, 7, 410)
    expect(projectCandidates(w).some(c => c.definition.id === 'experiment')).toBe(false)
    fund(w, 4, 0, 410)
    for (const [x, y] of [[9, 10], [11, 10], [10, 9], [10, 11]]) placeBuilding(w, x, y, 'storage', 'east')
    expect(projectCandidates(w).some(c => c.definition.id === 'experiment')).toBe(false)
  })
  it('selects a fully funded reachable source rather than a closer wood-only crate', () => {
    const w = world(); fund(w, 4, 0)
    placeBuilding(w, 30, 20, 'supplyCrate', 'east'); fund(w, 0, 8, 830)
    choose(w); until(w, () => w.experimentProject?.crate === 830)
    expect(crate(w, 830).inventory.copperPlate).toBe(8)
    const restored = load(w); until(restored, () => restored.experimentProject?.phase === 'building')
    expect(crate(restored).wood).toBe(4); expect(crate(restored, 830).wood).toBe(0); expect(crate(restored, 830).inventory.copperPlate).toBe(0)
  })
  it('revalidates both resources before pickup and waits without a partial debit', () => {
    const w = world(); fund(w); choose(w)
    until(w, () => w.experimentProject?.crate === 824 && w.pete.next !== null)
    crate(w).inventory.copperPlate-- // Model contention before the committed pickup arrives.
    advanceWorld(w, 50)
    expect(crate(w).wood).toBe(0); expect(crate(w).inventory.copperPlate).toBe(7)
    expect(w.experimentProject).toMatchObject({ phase: 'collecting', carried: 0, carriedCopper: 0 })
    expect(w.personality.paths.inventor.xp).toBe(0); expect(() => load(w)).not.toThrow()
    fund(w, 0, 1); until(w, () => w.experimentProject?.phase === 'building')
    expect(crate(w).wood).toBe(0); expect(crate(w).inventory.copperPlate).toBe(0)
  })
  it('atomically collects four Wood, eight copper plates and two gears, builds gradually and awards ten Inventor XP once', () => {
    const w = world(); fund(w); const eco = structuredClone(w.personality.paths.eco); choose(w)
    expect(crate(w).wood).toBe(0); expect(crate(w).inventory.copperPlate).toBe(8)
    until(w, () => (w.experimentProject?.elapsedMs ?? 0) >= 500)
    const project = w.experimentProject!, tile = project.tiles[0]
    expect(project).toMatchObject({ carried: 0, carriedCopper: 8, carriedCable: 4, carriedGears: 0 }); expect(crate(w).wood).toBe(0); expect(crate(w).inventory.copperPlate).toBe(0)
    expect(w.personality.paths.inventor.xp).toBe(0); expect(w.buildings[tile]).toBeNull()
    const restored = load(w), remaining = 12000 - project.elapsedMs
    advanceWorld(w, remaining - 50); expect(w.buildings[tile]).toBeNull()
    advanceWorld(w, 50); advanceWorld(restored, remaining)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(project).toMatchObject({ phase: 'complete', carried: 0, carriedCopper: 0, carriedGears: 0, built: 1 })
    expect(w.personality.paths.inventor.xp).toBe(10); expect(w.personality.paths.eco).toEqual(eco)
    expect(w.personality.rewardedProjects).toEqual(['experiment'])
    expect(placeBuilding(w, 10, 10, 'peteExperiment', 'east')).toBe(false)
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); fund(w); advanceWorld(w, 90000)
    expect(w.buildings.filter(b => b?.kind === 'peteExperiment')).toHaveLength(0)
    expect(crate(w).wood).toBe(0); expect(crate(w).inventory.copperPlate).toBe(8); expect(w.personality.paths.inventor.xp).toBe(10)
  })
  it('retains both carried materials and work across blocking, interruption and Save/Load', () => {
    const w = world(); fund(w); choose(w); until(w, () => (w.experimentProject?.elapsedMs ?? 0) >= 500)
    const p = w.experimentProject!, tile = p.tiles[0], elapsed = p.elapsedMs
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', 'east')).toBe(true)
    advanceWorld(w, 5000); expect(p.elapsedMs).toBe(elapsed); expect(p.carriedCopper).toBe(8); expect(w.personality.paths.inventor.xp).toBe(0)
    const restored = load(w); removeBuilding(restored, tile % SIZE, Math.floor(tile / SIZE))
    until(restored, () => restored.experimentProject?.phase === 'complete')
    expect(restored.personality.paths.inventor.xp).toBe(10); expect(crate(restored).inventory.copperPlate).toBe(0); expect(crate(restored).wood).toBe(0)
  })
  it('credits completed experimenting once with a persisted cooldown, never on interruption', () => {
    const w = built(); until(w, () => w.peace.activity === 'experimenting')
    expect(w.peace.untilMs - w.peace.sinceMs).toBe(EXPERIMENT_ACTIVITY_MS); expect(experimentSpot(w)).toBe(w.pete.tile)
    expect(finishExperiment(w)).toBe(false)
    const restored = load(w), remaining = w.peace.untilMs - w.timeMs
    advanceWorld(w, remaining - 50); expect(w.personality.paths.inventor.xp).toBe(10)
    advanceWorld(w, 50); advanceWorld(restored, remaining)
    expect(snapshot(restored)).toEqual(snapshot(w)); expect(w.personality.paths.inventor.xp).toBe(11)
    expect(finishExperiment(w)).toBe(false); expect(w.experimentProject!.readyAtMs).toBe(w.timeMs + EXPERIMENT_COOLDOWN_MS)
    advanceWorld(w, EXPERIMENT_COOLDOWN_MS - 50); expect(w.personality.paths.inventor.xp).toBe(11)
    until(w, () => w.personality.paths.inventor.xp === 12)
    until(w, () => w.peace.activity === 'experimenting')
    const xp = w.personality.paths.inventor.xp, tile = w.experimentProject!.tiles[0]
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); expect(w.peace.activity).toBe('homeward')
    advanceWorld(w, 10000); expect(w.personality.paths.inventor.xp).toBe(xp); expect(() => load(w)).not.toThrow()
  })
  it('preserves deterministic timing across partitions, pause and mid-visit restoration', () => {
    const w = built(); until(w, () => w.peace.activity === 'experimenting'); advanceWorld(w, 17)
    const split = load(w), paused = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(paused)
    advanceWorld(w, 10017)
    for (const ms of [17, 1000, 2000, 7000]) advanceWorld(split, ms)
    expect(snapshot(split)).toEqual(snapshot(w))
  })
  it('fits outside an existing enclosure while preserving gate, home and supply access', () => {
    const w = world(); fund(w, 200, 0)
    until(w, () => w.gateProject?.phase === 'complete', 900000)
    fund(w, 0, 8); choose(w)
    const p = w.experimentProject!, gate = w.yard!.entrance
    expect(yardInterior(w.yard!, p.tiles[0])).toBe(false); expect([...p.tiles, ...p.spots]).not.toContain(gate)
    w.water[p.tiles[0]] = true; expect(projectSiteClear(w, p)).toBe(false); w.water[p.tiles[0]] = false
    until(w, () => p.phase === 'complete')
    const paths = peteReachableTiles(w, w.pete.tile)
    for (const tile of [820, 824, w.coopProject!.tiles[0]]) expect(neighboringTiles(tile).some(i => paths.has(i) && !w.buildings[i])).toBe(true)
    expect(w.buildings[gate]?.kind).toBe('peteGate'); expect(() => load(w)).not.toThrow()
  })
  it('reserves an existing experiment approach when choosing a later yard boundary', () => {
    const w = built(); fund(w, 200, 0)
    until(w, () => w.coopProject?.phase === 'complete')
    const proposed = planYard(w)!
    expect(proposed).not.toBeNull()
    const approach = proposed.tiles.find(i => !w.buildings[i])!
    // Isolate the planner contract: a completed experiment's work tile is reserved.
    w.experimentProject!.spots = [approach]
    const revised = planYard(w)
    expect(revised === null || !yardBoundary(revised).includes(approach)).toBe(true)
  })
  it('keeps an earlier experiment approach clear when the yard is built later', () => {
    const w = built(), spot = w.experimentProject!.spots[0]
    fund(w, 200, 0)
    until(w, () => w.gateProject?.phase === 'complete', 900000)
    expect(w.buildings[spot]).toBeNull()
    expect(w.water[spot]).toBe(false)
    expect(experimentSpot(w)).toBe(spot)
    until(w, () => w.peace.activity === 'experimenting')
    expect(() => load(w)).not.toThrow()
  })
  it('migrates old saves unchanged and rejects malformed mixed stock, reward paths and activity clocks', () => {
    const w = world(); w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
    const old = snapshot(w); Object.assign(old, { version: 26 })
    expect(snapshot(decodeSave(JSON.stringify(old)).world)).toEqual(snapshot(w))
    fund(w); choose(w); until(w, () => (w.experimentProject?.elapsedMs ?? 0) >= 500)
    const badCarry = snapshot(w); badCarry.game.experimentProject!.carriedCopper = 7
    expect(() => decodeSave(JSON.stringify(badCarry))).toThrow('Invalid save')
    until(w, () => w.peace.activity === 'experimenting')
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'experimentProject') },
      (d: SaveDocument) => { d.game.experimentProject!.carriedCopper = 8 },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game.experimentProject!, 'readyAtMs') },
      (d: SaveDocument) => { d.game.experimentProject!.readyAtMs!++ },
      (d: SaveDocument) => { d.game.personality.paths.inventor.xp = 0 },
      (d: SaveDocument) => { d.game.peace.destination = null },
      (d: SaveDocument) => { Object.assign(d, { version: 23 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
