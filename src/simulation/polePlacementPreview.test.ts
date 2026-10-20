import { createUnlockedWorld } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { allocatePower, polePlacementPreview, POLE_CONNECTION_RANGE } from './power'
import { placeBuilding, removeBuilding, SIZE } from './world'

function setup() {
  const world = createUnlockedWorld(() => .5)
  expect(placeBuilding(world, 10, 10, 'powerPole', 'east')).toBe(true)
  allocatePower(world)
  return world
}
describe('power pole placement preview', () => {
  it.each([[16, 10, true], [10, 16, true], [4, 10, true], [10, 4, true], [16, 11, false], [15, 13, true], [15, 14, false]])('checks the shared inclusive Euclidean range at (%s, %s)', (x, y, connects) => {
    const world = setup()
    const preview = polePlacementPreview(world, { x, y })
    expect(preview.state).toBe(connects ? 'connected' : 'disconnected')
    expect(preview.connections).toEqual(connects ? [10 * SIZE + 10] : [])
  })
  it('returns all nearby poles in tile order, excluding generators and machines', () => {
    const world = setup()
    placeBuilding(world, 15, 10, 'powerPole', 'east')
    placeBuilding(world, 12, 15, 'powerPole', 'east')
    placeBuilding(world, 30, 30, 'powerPole', 'east')
    placeBuilding(world, 12, 11, 'generator', 'east')
    placeBuilding(world, 12, 13, 'furnace', 'east')
    expect(polePlacementPreview(world, { x: 12, y: 12 })).toMatchObject({ state: 'connected', error: null, connections: [410, 415, 612] })
  })
  it.each([[-1, 10], [SIZE, 10], [10, SIZE], [10.5, 10], [NaN, 10], [Infinity, 10]])('rejects invalid coordinates (%s, %s)', (x, y) => {
    const preview = polePlacementPreview(setup(), { x, y })
    expect(preview.state).toBe('invalid')
    expect(preview.error).toBeTruthy()
    expect(preview.connections).toEqual([])
  })
  it.each(['powerPole', 'generator', 'miner', 'belt', 'storage', 'furnace'] as const)('marks a tile occupied by a %s as invalid', kind => {
    const world = setup()
    world.tiles[11 * SIZE + 10] = 'iron'
    placeBuilding(world, 10, 11, kind, 'east')
    expect(polePlacementPreview(world, { x: 10, y: 11 })).toMatchObject({ state: 'invalid', connections: [] })
  })
  it('allows disconnected placement and leaves networks untouched until a pole is placed', () => {
    const world = setup()
    const snapshot = structuredClone(world), power = world.power
    for (const position of [{ x: 10 + POLE_CONNECTION_RANGE, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 10 }]) polePlacementPreview(world, position)
    expect(world).toEqual(snapshot)
    expect(world.power).toBe(power)
    expect(polePlacementPreview(world, { x: 30, y: 30 }).state).toBe('disconnected')
    expect(placeBuilding(world, 30, 30, 'powerPole', 'east')).toBe(true)
    expect(allocatePower(world).networks).toHaveLength(2)
  })
  it('predicts the actual simulation edges and responds to pole removal', () => {
    const world = setup()
    placeBuilding(world, 20, 10, 'powerPole', 'east')
    const position = { x: 15, y: 10 }
    const preview = polePlacementPreview(world, position)
    expect(preview.connections).toEqual([410, 420])
    const candidate = position.y * SIZE + position.x
    placeBuilding(world, position.x, position.y, 'powerPole', 'east')
    const actual = allocatePower(world).poleConnections.flatMap(([a, b]) => a === candidate ? [b] : b === candidate ? [a] : [])
    expect(actual).toEqual(preview.connections)
    removeBuilding(world, position.x, position.y)
    removeBuilding(world, 10, 10)
    expect(polePlacementPreview(world, position).connections).toEqual([420])
  })
})
