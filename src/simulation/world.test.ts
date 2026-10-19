import { describe, expect, it } from 'vitest'
import { buildingAt, createWorld, DIRECTIONS, placeBuilding, placementError, removalError, removeBuilding, rotate, SIZE } from './world'
import type { Belt, BuildingKind, Direction, Miner, Storage, World } from './world'
import { advanceWorld } from './step'
function place(world: World, x: number, y: number, kind: BuildingKind, direction: Direction = 'east') {
  expect(placeBuilding(world, x, y, kind, direction)).toBe(true)
}
function belt(world: World, x: number, y: number) { return buildingAt(world, x, y) as Belt }
function miner(world: World, x = 20, y = 20) { return buildingAt(world, x, y) as Miner }
function chest(world: World, x: number, y: number) { return buildingAt(world, x, y) as Storage }
function supplyLine() {
  const world = createWorld(() => .5)
  place(world, 20, 20, 'miner')
  place(world, 21, 20, 'belt', 'south')
  place(world, 21, 21, 'belt', 'east')
  place(world, 22, 21, 'storage')
  return world
}
function accounted(world: World) {
  return world.buildings.reduce((sum, b) => sum + (!b ? 0 : b.kind === 'storage' ? b.inventory : Number(b.item !== null)), 0)
}
describe('building tools', () => {
  it('generates terrain with a guaranteed central deposit and empty occupancy', () => {
    const world = createWorld(() => .5)
    expect(world.tiles).toHaveLength(SIZE ** 2)
    expect(world.tiles[20 * SIZE + 20]).toBe(true)
    expect(world.tiles).toContain(false)
    expect(world.buildings.every(b => b === null)).toBe(true)
  })
  it('validates coordinates, terrain and shared occupancy for every building', () => {
    const world = createWorld(() => .5)
    for (const kind of ['miner', 'belt', 'storage'] as const) {
      for (const [x, y] of [[-1, 20], [40, 20], [20.5, 20], [NaN, 20]]) expect(placeBuilding(world, x, y, kind, 'east')).toBe(false)
    }
    expect(placeBuilding(world, 0, 0, 'miner', 'east')).toBe(false)
    place(world, 0, 0, 'belt')
    expect(placementError(world, 0, 0, 'storage')).toContain('already')
    place(world, 20, 20, 'miner')
    expect(placeBuilding(world, 20, 20, 'belt', 'east')).toBe(false)
  })
  it('rotates through all directions and preserves placement direction', () => {
    const world = createWorld()
    let direction: Direction = 'north'
    for (const [x, expected] of DIRECTIONS.entries()) {
      expect(direction).toBe(expected)
      place(world, x, 0, 'belt', direction)
      expect(belt(world, x, 0).direction).toBe(expected)
      direction = rotate(direction)
    }
    expect(direction).toBe('north')
  })
  it('removes only empty buildings and leaves occupied ones intact', () => {
    const world = supplyLine()
    miner(world).item = 'iron'
    belt(world, 21, 20).item = 'iron'
    chest(world, 22, 21).inventory = 1
    for (const [x, y] of [[20, 20], [21, 20], [22, 21]]) {
      expect(removalError(world, x, y)).toContain('Empty')
      expect(removeBuilding(world, x, y)).toBe(false)
    }
    expect(removeBuilding(world, 21, 21)).toBe(true)
    expect(buildingAt(world, 21, 21)).toBe(null)
    expect(removeBuilding(world, -1, 0)).toBe(false)
  })
})
describe('mining and transport', () => {
  it('buffers one ore then pauses without accumulating blocked time', () => {
    const world = createWorld(() => .5)
    place(world, 20, 20, 'miner')
    advanceWorld(world, 999)
    expect(world.ore).toBe(0)
    advanceWorld(world, 1)
    expect(miner(world).item).toBe('iron')
    advanceWorld(world, 10000)
    expect(world.ore).toBe(1)
    expect(miner(world).elapsed).toBe(0)
    place(world, 21, 20, 'belt')
    advanceWorld(world, 50)
    expect(belt(world, 21, 20).item).toBe('iron')
    expect(belt(world, 21, 20).progress).toBe(0)
    expect(world.ore).toBe(1)
    expect(miner(world).elapsed).toBe(50)
  })
  it('delivers ore through corners into storage and conserves all mined items', () => {
    const world = supplyLine()
    advanceWorld(world, 2100)
    expect(chest(world, 22, 21).inventory).toBe(1)
    expect(world.ore).toBe(2)
    for (let i = 0; i < 100; i++) {
      advanceWorld(world, 133)
      expect(accounted(world)).toBe(world.ore)
    }
    expect(chest(world, 22, 21).inventory).toBeGreaterThan(10)
  })
  it.each(DIRECTIONS)('outputs miners in the %s direction', direction => {
    const world = createWorld(() => .5)
    const offset = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }[direction]
    place(world, 20, 20, 'miner', direction)
    place(world, 20 + offset[0], 20 + offset[1], 'belt', direction)
    advanceWorld(world, 1050)
    expect(belt(world, 20 + offset[0], 20 + offset[1]).item).toBe('iron')
  })
  it('blocks head-on inputs and direct miner-to-chest output', () => {
    const world = createWorld(() => .5)
    place(world, 20, 20, 'miner')
    place(world, 21, 20, 'belt', 'west')
    advanceWorld(world, 2000)
    expect(belt(world, 21, 20).item).toBe(null)
    expect(removeBuilding(world, 21, 20)).toBe(true)
    place(world, 21, 20, 'storage')
    advanceWorld(world, 2000)
    expect(chest(world, 21, 20).inventory).toBe(0)
    expect(world.ore).toBe(1)
  })
  it('uses tile order for merges and never moves a new arrival twice', () => {
    const world = createWorld()
    place(world, 2, 1, 'belt', 'south')
    place(world, 1, 2, 'belt', 'east')
    place(world, 2, 2, 'belt', 'east')
    for (const b of [belt(world, 2, 1), belt(world, 1, 2)]) { b.item = 'iron'; b.progress = 1 }
    advanceWorld(world, 50)
    expect(belt(world, 2, 1).item).toBe(null)
    expect(belt(world, 1, 2).item).toBe('iron')
    expect(belt(world, 2, 2).progress).toBe(0)
    expect(belt(world, 2, 2).entry).toBe('north')
  })
  it('blocks missing connections and recovers when a route is extended', () => {
    const world = createWorld()
    place(world, 39, 0, 'belt')
    belt(world, 39, 0).item = 'iron'
    advanceWorld(world, 1000)
    expect(belt(world, 39, 0).progress).toBe(1)
    place(world, 0, 0, 'belt')
    belt(world, 0, 0).item = 'iron'
    advanceWorld(world, 1000)
    place(world, 1, 0, 'storage')
    advanceWorld(world, 50)
    expect(chest(world, 1, 0).inventory).toBe(1)
    expect(belt(world, 0, 0).item).toBe(null)
  })
  it('does not reuse a destination vacated in the same step; full loops jam', () => {
    const world = createWorld()
    for (const [x, y, direction] of [[0, 0, 'east'], [1, 0, 'south'], [1, 1, 'west'], [0, 1, 'north']] as const) {
      place(world, x, y, 'belt', direction)
      belt(world, x, y).item = 'iron'
    }
    advanceWorld(world, 1000)
    for (const b of world.buildings) if (b?.kind === 'belt') { expect(b.item).toBe('iron'); expect(b.progress).toBe(1) }
    expect(accounted(world)).toBe(4)
  })
  it('waits until the next step before a miner reuses a vacated belt', () => {
    const world = createWorld(() => .5)
    place(world, 20, 20, 'miner')
    place(world, 21, 20, 'belt')
    place(world, 22, 20, 'storage')
    miner(world).item = 'iron'
    belt(world, 21, 20).item = 'iron'
    belt(world, 21, 20).progress = 1
    advanceWorld(world, 50)
    expect(chest(world, 22, 20).inventory).toBe(1)
    expect(belt(world, 21, 20).item).toBe(null)
    expect(miner(world).item).toBe('iron')
    advanceWorld(world, 50)
    expect(belt(world, 21, 20).item).toBe('iron')
    expect(belt(world, 21, 20).progress).toBe(0)
    expect(miner(world).item).toBe(null)
  })
  it('accepts simultaneous belt deliveries into a chest from all four sides', () => {
    const world = createWorld()
    place(world, 10, 10, 'storage')
    for (const [x, y, direction] of [[10, 9, 'south'], [11, 10, 'west'], [10, 11, 'north'], [9, 10, 'east']] as const) {
      place(world, x, y, 'belt', direction)
      belt(world, x, y).item = 'iron'
    }
    advanceWorld(world, 500)
    expect(chest(world, 10, 10).inventory).toBe(4)
    expect(accounted(world)).toBe(4)
  })
  it('is frame-partition independent and ignores invalid deltas', () => {
    const a = supplyLine(), b = supplyLine()
    advanceWorld(a, 12345)
    for (let i = 0; i < 123; i++) advanceWorld(b, 100)
    advanceWorld(b, 45)
    expect(b).toEqual(a)
    const before = structuredClone(b)
    for (const delta of [-1, 0, NaN, Infinity]) advanceWorld(b, delta)
    expect(b).toEqual(before)
    const c = supplyLine(), d = supplyLine()
    for (let i = 0; i < 60; i++) advanceWorld(c, 1000 / 60)
    advanceWorld(d, 1000)
    expect(c.ore).toBe(d.ore)
    expect(c.buildings).toEqual(d.buildings)
  })
})
