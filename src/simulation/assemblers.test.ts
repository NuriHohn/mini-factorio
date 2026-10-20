import { describe, expect, it } from 'vitest'
import { beltInputs } from './beltConnections'
import { canStartCrafting, changeCraftingRecipe, craftingStatus } from './crafting'
import { inspectBuilding, worldStats } from './inspection'
import { emptyInventory, ITEMS, inventoryTotal, RESOURCES } from './items'
import type { Inventory, Item } from './items'
import { allocatePower, powerRequirement, workingDemand } from './power'
import { MACHINE_DEFINITIONS, RECIPES } from './recipes'
import type { RecipeId } from './recipes'
import { changeFurnaceRecipe } from './smelting'
import { advanceWorld, STEP_MS } from './step'
import { poweredWorld } from './testFixtures'
import { advanceTransport, outputMachines } from './transport'
import { buildingAt, createWorld, DIRECTIONS, offsets, opposite, placeBuilding, removeBuilding, SIZE } from './world'
import type { Assembler, Belt, BuildingKind, Direction, Storage, World } from './world'

const recipes = [
  { id: 'ironGear', inputs: { ironPlate: 2 }, outputs: { ironGear: 1 }, durationMs: 2000 },
  { id: 'copperCable', inputs: { copperPlate: 1 }, outputs: { copperCable: 2 }, durationMs: 2000 },
  { id: 'electronicCircuit', inputs: { ironPlate: 1, copperCable: 3 }, outputs: { electronicCircuit: 1 }, durationMs: 3000 },
] as const
function add(world: World, x: number, y: number, kind: BuildingKind, direction: Direction = 'east') {
  expect(placeBuilding(world, x, y, kind, direction)).toBe(true)
}
function assembler(world: World, x = 20, y = 20) { return buildingAt(world, x, y) as Assembler }
function belt(world: World, x: number, y: number) { return buildingAt(world, x, y) as Belt }
function setup(recipe: RecipeId = 'ironGear') {
  const world = poweredWorld(() => .5)
  add(world, 20, 20, 'assembler')
  expect(changeCraftingRecipe(world, 20, 20, recipe)).toBe(null)
  return world
}
function incoming(world: World, x: number, y: number, direction: Direction, item: Item) {
  if (!buildingAt(world, x, y)) add(world, x, y, 'belt', direction)
  const b = belt(world, x, y)
  expect(b.item).toBe(null)
  b.item = item
  b.progress = 1
}
function loadBatch(a: Assembler) {
  if (!a.recipeId) throw Error('Fixture requires a manual recipe')
  Object.assign(a.input, RECIPES[a.recipeId].inputs)
}
function inventoryMaterials(inventory: Readonly<Partial<Inventory>>) {
  // Copper is measured in half-plate units, avoiding fractional conservation assertions.
  return {
    iron: (inventory.iron ?? 0) + (inventory.ironPlate ?? 0) + (inventory.ironGear ?? 0) * 2 + (inventory.electronicCircuit ?? 0),
    copper: ((inventory.copper ?? 0) + (inventory.copperPlate ?? 0)) * 2 + (inventory.copperCable ?? 0) + (inventory.electronicCircuit ?? 0) * 3,
  }
}
function materials(world: World) {
  const total = { iron: 0, copper: 0 }
  function count(inventory: Readonly<Partial<Inventory>>) {
    const value = inventoryMaterials(inventory)
    total.iron += value.iron
    total.copper += value.copper
    for (const item of ITEMS) { expect(Number.isInteger(inventory[item] ?? 0)).toBe(true); expect(inventory[item] ?? 0).toBeGreaterThanOrEqual(0) }
  }
  for (const b of world.buildings) {
    if (!b) continue
    if (b.kind === 'assembler' || b.kind === 'furnace') {
      count(b.input); count(b.output)
      if (b.job) count(b.job.inputs) // Never double count promised products.
      expect(inventoryTotal(b.output) + inventoryTotal(b.job?.outputs ?? {})).toBeLessThanOrEqual(MACHINE_DEFINITIONS[b.kind].outputCapacity)
      if (b.kind === 'furnace') expect(inventoryTotal(b.input)).toBeLessThanOrEqual(2)
      else for (const item of ITEMS) expect(b.input[item]).toBeLessThanOrEqual(((b.recipeId ? RECIPES[b.recipeId].inputs[item] : 0) ?? 0) * 2)
    } else if (b.kind === 'storage') count(b.inventory)
    else if ((b.kind === 'miner' || b.kind === 'belt') && b.item) count({ [b.item]: 1 })
  }
  return total
}

