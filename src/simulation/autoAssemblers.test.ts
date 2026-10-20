import { describe, expect, it } from 'vitest'
import { assemblerInputCapacity, assemblerWaitRemaining } from './assemblerRecipes'
import { changeCraftingRecipe, craftingStatus } from './crafting'
import { inspectBuilding } from './inspection'
import { ITEMS, inventoryTotal } from './items'
import type { Inventory, Item } from './items'
import { workingDemand } from './power'
import { advanceWorld, STEP_MS } from './step'
import { poweredWorld } from './testFixtures'
import { advanceTransport } from './transport'
import { buildingAt, placeBuilding, removeBuilding, SIZE } from './world'
import type { Assembler, Belt, Storage, World } from './world'

function setup() {
  const world = poweredWorld(() => .5)
  expect(placeBuilding(world, 20, 20, 'assembler', 'east')).toBe(true)
  expect(placeBuilding(world, 19, 20, 'belt', 'east')).toBe(true)
  return world
}
function machine(world: World) { return buildingAt(world, 20, 20) as Assembler }
function belt(world: World, x = 19, y = 20) { return buildingAt(world, x, y) as Belt }
function feed(world: World, item: Item, count = 1) {
  for (let i = 0; i < count; i++) {
    expect(belt(world).item).toBe(null)
    belt(world).item = item; belt(world).progress = 1
    advanceTransport(world, STEP_MS)
  }
}
function drain(world: World) {
  expect(placeBuilding(world, 21, 20, 'belt', 'east')).toBe(true)
  expect(placeBuilding(world, 22, 20, 'storage', 'east')).toBe(true)
}
function materials(world: World) {
  const total = { iron: 0, copper: 0 }
  function add(inv: Readonly<Partial<Inventory>>) {
    total.iron += (inv.iron ?? 0) + (inv.ironPlate ?? 0) + (inv.ironGear ?? 0) * 2 + (inv.electronicCircuit ?? 0)
    total.copper += ((inv.copper ?? 0) + (inv.copperPlate ?? 0)) * 2 + (inv.copperCable ?? 0) + (inv.electronicCircuit ?? 0) * 3
    for (const item of ITEMS) { expect(inv[item] ?? 0).toBeGreaterThanOrEqual(0); expect(Number.isInteger(inv[item] ?? 0)).toBe(true) }
  }
  for (const b of world.buildings) {
    if (!b) continue
    if (b.kind === 'assembler' || b.kind === 'furnace') {
      add(b.input); add(b.output); if (b.job) add(b.job.inputs)
      expect(inventoryTotal(b.output) + inventoryTotal(b.job?.outputs ?? {})).toBeLessThanOrEqual(b.kind === 'assembler' ? 4 : 2)
      if (b.kind === 'assembler') for (const item of ITEMS) expect(b.input[item]).toBeLessThanOrEqual(assemblerInputCapacity(b, item))
    } else if (b.kind === 'storage') add(b.inventory)
    else if ((b.kind === 'miner' || b.kind === 'belt') && b.item) add({ [b.item]: 1 })
  }
  return total
}
const singles = [
  { item: 'ironPlate', count: 2, recipe: 'ironGear', product: 'ironGear', quantity: 1 },
  { item: 'copperPlate', count: 1, recipe: 'copperCable', product: 'copperCable', quantity: 2 },
] as const

