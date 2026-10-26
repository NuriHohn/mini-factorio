import { createUnlockedWorld } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { emptyInventory, ITEMS, ITEM_DEFINITIONS, inventoryTotal, RESOURCES } from './items'
import type { Inventory } from './items'
import { RECIPES } from './recipes'
import type { RecipeId } from './recipes'
import { buildingAt, depositAt, placeBuilding, removeBuilding, SIZE } from './world'
import type { Belt, BuildingKind, Direction, Furnace, Miner, Storage, World } from './world'
import { changeFurnaceRecipe, recipeChangeError } from './smelting'
import { advanceWorld } from './step'
import { advanceTransport } from './transport'
import { allocatePower, powerRequirement } from './power'
import { inspectBuilding, worldStats } from './inspection'

const chains = [
  { resource: 'iron', product: 'ironPlate', recipeId: 'ironSmelting' },
  { resource: 'copper', product: 'copperPlate', recipeId: 'copperSmelting' },
] as const
function add(world: World, x: number, y: number, kind: BuildingKind, direction: Direction = 'east') {
  expect(placeBuilding(world, x, y, kind, direction)).toBe(true)
}
function f(world: World, x = 26, y = 20) { return buildingAt(world, x, y) as Furnace }
function m(world: World, x: number, y: number) { return buildingAt(world, x, y) as Miner }
function b(world: World, x: number, y: number) { return buildingAt(world, x, y) as Belt }
function storage(world: World, x: number, y: number) { return buildingAt(world, x, y) as Storage }
function furnaceWorld(recipe: RecipeId) {
  const world = createUnlockedWorld(() => .5)
  add(world, 26, 19, 'powerPole')
  add(world, 26, 18, 'generator')
  add(world, 26, 20, 'furnace')
  expect(changeFurnaceRecipe(world, 26, 20, recipe)).toBe(null)
  return world
}
function seeded(seed: number) {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32 }
}
function combinedWorld(shortage = false) {
  const world = createUnlockedWorld(seeded(42))
  add(world, 21, 19, 'powerPole')
  add(world, 27, 19, 'powerPole')
  add(world, 21, 18, 'generator')
  if (!shortage) add(world, 27, 18, 'generator')
  for (const [x, resource] of [[20, 'iron'], [26, 'copper']] as const) {
    expect(depositAt(world, x, 20)).toBe(resource)
    add(world, x, 20, 'miner')
    add(world, x + 1, 20, 'belt')
    add(world, x + 2, 20, 'furnace')
    expect(changeFurnaceRecipe(world, x + 2, 20, resource === 'iron' ? 'ironSmelting' : 'copperSmelting')).toBe(null)
    add(world, x + 3, 20, 'belt', 'south')
  }
  add(world, 23, 21, 'belt')
  add(world, 24, 21, 'storage')
  for (let x = 25; x <= 29; x++) add(world, x, 21, 'belt', 'west')
  return world
}
function physical(world: World): Inventory {
  const result = emptyInventory()
  const count = (inventory: Readonly<Inventory>) => { for (const item of ITEMS) result[item] += inventory[item] }
  for (const building of world.buildings) {
    if (building?.kind === 'miner' || building?.kind === 'belt') { if (building.item) result[building.item]++ }
    else if (building?.kind === 'storage') count(building.inventory)
    else if (building?.kind === 'furnace') {
      count(building.input); count(building.output)
      if (building.job) count(building.job.inputs) // Reserved outputs are not produced items yet.
    }
  }
  return result
}
function expectConserved(world: World) {
  const items = physical(world)
  for (const chain of chains) expect(items[chain.resource] + items[chain.product]).toBe(world.mined[chain.resource])
  for (const building of world.buildings) if (building?.kind === 'furnace') {
    expect(inventoryTotal(building.input)).toBeLessThanOrEqual(2)
    expect(inventoryTotal(building.output) + inventoryTotal(building.job?.outputs ?? {})).toBeLessThanOrEqual(2)
  }
}
describe('central item and recipe definitions', () => {
  it('has unique typed IDs, labels, categories and distinct visual properties for all registered items', () => {
    expect(new Set(ITEMS).size).toBe(13)
    for (const item of ITEMS) {
      const definition = ITEM_DEFINITIONS[item]
      expect(definition.id).toBe(item)
      expect(definition.label.length).toBeGreaterThan(0)
      if (definition.category !== 'component') expect(definition.visual.shape).toBe(definition.category)
      else expect(['gear', 'cable', 'circuit', 'component']).toContain(definition.visual.shape)
    }
    expect(ITEM_DEFINITIONS.iron.visual.color).not.toBe(ITEM_DEFINITIONS.copper.visual.color)
    expect(ITEM_DEFINITIONS.ironPlate.visual.color).not.toBe(ITEM_DEFINITIONS.copperPlate.visual.color)
    expect(RESOURCES).toEqual(['coal', 'iron', 'copper'])
    const a = emptyInventory(), other = emptyInventory()
    a.copper = 1
    expect(inventoryTotal(other)).toBe(0)
    expect(Object.keys(other)).toEqual(ITEMS)
  })
  it.each(chains)('exposes machine-readable $resource smelting without presentation dependencies', ({ resource, product, recipeId }) => {
    const recipe = RECIPES[recipeId]
    expect(recipe).toMatchObject({ id: recipeId, machine: 'furnace', inputs: { [resource]: 1 }, outputs: { [product]: 1 }, durationMs: 2000 })
    for (const amounts of [recipe.inputs, recipe.outputs]) {
      for (const [item, quantity] of Object.entries(amounts)) {
        expect(ITEMS).toContain(item)
        expect(quantity).toBeGreaterThan(0)
      }
    }
  })
})
describe('multi-resource terrain and mining', () => {
  it.each([0, 1, 42, 123456])('generates repeatable clusters of both resources for seed %s', seed => {
    const a = createUnlockedWorld(seeded(seed)), other = createUnlockedWorld(seeded(seed))
    expect(a).toEqual(other)
    expect(a.tiles).toHaveLength(SIZE ** 2)
    expect(a.tiles.every(tile => tile === null || RESOURCES.includes(tile))).toBe(true)
    for (const resource of RESOURCES.filter(resource => resource !== 'coal')) expect(a.tiles.filter(tile => tile === resource).length).toBeGreaterThan(20)
    expect(depositAt(a, 20, 20)).toBe('iron')
    expect(depositAt(a, 26, 20)).toBe('copper')
    expect(depositAt(a, -1, 20)).toBe(null)
  })
  it.each([0, .5, .999])('keeps both starting clusters accessible even with a constant random source %s', value => {
    const world = createUnlockedWorld(() => value)
    expect(depositAt(world, 20, 20)).toBe('iron')
    expect(depositAt(world, 26, 20)).toBe('copper')
    for (const dx of [-1, 0, 1]) expect(depositAt(world, 26 + dx, 20)).toBe('copper')
  })
  it.each(chains)('extracts $resource automatically at the existing powered rate', ({ resource }) => {
    const world = createUnlockedWorld(() => .5), x = resource === 'iron' ? 20 : 26
    add(world, x, 19, 'powerPole'); add(world, x, 18, 'generator'); add(world, x, 20, 'miner')
    advanceWorld(world, 999)
    expect(m(world, x, 20).item).toBe(null)
    advanceWorld(world, 1)
    expect(m(world, x, 20).item).toBe(resource)
    expect(world.mined[resource]).toBe(1)
    expect(inspectBuilding(world, 20 * SIZE + x)).toMatchObject({ kind: 'miner', resource })
    expect(powerRequirement(m(world, x, 20))).toBe(30)
    advanceWorld(world, 10000)
    expect(world.mined[resource]).toBe(1)
    expect(depositAt(world, x, 20)).toBe(resource) // Unlimited deposits remain unlimited.
  })
})
describe('safe individual furnace recipe selection', () => {
  it('defaults to Auto, can switch both ways when empty, and reports requirements/products', () => {
    const world = createUnlockedWorld()
    add(world, 26, 20, 'furnace')
    expect(f(world)).toMatchObject({ recipeMode: 'auto', recipeId: null })
    expect(changeFurnaceRecipe(world, 26, 20, 'copperSmelting')).toBe(null)
    expect(inspectBuilding(world, 20 * SIZE + 26)).toMatchObject({ recipeId: 'copperSmelting', requirements: { copper: 1 }, products: { copperPlate: 1 }, durationMs: 2000, recipeChangeError: null })
    expect(changeFurnaceRecipe(world, 26, 20, 'ironSmelting')).toBe(null)
    expect(f(world)).toMatchObject({ recipeMode: 'ironSmelting', recipeId: 'ironSmelting' })
    const snapshot = structuredClone(world)
    expect(changeFurnaceRecipe(world, 26, 20, 'auto')).toContain('one-time')
    expect(world).toEqual(snapshot)
    expect(changeFurnaceRecipe(world, -1, 20, 'copperSmelting')).not.toBe(null)
  })
  it('revalidates a recipe request if items arrive after an empty inspector snapshot', () => {
    const world = furnaceWorld('ironSmelting')
    const inspector = inspectBuilding(world, 20 * SIZE + 26)
    expect(inspector).toMatchObject({ recipeId: 'ironSmelting', recipeChangeError: null })
    f(world).input.iron = 1
    const before = structuredClone(world)
    expect(changeFurnaceRecipe(world, 26, 20, 'copperSmelting')).toContain('Empty both')
    expect(world).toEqual(before)
    expect(inspector).toMatchObject({ recipeChangeError: null, input: { iron: 0 } })
  })
  it.each(ITEMS)('blocks switching with buffered %s on either side without changing any state', item => {
    for (const side of ['input', 'output'] as const) {
      const world = furnaceWorld('ironSmelting')
      f(world)[side][item] = 1
      const snapshot = structuredClone(world)
      expect(changeFurnaceRecipe(world, 26, 20, 'copperSmelting')).toContain('Empty both')
      expect(recipeChangeError(f(world))).toContain('Empty both')
      expect(world).toEqual(snapshot)
    }
  })
  it.each(chains)('blocks switching during a $resource job and preserves committed resources/reservations', ({ resource, recipeId }) => {
    const world = furnaceWorld(recipeId)
    f(world).input[resource] = 1
    advanceWorld(world, 50)
    expect(inventoryTotal(f(world).input)).toBe(0)
    expect(f(world).job).not.toBe(null)
    const snapshot = structuredClone(world)
    expect(changeFurnaceRecipe(world, 26, 20, recipeId === 'ironSmelting' ? 'copperSmelting' : 'ironSmelting')).toContain('active batch')
    expect(world).toEqual(snapshot)
  })
  it.each(chains)('blocks the $resource recipe change until completed products leave the furnace', ({ resource, product, recipeId }) => {
    const world = furnaceWorld(recipeId)
    f(world).input[resource] = 1
    advanceWorld(world, 2050)
    expect(f(world).output[product]).toBe(1)
    expect(f(world).job).toBe(null)
    expect(changeFurnaceRecipe(world, 26, 20, recipeId === 'ironSmelting' ? 'copperSmelting' : 'ironSmelting')).toContain('Empty both')
    add(world, 27, 20, 'belt')
    advanceWorld(world, 50)
    expect(changeFurnaceRecipe(world, 26, 20, recipeId === 'ironSmelting' ? 'copperSmelting' : 'ironSmelting')).toBe(null)
    expect(b(world, 27, 20).item).toBe(product)
    expect(world.produced[product]).toBe(1)
  })
})
describe('both smelting recipes and typed transport', () => {
  it.each(chains)('converts only $resource into $product in exactly two processing seconds', ({ resource, product, recipeId }) => {
    const world = furnaceWorld(recipeId)
    f(world).input[resource] = 1
    advanceWorld(world, 50)
    expect(f(world).job?.elapsedMs).toBe(0)
    advanceWorld(world, 1999)
    expect(world.produced[product]).toBe(0)
    advanceWorld(world, 1)
    expect(f(world).output[product]).toBe(1)
    expect(world.produced[product]).toBe(1)
    expect(inventoryTotal(f(world).output)).toBe(1)
    expect(powerRequirement(f(world))).toBe(50)
  })
  it.each(chains)('rejects incompatible items at the $resource furnace without loss', ({ resource, recipeId }) => {
    for (const wrong of ITEMS.filter(item => item !== resource)) {
      const world = furnaceWorld(recipeId)
      add(world, 25, 20, 'belt')
      b(world, 25, 20).item = wrong
      advanceWorld(world, 5000)
      expect(b(world, 25, 20).item).toBe(wrong)
      expect(inventoryTotal(f(world).input)).toBe(0)
      expect(inventoryTotal(world.produced)).toBe(0)
    }
  })
  it('copper input reservations prevent simultaneous deliveries from exceeding capacity', () => {
    const world = furnaceWorld('copperSmelting')
    for (const [x, y, direction] of [[25, 20, 'east'], [26, 21, 'north']] as const) {
      add(world, x, y, 'belt', direction)
      b(world, x, y).item = 'copper'; b(world, x, y).progress = 1
    }
    f(world).input.copper = 1
    advanceTransport(world, 50)
    expect(f(world).input.copper).toBe(2)
    expect(b(world, 25, 20).item).toBe(null)
    expect(b(world, 26, 21).item).toBe('copper')
  })
  it.each(ITEMS)('keeps %s identity through a curved route into storage', item => {
    const world = createUnlockedWorld()
    add(world, 10, 10, 'belt'); add(world, 11, 10, 'belt', 'south'); add(world, 11, 11, 'storage')
    b(world, 10, 10).item = item
    advanceWorld(world, 550)
    expect(b(world, 11, 10)).toMatchObject({ item, entry: 'west', direction: 'south' })
    advanceWorld(world, 500)
    expect(storage(world, 11, 11).inventory[item]).toBe(1)
    expect(inventoryTotal(storage(world, 11, 11).inventory)).toBe(1)
  })
  it('stores a mixed sequence independently for all registered item types', () => {
    const world = createUnlockedWorld()
    add(world, 10, 10, 'belt'); add(world, 11, 10, 'belt', 'south'); add(world, 11, 11, 'storage')
    for (const item of [...ITEMS, ...ITEMS].reverse()) { b(world, 10, 10).item = item; advanceWorld(world, 1050) }
    for (const item of ITEMS) expect(storage(world, 11, 11).inventory[item]).toBe(2)
    expect(inventoryTotal(storage(world, 11, 11).inventory)).toBe(ITEMS.length * 2)
    expect(inspectBuilding(world, 11 * SIZE + 11)).toMatchObject({ kind: 'storage', inventory: { iron: 2, ironPlate: 2, copper: 2, copperPlate: 2 } })
  })
  it.each(chains)('keeps $resource progress, buffers and reservations intact during power interruption', ({ resource, product, recipeId }) => {
    const world = furnaceWorld(recipeId)
    f(world).input[resource] = 2; f(world).output[product] = 1
    advanceWorld(world, 1050)
    const snapshot = structuredClone(f(world))
    removeBuilding(world, 26, 18)
    advanceWorld(world, 10000)
    expect(f(world)).toEqual(snapshot)
    expect(world.produced[product]).toBe(0)
    add(world, 26, 18, 'generator')
    advanceWorld(world, 1000)
    expect(world.produced[product]).toBe(1)
    expect(f(world).output[product]).toBe(2)
    expect(f(world).input[resource]).toBe(1)
    expect(f(world).job).toBe(null)
  })
})
describe('simultaneous copper and iron production', () => {
  it.each([false, true])('runs both chains into one chest and conserves each metal (shortage: %s)', shortage => {
    const world = combinedWorld(shortage)
    for (let i = 0; i < 1000; i++) { advanceWorld(world, 50); expectConserved(world) }
    const chest = storage(world, 24, 21)
    expect(chest.inventory.ironPlate).toBeGreaterThan(5)
    expect(chest.inventory.copperPlate).toBeGreaterThan(5)
    expect(chest.inventory.iron).toBe(0)
    expect(chest.inventory.copper).toBe(0)
    const stats = worldStats(world)
    expect(stats.mined).toEqual(world.mined)
    expect(stats.produced).toEqual(world.produced)
    expect(stats.stored).toEqual(chest.inventory)
    chest.inventory.copperPlate++
    expect(stats.stored.copperPlate).not.toBe(chest.inventory.copperPlate) // Copied UI snapshot.
  })
  it('scales iron and copper mining and copper smelting by the same power fraction', () => {
    const world = createUnlockedWorld()
    add(world, 21, 19, 'powerPole'); add(world, 21, 18, 'generator')
    world.tiles[20 * SIZE + 20] = 'iron'; world.tiles[20 * SIZE + 22] = 'copper'
    add(world, 20, 20, 'miner'); add(world, 22, 20, 'miner'); add(world, 21, 21, 'furnace')
    expect(changeFurnaceRecipe(world, 21, 21, 'copperSmelting')).toBe(null)
    f(world, 21, 21).input.copper = 1
    advanceWorld(world, 550)
    expect(m(world, 20, 20).elapsed).toBeCloseTo(550 * 100 / 110)
    expect(m(world, 22, 20).elapsed).toBeCloseTo(m(world, 20, 20).elapsed)
    expect(f(world, 21, 21).job?.elapsedMs).toBeCloseTo(500 * 100 / 110)
    const before = [m(world, 20, 20).elapsed, m(world, 22, 20).elapsed, f(world, 21, 21).job?.elapsedMs]
    removeBuilding(world, 21, 18); advanceWorld(world, 10000)
    expect([m(world, 20, 20).elapsed, m(world, 22, 20).elapsed, f(world, 21, 21).job?.elapsedMs]).toEqual(before)
    add(world, 21, 18, 'generator'); advanceWorld(world, 50)
    expect(m(world, 20, 20).elapsed).toBeGreaterThan(before[0] ?? 0)
  })
  it('is deterministic for large, irregular, and 60 FPS advances under mixed-resource shortages', () => {
    const a = combinedWorld(true), other = combinedWorld(true), frames = combinedWorld(true)
    advanceWorld(a, 30000)
    for (let i = 0; i < 300; i++) { advanceWorld(other, 33); advanceWorld(other, 67) }
    for (let i = 0; i < 1800; i++) advanceWorld(frames, 1000 / 60)
    expect(other).toEqual(a)
    expect(frames.buildings).toEqual(a.buildings)
    expect(frames.mined).toEqual(a.mined)
    expect(frames.produced).toEqual(a.produced)
    expect(frames.power).toEqual(a.power)
    expectConserved(a)
  })
  it('keeps lifetime copper/iron totals when occupied buildings are removed', () => {
    const world = combinedWorld()
    advanceWorld(world, 12000)
    const mined = { ...world.mined }, produced = { ...world.produced }
    removeBuilding(world, 28, 20); removeBuilding(world, 24, 21)
    allocatePower(world)
    expect(world.mined).toEqual(mined)
    expect(world.produced).toEqual(produced)
    expect(inspectBuilding(world, 20 * SIZE + 28)).toBe(null)
    add(world, 24, 21, 'storage')
    expect(inventoryTotal(storage(world, 24, 21).inventory)).toBe(0)
  })
})