// Real belt-only routing from both miners through Auto furnaces and two assemblers.
function circuitFactory() {
  const world = createWorld(() => .5)
  world.tiles[10 * SIZE + 2] = 'iron'
  world.tiles[16 * SIZE + 2] = 'copper'
  for (const y of [8, 14]) for (const x of [2, 8, 14]) add(world, x, y, 'powerPole')
  for (const x of [2, 8, 14]) add(world, x, 7, 'generator')
  for (const y of [10, 16]) {
    add(world, 2, y, 'miner'); add(world, 3, y, 'belt'); add(world, 4, y, 'furnace'); add(world, 5, y, 'belt')
  }
  for (let x = 6; x <= 9; x++) add(world, x, 10, 'belt')
  add(world, 10, 10, 'assembler'); expect(changeCraftingRecipe(world, 10, 10, 'electronicCircuit')).toBe(null)
  add(world, 11, 10, 'belt'); add(world, 12, 10, 'storage')
  add(world, 6, 16, 'assembler'); expect(changeCraftingRecipe(world, 6, 16, 'copperCable')).toBe(null)
  for (let y = 16; y >= 13; y--) add(world, 7, y, 'belt', 'north')
  for (let x = 7; x <= 9; x++) add(world, x, 12, 'belt')
  add(world, 10, 12, 'belt', 'north'); add(world, 10, 11, 'belt', 'north')
  return world
}

describe('assembler definitions and shared crafting', () => {
  it('has non-mineable components and machine-readable assembler rules', () => {
    expect(RESOURCES).toEqual(['iron', 'copper'])
    expect(MACHINE_DEFINITIONS.assembler).toMatchObject({ craftingSpeed: 1, powerKw: 60, input: { kind: 'per-ingredient', batches: 2 }, outputCapacity: 4, inputSides: ['rear', 'left', 'right'], outputSide: 'front' })
    const world = setup()
    expect(assembler(world).recipeId).toBe('ironGear')
    expect(powerRequirement(assembler(world))).toBe(60)
    expect(workingDemand(assembler(world))).toBe(0)
    expect(canStartCrafting(assembler(world))).toBe(false)
  })
  it.each(recipes)('crafts exactly $outputs from $inputs in $durationMs ms for $id', ({ id, inputs, outputs, durationMs }) => {
    const world = setup(id), a = assembler(world)
    expect(RECIPES[id]).toMatchObject({ machine: 'assembler', inputs, outputs, durationMs })
    loadBatch(a)
    const before = materials(world)
    advanceWorld(world, STEP_MS)
    expect(a.job).toMatchObject({ recipeId: id, elapsedMs: 0, inputs, outputs })
    expect(inventoryTotal(a.input)).toBe(0)
    expect(workingDemand(a)).toBe(60)
    advanceWorld(world, durationMs - STEP_MS)
    expect(inventoryTotal(a.output)).toBe(0)
    advanceWorld(world, STEP_MS)
    expect(a.job).toBe(null)
    expect(a.output).toMatchObject(outputs)
    expect(world.produced).toMatchObject(outputs)
    expect(materials(world)).toEqual(before)
    advanceWorld(world, 10000)
    expect(a.output).toMatchObject(outputs)
    expect(world.produced).toMatchObject(outputs)
  })
  it.each(['ironPlate', 'copperCable'] as const)('waits for complete circuit ingredients when %s arrives first', first => {
    const world = setup('electronicCircuit'), a = assembler(world)
    const order: Item[] = first === 'ironPlate' ? ['ironPlate', 'copperCable', 'copperCable', 'copperCable'] : ['copperCable', 'copperCable', 'copperCable', 'ironPlate']
    for (let i = 0; i < order.length; i++) {
      incoming(world, 19, 20, 'east', order[i]); advanceWorld(world, STEP_MS)
      if (i < order.length - 1) { expect(a.job).toBe(null); expect(workingDemand(a)).toBe(0) }
    }
    expect(a.job).toMatchObject({ elapsedMs: 0, inputs: { ironPlate: 1, copperCable: 3 } })
    advanceWorld(world, 3000)
    expect(a.output.electronicCircuit).toBe(1)
  })
  it('reserves two output units for cables and waits for enough free space', () => {
    const world = setup('copperCable'), a = assembler(world)
    a.input.copperPlate = 2; a.output.copperCable = 2
    advanceWorld(world, STEP_MS)
    expect(a.job?.outputs.copperCable).toBe(2)
    expect(inventoryTotal(a.output) + inventoryTotal(a.job?.outputs ?? {})).toBe(4)
    advanceWorld(world, 2000)
    expect(a.output.copperCable).toBe(4); expect(a.input.copperPlate).toBe(1)
    expect(workingDemand(a)).toBe(0); expect(craftingStatus(a)).toBe('output-full')
    add(world, 21, 20, 'belt')
    advanceWorld(world, STEP_MS)
    expect(belt(world, 21, 20).item).toBe('copperCable')
    expect(a.output.copperCable).toBe(3); expect(a.job).toBe(null)
    add(world, 22, 20, 'storage')
    advanceWorld(world, 600)
    expect(a.job?.elapsedMs).toBeLessThan(100)
    expect(inventoryTotal(a.output) + inventoryTotal(a.job?.outputs ?? {})).toBeLessThanOrEqual(4)
    advanceWorld(world, 5000)
    expect((buildingAt(world, 22, 20) as Storage).inventory.copperCable).toBe(6)
    expect(world.produced.copperCable).toBe(4) // Initial two were fixture inventory.
  })
  it('does not export directly to another machine or chest, or reuse a belt vacated this step', () => {
    const world = setup('copperCable'), a = assembler(world)
    a.output.copperCable = 2
    add(world, 21, 20, 'storage')
    outputMachines(world, new Set())
    expect(a.output.copperCable).toBe(2)
    removeBuilding(world, 21, 20); add(world, 21, 20, 'assembler')
    outputMachines(world, new Set()); expect(a.output.copperCable).toBe(2)
    removeBuilding(world, 21, 20); add(world, 21, 20, 'belt'); add(world, 22, 20, 'storage')
    belt(world, 21, 20).item = 'copperCable'; belt(world, 21, 20).progress = 1
    advanceWorld(world, STEP_MS)
    expect(belt(world, 21, 20).item).toBe(null); expect(a.output.copperCable).toBe(2)
    advanceWorld(world, STEP_MS)
    expect(belt(world, 21, 20).item).toBe('copperCable'); expect(a.output.copperCable).toBe(1)
    expect(beltInputs(world, belt(world, 21, 20))).toContain('west')
  })
})

