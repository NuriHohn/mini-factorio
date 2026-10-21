import { expect, it } from 'vitest'
import { createWorld, placeBuilding, SIZE } from './world'
import type { CraftingMachine, World } from './world'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { allocatePower } from './power'
import { emptyInventory } from './items'
import { advanceRevenge, recordArrest } from './revenge'

function factory() {
  const world = createWorld(() => .5, { water: false, nature: false })
  placeBuilding(world, 20, 20, 'furnace', 'east')
  const machine = world.buildings[820] as CraftingMachine
  Object.assign(machine, { recipeMode: 'ironSmelting', recipeLocked: true, recipeId: 'ironSmelting' })
  machine.job = { recipeId: 'ironSmelting', elapsedMs: 0, inputs: { ...emptyInventory(), iron: 1 }, outputs: { ...emptyInventory(), ironPlate: 1 } }
  placeBuilding(world, 20, 19, 'powerPole', 'east')
  placeBuilding(world, 20, 18, 'generator', 'east')
  allocatePower(world)
  for (let i = 0; i < 3; i++) recordArrest(world)
  return world
}
function ticks(world: World, count: number) {
  for (let i = 0; i < count; i++) { world.timeMs += 50; advanceRevenge(world, 50) }
}
it.each(['water', 'buildings'] as const)('avoids an isolated first edge spawn caused by %s', obstacle => {
  const world = factory()
  for (const tile of [1, SIZE]) {
    if (obstacle === 'water') world.water[tile] = true
    else placeBuilding(world, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')
  }
  ticks(world, 100)
  expect(world.revenge.boss!.tile).not.toBe(0)
  const start = world.revenge.boss!.tile
  ticks(world, 30)
  expect(world.revenge.boss!.tile).not.toBe(start)
  expect(world.revenge.boss!.target).toBe(820)
})
it('releases an unreachable stale target and recovers when its route opens', () => {
  const world = factory()
  ticks(world, 100)
  const boss = world.revenge.boss!
  boss.target = 820
  // Split the map more than attack range from the factory.
  for (let y = 0; y < SIZE; y++) world.water[y * SIZE + 10] = true
  ticks(world, 1)
  expect(boss.target).toBeNull()
  expect(boss.next).not.toBeNull()
  world.water[10] = false
  ticks(world, 45)
  expect(boss.target).toBe(820)
  expect(boss.tile).not.toBe(0)
})
it('moves deterministically on dry land and uses the 750-ms tile duration', () => {
  const world = factory()
  ticks(world, 100)
  const other = structuredClone(world)
  ticks(world, 14)
  expect(world.revenge.boss).toMatchObject({ tile: 0, travelMs: 700 })
  ticks(world, 1)
  ticks(other, 15)
  expect(world.revenge).toEqual(other.revenge)
  expect(world.revenge.boss).toMatchObject({ tile: 1, next: null, travelMs: 0, hp: 100 })
})
it('retargets a reachable machine when a still-productive target is cut off', () => {
  const world = factory()
  ticks(world, 100)
  const boss = world.revenge.boss!
  boss.target = 820
  placeBuilding(world, 3, 20, 'furnace', 'east')
  const machine = world.buildings[803] as CraftingMachine
  machine.job = structuredClone((world.buildings[820] as CraftingMachine).job)
  placeBuilding(world, 3, 19, 'powerPole', 'east')
  placeBuilding(world, 3, 18, 'generator', 'east')
  allocatePower(world)
  for (let y = 0; y < SIZE; y++) world.water[y * SIZE + 10] = true
  ticks(world, 30)
  expect(boss.target).toBe(803)
  expect(boss.tile).not.toBe(0)
})

it('keeps fixed-step movement identical across frame rates and mid-move save/load', () => {
  const world = factory()
  ticks(world, 100)
  const other = structuredClone(world)
  advanceWorld(world, 350)
  const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
  const loaded = decodeSave(encodeSave(world, view)).world
  advanceWorld(world, 400)
  for (let i = 0; i < 90; i++) advanceWorld(other, 750 / 90)
  for (let i = 0; i < 8; i++) advanceWorld(loaded, 50)
  expect(world.revenge.boss!.tile).toBe(1)
  expect(other.revenge).toEqual(world.revenge)
  expect(loaded.revenge).toEqual(world.revenge)
})
