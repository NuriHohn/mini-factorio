import { describe, expect, it } from 'vitest'
import { inspectBuilding } from './inspection'
import { ITEMS, inventoryTotal } from './items'
import type { Item, Resource } from './items'
import { allocatePower } from './power'
import { changeFurnaceRecipe } from './smelting'
import { advanceWorld, STEP_MS } from './step'
import { poweredWorld } from './testFixtures'
import { advanceTransport } from './transport'
import { buildingAt, placeBuilding, removeBuilding, SIZE } from './world'
import type { Belt, Furnace, Storage, World } from './world'

const chains = [
  { ore: 'iron', plate: 'ironPlate', recipe: 'ironSmelting' },
  { ore: 'copper', plate: 'copperPlate', recipe: 'copperSmelting' },
] as const
function setup() {
  const world = poweredWorld(() => .5)
  expect(placeBuilding(world, 20, 20, 'furnace', 'east')).toBe(true)
  expect(placeBuilding(world, 19, 20, 'belt', 'east')).toBe(true)
  return world
}
function furnace(world: World) { return buildingAt(world, 20, 20) as Furnace }
function belt(world: World, x = 19, y = 20) { return buildingAt(world, x, y) as Belt }
function feed(world: World, item: Item) {
  expect(belt(world).item).toBe(null)
  belt(world).item = item
  belt(world).progress = 1
  advanceTransport(world, STEP_MS)
}
function drain(world: World) {
  expect(placeBuilding(world, 21, 20, 'belt', 'east')).toBe(true)
  expect(placeBuilding(world, 22, 20, 'storage', 'east')).toBe(true)
}
function contents(world: World, ore: Resource) {
  const plate = ore === 'iron' ? 'ironPlate' : 'copperPlate'
  let total = 0
  for (const b of world.buildings) {
    if (!b) continue
    if (b.kind === 'furnace') {
      // Reserved outputs are promises, not additional physical items.
      for (const inv of [b.input, b.output, b.job?.inputs]) if (inv) total += inv[ore] + inv[plate]
      expect(inventoryTotal(b.input)).toBeLessThanOrEqual(2)
      expect(inventoryTotal(b.output) + inventoryTotal(b.job?.outputs ?? {})).toBeLessThanOrEqual(2)
    } else if (b.kind === 'storage') total += b.inventory[ore] + b.inventory[plate]
    else if (b.kind === 'miner' || b.kind === 'belt') total += Number(b.item === ore || b.item === plate)
  }
  return total
}