describe('assembler conveyor acceptance and recipe safety', () => {
  it.each(DIRECTIONS)('accepts rear and sides, rejects the output face, and exports forward facing %s', direction => {
    for (const side of DIRECTIONS) {
      const world = setup(), a = assembler(world)
      a.direction = direction
      const d = offsets[side]
      incoming(world, 20 + d.x, 20 + d.y, opposite(side), 'ironPlate')
      advanceTransport(world, STEP_MS)
      expect(a.input.ironPlate).toBe(side === direction ? 0 : 1)
      expect(belt(world, 20 + d.x, 20 + d.y).item).toBe(side === direction ? 'ironPlate' : null)
    }
    const world = setup(), a = assembler(world), d = offsets[direction]
    a.direction = direction; a.output.ironGear = 1
    add(world, 20 + d.x, 20 + d.y, 'belt', direction)
    outputMachines(world, new Set())
    expect(belt(world, 20 + d.x, 20 + d.y).item).toBe('ironGear')
    expect(a.output.ironGear).toBe(0)
  })
  it.each(recipes)('uses the correct two-batch capacities for $id', ({ id, inputs }) => {
    for (const item of ITEMS.filter(item => (inputs as Partial<Inventory>)[item])) {
      const world = setup(id), a = assembler(world)
      const capacity = (RECIPES[id].inputs[item] ?? 0) * 2
      a.input[item] = capacity - 1
      incoming(world, 20, 19, 'south', item); incoming(world, 19, 20, 'east', item); incoming(world, 20, 21, 'north', item)
      const before = materials(world)
      advanceTransport(world, STEP_MS)
      expect(a.input[item]).toBe(capacity)
      expect(belt(world, 20, 19).item).toBe(null)
      expect(belt(world, 19, 20).item).toBe(item)
      expect(belt(world, 20, 21).item).toBe(item)
      expect(materials(world)).toEqual(before)
    }
  })
  it('allows the missing ingredient when the other buffer is full, reserving distinct simultaneous arrivals', () => {
    const world = setup('electronicCircuit'), a = assembler(world)
    a.input.copperCable = 6
    incoming(world, 20, 19, 'south', 'copperCable')
    incoming(world, 19, 20, 'east', 'ironPlate'); incoming(world, 20, 21, 'north', 'ironPlate')
    advanceTransport(world, STEP_MS)
    expect(a.input).toMatchObject({ copperCable: 6, ironPlate: 2 })
    expect(belt(world, 20, 19).item).toBe('copperCable')
    expect(belt(world, 19, 20).item).toBe(null); expect(belt(world, 20, 21).item).toBe(null)
    advanceWorld(world, STEP_MS)
    expect(a.job?.inputs).toMatchObject({ ironPlate: 1, copperCable: 3 })
  })
  it.each(ITEMS.filter(item => item !== 'ironPlate'))('keeps incompatible %s on its source belt', item => {
    const world = setup(), a = assembler(world)
    incoming(world, 19, 20, 'east', item)
    const before = materials(world)
    advanceWorld(world, 10000)
    expect(belt(world, 19, 20).item).toBe(item); expect(a.job).toBe(null)
    expect(inventoryTotal(a.input)).toBe(0); expect(materials(world)).toEqual(before)
  })
  it('changes only compatible manual recipes on an empty idle assembler and revalidates stale requests', () => {
    const world = setup(), a = assembler(world)
    expect(changeCraftingRecipe(world, 20, 20, 'electronicCircuit')).toBe(null)
    expect(a.recipeId).toBe('electronicCircuit')
    expect(changeCraftingRecipe(world, 20, 20, 'ironSmelting')).toContain('not compatible')
    expect(changeCraftingRecipe(world, -1, 20, 'ironGear')).toContain('existing assembler')
    expect(changeFurnaceRecipe(world, 20, 20, 'auto')).toContain('existing furnace')
    const emptyInspector = inspectBuilding(world, 20 * SIZE + 20)
    a.input.ironPlate = 1
    expect(changeCraftingRecipe(world, 20, 20, 'copperCable')).toContain('Empty both')
    expect(emptyInspector).toMatchObject({ recipeChangeError: null, input: { ironPlate: 0 } })
    a.input.copperCable = 3
    advanceWorld(world, STEP_MS)
    expect(changeCraftingRecipe(world, 20, 20, 'copperCable')).toContain('active batch')
    advanceWorld(world, 3000)
    expect(changeCraftingRecipe(world, 20, 20, 'copperCable')).toContain('Empty both')
    expect(a.recipeId).toBe('electronicCircuit')
  })
  it('cannot select assembler recipes on a furnace or auto-detect components', () => {
    const world = poweredWorld(() => .5)
    add(world, 20, 20, 'furnace')
    expect(changeFurnaceRecipe(world, 20, 20, 'copperCable')).toContain('not compatible')
    incoming(world, 19, 20, 'east', 'copperPlate'); advanceWorld(world, 5000)
    expect(belt(world, 19, 20).item).toBe('copperPlate')
    expect(buildingAt(world, 20, 20)).toMatchObject({ recipeMode: 'auto', recipeId: null, job: null })
  })
})