describe('assembler Auto detection and waiting', () => {
  it('defaults to Auto and reports all independent input capacities before detection', () => {
    const world = setup(), a = machine(world)
    expect(a).toMatchObject({ recipeMode: 'auto', recipeId: null, autoWaitElapsedMs: null, job: null })
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ recipeMode: 'auto', recipeId: null, recipe: 'Waiting for ingredients', recipeWaitRemainingMs: 0, inputCapacities: { ironPlate: 4, copperPlate: 2, copperCable: 6 } })
  })
  it.each(singles)('waits exactly two simulation seconds before starting $recipe, then processes for two seconds', ({ item, count, recipe, product, quantity }) => {
    const world = setup(), a = machine(world)
    feed(world, item, count)
    const before = materials(world)
    advanceWorld(world, STEP_MS)
    expect(a.recipeId).toBe(recipe); expect(a.job).toBe(null)
    expect(assemblerWaitRemaining(a)).toBe(2000)
    expect(craftingStatus(a)).toBe('waiting-recipe'); expect(workingDemand(a)).toBe(0)
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ recipeMode: 'auto', recipeId: recipe, recipeWaitRemainingMs: 2000 })
    advanceWorld(world, 1999); expect(a.job).toBe(null)
    advanceWorld(world, 1); expect(a.job).toMatchObject({ recipeId: recipe, elapsedMs: 0 })
    expect(workingDemand(a)).toBe(60)
    advanceWorld(world, 1950); expect(world.produced[product]).toBe(0)
    advanceWorld(world, STEP_MS)
    expect(world.produced[product]).toBe(quantity)
    expect(materials(world)).toEqual(before)
  })
  it('prioritizes a fully supplied circuit immediately even with both single-ingredient recipes ready', () => {
    const world = setup(), a = machine(world)
    feed(world, 'ironPlate', 4); feed(world, 'copperPlate', 2); feed(world, 'copperCable', 6)
    const before = materials(world)
    advanceWorld(world, STEP_MS)
    expect(a.job).toMatchObject({ recipeId: 'electronicCircuit', elapsedMs: 0, inputs: { ironPlate: 1, copperCable: 3 } })
    expect(a.input).toMatchObject({ ironPlate: 3, copperPlate: 2, copperCable: 3 })
    expect(materials(world)).toEqual(before)
  })
  it.each([1000, 1950, 2000])('switches to circuits when cables complete the batch after %s ms of waiting', elapsed => {
    const world = setup(), a = machine(world)
    feed(world, 'ironPlate', 2); advanceWorld(world, elapsed)
    expect(a.job).toBe(null)
    feed(world, 'copperCable', 3); advanceWorld(world, STEP_MS)
    expect(a.job).toMatchObject({ recipeId: 'electronicCircuit', elapsedMs: 0 })
    expect(a.input.ironPlate).toBe(1)
  })
  it.each<{ order: readonly Item[] }>([
    { order: ['ironPlate', 'ironPlate', 'copperCable', 'copperCable', 'copperCable'] },
    { order: ['copperCable', 'ironPlate', 'copperCable', 'ironPlate', 'copperCable'] },
    { order: ['copperCable', 'copperCable', 'copperCable', 'ironPlate'] },
  ])('handles mixed ingredient order $order without incomplete recipe locks', ({ order }) => {
    const world = setup()
    for (const item of order) { feed(world, item); advanceWorld(world, 100) }
    expect(machine(world).job?.recipeId).toBe('electronicCircuit')
    expect(machine(world).output.ironGear).toBe(0)
  })
  it('does not postpone the deadline for later arrivals or a change of single-recipe candidate', () => {
    const world = setup(), a = machine(world)
    feed(world, 'copperPlate'); advanceWorld(world, 1050)
    expect(assemblerWaitRemaining(a)).toBe(1000)
    feed(world, 'ironPlate', 2); feed(world, 'copperPlate')
    advanceWorld(world, 1000)
    expect(a.job).toMatchObject({ recipeId: 'ironGear', elapsedMs: 0 })
    expect(a.input.copperPlate).toBe(2)
  })
  it('does not interrupt an active gear job when a complete circuit arrives', () => {
    const world = setup(), a = machine(world)
    feed(world, 'ironPlate', 2); advanceWorld(world, 2550)
    const job = structuredClone(a.job)
    feed(world, 'ironPlate'); feed(world, 'copperCable', 3)
    expect(a.job).toEqual(job); expect(a.recipeId).toBe('ironGear')
    advanceWorld(world, 1500)
    expect(world.produced.ironGear).toBe(1)
    expect(a.job).toMatchObject({ recipeId: 'electronicCircuit', elapsedMs: 0 })
    expect(a.output.ironGear).toBe(1) // Auto may switch with old products still buffered.
  })
  it('bounds each ingredient independently and reserves simultaneous deliveries per item', () => {
    const world = setup(), a = machine(world)
    feed(world, 'copperCable', 6); feed(world, 'copperPlate', 2); feed(world, 'ironPlate', 3)
    expect(placeBuilding(world, 20, 19, 'belt', 'south')).toBe(true)
    expect(placeBuilding(world, 20, 21, 'belt', 'north')).toBe(true)
    for (const [x, y, item] of [[20, 19, 'ironPlate'], [19, 20, 'ironPlate'], [20, 21, 'copperCable']] as const) {
      belt(world, x, y).item = item; belt(world, x, y).progress = 1
    }
    const before = materials(world)
    advanceTransport(world, STEP_MS)
    expect(a.input).toMatchObject({ ironPlate: 4, copperPlate: 2, copperCable: 6 })
    expect(belt(world, 20, 19).item).toBe(null)
    expect(belt(world).item).toBe('ironPlate'); expect(belt(world, 20, 21).item).toBe('copperCable')
    expect(materials(world)).toEqual(before)
  })
  it.each(['iron', 'copper', 'ironGear', 'electronicCircuit'] as const)('rejects incompatible %s in Auto without loss', item => {
    const world = setup()
    feed(world, item); advanceWorld(world, 5000)
    expect(belt(world).item).toBe(item); expect(machine(world).recipeId).toBe(null)
  })
})

