import { stripVersion52State } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import type { SupplyCrate, World } from './world'
import { awardActivity } from './personality'
import { PETE_PROJECTS } from './projectRegistry'
import { projectCandidates, trySecretProject } from './secretProject'
import { advanceWorld } from './step'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import { createLeisure, flightPose, leisureDecision } from './peteLeisure'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snap = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snap(w))).world
function world(xp = 20) {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  awardActivity(w.personality, { path: 'inventor', xp })
  const crate = w.buildings[824] as SupplyCrate
  crate.inventory.copperPlate = 60; crate.inventory.copperCable = 40; crate.inventory.electronicCircuit = 16
  return w
}
function until(w: World, ready: () => boolean, limit = 500000) { for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50); expect(ready()).toBe(true) }
function choose(w: World, id: string) {
  for (const d of PETE_PROJECTS) { const p = w[d.state]; if (p) delete p.selected }
  const cs = projectCandidates(w), index = cs.findIndex(c => c.definition.id === id); expect(index).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((s, c) => s + c.priorityWeight, 0), low = cs.slice(0, index).reduce((s, c) => s + c.priorityWeight, 0) / total, high = low + cs[index].priorityWeight / total
  for (let seed = 0; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) { w.peace.seed = seed; break } }
  expect(trySecretProject(w)).toBe(true)
}
function chest() { const w = world(); choose(w, 'treasure'); until(w, () => w.treasureProject?.phase === 'complete'); return w }
function pad() { const w = world(200); choose(w, 'experiment'); until(w, () => w.experimentProject?.phase === 'complete'); choose(w, 'flightpad'); until(w, () => w.flightProject?.phase === 'complete'); return w }
describe('Inventor collection and harmless flight', () => {
  it('atomically builds a copper chest and preserves paid work, rewards and materials through save/load', () => {
    const w = world(), crate = w.buildings[824] as SupplyCrate
    choose(w, 'treasure'); until(w, () => (w.treasureProject?.elapsedMs ?? 0) >= 500)
    expect(crate.inventory.copperPlate).toBe(48); expect(crate.inventory.copperCable).toBe(36)
    expect(w.treasureProject?.carriedCopper).toBe(12)
    const restored = load(w); advanceWorld(w, 15000); advanceWorld(restored, 15000)
    expect(snap(restored)).toEqual(snap(w)); expect(w.personality.rewardedProjects.filter(id => id === 'treasure')).toHaveLength(1)
  })
  it('finds nearby keepsakes, carries them home and deposits exactly one XP without factory items', () => {
    const w = chest(); w.leisure ??= createLeisure(w); w.leisure.nextFindAtMs = w.timeMs
    until(w, () => w.peace.activity === 'pickingTreasure')
    expect(snap(load(w))).toEqual(snap(w))
    until(w, () => w.leisure?.carried !== null && w.leisure?.carried !== undefined)
    const carried = w.leisure!.carried!, restored = load(w), count = w.leisure!.collection[carried]
    until(w, () => w.leisure!.collection[carried] > count)
    advanceWorld(restored, w.timeMs - restored.timeMs)
    expect(snap(restored)).toEqual(snap(w)); expect(w.leisure!.carried).toBeNull()
    expect(w.leisure!.collection[carried]).toBe(count + 1)
    expect(w.produced.ironGear).toBe(0)
  })
  it('cancels a blocked find without phantom payload and preserves a loadable world', () => {
    const w = chest(); w.leisure ??= createLeisure(w); w.leisure.nextFindAtMs = w.timeMs
    until(w, () => w.peace.activity === 'treasureward')
    const target = w.leisure!.pending!.tile
    expect(placeBuilding(w, target % 40, Math.floor(target / 40), 'storage', 'east')).toBe(true)
    expect(w.leisure!.pending).toBeNull(); expect(w.leisure!.carried).toBeNull()
    expect(() => load(w)).not.toThrow()
  })
  it('keeps carried treasure when its chest is removed', () => {
    const w = chest(); w.leisure ??= createLeisure(w); w.leisure.carried = 'crystal'
    const tile = w.treasureProject!.tiles[0]; removeBuilding(w, tile % 40, Math.floor(tile / 40))
    advanceWorld(w, 5000); expect(w.leisure!.carried).toBe('crystal'); expect(leisureDecision(w)).toBeNull(); expect(() => load(w)).not.toThrow()
  })
  it('has harmless early crash landings, saved recovery and completion-only practice XP', () => {
    const w = pad(); until(w, () => w.peace.activity === 'flying')
    expect(w.leisure!.flight!.practice).toBe(true); expect(w.leisure!.flight!.crash).toBe(true)
    expect(flightPose(w)).not.toBeNull(); const tile = w.pete.tile, stock = structuredClone(w.produced), before = w.leisure!.practices
    const bad = snap(w); bad.game.leisure.flight.durationMs = 6050
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    const restored = load(w)
    until(w, () => w.peace.activity === 'crashRest'); expect(w.leisure!.practices).toBe(before)
    expect(snap(load(w))).toEqual(snap(w))
    until(w, () => w.leisure!.practices === before + 1)
    advanceWorld(restored, w.timeMs - restored.timeMs)
    expect(snap(restored)).toEqual(snap(w)); expect(w.produced).toEqual(stock); expect(w.pete.tile).toBe(tile)
  })
  it('unlocks scenic flights at level 5 without cargo or factory effects and cancels on home loss', () => {
    const w = pad(); awardActivity(w.personality, { path: 'inventor', xp: 300 }); until(w, () => w.peace.activity === 'flying')
    expect(w.leisure!.flight!.practice).toBe(false); expect(w.leisure!.flight!.crash).toBe(false)
    const before = w.leisure!.practices; until(w, () => w.leisure!.flight === null)
    expect(w.leisure!.practices).toBe(before)
    until(w, () => w.peace.activity === 'flying'); removeBuilding(w, 20, 20)
    expect(w.leisure!.flight).toBeNull(); expect(() => load(w)).not.toThrow()
  })
  it('strictly rejects forged carried materials and flight clocks and accepts old version 36', () => {
    const w = world(); choose(w, 'treasure'); until(w, () => w.treasureProject?.phase === 'building')
    const bad = snap(w); bad.game.treasureProject.carriedCable = 0; expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    const legacy = snap(createBareWorld(() => .5)); stripVersion52State(legacy.game); legacy.version = 36
    expect(decodeSave(JSON.stringify(legacy)).world.leisure).toBeUndefined()
    legacy.game.leisure = createLeisure(w); expect(() => decodeSave(JSON.stringify(legacy))).toThrow('Invalid save')
  })
})