describe('assembler electricity, inspection and removal', () => {
  it('does not start or consume inputs without power and preserves active jobs through outages', () => {
    const world = setup('electronicCircuit'), a = assembler(world)
    removeBuilding(world, 21, 18); loadBatch(a)
    advanceWorld(world, 10000)
    expect(a.job).toBe(null); expect(a.input).toMatchObject({ ironPlate: 1, copperCable: 3 })
    add(world, 21, 18, 'generator'); advanceWorld(world, 1050)
    expect(a.job?.elapsedMs).toBe(1000)
    removeBuilding(world, 21, 18)
    const frozen = structuredClone(a)
    advanceWorld(world, 10000); expect(a).toEqual(frozen)
    expect(workingDemand(a)).toBe(60)
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ kind: 'assembler', progress: 1 / 3, reserved: { electronicCircuit: 1 }, electrical: { state: 'no-generation', speedFraction: 0 } })
    add(world, 21, 18, 'generator'); advanceWorld(world, 2000)
    expect(a.output.electronicCircuit).toBe(1); expect(world.produced.electronicCircuit).toBe(1)
    expect(workingDemand(a)).toBe(0)
  })
  it('shares a shortage proportionally and ignores inactive machines', () => {
    const world = setup(), a = assembler(world)
    add(world, 22, 20, 'assembler'); const other = assembler(world, 22, 20)
    expect(changeCraftingRecipe(world, 22, 20, 'ironGear')).toBe(null)
    loadBatch(a)
    expect(allocatePower(world).consumers[20 * SIZE + 20]).toMatchObject({ requestedKw: 60, speedFraction: 1 })
    expect(workingDemand(other)).toBe(0)
    loadBatch(other); advanceWorld(world, STEP_MS)
    expect(world.power?.consumers[20 * SIZE + 20]?.speedFraction).toBeCloseTo(5 / 6)
    advanceWorld(world, 1200)
    expect(a.job?.elapsedMs).toBeCloseTo(1000); expect(other.job?.elapsedMs).toBeCloseTo(1000)
    advanceWorld(world, 1200)
    expect(a.output.ironGear).toBe(1); expect(other.output.ironGear).toBe(1)
  })
  it('copies inspection buffers, capacities, reservations and distinguishes storage from production totals', () => {
    const world = setup('copperCable'), a = assembler(world)
    loadBatch(a); advanceWorld(world, 1050)
    const snapshot = inspectBuilding(world, 20 * SIZE + 20)
    expect(snapshot).toMatchObject({ kind: 'assembler', recipe: 'Copper cable', recipeId: 'copperCable', requirements: { copperPlate: 1 }, products: { copperCable: 2 }, inputCapacity: null, inputCapacities: { copperPlate: 2 }, outputCapacity: 4, durationMs: 2000, craftingSpeed: 1, progress: .5, reserved: { copperCable: 2 }, electrical: { requirementKw: 60, suppliedKw: 60, speedFraction: 1 } })
    advanceWorld(world, 1000)
    expect(snapshot).toMatchObject({ progress: .5, output: { copperCable: 0 } })
    expect(worldStats(world)).toMatchObject({ assemblers: 1, furnaces: 0, maxCraftingPerSec: 1, produced: { copperCable: 2 }, stored: { copperCable: 0 } })
  })
  it('discards buffers and committed materials on removal without ghost products or changing lifetime counters', () => {
    const world = setup('copperCable'), a = assembler(world)
    a.input.copperPlate = 2; a.output.copperCable = 2
    world.produced.copperCable = 10; world.mined.copper = 8
    advanceWorld(world, 1050); expect(a.job).not.toBe(null)
    expect(removeBuilding(world, 20, 20)).toBe(true)
    advanceWorld(world, 10000)
    expect(world.produced.copperCable).toBe(10); expect(world.mined.copper).toBe(8)
    expect(materials(world)).toEqual({ iron: 0, copper: 0 })
    expect(worldStats(world).assemblers).toBe(0)
    add(world, 20, 20, 'assembler'); expect(assembler(world)).toMatchObject({ recipeMode: 'auto', recipeId: null, job: null, input: emptyInventory(), output: emptyInventory() })
  })
})

