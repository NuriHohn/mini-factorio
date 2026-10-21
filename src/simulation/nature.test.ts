import { damageWalker, recordArrest } from './revenge'
import { describe, expect, it } from 'vitest'
import { advanceNature, brushTiles, chopTree, MATURE_TREE_MS, naturalTreeCap, natureRandom, nearFactory, paintLandscape, plantTree, refreshNatureSchedule, reproductionTargets, REPRODUCTION_MS, treeStage, treeWood, YOUNG_TREE_MS } from './nature'
import { createWorld, placeBuilding, placementError, removeBuilding, SIZE } from './world'
import type { BuildingKind, Tree, World } from './world'
import { advanceWorld } from './step'
import { reachableTiles } from './navigation'
import { allocatePower } from './power'
import { analyticsSnapshot } from './analytics'
const bare = () => createWorld(() => .5, { nature: false })
function tree(world: World, x = 5, y = 5) {
  expect(plantTree(world, x, y, 'oak')).toBe(true)
  return world.buildings[y * SIZE + x] as Tree
}
const trees = (world: World) => world.buildings.filter((b): b is Tree => b?.kind === 'tree')
function attemptWorld(seed: number) {
  const w = bare(); tree(w); w.nature.seed = seed; w.timeMs = MATURE_TREE_MS + REPRODUCTION_MS
  return w
}
describe('layered trees, wood and terrain', () => {
  it.each(['oak', 'pine', 'birch'] as const)('plants %s on ore, blocks construction/navigation, preserves decorations and ore after chopping', species => {
    const w = bare(); w.tiles[205] = 'iron'; paintLandscape(w, { x: 5, y: 5 }, { x: 5, y: 5 }, 'flowers', 1)
    expect(plantTree(w, 5, 5, species)).toBe(true)
    expect((w.buildings[205] as Tree).species).toBe(species)
    expect(placementError(w, 5, 5, 'belt')).toContain('Axe')
    expect(reachableTiles(w, 204).has(205)).toBe(false)
    expect(removeBuilding(w, 5, 5)).toBe(false)
    expect(chopTree(w, 5, 5)?.wood).toBe(0)
    expect(w.tiles[205]).toBe('iron'); expect(w.nature.decorations[205]).toBe('flowers')
    expect(reachableTiles(w, 204).has(205)).toBe(true)
    expect(placeBuilding(w, 5, 5, 'miner', 'east')).toBe(true)
    expect(w.tiles[205]).toBe('iron'); expect(w.nature.decorations[205]).toBe('flowers')
    expect(plantTree(w, 5, 5, species)).toBe(false)
    expect(removeBuilding(w, 5, 5)).toBe(true)
    expect(w.nature.decorations[205]).toBe('flowers')
  })
  it.each([[0, 'sapling', 0], [119950, 'sapling', 0], [120000, 'young', 1], [299950, 'young', 1], [300000, 'mature', 3]] as const)('at %ims is %s and yields %i wood exactly once', (age, stage, wood) => {
    const w = bare(), t = tree(w); w.timeMs = age
    expect(treeStage(w, t)).toBe(stage); expect(treeWood(w, t)).toBe(wood)
    expect(chopTree(w, 5, 5)?.wood).toBe(wood)
    expect(chopTree(w, 5, 5)).toBe(null); expect(w.nature.wood).toBe(wood)
    expect(w.nature.nextAttemptAtMs).toBe(null)
    expect(placeBuilding(w, 5, 5, 'belt', 'east')).toBe(true)
  })
  it('grows at fixed-step boundaries, freezes without simulation and ignores nearby factory/power changes', () => {
    const w = bare(), t = tree(w); w.timeMs = YOUNG_TREE_MS - 50
    advanceWorld(w, 0); expect(treeStage(w, t)).toBe('sapling')
    advanceWorld(w, 49); expect(treeStage(w, t)).toBe('sapling')
    advanceWorld(w, 1); expect(treeStage(w, t)).toBe('young')
    placeBuilding(w, 6, 5, 'generator', 'east')
    w.timeMs = MATURE_TREE_MS - 50; advanceWorld(w, 50)
    expect(treeStage(w, t)).toBe('mature')
    expect(plantTree(w, 6, 6, 'pine')).toBe(true) // Manual planting ignores factory exclusion.
    expect(plantTree(w, -1, 0, 'oak')).toBe(false)
  })
  it('stays outside power, research, production and analytics machinery', () => {
    const w = bare(); tree(w); placeBuilding(w, 5, 6, 'powerPole', 'east'); placeBuilding(w, 5, 7, 'generator', 'east')
    allocatePower(w)
    expect(w.power!.assignments[205]).toBeUndefined(); expect(w.power!.consumers[205]).toBeUndefined()
    const before = structuredClone(w.research)
    advanceWorld(w, 1000)
    expect(w.research).toEqual(before)
    expect(analyticsSnapshot(w)).toMatchObject({ configuredMachines: 0, totalPerMinute: 0 })
  })
})
describe('scheduled deterministic forest expansion', () => {
  it('attempts five minutes after maturity and keeps the original cadence', () => {
    const w = bare(), t = tree(w)
    w.timeMs = 599950; advanceNature(w); expect(t.nextReproductionAtMs).toBe(600000)
    const before = w.nature.seed; w.timeMs += 50; advanceNature(w)
    expect(w.nature.seed).not.toBe(before)
    expect(t.nextReproductionAtMs).toBe(900000)
    const seed = w.nature.seed; advanceNature(w); expect(w.nature.seed).toBe(seed)
    expect(w.nature.nextAttemptAtMs).toBe(900000)
  })
  it('implements the 20% boundary using the independent seeded RNG, preserving ore on successful spread', () => {
    for (const succeeds of [true, false]) {
      const seed = succeeds ? 2485 : 2488
      expect(natureRandom({ seed })).toBeCloseTo(succeeds ? .1991357543 : .2002984115, 9)
      const w = attemptWorld(seed), parent = w.buildings[205] as Tree
      for (const tile of reproductionTargets(w, parent)) w.tiles[tile] = 'copper'
      const ore = [...w.tiles]
      advanceNature(w)
      expect(trees(w)).toHaveLength(succeeds ? 2 : 1)
      expect(w.tiles).toEqual(ore)
      if (succeeds) {
        const child = trees(w).find(t => t !== parent)!
        expect(child).toMatchObject({ species: 'oak', origin: 'natural', bornAtMs: 600000, nextReproductionAtMs: 1200000 })
        expect(Math.max(Math.abs(child.x - parent.x), Math.abs(child.y - parent.y))).toBeGreaterThanOrEqual(1)
        expect(Math.max(Math.abs(child.x - parent.x), Math.abs(child.y - parent.y))).toBeLessThanOrEqual(2)
      }
    }
  })
  it.each(['belt', 'powerPole', 'generator', 'radar', 'storage', 'furnace'] as BuildingKind[])('excludes all cells within Chebyshev distance three of %s', kind => {
    const w = bare(); placeBuilding(w, 10, 10, kind, 'east')
    expect(nearFactory(w, 13, 13)).toBe(true)
    expect(nearFactory(w, 14, 10)).toBe(false)
    const parent = tree(w, 13, 10)
    expect(reproductionTargets(w, parent).every(i => !nearFactory(w, i % SIZE, Math.floor(i / SIZE)))).toBe(true)
  })
  it('checks every occupied cell of a footprint rather than its origin', () => {
    const w = bare(); placeBuilding(w, 10, 10, 'storage', 'east')
    // The current game has only 1x1 objects. Model additional occupied footprint cells.
    w.buildings[411] = w.buildings[410]; w.buildings[412] = w.buildings[410]
    expect(nearFactory(w, 15, 13)).toBe(true); expect(nearFactory(w, 16, 13)).toBe(false)
  })
  it('consumes one attempt with no spawn when every target is occupied/reserved', () => {
    const w = attemptWorld(2000), parent = w.buildings[205] as Tree
    for (const tile of reproductionTargets(w, parent)) placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')
    advanceNature(w)
    expect(trees(w)).toHaveLength(1); expect(parent.nextReproductionAtMs).toBe(900000)
  })
  it('caps natural trees at 20% while exempting manually planted trees', () => {
    const w = bare(), cap = naturalTreeCap()
    for (let i = 0; trees(w).length < cap; i++) if (plantTree(w, i % SIZE, Math.floor(i / SIZE), 'birch')) (w.buildings[i] as Tree).origin = 'natural'
    expect(plantTree(w, 30, 30, 'pine')).toBe(true)
    w.timeMs = 600000; advanceNature(w)
    expect(trees(w).filter(t => t.origin === 'natural')).toHaveLength(cap)
    expect(trees(w)).toHaveLength(cap + 1)
    const manual = bare()
    for (let i = 0; trees(manual).length < cap + 1; i++) plantTree(manual, i % SIZE, Math.floor(i / SIZE), 'birch')
    manual.nature.seed = 2000; manual.timeMs = 600000; advanceNature(manual)
    expect(trees(manual).some(t => t.origin === 'natural')).toBe(true)
  })
  it('is identical across frame partitions and does not borrow Pete RNG', () => {
    const a = attemptWorld(2000), b = structuredClone(a); a.timeMs = b.timeMs = 599950
    const seed = a.pete.seed
    advanceNature(a); expect(a.pete.seed).toBe(seed)
    advanceWorld(a, 150)
    for (const ms of [17, 33, 50, 50]) advanceWorld(b, ms)
    expect(b).toEqual(a)
    refreshNatureSchedule(a); expect(a.nature.nextAttemptAtMs).toBe(b.nature.nextAttemptAtMs)
  })
})
describe('nature and existing actor occupancy', () => {
  it('does not plant or spread onto Pete current/next reserved tiles', () => {
    const w = bare(), parent = tree(w)
    Object.assign(w.pete, { x: 6, y: 5, tile: 206, next: 207, travelMs: 0 })
    expect(plantTree(w, 6, 5, 'oak')).toBe(false)
    expect(plantTree(w, 7, 5, 'oak')).toBe(false)
    expect(reproductionTargets(w, parent)).not.toContain(206)
    expect(reproductionTargets(w, parent)).not.toContain(207)
  })
  it('routes real police around trees and completes exactly one ordinary arrest', () => {
    const w = bare()
    Object.assign(w.pete, { x: 8, y: 8, tile: 328, mode: 'CRYING', cryingMs: 10000 })
    plantTree(w, 7, 8, 'oak'); plantTree(w, 8, 7, 'pine')
    placeBuilding(w, 9, 8, 'radar', 'east'); placeBuilding(w, 9, 7, 'powerPole', 'east'); placeBuilding(w, 9, 6, 'generator', 'east')
    let sawCar = false
    for (let i = 0; i < 500 && w.pete.mode !== 'IMPRISONED'; i++) {
      advanceWorld(w, 50)
      const car = w.police.car
      if (car) {
        sawCar = true
        expect(w.buildings[car.tile]?.kind).not.toBe('tree')
        if (car.next !== null) expect(w.buildings[car.next]?.kind).not.toBe('tree')
        expect(plantTree(w, car.tile % SIZE, Math.floor(car.tile / SIZE), 'birch')).toBe(false)
      }
    }
    expect(sawCar).toBe(true); expect(w.pete.mode).toBe('IMPRISONED')
    expect(w.revenge.arrests).toBe(1); expect(w.nature.wood).toBe(0)
    expect(w.buildings[327]?.kind).toBe('tree'); expect(w.buildings[288]?.kind).toBe('tree')
  })
  it('keeps walker spawn/actor reservations and combat progression intact around tree occupancy', () => {
    const w = bare(); plantTree(w, 0, 0, 'oak')
    for (let i = 0; i < 3; i++) recordArrest(w)
    advanceWorld(w, 5000)
    const boss = w.revenge.boss!
    expect(boss).toMatchObject({ tile: 1, hp: 100 })
    expect(plantTree(w, boss.x, boss.y, 'pine')).toBe(false)
    damageWalker(w, 50); expect(w.revenge.stage).toBe('stomp')
    advanceWorld(w, 1500); expect(w.revenge.blast?.kind).toBe('stomp')
    expect(w.buildings[0]?.kind).toBe('tree')
    damageWalker(w, 50); advanceWorld(w, 7000)
    expect(w.revenge).toMatchObject({ stage: 'idle', threshold: 5, arrests: 0 })
    expect(w.nature.wood).toBe(0)
  })
})
describe('landscape brush and initial landscape', () => {
  it.each([1, 3, 5] as const)('paints a %i-square brush, clips edges and preserves occupancy and ore when erasing', size => {
    const w = bare(); const x = 20, y = 20
    expect(paintLandscape(w, { x, y }, { x, y }, 'flowers', size)).toBe(size * size)
    const ore = [...w.tiles]; placeBuilding(w, x, y, 'storage', 'east')
    expect(paintLandscape(w, { x, y }, { x, y }, 'grass', size)).toBe(size * size)
    paintLandscape(w, { x, y }, { x, y }, null, size)
    expect(w.tiles).toEqual(ore); expect(w.buildings[820]?.kind).toBe('storage')
    expect(brushTiles({ x: 0, y: 0 }, { x: 0, y: 0 }, size)).toHaveLength(((size + 1) / 2) ** 2)
  })
  it('fills long horizontal/diagonal drag paths without gaps and ignores malformed brush commands', () => {
    const w = bare(); paintLandscape(w, { x: 0, y: 0 }, { x: 39, y: 39 }, 'flowers', 1)
    for (let n = 0; n < 40; n++) expect(w.nature.decorations[n * 41]).toBe('flowers')
    paintLandscape(w, { x: 0, y: 20 }, { x: 39, y: 20 }, 'grass', 3)
    for (let n = 0; n < 40; n++) expect(w.nature.decorations[20 * SIZE + n]).toBe('grass')
    expect(brushTiles({ x: -100, y: 20 }, { x: -100, y: 20 }, 5)).toEqual([])
    const clipped = brushTiles({ x: -100, y: 0 }, { x: 10, y: 10 }, 1)
    expect(clipped[0]).toBe(9 * SIZE)
    expect(clipped.at(-1)).toBe(10 * SIZE + 10)
    expect(brushTiles({ x: NaN, y: 0 }, { x: 1, y: 1 }, 1)).toEqual([])
  })
  it('generates mixed irregular forests/meadows with a clear starter area and unchanged ore generation', () => {
    const a = createWorld(() => .5), b = createWorld(() => .5), clear = bare()
    expect(a).toEqual(b); expect(a.tiles).toEqual(clear.tiles)
    expect(trees(a).length).toBeGreaterThan(20); expect(trees(a).length).toBeLessThan(naturalTreeCap())
    expect(new Set(trees(a).map(t => t.species)).size).toBe(3)
    expect(a.nature.decorations.filter(Boolean).length).toBeGreaterThan(10)
    for (let y = 10; y <= 30; y++) for (let x = 10; x <= 30; x++) expect(a.buildings[y * SIZE + x]).toBe(null)
    expect(a.buildings[a.pete.tile]).toBe(null)
  })
})
