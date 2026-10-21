import { describe, expect, it } from 'vitest'
import { generateWater, isWater, shoreline } from './waterTerrain'
import { createWorld, placeBuilding, SIZE } from './world'
import { createBareWorld, createUnlockedWorld } from './testFixtures'
import { natureRandom, paintLandscape, plantTree, reproductionTargets } from './nature'
import { reachableTiles } from './navigation'
import { advanceWorld } from './step'
import { recordArrest } from './revenge'
const rng = (seed: number) => { const state = { seed }; return () => natureRandom(state) }
describe('deterministic natural water terrain', () => {
  it.each([1, 42, 123456, 0xffffffff])('generates bounded organic features from seed %i with a protected, connected starting region', seed => {
    const w = createWorld(rng(seed), { nature: false }), again = createWorld(rng(seed), { nature: false })
    expect(w.water).toEqual(again.water); expect(w.tiles).toEqual(again.tiles)
    const count = w.water.filter(Boolean).length
    expect(count).toBeGreaterThanOrEqual(80); expect(count).toBeLessThanOrEqual(176)
    for (let y = 10; y <= 30; y++) for (let x = 10; x <= 30; x++) expect(isWater(w, x, y)).toBe(false)
    expect(w.tiles[20 * SIZE + 20]).toBe('iron'); expect(w.tiles[20 * SIZE + 26]).toBe('copper')
    expect(reachableTiles(w, w.pete.tile).size).toBe(SIZE * SIZE - count)
    expect(w.water.slice(0, SIZE).some(Boolean)).toBe(false)
    expect(w.water.some((water, i) => water && i < 10 * SIZE)).toBe(true)
    expect(w.water.some((water, i) => water && i % SIZE < 9 && Math.floor(i / SIZE) > 13)).toBe(true)
    expect(w.water.some((water, i) => water && Math.floor(i / SIZE) > 31)).toBe(true)
  })
  it('varies layout with the seed, leaves ore unchanged and coexists with forests/meadows', () => {
    const w = createWorld(rng(21)), other = createWorld(rng(22)), dry = createWorld(rng(21), { water: false })
    expect(w.water).not.toEqual(other.water); expect(w.tiles).toEqual(dry.tiles)
    expect(w.buildings.some(b => b?.kind === 'tree')).toBe(true)
    for (let i = 0; i < w.water.length; i++) if (w.water[i]) { expect(w.buildings[i]).toBeNull(); expect(w.nature.decorations[i]).toBeNull() }
    const bare = createBareWorld(() => .5); generateWater(bare, 21)
    expect(bare.water.some(Boolean)).toBe(true)
  })
  it('classifies shore edges and map corners without out-of-range water', () => {
    const w = createBareWorld(() => .5)
    for (let y = 0; y <= 2; y++) for (let x = 0; x <= 2; x++) w.water[y * SIZE + x] = true
    expect(shoreline(w, 1, 1)).toBe(0); expect(shoreline(w, 0, 0)).toBe(9)
    expect(shoreline(w, 2, 2)).toBe(6); expect(shoreline(w, 3, 3)).toBe(0)
    expect(isWater(w, -1, 0)).toBe(false); expect(isWater(w, 40, 0)).toBe(false)
  })
  it('rejects ordinary buildings, planting, reproduction and decoration on water', () => {
    const w = createUnlockedWorld(() => .5); w.nature.wood = 100; w.water[410] = true; w.tiles[410] = 'iron'
    for (const kind of ['belt', 'miner', 'furnace', 'assembler', 'generator', 'storage', 'powerPole', 'inserter', 'splitter', 'radar', 'sprinkler', 'tree', 'treehouse'] as const) expect(placeBuilding(w, 10, 10, kind, 'east')).toBe(false)
    expect(plantTree(w, 10, 10, 'oak')).toBe(false)
    expect(paintLandscape(w, { x: 10, y: 10 }, { x: 10, y: 10 }, 'flowers', 1)).toBe(0)
    expect(plantTree(w, 9, 10, 'oak')).toBe(true)
    const tree = w.buildings[409]!
    if (tree.kind !== 'tree') throw Error('fixture')
    expect(reproductionTargets(w, tree)).not.toContain(410)
    expect(placeBuilding(w, 11, 10, 'storage', 'east')).toBe(true)
  })
  it('keeps wandering, escape navigation and police transport on dry ground', () => {
    const w = createBareWorld(() => .5)
    for (let y = 0; y < SIZE; y++) w.water[y * SIZE + 20] = true
    expect([...reachableTiles(w, w.pete.tile).keys()].every(i => i % SIZE < 20)).toBe(true)
    placeBuilding(w, 16, 22, 'powerPole', 'east'); placeBuilding(w, 15, 22, 'generator', 'east'); placeBuilding(w, 17, 22, 'radar', 'east')
    for (let i = 0; i < 400; i++) {
      advanceWorld(w, 50)
      expect(w.water[w.pete.tile]).toBe(false)
      if (w.pete.next !== null) expect(w.water[w.pete.next]).toBe(false)
      const car = w.police.car
      if (car) { expect(w.water[car.tile]).toBe(false); if (car.next !== null) expect(w.water[car.next]).toBe(false) }
    }
    expect(w.revenge.arrests).toBe(1)
  })
  it('keeps a Revenge walker on land without changing its escalation rules', () => {
    const w = createBareWorld(() => .5)
    for (let y = 0; y < SIZE; y++) w.water[y * SIZE + 3] = true
    placeBuilding(w, 20, 20, 'generator', 'east')
    for (let i = 0; i < 3; i++) recordArrest(w)
    for (let i = 0; i < 160; i++) { advanceWorld(w, 50); const b = w.revenge.boss; if (b) { expect(w.water[b.tile]).toBe(false); if (b.next !== null) expect(w.water[b.next]).toBe(false) } }
    expect(w.revenge.arrests).toBe(3); expect(w.revenge.boss).not.toBeNull()
  })
})
