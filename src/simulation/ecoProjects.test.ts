import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { awardActivity } from './personality'
import { advanceWorld } from './step'
import { projectCandidates, trySecretProject, currentProject } from './secretProject'
import { PETE_PROJECTS, projectUnlocked } from './projectRegistry'
import { supplyWood } from './supplyCrate'
import { gardenSpot, planPlanting, plantingSite, PLANT_COOLDOWN_MS, TEND_MS } from './ecoProjects'
import { plantTree, treeStage } from './nature'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function world(xp = 20) {
  const w = createBareWorld(() => .5); w.nature.wood = 500
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  if (xp) awardActivity(w.personality, { path: 'eco', xp })
  return w
}
function until(w: World, ready: () => boolean, limit = 500000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
function choose(w: World, id: string) {
  const cs = projectCandidates(w), index = cs.findIndex(c => c.definition.id === id)
  expect(index).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((s, c) => s + c.weight, 0), low = cs.slice(0, index).reduce((s, c) => s + c.weight, 0) / total, high = low + cs[index].weight / total
  let seed = 0
  for (; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) break }
  expect(seed).toBeLessThan(100000); w.peace.seed = seed
  expect(trySecretProject(w)).toBe(true)
  expect(currentProject(w)).toBe(w[cs[index].definition.state])
}
const stock = (w: World) => (w.buildings[824] as SupplyCrate).wood
const trees = (w: World) => w.buildings.filter(b => b?.kind === 'tree')
describe('Eco level two projects', () => {
  it('requires Eco level two independently of dominance and declares exact resources/rewards', () => {
    const w = world(19); supplyWood(w, 824, 24)
    for (const id of ['garden', 'reforestation']) expect(projectUnlocked(w, PETE_PROJECTS.find(p => p.id === id)!)).toBe(false)
    awardActivity(w.personality, { path: 'eco', xp: 1 })
    for (let i = 0; i < 10; i++) awardActivity(w.personality, { path: 'inventor', xp: 1 })
    expect(w.personality.dominant).toBe('inventor')
    const before = snapshot(w), candidates = projectCandidates(w)
    expect(candidates.find(c => c.definition.id === 'garden')?.weight).toBe(2)
    expect(candidates.find(c => c.definition.id === 'reforestation')?.weight).toBe(12)
    expect(snapshot(w)).toEqual(before)
    supplyWood(w, 824, 12)
    expect(projectCandidates(w).find(c => c.definition.id === 'garden')?.weight).toBe(3)
  })
  it('collects twelve Wood once, builds gradually and rewards the garden exactly once across saves', () => {
    const w = world(); supplyWood(w, 824, 12); choose(w, 'garden')
    expect(stock(w)).toBe(12)
    until(w, () => (w.gardenProject?.elapsedMs ?? 0) >= 500)
    const p = w.gardenProject!, tile = p.tiles[0], restored = load(w)
    expect(stock(w)).toBe(0); expect(p.carried).toBe(12); expect(w.buildings[tile]).toBeNull(); expect(w.personality.paths.eco.xp).toBe(20)
    advanceWorld(w, 12000 - p.elapsedMs); advanceWorld(restored, 12000 - restored.gardenProject!.elapsedMs)
    expect(snapshot(restored)).toEqual(snapshot(w)); expect(w.buildings[tile]?.kind).toBe('peteGarden')
    expect(w.personality.paths.eco.xp).toBe(40); expect(w.personality.rewardedProjects).toEqual(['garden'])
    expect(placeBuilding(w, 10, 10, 'peteGarden', 'east')).toBe(false)
    removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE)); advanceWorld(w, 30000)
    expect(w.personality.paths.eco.xp).toBe(40); expect(w.gardenProject?.phase).toBe('complete'); expect(() => load(w)).not.toThrow()
  })
  it('occasionally tends the garden, preserves the animation on load and cancels safely on demolition', () => {
    const w = world(); supplyWood(w, 824, 12); choose(w, 'garden'); until(w, () => w.gardenProject?.phase === 'complete')
    until(w, () => w.peace.activity === 'gardening')
    expect(w.peace.untilMs - w.peace.sinceMs).toBe(TEND_MS); expect(w.pete.tile).toBe(gardenSpot(w))
    const restored = load(w); advanceWorld(w, 765); advanceWorld(restored, 765); expect(snapshot(restored)).toEqual(snapshot(w))
    const tile = w.gardenProject!.tiles[0]; removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE))
    expect(w.peace.activity).toBe('homeward'); expect(() => load(w)).not.toThrow(); expect(w.personality.paths.eco.xp).toBe(40)
  })
  it('plants an existing growing tree only on success, without premature or duplicate XP', () => {
    const w = world(); supplyWood(w, 824, 2); choose(w, 'reforestation'); expect(stock(w)).toBe(2)
    until(w, () => (w.plantProject?.elapsedMs ?? 0) >= 500)
    const p = w.plantProject!, tile = p.tiles[0]
    expect(stock(w)).toBe(0); expect(w.personality.paths.eco.xp).toBe(20); expect(trees(w)).toHaveLength(0)
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', 'east')).toBe(true)
    advanceWorld(w, 5000); expect(w.personality.paths.eco.xp).toBe(20); expect(p.carried).toBe(2)
    const restored = load(w); removeBuilding(restored, tile % SIZE, Math.floor(tile / SIZE))
    until(restored, () => restored.plantProject?.phase === 'complete')
    expect(restored.personality.paths.eco.xp).toBe(25); expect(trees(restored)).toHaveLength(1)
    const tree = restored.buildings[tile]!
    if (tree.kind !== 'tree') throw Error('fixture')
    expect(treeStage(restored, tree)).toBe('sapling'); expect(treeStage({ timeMs: tree.bornAtMs + 120000 }, tree)).toBe('young')
    const again = load(restored); advanceWorld(again, 5000); expect(again.personality.paths.eco.xp).toBe(25)
  })
  it('enforces the cooldown, supports repeated XP and leaves time for ordinary peaceful routines', () => {
    const w = world(); supplyWood(w, 824, 2); choose(w, 'reforestation'); until(w, () => w.plantProject?.phase === 'complete')
    const first = w.plantProject!, due = first.readyAtMs!
    expect(due).toBe(w.timeMs + PLANT_COOLDOWN_MS)
    supplyWood(w, 824, 2); advanceWorld(w, PLANT_COOLDOWN_MS - 50)
    expect(w.plantProject).toBe(first); expect(stock(w)).toBe(2)
    expect(projectCandidates(w).some(c => c.definition.id === 'reforestation')).toBe(false)
    expect(w.peace.activity).not.toBe('project')
    const restored = load(w); advanceWorld(restored, 50); choose(restored, 'reforestation')
    until(restored, () => restored.plantProject?.phase === 'complete')
    expect(trees(restored)).toHaveLength(2); expect(restored.personality.paths.eco.xp).toBe(30); expect(stock(restored)).toBe(0)
  })
  it('avoids water, factory buffers, ore, tree density, blocked routes and prefers existing natural areas', () => {
    const w = world(), plan = planPlanting(w)!, tile = plan.tiles[0]
    expect(plantingSite(w, tile)).toBe(true)
    w.water[tile] = true; expect(plantingSite(w, tile)).toBe(false); w.water[tile] = false
    w.tiles[tile] = 'iron'; expect(plantingSite(w, tile)).toBe(false); w.tiles[tile] = null
    placeBuilding(w, tile % SIZE + 1, Math.floor(tile / SIZE), 'storage', 'east'); expect(plantingSite(w, tile)).toBe(false)
    removeBuilding(w, tile % SIZE + 1, Math.floor(tile / SIZE))
    expect(plantTree(w, tile % SIZE + 1, Math.floor(tile / SIZE), 'birch')).toBe(true); expect(plantingSite(w, tile)).toBe(false)
    const next = planPlanting(w)!
    expect(Math.max(Math.abs(next.tiles[0] % SIZE - (tile % SIZE + 1)), Math.abs(Math.floor(next.tiles[0] / SIZE) - Math.floor(tile / SIZE)))).toBeLessThanOrEqual(5)
    for (let i = 0; i < w.water.length; i++) if (!w.buildings[i] && i !== w.pete.tile) w.water[i] = true
    expect(planPlanting(w)).toBeNull()
  })
  it('remains deterministic across equivalent partitions, pause and mid-plant saves', () => {
    const w = world(); supplyWood(w, 824, 2); choose(w, 'reforestation'); until(w, () => (w.plantProject?.elapsedMs ?? 0) >= 500)
    advanceWorld(w, 17); const split = load(w), paused = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(paused)
    advanceWorld(w, 15017)
    for (const ms of [17, 1000, 2000, 12000]) advanceWorld(split, ms)
    expect(snapshot(split)).toEqual(snapshot(w))
  })
  it('completes the existing property and garden through the real registry without duplicate rewards or lost Wood', () => {
    const w = world(0); supplyWood(w, 824, 200)
    until(w, () => w.gateProject?.phase === 'complete' && w.gardenProject?.phase === 'complete', 900000)
    expect(w.personality.rewardedProjects).toHaveLength(6)
    expect(new Set(w.personality.rewardedProjects).size).toBe(6)
    const planted = trees(w).filter(t => t.kind === 'tree' && t.origin === 'manual').length
    expect(stock(w) + 6 + 10 + 5 + 3 + 12 + w.yard!.tiles.length * 2 + planted * 2 + (w.plantProject?.carried ?? 0)).toBe(200)
    expect(w.personality.paths.eco.xp).toBe(55 + planted * 5 + w.poultry!.collected)
    expect(snapshot(load(w))).toEqual(snapshot(w))
  })
  it('strictly validates garden construction, completed ownership and tending state', () => {
    const w = world(); supplyWood(w, 824, 12); choose(w, 'garden')
    until(w, () => (w.gardenProject?.elapsedMs ?? 0) >= 500)
    const invalidStock = snapshot(w); invalidStock.game.gardenProject!.carried = 11
    expect(() => decodeSave(JSON.stringify(invalidStock))).toThrow('Invalid save')
    until(w, () => w.peace.activity === 'gardening')
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'gardenProject') },
      (d: SaveDocument) => { d.game.gardenProject!.readyAtMs!++ },
      (d: SaveDocument) => { d.game.peace.destination = null },
      (d: SaveDocument) => { d.game.personality.rewardedProjects = [] },
      (d: SaveDocument) => { d.game.buildings[41] = { kind: 'peteGarden', x: 1, y: 1 } },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
  it('migrates a version-22 world unchanged and rejects malformed progress, cooldowns and unearned gardens', () => {
    const w = world(); w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
    const old = snapshot(w); Reflect.deleteProperty(old.game.peace, 'nextProjectCheckAtMs'); Object.assign(old, { version: 22 })
    const restored = decodeSave(JSON.stringify(old)).world; expect(snapshot(restored)).toEqual(snapshot(w))
    expect(restored.gardenProject).toBeUndefined(); expect(restored.plantProject).toBeUndefined()
    supplyWood(w, 824, 2); choose(w, 'reforestation'); until(w, () => w.plantProject?.phase === 'complete')
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game.plantProject!, 'readyAtMs') },
      (d: SaveDocument) => { d.game.plantProject!.readyAtMs!++ },
      (d: SaveDocument) => { d.game.plantProject!.carried = 2 },
      (d: SaveDocument) => { d.game.plantProject!.selected = true },
      (d: SaveDocument) => { Object.assign(d, { version: 22 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