describe('automatic furnace recipes', () => {
  it('starts in Auto without a detected recipe and publishes a safe inspection snapshot', () => {
    const world = setup()
    const snapshot = inspectBuilding(world, 20 * SIZE + 20)
    expect(snapshot).toMatchObject({ recipeMode: 'auto', recipeId: null, recipe: 'Waiting for ore', status: 'waiting-input', progress: 0, recipeChangeError: null, requirements: {}, products: {} })
    feed(world, 'copper')
    expect(snapshot).toMatchObject({ recipeId: null, input: { copper: 0 } })
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ recipeMode: 'auto', recipeId: 'copperSmelting', recipe: 'Copper smelting', input: { copper: 1 }, requirements: { copper: 1 }, products: { copperPlate: 1 } })
  })
  it.each(chains)('detects $ore and completes exactly one $plate after two processing seconds', ({ ore, plate, recipe }) => {
    const world = setup(), f = furnace(world)
    feed(world, ore)
    expect(f.recipeId).toBe(recipe)
    expect(belt(world).item).toBe(null)
    advanceWorld(world, STEP_MS)
    expect(f.job).toMatchObject({ recipeId: recipe, elapsedMs: 0, inputs: { [ore]: 1 }, outputs: { [plate]: 1 } })
    advanceWorld(world, 1950)
    expect(world.produced[plate]).toBe(0)
    advanceWorld(world, STEP_MS)
    expect(f.output[plate]).toBe(1)
    expect(world.produced[plate]).toBe(1)
    expect(contents(world, ore)).toBe(1)
  })
  it.each(chains)('detects a different ore after the $ore batch and its outputs fully drain', ({ ore, plate }) => {
    const world = setup(), f = furnace(world)
    drain(world)
    feed(world, ore)
    advanceWorld(world, 2700)
    expect(f.job).toBe(null)
    expect(inventoryTotal(f.input) + inventoryTotal(f.output)).toBe(0)
    const next = ore === 'iron' ? chains[1] : chains[0]
    feed(world, next.ore)
    expect(f.recipeId).toBe(next.recipe)
    advanceWorld(world, 2700)
    const chest = buildingAt(world, 22, 20) as Storage
    expect(chest.inventory[plate]).toBe(1)
    expect(chest.inventory[next.plate]).toBe(1)
    expect(contents(world, ore)).toBe(1)
    expect(contents(world, next.ore)).toBe(1)
  })
  it.each(['input', 'processing', 'output'] as const)('keeps incompatible ore on its belt while locked by %s', state => {
    const world = setup(), f = furnace(world)
    feed(world, 'iron')
    if (state === 'processing') advanceWorld(world, 1050)
    if (state === 'output') advanceWorld(world, 2050)
    const before = structuredClone(f)
    feed(world, 'copper')
    expect(f).toEqual(before)
    expect(f.recipeId).toBe('ironSmelting')
    expect(belt(world).item).toBe('copper')
    expect(contents(world, 'iron')).toBe(1)
    expect(contents(world, 'copper')).toBe(1)
    expect(changeFurnaceRecipe(world, 20, 20, 'auto')).not.toBe(null)
    expect(changeFurnaceRecipe(world, 20, 20, 'copperSmelting')).not.toBe(null)
  })
  it.each(chains)('keeps manual $recipe fixed, including when empty', ({ ore, plate, recipe }) => {
    const world = setup(), f = furnace(world)
    expect(changeFurnaceRecipe(world, 20, 20, recipe)).toBe(null)
    feed(world, ore === 'iron' ? 'copper' : 'iron')
    advanceWorld(world, 5000)
    expect(belt(world).item).not.toBe(null)
    expect(f).toMatchObject({ recipeMode: recipe, recipeId: recipe, job: null })
    expect(inventoryTotal(f.input) + inventoryTotal(f.output)).toBe(0)
    expect(contents(world, ore === 'iron' ? 'copper' : 'iron')).toBe(1)
    const accepted = setup()
    expect(changeFurnaceRecipe(accepted, 20, 20, recipe)).toBe(null)
    feed(accepted, ore)
    advanceWorld(accepted, 2050)
    expect(furnace(accepted).output[plate]).toBe(1)
  })
  it.each(ITEMS.filter(item => item.endsWith('Plate')))('rejects %s without detecting a recipe', item => {
    const world = setup()
    feed(world, item)
    expect(belt(world).item).toBe(item)
    expect(furnace(world).recipeId).toBe(null)
    expect(inventoryTotal(furnace(world).input)).toBe(0)
  })
  it('does not detect from an arrival facing the output side', () => {
    const world = setup()
    expect(placeBuilding(world, 21, 20, 'belt', 'west')).toBe(true)
    belt(world, 21, 20).item = 'copper'
    belt(world, 21, 20).progress = 1
    advanceTransport(world, STEP_MS)
    expect(furnace(world).recipeId).toBe(null)
    expect(belt(world, 21, 20).item).toBe('copper')
    feed(world, 'iron')
    expect(furnace(world).recipeId).toBe('ironSmelting')
  })
  it('reserves the first accepted recipe across simultaneous mixed inputs and both input slots', () => {
    const world = setup(), f = furnace(world)
    for (const [x, y, direction, item] of [[20, 19, 'south', 'copper'], [20, 21, 'north', 'copper']] as const) {
      expect(placeBuilding(world, x, y, 'belt', direction)).toBe(true)
      belt(world, x, y).item = item
      belt(world, x, y).progress = 1
    }
    feed(world, 'iron')
    expect(f.recipeId).toBe('copperSmelting') // North has the lowest tile index.
    expect(f.input.copper).toBe(2)
    expect(f.input.iron).toBe(0)
    expect(belt(world).item).toBe('iron')
    expect(contents(world, 'iron')).toBe(1)
    expect(contents(world, 'copper')).toBe(2)
  })
  it('eventually accepts the waiting other ore only after all selected ore and plates clear', () => {
    const world = setup(), f = furnace(world)
    drain(world)
    expect(placeBuilding(world, 20, 19, 'belt', 'south')).toBe(true)
    belt(world, 20, 19).item = 'copper'
    belt(world, 20, 19).progress = 1
    feed(world, 'iron')
    expect(f.recipeId).toBe('copperSmelting')
    let switched = false
    for (let i = 0; i < 120; i++) {
      const locked = f.job !== null || inventoryTotal(f.input) + inventoryTotal(f.output) > 0
      const previous = f.recipeId
      advanceWorld(world, STEP_MS)
      if (f.recipeId !== previous) {
        expect(locked).toBe(false)
        switched = true
      }
      expect(contents(world, 'iron')).toBe(1)
      expect(contents(world, 'copper')).toBe(1)
    }
    expect(switched).toBe(true)
    expect(f.recipeId).toBe('ironSmelting')
    const chest = buildingAt(world, 22, 20) as Storage
    expect(chest.inventory).toMatchObject({ ironPlate: 1, copperPlate: 1 })
  })
  it('skips incompatible arrivals before selecting the first compatible ore', () => {
    const world = setup()
    expect(placeBuilding(world, 20, 19, 'belt', 'south')).toBe(true)
    belt(world, 20, 19).item = 'ironPlate'
    belt(world, 20, 19).progress = 1
    feed(world, 'copper')
    expect(belt(world, 20, 19).item).toBe('ironPlate')
    expect(furnace(world).recipeId).toBe('copperSmelting')
  })
  it.each(chains)('preserves detected $recipe, progress and reservations during an outage', ({ ore, plate, recipe }) => {
    const world = setup(), f = furnace(world)
    feed(world, ore)
    advanceWorld(world, 1050)
    expect(f.job?.elapsedMs).toBe(1000)
    removeBuilding(world, 21, 18) // Full-power fixture generator.
    const before = structuredClone(f)
    feed(world, ore === 'iron' ? 'copper' : 'iron')
    advanceWorld(world, 5000)
    expect(f).toEqual(before)
    expect(f.recipeId).toBe(recipe)
    expect(placeBuilding(world, 21, 18, 'generator', 'east')).toBe(true)
    advanceWorld(world, 1000)
    expect(f.output[plate]).toBe(1)
    expect(world.produced[plate]).toBe(1)
    expect(belt(world).item).not.toBe(null)
    expect(contents(world, ore)).toBe(1)
  })
  it('detects while disconnected but starts no job until connected', () => {
    const world = setup(), f = furnace(world)
    removeBuilding(world, 21, 18)
    feed(world, 'copper')
    advanceWorld(world, 5000)
    expect(f).toMatchObject({ recipeId: 'copperSmelting', input: { copper: 1 }, job: null })
    expect(placeBuilding(world, 21, 18, 'generator', 'east')).toBe(true)
    advanceWorld(world, 2050)
    expect(f.output.copperPlate).toBe(1)
  })
  it('scales an Auto job proportionally under power shortage', () => {
    const world = setup(), f = furnace(world)
    // Three active furnaces demand 150 kW from one 100 kW generator.
    for (const [x, y] of [[20, 18], [22, 20]]) {
      expect(placeBuilding(world, x, y, 'furnace', 'east')).toBe(true)
      expect(changeFurnaceRecipe(world, x, y, 'ironSmelting')).toBe(null)
      const other = buildingAt(world, x, y) as Furnace
      other.input.iron = 2
    }
    feed(world, 'copper')
    advanceWorld(world, STEP_MS)
    expect(allocatePower(world).consumers[20 * SIZE + 20]?.speedFraction).toBeCloseTo(2 / 3)
    advanceWorld(world, 1500)
    expect(f.job?.elapsedMs).toBeCloseTo(1000)
    expect(f.job?.outputs.copperPlate).toBe(1)
    expect(f.recipeId).toBe('copperSmelting')
  })
  it('conserves each metal through alternating mixed input and is deterministic across time partitions', () => {
    function run(partitioned: boolean) {
      const world = setup()
      drain(world)
      for (const ore of ['copper', 'iron', 'copper', 'iron'] as const) {
        feed(world, ore)
        if (partitioned) for (let i = 0; i < 270; i++) advanceWorld(world, 10)
        else advanceWorld(world, 2700)
      }
      expect(contents(world, 'iron')).toBe(2)
      expect(contents(world, 'copper')).toBe(2)
      expect(world.produced).toMatchObject({ ironPlate: 2, copperPlate: 2 })
      return world
    }
    expect(run(true)).toEqual(run(false))
  })
})
