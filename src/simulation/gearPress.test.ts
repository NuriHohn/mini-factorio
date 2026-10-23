import { describe, expect, it } from 'vitest'
import { createUnlockedWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { Belt, Inserter, PetePress, Storage, SupplyCrate, World } from './world'
import { canReceive, deliverItem, advanceTransport } from './transport'
import { supplyWood } from './supplyCrate'
import { currentProject, projectCandidates, projectSiteClear, trySecretProject } from './secretProject'
import { awardActivity } from './personality'
import { advanceWorld } from './step'
import { finishPress, gearPress, PRESS_ACTIVITY_MS, PRESS_COOLDOWN_MS, pressReady, pressSpot } from './gearPress'
import { planYard, yardBoundary } from './yard'
import { createInserterFrame, advanceInserters, INSERTER_SWING_MS } from './inserters'
import { allocatePower } from './power'
import { inspectBuilding } from './inspection'
import { inspectionSummary } from '../game/inspectionSummary'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
const crate = (w: World, tile = 824) => w.buildings[tile] as SupplyCrate
function world() {
  const w = createUnlockedWorld(() => .5); w.nature.wood = 500
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  return w
}
function fund(w: World, wood = 4, iron = 12, gears = 4, tile = 824) {
  if (wood) expect(supplyWood(w, tile, wood)).toBe(true)
  for (let n = 0; n < iron; n++) expect(deliverItem(crate(w, tile), 'ironPlate', 'east')).toBe(true)
  for (let n = 0; n < gears; n++) expect(deliverItem(crate(w, tile), 'ironGear', 'east')).toBe(true)
}
function until(w: World, ready: () => boolean, limit = 500000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
function choose(w: World) {
  const cs = projectCandidates(w), index = cs.findIndex(c => c.definition.id === 'press')
  expect(index).toBeGreaterThanOrEqual(0)
  const total = cs.reduce((sum, c) => sum + c.weight, 0), low = cs.slice(0, index).reduce((sum, c) => sum + c.weight, 0) / total, high = low + cs[index].weight / total
  let seed = 0
  for (; seed < 100000; seed++) { const r = ((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296; if (r >= low && r < high) break }
  expect(seed).toBeLessThan(100000); w.peace.seed = seed
  expect(trySecretProject(w)).toBe(true); expect(currentProject(w)).toBe(w.pressProject)
}
function built() { const w = world(); fund(w); choose(w); until(w, () => w.pressProject?.phase === 'complete'); return w }
function feed(w: World, n = 2) { for (let i = 0; i < n; i++) expect(deliverItem(gearPress(w)!, 'ironPlate', 'east')).toBe(true) }
function working() { const w = built(); feed(w); until(w, () => w.peace.activity === 'pressing'); return w }

describe('Industrial level one gear press', () => {
  it('uses iron weighting independently of dominant personality and changes no stock or RNG during planning', () => {
    const w = world(); awardActivity(w.personality, { path: 'inventor', xp: 450 }); fund(w, 6)
    const before = snapshot(w), cs = projectCandidates(w)
    expect(cs.find(c => c.definition.id === 'press')).toMatchObject({ weight: 1, definition: { path: 'industrial', minimumLevel: 1, resources: { wood: 4, ironPlate: 12, ironGear: 4 } } })
    expect(snapshot(w)).toEqual(before)
    fund(w, 0, 12, 0)
    expect(projectCandidates(w).find(c => c.definition.id === 'press')?.weight).toBe(2)
    expect(projectCandidates(w).find(c => c.definition.id === 'fence')?.weight).toBe(cs.find(c => c.definition.id === 'fence')?.weight)
  })

  it('requires the complete build set in one reachable crate and rechecks gear contention atomically', () => {
    const w = world(); fund(w, 4, 12, 3)
    placeBuilding(w, 30, 20, 'supplyCrate', 'east'); fund(w, 0, 0, 1, 830)
    expect(projectCandidates(w).some(c => c.definition.id === 'press')).toBe(false)
    fund(w, 0, 0, 1); choose(w)
    until(w, () => w.pressProject?.crate === 824 && w.pete.next !== null)
    crate(w).inventory.ironGear--
    advanceWorld(w, 50)
    expect(crate(w)).toMatchObject({ wood: 4, inventory: { ironPlate: 12, ironGear: 3 } })
    expect(w.pressProject).toMatchObject({ phase: 'collecting', carried: 0, carriedIron: 0, carriedGears: 0 })
    fund(w, 0, 0, 1); until(w, () => w.pressProject?.phase === 'building')
    expect(crate(w)).toMatchObject({ wood: 0, inventory: { ironPlate: 0, ironGear: 0 } })
    expect(w.pressProject).toMatchObject({ carried: 4, carriedIron: 12, carriedGears: 4 })
    expect(() => load(w)).not.toThrow()
  })

  it('builds for twelve seconds, keeps paid work across blocked sites and grants only one completion reward', () => {
    const w = world(); fund(w); choose(w); until(w, () => (w.pressProject?.elapsedMs ?? 0) >= 500)
    const p = w.pressProject!, tile = p.tiles[0], elapsed = p.elapsedMs
    w.water[tile] = true; expect(projectSiteClear(w, p)).toBe(false); w.water[tile] = false
    expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', 'east')).toBe(true)
    advanceWorld(w, 5000); expect(p.elapsedMs).toBe(elapsed)
    const restored = load(w); removeBuilding(restored, tile % SIZE, Math.floor(tile / SIZE))
    until(restored, () => restored.pressProject?.phase === 'complete')
    expect(restored.pressProject).toMatchObject({ carried: 0, carriedIron: 0, carriedGears: 0, built: 1 })
    expect(restored.personality.paths.industrial.xp).toBe(10)
    expect(restored.personality.rewardedProjects).toEqual(['press'])
    expect(gearPress(restored)).toMatchObject({ plates: 0, gears: 0 })
    expect(placeBuilding(restored, 10, 10, 'petePress', 'east')).toBe(false)
    removeBuilding(restored, tile % SIZE, Math.floor(tile / SIZE)); fund(restored)
    advanceWorld(restored, 90000)
    expect(gearPress(restored)).toBeNull()
    expect(projectCandidates(restored).some(c => c.definition.id === 'press')).toBe(false)
    expect(restored.personality.paths.industrial.xp).toBe(10)
  })

  it('converts exactly two plates into one gear only at completion and records production, consumption and XP once', () => {
    const w = working(), press = gearPress(w)!, xp = w.personality.paths.industrial.xp
    expect(w.peace.untilMs - w.peace.sinceMs).toBe(PRESS_ACTIVITY_MS)
    expect(pressSpot(w)).toBe(w.pete.tile); expect(finishPress(w)).toBe(false)
    const restored = load(w), left = w.peace.untilMs - w.timeMs
    advanceWorld(w, left - 50); expect(press).toMatchObject({ plates: 2, gears: 0 }); expect(w.produced.ironGear).toBe(0)
    advanceWorld(w, 50); advanceWorld(restored, left)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(press).toMatchObject({ plates: 0, gears: 1 }); expect(w.produced.ironGear).toBe(1)
    expect(w.personality.paths.industrial.xp).toBe(xp + 1)
    expect(w.analytics.samples.at(-1)).toMatchObject({ produced: { ironGear: 1 }, consumed: { ironPlate: 2 } })
    expect(finishPress(w)).toBe(false)
    expect(w.pressProject!.readyAtMs).toBe(w.timeMs + PRESS_COOLDOWN_MS)
    feed(w, 4); advanceWorld(w, PRESS_COOLDOWN_MS - 50)
    expect(press.gears).toBe(1); expect(w.personality.paths.industrial.xp).toBe(xp + 1)
    until(w, () => press.gears === 2)
    expect(press.plates + press.gears * 2).toBe(6)
  })

  it('waits without spending input or awarding XP when empty or output-full, and resumes after collection', () => {
    const w = built(), press = gearPress(w)!
    advanceWorld(w, 90000); expect(w.personality.paths.industrial.xp).toBe(10)
    feed(w, 4); press.gears = 4
    expect(pressReady(w)).toBe(false); advanceWorld(w, 90000)
    expect(press).toMatchObject({ plates: 4, gears: 4 }); expect(w.produced.ironGear).toBe(0)
    press.gears--; until(w, () => press.gears === 4)
    expect(press.plates).toBe(2); expect(w.produced.ironGear).toBe(1)
    expect(w.personality.paths.industrial.xp).toBe(11)
  })

  it('keeps all plates through home removal and cancels work without output or XP', () => {
    const w = working(); advanceWorld(w, 2000); removeBuilding(w, 20, 20)
    const restored = load(w)
    advanceWorld(restored, 10000)
    expect(gearPress(restored)).toMatchObject({ plates: 2, gears: 0 })
    expect(restored.personality.paths.industrial.xp).toBe(10); expect(restored.produced.ironGear).toBe(0)
    placeBuilding(restored, 20, 20, 'treehouse', 'east')
    until(restored, () => gearPress(restored)!.gears === 1)
    expect(gearPress(restored)!.plates).toBe(0)
  })

  it('preserves exact partitioned timing and fractional remainder across mid-work saves and pause', () => {
    const w = working(); advanceWorld(w, 17)
    const restored = load(w), before = snapshot(w)
    advanceWorld(w, 0); expect(snapshot(w)).toEqual(before)
    advanceWorld(w, 10017)
    for (const ms of [17, 1000, 2000, 7000]) advanceWorld(restored, ms)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })

  it('accepts only plates within the four-slot input limit, including simultaneous belt reservations', () => {
    const w = built(), press = gearPress(w)!, x = press.x, y = press.y
    expect(deliverItem(press, 'iron', 'east')).toBe(false)
    expect(deliverItem(press, 'ironGear', 'east')).toBe(false)
    feed(w, 3); expect(canReceive(press, 'ironPlate', 'east', { ironPlate: 1 })).toBe(false)
    for (const [dx, dy, direction] of [[-1, 0, 'east'], [1, 0, 'west']] as const) {
      expect(placeBuilding(w, x + dx, y + dy, 'belt', direction)).toBe(true)
      Object.assign(w.buildings[(y + dy) * SIZE + x + dx]!, { item: 'ironPlate', progress: 1 })
    }
    advanceTransport(w, 50)
    expect(press.plates).toBe(4)
    const belts = [w.buildings[y * SIZE + x - 1], w.buildings[y * SIZE + x + 1]] as Belt[]
    expect(belts.filter(b => b.item === 'ironPlate')).toHaveLength(1)
    expect(deliverItem(press, 'ironPlate', 'south')).toBe(false)
  })

  it('lets powered inserters extract only gears and conserves one contested output across two arms', () => {
    const w = built(), press = gearPress(w)!, x = press.x, y = press.y
    press.plates = 2; press.gears = 1
    for (const [dx, direction] of [[-1, 'west'], [1, 'east']] as const) {
      expect(placeBuilding(w, x + dx, y, 'inserter', direction)).toBe(true)
      expect(placeBuilding(w, x + dx * 2, y, 'storage', direction)).toBe(true)
    }
    expect(placeBuilding(w, x, y - 1, 'powerPole', 'east')).toBe(true)
    expect(placeBuilding(w, x, y - 2, 'generator', 'east')).toBe(true)
    const frame = createInserterFrame(w); allocatePower(w, frame); advanceInserters(w, 50, frame)
    const arms = [w.buildings[y * SIZE + x - 1], w.buildings[y * SIZE + x + 1]] as Inserter[]
    expect(arms.filter(a => a.item === 'ironGear')).toHaveLength(1)
    expect(press).toMatchObject({ plates: 2, gears: 0 })
    const inFlight = load(w)
    for (const candidate of [w, inFlight]) advanceWorld(candidate, INSERTER_SWING_MS)
    expect(snapshot(inFlight)).toEqual(snapshot(w))
    const chests = [w.buildings[y * SIZE + x - 2], w.buildings[y * SIZE + x + 2]] as Storage[]
    expect(chests.reduce((n, c) => n + c.inventory.ironGear, 0)).toBe(1)
    expect(chests.reduce((n, c) => n + c.inventory.ironPlate, 0)).toBe(0)
  })

  it('protects the work approach from later yard layouts and exposes useful inspection states', () => {
    const w = built(); fund(w, 200, 0, 0)
    until(w, () => w.coopProject?.phase === 'complete')
    const yard = planYard(w)!, approach = yard.tiles.find(i => !w.buildings[i])!
    w.pressProject!.spots = [approach]
    const revised = planYard(w)
    expect(revised === null || !yardBoundary(revised).includes(approach)).toBe(true)
    const press = gearPress(w)!
    expect(inspectionSummary(inspectBuilding(w, w.pressProject!.tiles[0])!).state).toContain('Needs 2 iron plates')
    press.gears = 4
    expect(inspectionSummary(inspectBuilding(w, w.pressProject!.tiles[0])!).state).toContain('Output full')
  })

  it('migrates version 27 and rejects orphan presses, forged buffers, paid balances and activity clocks', () => {
    const old = snapshot(world()); Object.assign(old, { version: 27 })
    expect(decodeSave(JSON.stringify(old)).world.pressProject).toBeUndefined()
    const w = working()
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'pressProject') },
      (d: SaveDocument) => { d.game.pressProject!.carriedIron = 12 },
      (d: SaveDocument) => { (d.game.buildings[d.game.pressProject!.tiles[0]] as PetePress).plates = 5 },
      (d: SaveDocument) => { (d.game.buildings[d.game.pressProject!.tiles[0]] as PetePress).gears = 5 },
      (d: SaveDocument) => { (d.game.buildings[d.game.pressProject!.tiles[0]] as PetePress).plates = 0 },
      (d: SaveDocument) => { d.game.peace.untilMs += 50 },
      (d: SaveDocument) => { Object.assign(d, { version: 27 }) },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
  })
})
