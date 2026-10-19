import { describe, expect, it } from 'vitest'
import { advanceMining, createWorld, placeMiner, SIZE } from './world'
describe('mining simulation', () => {
  it('generates a 40 by 40 world with a central deposit', () => {
    const world = createWorld(() => .5)
    expect(world.tiles).toHaveLength(SIZE ** 2)
    expect(world.tiles[20 * SIZE + 20]).toBe(true)
    expect(world.tiles).toContain(false)
  })
  it('only permits one miner per iron tile and rejects invalid coordinates', () => {
    const world = createWorld(() => .5)
    for (const [x, y] of [[0, 0], [-1, 20], [40, 20], [20.5, 20]]) expect(placeMiner(world, x, y)).toBe(false)
    expect(placeMiner(world, 20, 20)).toBe(true)
    expect(placeMiner(world, 20, 20)).toBe(false)
    expect(world.miners).toHaveLength(1)
  })
  it('preserves partial progress across multiple cycles and independently placed miners', () => {
    const world = createWorld(() => .5)
    world.tiles[21 * SIZE + 20] = true
    placeMiner(world, 20, 20)
    advanceMining(world, 600)
    expect(world.ore).toBe(0)
    placeMiner(world, 20, 21)
    advanceMining(world, 2500)
    expect(world.ore).toBe(5)
    expect(world.miners.map(m => m.elapsed)).toEqual([100, 500])
    advanceMining(world, 900)
    expect(world.ore).toBe(7)
  })
  it('does not produce without miners and ignores invalid time steps', () => {
    const world = createWorld()
    advanceMining(world, 10000)
    expect(world.ore).toBe(0)
    placeMiner(world, 20, 20)
    for (const delta of [-1, 0, NaN, Infinity]) advanceMining(world, delta)
    expect(world.ore).toBe(0)
    expect(world.miners[0].elapsed).toBe(0)
  })
})

