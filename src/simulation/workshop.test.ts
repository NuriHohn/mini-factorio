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
import { finishWorkshop, WORKSHOP_ACTIVITY_MS, WORKSHOP_COOLDOWN_MS, workshopSpot } from './workshop'
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
function fund(w: World, wood = 4, iron = 8, tile = 824) {
  if (wood) expect(supplyWood(w, tile, wood)).toBe(true)
  for (let i = 0; i < iron; i++) expect(deliverItem(crate(w, tile), 'ironPlate', 'east')).toBe(true)
}
function until(w: World, ready: () => boolean, limit = 500000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
function choose(w: World) {
  const cs = projectCandidates(w), index = cs.findIndex(c => c.definition.id === 'workshop')
  expect(index).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((sum, c) => sum + c.weight, 0), low = cs.slice(0, index).reduce((sum, c) => sum + c.weight, 0) / total, high = low + cs[index].weight / total
  let seed = 0
  for (; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) break }
  expect(seed).toBeLessThan(100000); w.peace.seed = seed
  expect(trySecretProject(w)).toBe(true); expect(currentProject(w)).toBe(w.workshopProject)
}
function built() { const w = world(); fund(w); choose(w); until(w, () => w.workshopProject?.phase === 'complete'); return w }
describe('Craftsman level one workshop', () => {
  it('is available independently of dominant personality and responds to iron without changing Eco weights', () => {
    const w = world(), definition = PETE_PROJECTS.find(p => p.id === 'workshop')!
    expect(definition).toMatchObject({ path: 'craftsman', minimumLevel: 1, primaryMaterial: 'ironPlate', resources: { wood: 4, ironPlate: 8 }, repeatable: false })
    expect(projectUnlocked(w, definition)).toBe(true)
    awardActivity(w.personality, { path: 'industrial', xp: 450 })
    expect(w.personality.dominant).toBe('industrial'); fund(w, 8, 8)
    const before = snapshot(w), cs = projectCandidates(w)
    expect(cs.find(c => c.definition.id === 'workshop')?.weight).toBe(1)
    expect(cs.find(c => c.definition.id === 'fence')?.weight).toBe(1)
    expect(snapshot(w)).toEqual(before)
    fund(w, 0, 8)
    expect(projectCandidates(w).find(c => c.definition.id === 'workshop')?.weight).toBe(2)
    expect(projectCandidates(w).find(c => c.definition.id === 'fence')?.weight).toBe(1)
  })
  it('requires both materials together and never treats ore or inaccessible stock as plates', () => {
    for (const [wood, plates] of [[3, 8], [4, 7]]) {
      const w = world(); fund(w, wood, plates)
      expect(projectCandidates(w).some(c => c.definition.id === 'workshop')).toBe(false)
      expect(crate(w).wood).toBe(wood); expect(crate(w).inventory.ironPlate).toBe(plates)
    }
    const w = world(); fund(w, 4, 0)
    for (let i = 0; i < 8; i++) deliverItem(crate(w), 'iron', 'east')
    expect(projectCandidates(w).some(c => c.definition.id === 'workshop')).toBe(false)
    placeBuilding(w, 10, 10, 'supplyCrate', 'east'); fund(w, 0, 8, 410)
    expect(projectCandidates(w).some(c => c.definition.id === 'workshop')).toBe(false)
    fund(w, 4, 0, 410)
    for (const [x, y] of [[9, 10], [11, 10], [10, 9], [10, 11]]) placeBuilding(w, x, y, 'storage', 'east')
    expect(projectCandidates(w).some(c => c.definition.id === 'workshop')).toBe(false)
  })
  it('selects a fully funded reachable source rather than a closer wood-only crate', () => {
    const w = world(); fund(w, 4, 0)
    placeBuilding(w, 30, 20, 'supplyCrate', 'east'); fund(w, 4, 8, 830)
    choose(w); until(w, () => w.workshopProject?.crate === 830)
    expect(crate(w, 830).inventory.ironPlate).toBe(8)
    const restored = load(w); until(restored, () => restored.workshopProject?.phase === 'building')
    expect(crate(restored).wood).toBe(4); expect(crate(restored, 830).wood).toBe(0); expect(crate(restored, 830).inventory.ironPlate).toBe(0)
  })
  it('revalidates both resources before pickup and waits without a partial debit', () => {
    const w = world(); fund(w); choose(w)
    until(w, () => w.workshopProject?.crate === 824 && w.pete.next !== null)
    crate(w).inventory.ironPlate-- // Model contention before the committed pickup arrives.
    advanceWorld(w, 50)
    expect(crate(w).wood).toBe(4); expect(crate(w).inventory.ironPlate).toBe(7)
    expect(w.workshopProject).toMatchObject({ phase: 'collecting', carried: 0, carriedIron: 0 })
    expect(w.personality.paths.craftsman.xp).toBe(0); expect(() => load(w)).not.toThrow()
    fund(w, 0, 1); until(w, () => w.workshopProject?.phase === 'building')
    expect(crate(w).wood).toBe(0); expect(crate(w).inventory.ironPlate).toBe(0)
  })
  it('atomically collects four Wood and eight plates, builds gradually and awards ten Craftsman XP once', () => {
    const w = world(); fund(w); const eco = structuredClone(w.personality.paths.eco); choose(w)
    expect(crate(w).wood).toBe(4); expect(crate(w).inventory.ironPlate).toBe(8)
    until(w, () => (w.workshopProject?.elapsedMs ?? 0) >= 500)
    const project = w.workshopProject!, tile = project.tiles[0]
    expect(project).toMatchObject({ carried: 4, carriedIron: 8 }); expect(crate(w).wood).toBe(0); expect(crate(w).inventory.ironPlate).toBe(0)
    expect(w.personality.paths.craftsman.xp).toBe(0); expect(w.buildings[tile]).toBeNull()
    const restored = load(w), remaining = 12000 - project.elapsedMs
    advanceWorld(w, remaining - 50); expect(w.buildings[tile]).toBeNull()
    advanceWorld(w, 50); advanceWorld(restored, remaining)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(project).toMatchObject({ phase: 'complete', carried: 0, carriedIron: 0, built: 1 })
    expect(w.personality.paths.craftsman.xp).toBe(10); expect(w.personality.paths.eco).toEqual(eco)
    expect(w.personality.rewardedProjects).toEqual(['workshop'])
    expect(placeBuilding(w, 10, 10, 'peteWorkshop', 'east')).toBe(false)
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); fund(w); advanceWorld(w, 90000)
    expect(w.buildings.filter(b => b?.kind === 'peteWorkshop')).toHaveLength(0)
    expect(crate(w).wood).toBe(4); expect(crate(w).inventory.ironPlate).toBe(8); expect(w.personality.paths.craftsman.xp).toBe(10)
  })
  it('retains both carried materials and work across blocking, interruption and Save/Load', () => {
    const w = world(); fund(w); choose(w); until(w, () => (w.workshopProject?.elapsedMs ?? 0) >= 500)
    const p = w.workshopProject!, tile = p.tiles[0], elapsed = p.elapsedMs
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', 'east')).toBe(true)
    advanceWorld(w, 5000); expect(p.elapsedMs).toBe(elapsed); expect(p.carriedIron).toBe(8); expect(w.personality.paths.craftsman.xp).toBe(0)
    const restored = load(w); removeBuilding(restored, tile % SIZE, Math.floor(tile / SIZE))
    until(restored, () => restored.workshopProject?.phase === 'complete')
    expect(restored.personality.paths.craftsman.xp).toBe(10); expect(crate(restored).inventory.ironPlate).toBe(0); expect(crate(restored).wood).toBe(0)
  })
  it('credits completed hammering once with a persisted cooldown, never on interruption', () => {
    const w = built(); until(w, () => w.peace.activity === 'hammering')
    expect(w.peace.untilMs - w.peace.sinceMs).toBe(WORKSHOP_ACTIVITY_MS); expect(workshopSpot(w)).toBe(w.pete.tile)
    expect(finishWorkshop(w)).toBe(false)
    const restored = load(w), remaining = w.peace.untilMs - w.timeMs
    advanceWorld(w, remaining - 50); expect(w.personality.paths.craftsman.xp).toBe(10)
    advanceWorld(w, 50); advanceWorld(restored, remaining)
    expect(snapshot(restored)).toEqual(snapshot(w)); expect(w.personality.paths.craftsman.xp).toBe(11)
    expect(finishWorkshop(w)).toBe(false); expect(w.workshopProject!.readyAtMs).toBe(w.timeMs + WORKSHOP_COOLDOWN_MS)
    advanceWorld(w, WORKSHOP_COOLDOWN_MS - 50); expect(w.personality.paths.craftsman.xp).toBe(11)
    until(w, () => w.personality.paths.craftsman.xp === 12)
    until(w, () => w.peace.activity === 'hammering')
    const xp = w.personality.paths.craftsman.xp, tile = w.workshopProject!.tiles[0]
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); expect(w.peace.activity).toBe('homeward')
    advanceWorld(w, 10000); expect(w.personality.paths.craftsman.xp).toBe(xp); expect(() => load(w)).not.toThrow()
  })
  it('preserves deterministic timing across partitions, pause and mid-visit restoration', () => {
    const w = built(); until(w, () => w.peace.activity === 'hammering'); advanceWorld(w, 17)
    const split = load(w), paused = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(paused)
    advanceWorld(w, 10017)
    for (const ms of [17, 1000, 2000, 7000]) advanceWorld(split, ms)
    expect(snapshot(split)).toEqual(snapshot(w))
  })
  it('fits outside an existing enclosure while preserving gate, home and supply access', () => {
    const w = world(); fund(w, 200, 0)
    until(w, () => w.gateProject?.phase === 'complete', 900000)
    fund(w, 0, 8); choose(w)
    const p = w.workshopProject!, gate = w.yard!.entrance
    expect(yardInterior(w.yard!, p.tiles[0])).toBe(false); expect([...p.tiles, ...p.spots]).not.toContain(gate)
    w.water[p.tiles[0]] = true; expect(projectSiteClear(w, p)).toBe(false); w.water[p.tiles[0]] = false
    until(w, () => p.phase === 'complete')
    const paths = peteReachableTiles(w, w.pete.tile)
    for (const tile of [820, 824, w.coopProject!.tiles[0]]) expect(neighboringTiles(tile).some(i => paths.has(i) && !w.buildings[i])).toBe(true)
    expect(w.buildings[gate]?.kind).toBe('peteGate'); expect(() => load(w)).not.toThrow()
  })
  it('reserves an existing workshop approach when choosing a later yard boundary', () => {
    const w = built(); fund(w, 200, 0)
    until(w, () => w.coopProject?.phase === 'complete')
    const proposed = planYard(w)!
    expect(proposed).not.toBeNull()
    const approach = proposed.tiles.find(i => !w.buildings[i])!
    // Isolate the planner contract: a completed workshop's work tile is reserved.
    w.workshopProject!.spots = [approach]
    const revised = planYard(w)
    expect(revised === null || !yardBoundary(revised).includes(approach)).toBe(true)
  })
  it('keeps an earlier workshop approach clear when the yard is built later', () => {
    const w = built(), spot = w.workshopProject!.spots[0]
    fund(w, 200, 0)
    until(w, () => w.gateProject?.phase === 'complete', 900000)
    expect(w.buildings[spot]).toBeNull()
    expect(w.water[spot]).toBe(false)
    expect(workshopSpot(w)).toBe(spot)
    until(w, () => w.peace.activity === 'hammering')
    expect(() => load(w)).not.toThrow()
  })
  it('migrates old saves unchanged and rejects malformed mixed stock, reward paths and activity clocks', () => {
    const w = world(); w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
    const old = snapshot(w); Reflect.deleteProperty(old.game.peace, 'nextProjectCheckAtMs'); Object.assign(old, { version: 23 })
    expect(snapshot(decodeSave(JSON.stringify(old)).world)).toEqual(snapshot(w))
    fund(w); choose(w); until(w, () => (w.workshopProject?.elapsedMs ?? 0) >= 500)
    const badCarry = snapshot(w); badCarry.game.workshopProject!.carriedIron = 7
    expect(() => decodeSave(JSON.stringify(badCarry))).toThrow('Invalid save')
    until(w, () => w.peace.activity === 'hammering')
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'workshopProject') },
      (d: SaveDocument) => { d.game.workshopProject!.carriedIron = 8 },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game.workshopProject!, 'readyAtMs') },
      (d: SaveDocument) => { d.game.workshopProject!.readyAtMs!++ },
      (d: SaveDocument) => { d.game.personality.paths.craftsman.xp = 0 },
      (d: SaveDocument) => { d.game.peace.destination = null },
      (d: SaveDocument) => { Object.assign(d, { version: 23 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
