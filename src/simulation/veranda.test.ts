import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { supplyWood } from './supplyCrate'
import { deliverItem } from './transport'
import { advanceWorld } from './step'
import { awardActivity } from './personality'
import { PETE_PROJECTS, projectUnlocked } from './projectRegistry'
import { currentProject, projectCandidates, trySecretProject } from './secretProject'
import { hasVeranda, VERANDA_BUILD_MS, VERANDA_REST_MS } from './veranda'
import { neighboringTiles, peteReachableTiles } from './navigation'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World) => w.buildings[824] as SupplyCrate
function world(xp = 20) {
  const w = createBareWorld(() => .5); w.nature.wood = 500
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  if (xp) awardActivity(w.personality, { path: 'craftsman', xp })
  return w
}
function fund(w: World, wood = 0, iron = 20) {
  if (wood) expect(supplyWood(w, 824, wood)).toBe(true)
  for (let i = 0; i < iron; i++) expect(deliverItem(crate(w), 'ironPlate', 'east')).toBe(true)
}
function until(w: World, ready: () => boolean, limit = 300000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
function choose(w: World, id = 'veranda') {
  const cs = projectCandidates(w), index = cs.findIndex(c => c.definition.id === id)
  expect(index).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((sum, c) => sum + c.weight, 0), low = cs.slice(0, index).reduce((sum, c) => sum + c.weight, 0) / total, high = low + cs[index].weight / total
  let seed = 0
  for (; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) break }
  expect(seed).toBeLessThan(100000); w.peace.seed = seed
  expect(trySecretProject(w)).toBe(true); expect(currentProject(w)).toBe(w[cs[index].definition.state])
}
function building() { const w = world(); fund(w); choose(w); until(w, () => (w.verandaProject?.elapsedMs ?? 0) >= 500); return w }
function built() { const w = building(); until(w, () => w.verandaProject?.phase === 'complete'); return w }
describe('Craftsman level two treehouse veranda', () => {
  it('unlocks at 20 Craftsman XP independently of dominance and weights available iron', () => {
    const w = world(19), definition = PETE_PROJECTS.find(p => p.id === 'veranda')!
    expect(definition).toMatchObject({ path: 'craftsman', minimumLevel: 2, primaryMaterial: 'ironPlate', resources: { ironPlate: 20 }, repeatable: false })
    fund(w); expect(projectUnlocked(w, definition)).toBe(false)
    expect(projectCandidates(w).some(c => c.definition.id === 'veranda')).toBe(false)
    awardActivity(w.personality, { path: 'craftsman', xp: 1 })
    for (let i = 0; i < 8; i++) awardActivity(w.personality, { path: 'eco', xp: 1 })
    expect(w.personality.dominant).toBe('eco'); expect(projectUnlocked(w, definition)).toBe(true)
    const before = snapshot(w), candidates = projectCandidates(w)
    expect(candidates.find(c => c.definition.id === 'veranda')?.weight).toBe(1)
    expect(snapshot(w)).toEqual(before)
    fund(w, 0, 20)
    expect(projectCandidates(w).find(c => c.definition.id === 'veranda')?.weight).toBe(2)
    expect(projectCandidates(w).find(c => c.definition.id === 'fence')?.weight).toBe(candidates.find(c => c.definition.id === 'fence')?.weight)
  })
  it('requires complete stock and a reachable dry approach without spending on consideration', () => {
    for (const [wood, iron] of [[0, 19], [8, 11]]) {
      const w = world(); fund(w, wood, iron)
      expect(projectCandidates(w).some(c => c.definition.id === 'veranda')).toBe(false)
      expect(crate(w)).toMatchObject({ wood, inventory: { ironPlate: iron } })
    }
    const w = world(); fund(w)
    for (const i of neighboringTiles(820)) w.water[i] = true
    expect(projectCandidates(w).some(c => c.definition.id === 'veranda')).toBe(false)
    expect(crate(w)).toMatchObject({ wood: 0, inventory: { ironPlate: 20 } })
  })
  it('collects both materials atomically once, builds gradually and preserves every footprint', () => {
    const w = world(); fund(w); choose(w)
    const structures = structuredClone(w.buildings), revision = w.topologyRevision
    until(w, () => w.verandaProject?.phase === 'building')
    expect(w.verandaProject).toMatchObject({ tiles: [820], carried: 0, carriedIron: 20, built: 0, elapsedMs: 0 })
    expect(crate(w)).toMatchObject({ wood: 0, inventory: { ironPlate: 0 } })
    until(w, () => w.verandaProject!.elapsedMs >= 500)
    expect(hasVeranda(w)).toBe(false); expect(w.personality.paths.craftsman.xp).toBe(20)
    const restored = load(w)
    until(w, () => w.verandaProject!.phase === 'complete')
    until(restored, () => restored.verandaProject!.phase === 'complete')
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(w.buildings).toEqual(structures.map((b, i) => i === 824 ? { ...b, wood: 0, inventory: crate(w).inventory } : b))
    expect(w.topologyRevision).toBe(revision)
    expect(w.verandaProject).toMatchObject({ built: 1, carried: 0, carriedIron: 0, elapsedMs: 0 })
    expect(w.personality.paths.craftsman.xp).toBe(45); expect(w.personality.paths.eco.xp).toBe(0)
    expect(w.personality.rewardedProjects).toEqual(['veranda'])
    expect(peteReachableTiles(w, w.pete.tile).has(w.verandaProject!.spots[0])).toBe(true)
    fund(w); expect(projectCandidates(w).some(c => c.definition.id === 'veranda')).toBe(false)
    expect(hasVeranda(load(w))).toBe(true)
  })
  it('revalidates lost stock before pickup without a partial debit', () => {
    const w = world(); fund(w); choose(w)
    until(w, () => w.verandaProject?.crate === 824 && w.pete.next !== null)
    crate(w).inventory.ironPlate = 19
    until(w, () => w.peace.activity !== 'project')
    expect(w.verandaProject).toMatchObject({ phase: 'collecting', carried: 0, carriedIron: 0 })
    expect(crate(w).wood).toBe(0)
    fund(w, 0, 1); choose(w); until(w, () => w.verandaProject!.phase === 'building')
    expect(crate(w)).toMatchObject({ wood: 0, inventory: { ironPlate: 0 } })
  })
  it('waits when the paid work approach is blocked and resumes without spending twice', () => {
    const w = world(); fund(w); choose(w)
    until(w, () => w.verandaProject?.phase === 'building')
    const spot = w.verandaProject!.spots[0]
    expect(placeBuilding(w, spot % SIZE, Math.floor(spot / SIZE), 'storage', 'east')).toBe(true)
    advanceWorld(w, 20000)
    expect(w.verandaProject).toMatchObject({ phase: 'building', carried: 0, carriedIron: 20, elapsedMs: 0 })
    const restored = load(w)
    expect(removeBuilding(restored, spot % SIZE, Math.floor(spot / SIZE))).toBe(true)
    until(restored, () => restored.verandaProject!.phase === 'complete')
    expect(restored.personality.paths.craftsman.xp).toBe(45)
    expect(crate(restored)).toMatchObject({ wood: 0, inventory: { ironPlate: 0 } })
  })
  it('keeps paid progress during home loss and resumes safely without another collection', () => {
    const w = building(), elapsed = w.verandaProject!.elapsedMs
    expect(removeBuilding(w, 20, 20)).toBe(true)
    const restored = load(w); advanceWorld(restored, 20000)
    expect(restored.verandaProject).toMatchObject({ elapsedMs: elapsed, carried: 0, carriedIron: 20 })
    expect(placeBuilding(restored, 20, 20, 'treehouse', 'east')).toBe(true)
    until(restored, () => restored.verandaProject!.phase === 'complete')
    expect(restored.personality.paths.craftsman.xp).toBe(45)
    expect(crate(restored)).toMatchObject({ wood: 0, inventory: { ironPlate: 0 } })
  })
  it('persists permanently across dominance changes, rest and demolition without repeated XP', () => {
    const w = built()
    for (let i = 0; i < 8; i++) awardActivity(w.personality, { path: 'eco', xp: 1 })
    expect(w.personality.dominant).toBe('eco'); expect(hasVeranda(w)).toBe(true)
    until(w, () => w.peace.activity === 'verandaRest')
    expect(w.peace.untilMs - w.peace.sinceMs).toBe(VERANDA_REST_MS)
    expect(neighboringTiles(820)).toContain(w.pete.tile)
    const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
    advanceWorld(restored, VERANDA_REST_MS)
    expect(restored.peace.activity).not.toBe('verandaRest')
    expect(restored.personality.paths.craftsman.xp).toBe(45)
    expect(removeBuilding(w, 20, 20)).toBe(true); expect(w.peace.activity).toBe('homeward')
    expect(hasVeranda(w)).toBe(false); expect(() => load(w)).not.toThrow()
    expect(placeBuilding(w, 20, 20, 'treehouse', 'east')).toBe(true)
    expect(hasVeranda(w)).toBe(true); fund(w)
    expect(projectCandidates(w).some(c => c.definition.id === 'veranda')).toBe(false)
    expect(w.personality.rewardedProjects.filter(id => id === 'veranda')).toHaveLength(1)
  })
  it('uses fixed simulation timing across partitions, pause and mid-construction saves', () => {
    const w = building(); advanceWorld(w, 17)
    const paused = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(paused)
    const restored = load(w)
    advanceWorld(w, VERANDA_BUILD_MS + 17)
    for (const ms of [17, 2000, 3000, 7000]) advanceWorld(restored, ms)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('migrates version 24 workshop saves exactly and rejects malformed upgrade progress and rewards', () => {
    const w = world(0); fund(w, 0, 12); choose(w, 'workshop'); until(w, () => w.workshopProject?.phase === 'complete')
    w.peace.nextProjectCheckAtMs = 0; w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
    const old = snapshot(w); Reflect.deleteProperty(old.game.peace, 'nextProjectCheckAtMs'); Object.assign(old, { version: 24 })
    expect(snapshot(decodeSave(JSON.stringify(old)).world)).toEqual(snapshot(w))
    const active = building()
    for (const mutate of [
      (d: SaveDocument) => { d.game.verandaProject!.carriedIron = 11 },
      (d: SaveDocument) => { d.game.verandaProject!.carried = 7 },
      (d: SaveDocument) => { d.game.verandaProject!.elapsedMs++ },
      (d: SaveDocument) => { d.game.verandaProject!.tiles = [821] },
      (d: SaveDocument) => { d.game.verandaProject!.spots = [822] },
      (d: SaveDocument) => { Object.assign(d, { version: 24 }) },
      (d: SaveDocument) => { d.game.personality.paths.craftsman = { xp: 19, level: 1, influence: 0 } },
    ]) {
      const doc = snapshot(active); mutate(doc); expect(() => decodeSave(JSON.stringify(doc))).toThrow('Invalid save')
    }
    const complete = built(), badXp = snapshot(complete)
    badXp.game.personality.paths.craftsman.xp = 20
    expect(() => decodeSave(JSON.stringify(badXp))).toThrow('Invalid save')
    const duplicate = snapshot(complete); duplicate.game.personality.rewardedProjects.push('veranda')
    expect(() => decodeSave(JSON.stringify(duplicate))).toThrow('Invalid save')
  })
})
