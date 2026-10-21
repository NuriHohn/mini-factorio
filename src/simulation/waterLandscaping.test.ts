import { describe, expect, it } from 'vitest'
import { paintWater, waterEditError, waterProtection } from './waterLandscaping'
import { createUnlockedWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import { paintLandscape } from './nature'
import { commitConstruction, planConstruction } from './construction'
import { advanceWorld } from './step'
import { terrainChunkRevision, terrainRevision } from './waterTerrain'
import { validateTerrain } from '../persistence/terrainValidation'
const p = (x: number, y: number) => ({ x, y })
const bare = () => createUnlockedWorld(() => .5)
describe('authoritative water landscaping', () => {
  it.each([1, 3, 5] as const)('creates/removes %i-square brushes and preserves underlying ore', size => {
    const w = bare(), ore = [...w.tiles], count = size * size
    paintLandscape(w, p(20, 20), p(20, 20), 'flowers', size)
    expect(paintWater(w, p(20, 20), p(20, 20), 'water', size)).toBe(count)
    expect(w.water.filter(Boolean)).toHaveLength(count)
    expect(w.nature.decorations.every((d, i) => !w.water[i] || d === null)).toBe(true)
    expect(w.tiles).toEqual(ore); expect(w.topologyRevision).toBe(1)
    expect(paintWater(w, p(20, 20), p(20, 20), 'land', size)).toBe(count)
    expect(w.water.some(Boolean)).toBe(false); expect(w.tiles).toEqual(ore)
    expect(placeBuilding(w, 20, 20, 'miner', 'east')).toBe(true)
    validateTerrain(w)
  })
  it('keeps diagonal one-cell channels cardinally connected during fast drags', () => {
    const w = bare()
    expect(paintWater(w, p(3, 3), p(12, 12), 'water', 1)).toBe(19)
    for (let i = 3; i <= 12; i++) {
      expect(w.water[i * SIZE + i]).toBe(true)
      if (i < 12) expect(w.water[i * SIZE + i + 1]).toBe(true)
    }
    expect(paintWater(w, p(3, 3), p(12, 12), 'water', 1)).toBe(0)
    expect(paintWater(w, p(3, 3), p(12, 12), 'land', 1)).toBe(19)
    expect(w.water.some(Boolean)).toBe(false)
  })
  it('does no work for unchanged or fully rejected edits, including decoration/cache revisions', () => {
    const w = bare()
    paintWater(w, p(5, 5), p(5, 5), 'water', 3)
    const before = structuredClone(w), revision = terrainRevision(w)
    expect(paintWater(w, p(5, 5), p(5, 5), 'water', 3)).toBe(0)
    expect(paintWater(w, p(-50, -50), p(-40, -40), 'water', 5)).toBe(0)
    expect(w).toEqual(before); expect(terrainRevision(w)).toBe(revision)
    expect(waterEditError(w, -1, 'water')).toContain('inside')
  })
  it('clips brushes and fast strokes to map boundaries without snapping unrelated off-map strokes', () => {
    const w = bare()
    expect(paintWater(w, p(0, 0), p(0, 0), 'water', 3)).toBe(4)
    expect(paintWater(w, p(-100, 8), p(100, 8), 'water', 1)).toBe(SIZE)
    expect(w.water.filter(Boolean)).toHaveLength(44)
    expect(paintWater(w, p(-100, -10), p(100, -10), 'water', 5)).toBe(0)
    validateTerrain(w)
  })
  it.each(['miner', 'furnace', 'assembler', 'storage', 'belt', 'splitter', 'inserter', 'generator', 'powerPole', 'tree', 'treehouse', 'radar', 'prison', 'sprinkler'] as const)('protects %s without changing structures, jobs, inventories or funding', kind => {
    const w = bare(); w.nature.wood = 100
    const position = kind === 'prison' ? p(0, 5) : kind === 'miner' ? p(20, 20) : p(5, 5)
    expect(placeBuilding(w, position.x, position.y, kind, 'east')).toBe(true)
    const before = structuredClone(w)
    expect(paintWater(w, position, position, 'water', 1)).toBe(0)
    expect(w).toEqual(before)
  })
  it('skips protected fields of a brush but applies eligible ones deterministically', () => {
    const a = bare(), b = bare()
    for (const w of [a, b]) {
      placeBuilding(w, 5, 5, 'storage', 'east')
      expect(paintWater(w, p(5, 5), p(5, 5), 'water', 3)).toBe(8)
      validateTerrain(w)
    }
    expect(a).toEqual(b)
  })
  it('reserves actor positions/next/path, peaceful destinations/gifts and prison exits', () => {
    const w = bare()
    w.pete.next = 10 * SIZE + 10; w.pete.path = [10 * SIZE + 11]
    w.peace.destination = 10 * SIZE + 12
    w.peace.gifts.push({ id: 1, tile: 10 * SIZE + 13, kind: 'wood', wood: 1, atMs: 0 })
    placeBuilding(w, 0, 5, 'prison', 'east')
    const prison = w.buildings[5 * SIZE]!
    if (prison.kind !== 'prison') throw Error('fixture')
    const reserved = waterProtection(w).reserved
    expect(reserved.has(w.pete.tile)).toBe(true)
    expect(reserved.has(prison.exit)).toBe(true)
    for (const tile of reserved) {
      expect(waterEditError(w, tile, 'water')).toBeTruthy()
      expect(paintWater(w, p(tile % SIZE, Math.floor(tile / SIZE)), p(tile % SIZE, Math.floor(tile / SIZE)), 'water', 1)).toBe(0)
    }
  })
  it.each([false, true])('protects existing bridge segments and both empty banks (vertical=%s)', vertical => {
    const w = bare(); w.nature.wood = 100
    const point = (k: number) => vertical ? p(10, k) : p(k, 10)
    paintWater(w, point(10), point(12), 'water', 1)
    expect(commitConstruction(w, point(9), point(13), 'belt', vertical ? 'south' : 'east').error).toBeNull()
    removeBuilding(w, point(9).x, point(9).y); removeBuilding(w, point(13).x, point(13).y)
    const before = structuredClone(w)
    expect(paintWater(w, point(10), point(12), 'land', 5)).toBe(0)
    for (const k of [9, 13]) {
      expect(waterEditError(w, point(k).y * SIZE + point(k).x, 'water')).toContain('banks')
      expect(paintWater(w, point(k), point(k), 'water', 1)).toBe(0)
    }
    expect(w).toEqual(before)
    expect(paintWater(w, point(10), point(12), 'water', 1)).toBe(0)
    validateTerrain(w)
    // Sideways landscape edits are safe and do not change the axis span or cost.
    expect(paintWater(w, p(11, 11), p(11, 11), 'water', 1)).toBe(1)
  })
  it('keeps bridge transport and routing valid while editing neighboring terrain', () => {
    const w = bare(); w.nature.wood = 100
    paintWater(w, p(10, 10), p(12, 10), 'water', 1)
    commitConstruction(w, p(8, 10), p(14, 10), 'belt', 'east'); placeBuilding(w, 15, 10, 'storage', 'east')
    const belt = w.buildings[10 * SIZE + 8]!
    if (belt.kind !== 'belt') throw Error('fixture')
    belt.item = 'iron'
    paintWater(w, p(10, 11), p(12, 11), 'water', 3)
    validateTerrain(w); advanceWorld(w, 4500)
    expect(w.buildings[10 * SIZE + 15]).toMatchObject({ inventory: { iron: 1 } })
    const plan = planConstruction(w, p(7, 7), p(13, 7), 'belt', 'east')
    expect(plan.error).toBeNull(); expect(w.nature.wood).toBe(91)
  })
  it('invalidates only touched chunks plus their diagonal shoreline halo', () => {
    const w = bare()
    paintWater(w, p(3, 3), p(3, 3), 'water', 1)
    expect(terrainRevision(w)).toBe(1); expect(terrainChunkRevision(w, 0)).toBe(1)
    expect(terrainChunkRevision(w, 1)).toBe(0)
    paintWater(w, p(7, 7), p(7, 7), 'water', 1)
    for (const chunk of [0, 1, 5, 6]) expect(terrainChunkRevision(w, chunk)).toBe(2)
    expect(terrainChunkRevision(w, 24)).toBe(0)
    const remainder = w.remainder, clock = w.timeMs
    expect(clock).toBe(0); expect(remainder).toBe(0)
  })
})