describe('Auto progress, power, backpressure and conservation', () => {
  it('ages the wait without power but preserves the job, committed ingredients and reservations during an outage', () => {
    const world = setup(), a = machine(world)
    removeBuilding(world, 21, 18)
    feed(world, 'ironPlate', 2); advanceWorld(world, 5000)
    expect(a.job).toBe(null); expect(a.input.ironPlate).toBe(2)
    expect(assemblerWaitRemaining(a)).toBe(0)
    expect(placeBuilding(world, 21, 18, 'generator', 'east')).toBe(true)
    advanceWorld(world, 1050); expect(a.job?.elapsedMs).toBe(1000)
    removeBuilding(world, 21, 18)
    const frozen = structuredClone(a)
    advanceWorld(world, 5000); expect(a).toEqual(frozen)
    expect(placeBuilding(world, 21, 18, 'generator', 'east')).toBe(true)
    advanceWorld(world, 1000); expect(a.output.ironGear).toBe(1)
  })
  it('scales active Auto jobs proportionally under power shortage', () => {
    const world = setup(), a = machine(world)
    expect(placeBuilding(world, 22, 20, 'assembler', 'east')).toBe(true)
    const other = buildingAt(world, 22, 20) as Assembler
    expect(changeCraftingRecipe(world, 22, 20, 'ironGear')).toBe(null)
    other.input.ironPlate = 4
    feed(world, 'ironPlate', 2); advanceWorld(world, 2050)
    expect(a.job?.elapsedMs).toBe(0)
    expect(world.power?.consumers[20 * SIZE + 20]?.speedFraction).toBeCloseTo(5 / 6)
    advanceWorld(world, 1200); expect(a.job?.elapsedMs).toBeCloseTo(1000)
  })
  it('keeps the expired deadline under backpressure, and starts as soon as the required slots open', () => {
    const world = setup(), a = machine(world)
    a.output.copperCable = 4
    feed(world, 'copperPlate'); advanceWorld(world, 5000)
    expect(a.job).toBe(null); expect(craftingStatus(a)).toBe('output-full')
    expect(assemblerWaitRemaining(a)).toBe(0); expect(workingDemand(a)).toBe(0)
    drain(world)
    advanceWorld(world, STEP_MS)
    expect(a.job).toBe(null) // Only one free unit, but cables reserve two.
    advanceWorld(world, 600)
    expect(a.job?.recipeId).toBe('copperCable')
    expect(a.job?.elapsedMs).toBeLessThanOrEqual(100)
    expect(inventoryTotal(a.output) + inventoryTotal(a.job?.outputs ?? {})).toBe(4)
  })
  it('drains complete mixed buffers and rotates equal-priority recipes without stranding inputs', () => {
    const world = setup(), a = machine(world)
    drain(world)
    feed(world, 'ironPlate', 4); feed(world, 'copperPlate', 2); feed(world, 'copperCable', 6)
    const before = materials(world)
    for (let i = 0; i < 500; i++) {
      advanceWorld(world, STEP_MS)
      expect(materials(world)).toEqual(before)
    }
    expect(inventoryTotal(a.input)).toBe(0)
    const stored = (buildingAt(world, 22, 20) as Storage).inventory
    expect(stored).toMatchObject({ electronicCircuit: 2, ironGear: 1, copperCable: 4 })
    expect(a.job).toBe(null)
  })
  it('alternates lower-priority recipes when both supplies stay available', () => {
    const world = setup(), a = machine(world)
    drain(world)
    feed(world, 'ironPlate', 4); feed(world, 'copperPlate', 2)
    advanceWorld(world, 4050)
    expect(world.produced.ironGear).toBe(1)
    feed(world, 'ironPlate', 2) // Gear remains craftable throughout.
    advanceWorld(world, 2000)
    expect(a.job?.recipeId).toBe('copperCable')
    advanceWorld(world, 2000)
    expect(world.produced.copperCable).toBe(2)
  })
  it('retains Manual locking, immediate starts, and empty-idle restrictions for switching modes', () => {
    const world = setup(), a = machine(world)
    expect(changeCraftingRecipe(world, 20, 20, 'ironGear')).toBe(null)
    feed(world, 'copperCable'); advanceWorld(world, 5000)
    expect(belt(world).item).toBe('copperCable'); expect(a.recipeId).toBe('ironGear')
    a.input.ironPlate = 2
    expect(changeCraftingRecipe(world, 20, 20, 'auto')).toContain('Empty both')
    advanceWorld(world, STEP_MS); expect(a.job?.elapsedMs).toBe(0)
    expect(changeCraftingRecipe(world, 20, 20, 'auto')).toContain('active batch')
    advanceWorld(world, 2000)
    expect(changeCraftingRecipe(world, 20, 20, 'auto')).toContain('Empty both')
    drain(world); advanceWorld(world, STEP_MS)
    expect(changeCraftingRecipe(world, 20, 20, 'auto')).toBe(null)
    expect(a).toMatchObject({ recipeMode: 'auto', recipeId: null, autoWaitElapsedMs: null })
  })
  it('is deterministic across large and partitioned advances, including waiting and switches', () => {
    function run(split: boolean) {
      const world = setup(); drain(world)
      feed(world, 'ironPlate', 4); feed(world, 'copperPlate', 2); feed(world, 'copperCable', 6)
      if (split) for (let i = 0; i < 2000; i++) advanceWorld(world, 10)
      else advanceWorld(world, 20000)
      expect(materials(world)).toEqual({ iron: 4, copper: 10 })
      return world
    }
    expect(run(true)).toEqual(run(false))
  })
})
