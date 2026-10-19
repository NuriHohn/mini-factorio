import { describe, expect, it } from 'vitest'
import { advanceWorld, STEP_MS } from './step'
import { advanceTransport, outputMachines } from './transport'
import { advanceSmelting, furnaceStatus } from './smelting'
import { ITEMS, inventoryTotal } from './items'
import { FURNACE_INPUT_CAPACITY, FURNACE_OUTPUT_CAPACITY, RECIPES } from './recipes'
import { buildingAt, createWorld, DIRECTIONS, offsets, opposite, placeBuilding, removeBuilding, SIZE } from './world'
import type { Belt, BuildingKind, Direction, Furnace, Storage, World } from './world'
import { beltInputs } from './beltConnections'
import { inspectBuilding, worldStats } from './inspection'

function place(world: World, x: number, y: number, kind: BuildingKind, direction: Direction = 'east') {
  expect(placeBuilding(world, x, y, kind, direction)).toBe(true)
}
function furnace(world: World, x = 20, y = 20) { return buildingAt(world, x, y) as Furnace }
function belt(world: World, x: number, y: number) { return buildingAt(world, x, y) as Belt }
function chest(world: World, x: number, y: number) { return buildingAt(world, x, y) as Storage }
function setup() {
  const world = createWorld(() => .5)
  place(world, 20, 20, 'furnace')
  return world
}
function line() {
  const world = createWorld(() => .5)
  place(world, 20, 20, 'miner')
  place(world, 21, 20, 'belt')
  place(world, 22, 20, 'furnace')
  place(world, 23, 20, 'belt', 'south')
  place(world, 23, 21, 'belt', 'east')
  place(world, 24, 21, 'storage')
  return world
}
function physicalItems(world: World) {
  let total = 0
  for (const b of world.buildings) {
    if (!b) continue
    if (b.kind === 'storage') total += inventoryTotal(b.inventory)
    else if (b.kind === 'furnace') total += inventoryTotal(b.input) + inventoryTotal(b.output) + (b.job ? inventoryTotal(b.job.inputs) : 0)
    else total += Number(b.item !== null)
  }
  return total
}
function expectCapacity(world: World) {
  for (const b of world.buildings) {
    if (b?.kind !== 'furnace') continue
    expect(inventoryTotal(b.input)).toBeLessThanOrEqual(FURNACE_INPUT_CAPACITY)
    expect(inventoryTotal(b.output) + (b.job ? inventoryTotal(b.job.outputs) : 0)).toBeLessThanOrEqual(FURNACE_OUTPUT_CAPACITY)
    for (const inventory of [b.input, b.output]) for (const item of ITEMS) expect(inventory[item]).toBeGreaterThanOrEqual(0)
  }
}
describe('furnace processing', () => {
  it('waits for input and completes a batch exactly 2000 ms after it starts', () => {
    const world = setup(), f = furnace(world)
    advanceWorld(world, 5000)
    expect(furnaceStatus(f)).toBe('waiting-input')
    expect(world.plates).toBe(0)
    f.input.iron = 1
    advanceWorld(world, STEP_MS)
    expect(f.job?.elapsedMs).toBe(0)
    expect(f.job?.inputs.iron).toBe(1)
    expect(f.job?.outputs.ironPlate).toBe(1)
    expect(f.input.iron).toBe(0)
    advanceWorld(world, 1999)
    expect(f.output.ironPlate).toBe(0)
    expect(world.plates).toBe(0)
    advanceWorld(world, 1)
    expect(f.output.ironPlate).toBe(1)
    expect(world.plates).toBe(1)
    expect(f.job).toBe(null)
    expect(furnaceStatus(f)).toBe('waiting-input')
    advanceWorld(world, 4000)
    expect(world.plates).toBe(1)
  })
  it('reserves the final output slot and does not start when the buffer is full', () => {
    const world = setup(), f = furnace(world)
    f.input.iron = 2
    f.output.ironPlate = 1
    advanceWorld(world, STEP_MS)
    expect(f.input.iron).toBe(1)
    expect(f.job?.outputs.ironPlate).toBe(1)
    expectCapacity(world)
    advanceWorld(world, 2000)
    expect(f.output.ironPlate).toBe(2)
    expect(f.job).toBe(null)
    expect(f.input.iron).toBe(1)
    expect(furnaceStatus(f)).toBe('output-full')
    advanceWorld(world, 10000)
    expect(world.plates).toBe(1)
    expect(f.input.iron).toBe(1)
    // Draining one output starts a fresh batch, never a catch-up burst.
    place(world, 21, 20, 'belt')
    advanceWorld(world, STEP_MS)
    expect(belt(world, 21, 20).item).toBe('ironPlate')
    expect(f.job?.elapsedMs).toBe(0)
    expectCapacity(world)
  })
  it('releases reserved capacity through removal without creating a ghost output', () => {
    const world = setup(), f = furnace(world)
    f.input.iron = 2
    f.output.ironPlate = 1
    world.ore = 12
    world.plates = 4
    advanceWorld(world, 1000)
    expect(f.job).not.toBe(null)
    expect(removeBuilding(world, 20, 20)).toBe(true)
    advanceWorld(world, 10000)
    expect(world.ore).toBe(12)
    expect(world.plates).toBe(4)
    expect(physicalItems(world)).toBe(0)
    place(world, 20, 20, 'furnace')
    expect(furnace(world).job).toBe(null)
    expect(inventoryTotal(furnace(world).input)).toBe(0)
    expect(inventoryTotal(furnace(world).output)).toBe(0)
  })
  it('retains a completed job rather than losing it if an invalid external edit fills its reservation', () => {
    const world = setup(), f = furnace(world)
    f.input.iron = 1
    advanceSmelting(world, STEP_MS)
    f.output.ironPlate = 2
    advanceSmelting(world, 2000)
    expect(f.job?.elapsedMs).toBe(2000)
    expect(world.plates).toBe(0)
    f.output.ironPlate--
    advanceSmelting(world, STEP_MS)
    expect(f.output.ironPlate).toBe(2)
    expect(world.plates).toBe(1)
    expect(f.job).toBe(null)
  })
})
describe('furnace transport', () => {
  it.each(DIRECTIONS)('accepts three input sides and outputs only forward when facing %s', direction => {
    for (const side of DIRECTIONS) {
      const world = setup(), f = furnace(world)
      f.direction = direction
      const d = offsets[side], x = 20 + d.x, y = 20 + d.y
      place(world, x, y, 'belt', opposite(side))
      belt(world, x, y).item = 'iron'
      belt(world, x, y).progress = 1
      advanceTransport(world, STEP_MS)
      expect(f.input.iron).toBe(side === direction ? 0 : 1)
      expect(belt(world, x, y).item).toBe(side === direction ? 'iron' : null)
    }
    const world = setup(), f = furnace(world)
    f.direction = direction
    f.output.ironPlate = 1
    const d = offsets[direction]
    place(world, 20 + d.x, 20 + d.y, 'belt', direction)
    outputMachines(world, new Set())
    expect(f.output.ironPlate).toBe(0)
    expect(belt(world, 20 + d.x, 20 + d.y).item).toBe('ironPlate')
    expect(beltInputs(world, belt(world, 20 + d.x, 20 + d.y))).toContain(opposite(direction))
  })
  it.each([0, 1, 2])('reserves input capacity with %s queued ore across simultaneous deliveries', initial => {
    const world = setup(), f = furnace(world)
    f.input.iron = initial
    for (const [x, y, direction] of [[20, 19, 'south'], [19, 20, 'east'], [20, 21, 'north']] as const) {
      place(world, x, y, 'belt', direction)
      belt(world, x, y).item = 'iron'
      belt(world, x, y).progress = 1
    }
    advanceTransport(world, STEP_MS)
    expect(f.input.iron).toBe(2)
    expect(belt(world, 20, 19).item).toBe(initial < 2 ? null : 'iron')
    expect(belt(world, 19, 20).item).toBe(initial === 0 ? null : 'iron')
    expect(belt(world, 20, 21).item).toBe('iron')
    expectCapacity(world)
  })
  it('rejects plates at furnace inputs and keeps wrong items on their belts', () => {
    const world = setup()
    place(world, 19, 20, 'belt')
    belt(world, 19, 20).item = 'ironPlate'
    advanceWorld(world, 5000)
    expect(belt(world, 19, 20).item).toBe('ironPlate')
    expect(inventoryTotal(furnace(world).input)).toBe(0)
    expect(world.plates).toBe(0)
  })
  it('never outputs directly into storage or reuses a just-vacated belt', () => {
    const world = setup(), f = furnace(world)
    f.output.ironPlate = 2
    place(world, 21, 20, 'storage')
    outputMachines(world, new Set())
    expect(chest(world, 21, 20).inventory.ironPlate).toBe(0)
    expect(f.output.ironPlate).toBe(2)
    removeBuilding(world, 21, 20)
    place(world, 21, 20, 'belt')
    place(world, 22, 20, 'storage')
    belt(world, 21, 20).item = 'ironPlate'
    belt(world, 21, 20).progress = 1
    advanceWorld(world, STEP_MS)
    expect(chest(world, 22, 20).inventory.ironPlate).toBe(1)
    expect(belt(world, 21, 20).item).toBe(null)
    expect(f.output.ironPlate).toBe(2)
    advanceWorld(world, STEP_MS)
    expect(belt(world, 21, 20).item).toBe('ironPlate')
    expect(f.output.ironPlate).toBe(1)
  })
  it('resolves two machine outputs competing for one belt without duplication', () => {
    const world = setup(), f = furnace(world)
    f.direction = 'south'
    f.output.ironPlate = 1
    world.tiles[21 * SIZE + 19] = true
    place(world, 19, 21, 'miner')
    const m = buildingAt(world, 19, 21)
    if (m?.kind !== 'miner') throw Error('Missing miner')
    m.item = 'iron'
    place(world, 20, 21, 'belt')
    outputMachines(world, new Set())
    expect(belt(world, 20, 21).item).toBe('ironPlate')
    expect(f.output.ironPlate).toBe(0)
    expect(m.item).toBe('iron')
    expect(physicalItems(world)).toBe(2)
  })
  it('stores ore and plates separately on a mixed belt route', () => {
    const world = setup()
    place(world, 0, 0, 'belt')
    place(world, 1, 0, 'belt', 'south')
    place(world, 1, 1, 'storage')
    for (const item of ITEMS) {
      belt(world, 0, 0).item = item
      advanceWorld(world, 1050)
      expect(chest(world, 1, 1).inventory[item]).toBe(1)
    }
    expect(inventoryTotal(chest(world, 1, 1).inventory)).toBe(2)
  })
})
describe('complete production chain', () => {
  it('mines, smelts and delivers plates around corners without loss or buffer overflow', () => {
    const world = line()
    for (let i = 0; i < 1200; i++) {
      advanceWorld(world, STEP_MS)
      expect(physicalItems(world)).toBe(world.ore)
      expectCapacity(world)
    }
    expect(chest(world, 24, 21).inventory.ironPlate).toBeGreaterThan(20)
    expect(chest(world, 24, 21).inventory.iron).toBe(0)
    expect(world.plates).toBeGreaterThanOrEqual(chest(world, 24, 21).inventory.ironPlate)
  })
  it('recovers from blocked output with no time-dependent loss or catch-up production', () => {
    const world = line()
    removeBuilding(world, 23, 20)
    advanceWorld(world, 20000)
    const f = furnace(world, 22, 20)
    expect(f.output.ironPlate).toBe(2)
    expect(f.input.iron).toBe(2)
    expect(f.job).toBe(null)
    expect(world.plates).toBe(2)
    expect(physicalItems(world)).toBe(world.ore)
    place(world, 23, 20, 'belt', 'south')
    advanceWorld(world, STEP_MS)
    expect(f.job?.elapsedMs).toBe(0)
    advanceWorld(world, 10000)
    expect(chest(world, 24, 21).inventory.ironPlate).toBeGreaterThan(2)
    expect(physicalItems(world)).toBe(world.ore)
    expectCapacity(world)
  })
  it('produces identical world state for large and partitioned advances', () => {
    const a = line(), b = line()
    advanceWorld(a, 23457)
    for (let i = 0; i < 234; i++) advanceWorld(b, 100)
    advanceWorld(b, 57)
    expect(b).toEqual(a)
    expect(physicalItems(a)).toBe(a.ore)
    expect(RECIPES.ironSmelting.durationMs).toBe(2000)
    const c = line(), d = line()
    for (let i = 0; i < 1800; i++) advanceWorld(c, 1000 / 60)
    advanceWorld(d, 30000)
    expect(c.buildings).toEqual(d.buildings)
    expect(c.ore).toBe(d.ore)
    expect(c.plates).toBe(d.plates)
  })
})
describe('inspection and global statistics', () => {
  it('reports safe value snapshots, reserved slots, and operational states', () => {
    const world = setup(), f = furnace(world)
    expect(inspectBuilding(world, null)).toBe(null)
    expect(inspectBuilding(world, 0)).toBe(null)
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ kind: 'furnace', status: 'waiting-input', progress: 0 })
    f.input.iron = 1
    advanceWorld(world, 1050)
    const snapshot = inspectBuilding(world, 20 * SIZE + 20)
    expect(snapshot).toMatchObject({ kind: 'furnace', status: 'processing', progress: .5, reserved: { ironPlate: 1 } })
    advanceWorld(world, 1000)
    expect(snapshot).toMatchObject({ status: 'processing', progress: .5, output: { ironPlate: 0 } })
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ status: 'waiting-input', output: { ironPlate: 1 }, outputWaiting: true })
    f.output.ironPlate = 2
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ status: 'output-full' })
  })
  it('updates stored inventories and counts after removal, retaining lifetime totals', () => {
    const world = line()
    advanceWorld(world, 12000)
    const before = worldStats(world)
    expect(before.storedPlates).toBeGreaterThan(0)
    expect(before.furnaces).toBe(1)
    expect(before.miners).toBe(1)
    const inspection = inspectBuilding(world, 21 * SIZE + 24)
    expect(inspection).toMatchObject({ kind: 'storage', inventory: { iron: 0, ironPlate: before.storedPlates } })
    removeBuilding(world, 24, 21)
    removeBuilding(world, 22, 20)
    removeBuilding(world, 20, 20)
    const after = worldStats(world)
    expect(after).toMatchObject({ storedOre: 0, storedPlates: 0, miners: 0, furnaces: 0, oreMined: before.oreMined, platesSmelted: before.platesSmelted })
    expect(inspectBuilding(world, 21 * SIZE + 24)).toBe(null)
  })
})
