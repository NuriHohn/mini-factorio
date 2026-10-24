import { describe, expect, it } from 'vitest'
import { createUnlockedWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import type { SupplyCrate, World } from './world'
import { awardActivity } from './personality'
import { PETE_PROJECTS } from './projectRegistry'
import { projectCandidates, trySecretProject } from './secretProject'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { createDevelopmentLife, developmentBuilding, developmentDecision } from './peteDevelopments'
import type { DevelopmentKind, DevelopmentTask } from './peteDevelopments'
import { canReceive } from './transport'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snap = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-24T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snap(w))).world
function world() {
  const w = createUnlockedWorld(() => .5); w.nature.wood = 50
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  for (const path of ['eco', 'craftsman', 'industrial'] as const) awardActivity(w.personality, { path, xp: 200 })
  const c = w.buildings[824] as SupplyCrate; c.wood = 50; c.inventory.ironPlate = 100; c.inventory.ironGear = 40; c.inventory.mechanicModule = 8
  return w
}
function until(w: World, f: () => boolean, limit = 200000) { for (let t = 0; t < limit && !f(); t += 50) advanceWorld(w, 50); expect(f()).toBe(true) }
function choose(w: World, id: string) {
  for (const d of PETE_PROJECTS) { const p = w[d.state]; if (p) delete p.selected }
  const cs = projectCandidates(w), i = cs.findIndex(c => c.definition.id === id); expect(i).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((n, c) => n + c.priorityWeight, 0), low = cs.slice(0, i).reduce((n, c) => n + c.priorityWeight, 0) / total, high = low + cs[i].priorityWeight / total
  for (let seed = 0; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) { w.peace.seed = seed; break } }
  expect(trySecretProject(w)).toBe(true)
}
function build(w: World, kind: string) { choose(w, kind); until(w, () => w[PETE_PROJECTS.find(d => d.id === kind)!.state]?.phase === 'complete') }
function prepared(kind: DevelopmentKind) {
  const w = world()
  for (const pre of PETE_PROJECTS.find(d => d.id === kind)!.prerequisites) { if (pre === 'veranda') build(w, 'workshop'); if (pre === 'mechanic') build(w, 'press'); build(w, pre) }
  build(w, kind); return w
}
function start(w: World, task: DevelopmentTask) {
  w.developmentLife ??= createDevelopmentLife()
  for (const t of Object.keys(w.developmentLife.nextAt) as DevelopmentTask[]) w.developmentLife.nextAt[t] = t === task || (task === 'takeSapling' && t === 'plantSapling') ? 0 : w.timeMs + 60000
  for (let n = 0; n < 100; n++) {
    const choice = developmentDecision(w)
    if (choice && w.developmentLife.task === task) { Object.assign(w.pete, { next: null, travelMs: 0, x: w.pete.tile % 40, y: Math.floor(w.pete.tile / 40), path: [], pathRevision: -1 }); Object.assign(w.peace, { activity: choice.activity, destination: choice.destination, sinceMs: w.timeMs, untilMs: w.timeMs }); return }
  }
  throw new Error(`No task ${task}`)
}
describe('higher Pete developments', () => {
  it.each(['orchard', 'bicycle', 'mechanic', 'winch', 'nursery', 'house'] as const)('builds %s with exact materials, staged work and once-only saved rewards', kind => {
    const w = prepared(kind), p = w[`${kind}Project`]!
    expect(p.phase).toBe('complete'); expect(developmentBuilding(w, kind)).not.toBeNull()
    expect(w.personality.rewardedProjects.filter(id => id === kind)).toHaveLength(1)
    const restored = load(w); advanceWorld(w, 3700); advanceWorld(restored, 3700); expect(snap(restored)).toEqual(snap(w))
  })
  it('preserves paid stock across a blocked orchard and rejects forged balances', () => {
    const w = world(); choose(w, 'orchard'); until(w, () => w.orchardProject!.elapsedMs >= 500)
    const p = w.orchardProject!, wood = (w.buildings[824] as SupplyCrate).wood, tile = p.tiles[0]
    const bad = snap(w); bad.game.orchardProject.carried = 0; expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    placeBuilding(w, tile % 40, Math.floor(tile / 40), 'storage', 'east'); advanceWorld(w, 1000); expect(p.carried).toBe(18)
    expect(() => load(w)).not.toThrow(); removeBuilding(w, tile % 40, Math.floor(tile / 40)); choose(w, 'orchard'); until(w, () => p.phase === 'complete')
    expect((w.buildings[824] as SupplyCrate).wood).toBeLessThanOrEqual(wood)
  })
  it('physically picks and delivers fruit across a saved carrying phase', () => {
    const w = prepared('orchard'), orchard = developmentBuilding(w, 'orchard')!; orchard.fruit = 2
    start(w, 'pickFruit'); until(w, () => w.developmentLife!.carriedFruit === 2)
    const restored = load(w); until(w, () => w.developmentLife!.fruit >= 2); advanceWorld(restored, w.timeMs - restored.timeMs)
    expect(snap(restored)).toEqual(snap(w)); expect(w.developmentLife!.carriedFruit).toBe(0)
  })
  it('commits mechanics only at completion, respects buffers and persists input/output', () => {
    const w = prepared('mechanic'), b = developmentBuilding(w, 'mechanic')!; b.gears = 2
    expect(canReceive(b, 'ironPlate', 'east')).toBe(false); expect(canReceive(b, 'ironGear', 'east', { ironGear: 2 })).toBe(false)
    start(w, 'mechanics'); until(w, () => w.peace.activity === 'developmentWork'); const restored = load(w), before = w.produced.mechanicModule
    expect(b.gears).toBe(2); advanceWorld(w, 6000); advanceWorld(restored, 6000)
    expect(w.produced.mechanicModule).toBe(before + 1); expect(b.modules).toBe(1); expect(b.gears).toBe(0); expect(snap(restored)).toEqual(snap(w))
  })
  it('rides real cardinal tiles and restores fractional progress without teleporting', () => {
    const w = prepared('bicycle'); start(w, 'cycle'); until(w, () => w.peace.activity === 'cycling' && w.pete.next !== null && w.pete.travelMs > 0)
    const restored = load(w); expect(w.pete.path.length).toBeGreaterThan(0)
    advanceWorld(w, 7000); advanceWorld(restored, 7000); expect(snap(restored)).toEqual(snap(w))
  })
  it('cancels an active ride on home loss without stale saved tasks or XP', () => {
    const w = prepared('bicycle'); start(w, 'cycle'); until(w, () => w.peace.activity === 'cycling')
    const xp = w.personality.paths.craftsman.xp
    removeBuilding(w, 20, 20); expect(w.developmentLife!.task).toBeNull(); expect(w.personality.paths.craftsman.xp).toBe(xp); expect(() => load(w)).not.toThrow()
  })
  it('grows a paid seedling then plants it nearby, with valid save state after topology changes', () => {
    const w = prepared('nursery'); start(w, 'collectNurseryWood'); until(w, () => w.developmentLife!.carriedWood === 2)
    expect(() => load(w)).not.toThrow(); until(w, () => w.developmentLife!.saplings > 0)
    start(w, 'takeSapling'); until(w, () => w.developmentLife!.carriedSapling === 1)
    expect(() => load(w)).not.toThrow()
    start(w, 'plantSapling'); until(w, () => w.developmentLife!.task !== 'plantSapling')
    expect(w.buildings.some(b => b?.kind === 'tree' && b.origin === 'manual')).toBe(true); expect(() => load(w)).not.toThrow()
  })
  it('moves modules through powered inserters without extracting unfinished gears', () => {
    const w = world(); const tile = 410
    w.buildings[tile] = { kind: 'peteDevelopment', development: 'mechanic', x: 10, y: 10, gears: 3, modules: 2, fruit: 0, readyAtMs: 0 }
    placeBuilding(w, 11, 10, 'inserter', 'east'); placeBuilding(w, 12, 10, 'storage', 'east')
    placeBuilding(w, 11, 9, 'powerPole', 'east'); placeBuilding(w, 11, 8, 'generator', 'east')
    w.topologyRevision++; advanceWorld(w, 5000)
    const b = w.buildings[tile], storage = w.buildings[412]
    expect(b?.kind === 'peteDevelopment' && b.modules).toBe(0); expect(b?.kind === 'peteDevelopment' && b.gears).toBe(3)
    expect(storage?.kind === 'storage' && storage.inventory.mechanicModule).toBe(2)
  })
  it('does not spend workshop input when its home is removed during work', () => {
    const w = prepared('mechanic'), b = developmentBuilding(w, 'mechanic')!; b.gears = 2
    start(w, 'mechanics'); until(w, () => w.peace.activity === 'developmentWork')
    const xp = w.personality.paths.industrial.xp, produced = w.produced.mechanicModule
    removeBuilding(w, 20, 20)
    expect(w.developmentLife!.task).toBeNull(); expect(b.gears).toBe(2)
    expect(w.produced.mechanicModule).toBe(produced); expect(w.personality.paths.industrial.xp).toBe(xp)
    expect(() => load(w)).not.toThrow()
  })
  it('rejects full or empty workshop batches and forged active task stock', () => {
    const w = prepared('mechanic'), b = developmentBuilding(w, 'mechanic')!
    w.developmentLife = createDevelopmentLife()
    for (const t of Object.keys(w.developmentLife.nextAt) as DevelopmentTask[]) w.developmentLife.nextAt[t] = w.timeMs + 60000
    w.developmentLife.nextAt.mechanics = 0
    expect(developmentDecision(w)).toBeNull()
    b.gears = 2; b.modules = 4; expect(developmentDecision(w)).toBeNull()
    b.modules = 0; start(w, 'mechanics'); until(w, () => w.peace.activity === 'developmentWork')
    const bad = snap(w); bad.game.buildings[b.y * 40 + b.x].gears = 0
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
  })
  it('preserves a carried seedling across nursery removal and saved continuation', () => {
    const w = prepared('nursery'); w.developmentLife = createDevelopmentLife(); w.developmentLife.saplings = 1
    start(w, 'takeSapling'); until(w, () => w.developmentLife!.carriedSapling === 1)
    const b = developmentBuilding(w, 'nursery')!; removeBuilding(w, b.x, b.y)
    const restored = load(w); advanceWorld(w, 12000)
    for (let i = 0; i < 120; i++) advanceWorld(restored, 100)
    expect(snap(restored)).toEqual(snap(w)); expect(w.developmentLife!.carriedSapling).toBe(0)
    expect(w.buildings.some(b => b?.kind === 'tree' && b.origin === 'manual')).toBe(true)
  })
  it('rejects a missing earned XP ledger without changing the live world', () => {
    const w = prepared('orchard'); start(w, 'tendOrchard'); until(w, () => w.developmentLife!.ecoXp > 0)
    const before = snap(w), bad = structuredClone(before); bad.game.developmentLife.ecoXp = bad.game.personality.paths.eco.xp + 1
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save'); expect(snap(w)).toEqual(before)
  })
  it('saves pantry recovery while carrying fruit without losing or duplicating the load', () => {
    const w = prepared('orchard'); build(w, 'fence'); build(w, 'coop'); build(w, 'campfire')
    w.developmentLife ??= createDevelopmentLife(); w.developmentLife.fruit = 12; w.developmentLife.carriedFruit = 2
    start(w, 'cookFruit'); until(w, () => w.peace.activity === 'developmentWork')
    const restored = load(w); advanceWorld(w, 6000); advanceWorld(restored, 6000)
    expect(snap(restored)).toEqual(snap(w)); expect(w.developmentLife.carriedFruit).toBe(2); expect(w.developmentLife.fruit).toBe(11)
  })
  it('retains fruit and wood on home loss and migrates module-free version 37', () => {
    const w = prepared('orchard'); w.developmentLife ??= createDevelopmentLife(); w.developmentLife.carriedFruit = 2
    removeBuilding(w, 20, 20); expect(w.developmentLife.carriedFruit).toBe(2); expect(() => load(w)).not.toThrow()
    const legacy = snap(createUnlockedWorld(() => .5)); legacy.version = 37
    const strip = (o: Record<string, unknown>) => { if (!o || typeof o !== 'object') return; delete o.mechanicModule; for (const v of Object.values(o)) if (v && typeof v === 'object') strip(v as Record<string, unknown>) }
    strip(legacy.game); expect(decodeSave(JSON.stringify(legacy)).world.produced.mechanicModule).toBe(0)
  })
})