describe('multi-stage circuit production', () => {
  it('mines, auto-smelts, crafts cables and circuits through belts while conserving both metals at every step', () => {
    const world = circuitFactory()
    for (let i = 0; i < 2400; i++) {
      advanceWorld(world, STEP_MS)
      expect(materials(world)).toEqual({ iron: world.mined.iron, copper: world.mined.copper * 2 })
    }
    const chest = buildingAt(world, 12, 10) as Storage
    expect(chest.inventory.electronicCircuit).toBeGreaterThan(10)
    expect(world.produced.copperCable % 2).toBe(0)
    expect(world.produced.electronicCircuit).toBeGreaterThanOrEqual(chest.inventory.electronicCircuit)
    expect(buildingAt(world, 4, 10)).toMatchObject({ recipeMode: 'auto', recipeId: 'ironSmelting' })
    expect(buildingAt(world, 4, 16)).toMatchObject({ recipeMode: 'auto', recipeId: 'copperSmelting' })
  })
  it('produces identical state for equivalent large, uneven and frame-sized time advances', () => {
    const a = circuitFactory(), b = circuitFactory(), c = circuitFactory()
    advanceWorld(a, 60017)
    for (let i = 0; i < 600; i++) advanceWorld(b, 100)
    advanceWorld(b, 17)
    for (let i = 0; i < 3600; i++) advanceWorld(c, 1000 / 60)
    advanceWorld(c, 17)
    expect(b).toEqual(a); expect(c.buildings).toEqual(a.buildings)
    expect(c.produced).toEqual(a.produced); expect(c.mined).toEqual(a.mined)
    expect(materials(a)).toEqual({ iron: a.mined.iron, copper: a.mined.copper * 2 })
  })
})
