import { describe, expect, it } from 'vitest'
import { beltInputs } from './beltConnections'
import { buildingAt, createWorld, DIRECTIONS, offsets, opposite, placeBuilding, removeBuilding, rotate } from './world'
import type { Belt, Direction, World } from './world'
import { advanceWorld } from './step'

function target(world: World, direction: Direction = 'east'): Belt {
  placeBuilding(world, 20, 20, 'belt', direction)
  return buildingAt(world, 20, 20) as Belt
}
function source(world: World, side: Direction, kind: 'belt' | 'miner' = 'belt') {
  const d = offsets[side]
  world.tiles[(20 + d.y) * 40 + 20 + d.x] = 'iron'
  expect(placeBuilding(world, 20 + d.x, 20 + d.y, kind, opposite(side))).toBe(true)
}
describe('belt topology', () => {
  it.each(DIRECTIONS)('finds every legal miner and belt input for output %s', output => {
    for (const kind of ['miner', 'belt'] as const) {
      const world = createWorld()
      const belt = target(world, output)
      for (const side of DIRECTIONS) source(world, side, kind)
      const inputs = beltInputs(world, belt)
      expect(inputs).toHaveLength(3)
      expect(inputs).not.toContain(output)
      expect(inputs[0]).toBe(opposite(output))
    }
  })
  it('keeps rear-first and tile-order side priority independent of item activity', () => {
    const world = createWorld()
    const belt = target(world)
    source(world, 'south')
    source(world, 'north')
    expect(beltInputs(world, belt)).toEqual(['north', 'south'])
    source(world, 'west')
    expect(beltInputs(world, belt)).toEqual(['west', 'north', 'south'])
    belt.item = 'iron'
    belt.entry = 'south'
    belt.progress = .5
    expect(beltInputs(world, belt)).toEqual(['west', 'north', 'south'])
  })
  it('recomputes after placement, removal and replacement rotation', () => {
    const world = createWorld()
    const belt = target(world, 'south')
    expect(beltInputs(world, belt)).toEqual([])
    source(world, 'west')
    expect(beltInputs(world, belt)).toEqual(['west'])
    removeBuilding(world, 19, 20)
    expect(beltInputs(world, belt)).toEqual([])
    placeBuilding(world, 19, 20, 'belt', 'north')
    expect(beltInputs(world, belt)).toEqual([])
    removeBuilding(world, 19, 20)
    placeBuilding(world, 19, 20, 'belt', 'east')
    expect(beltInputs(world, belt)).toEqual(['west'])
    belt.direction = rotate(belt.direction)
    expect(beltInputs(world, belt)).toEqual([])
  })
  it('ignores storage and outward-facing neighbours, including map edges', () => {
    const world = createWorld()
    placeBuilding(world, 0, 0, 'belt', 'east')
    const belt = buildingAt(world, 0, 0) as Belt
    placeBuilding(world, 0, 1, 'storage', 'north')
    placeBuilding(world, 1, 0, 'belt', 'east')
    expect(beltInputs(world, belt)).toEqual([])
  })
  it('does not change transport arbitration when the visual primary input differs', () => {
    const world = createWorld()
    const belt = target(world)
    source(world, 'west')
    source(world, 'north')
    for (const [x, y] of [[19, 20], [20, 19]]) {
      const b = buildingAt(world, x, y) as Belt
      b.item = 'iron'
      b.progress = 1
    }
    expect(beltInputs(world, belt)[0]).toBe('west')
    advanceWorld(world, 50)
    expect(belt.entry).toBe('north')
    expect((buildingAt(world, 19, 20) as Belt).item).toBe('iron')
    expect(beltInputs(world, belt)[0]).toBe('west')
  })
})
