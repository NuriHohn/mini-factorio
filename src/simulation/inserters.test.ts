import { describe, expect, it } from 'vitest'
import { changeCraftingRecipe } from './crafting'
import { inspectBuilding, worldStats } from './inspection'
import { createInserterFrame, advanceInserters, inserterDemand, inserterPorts, INSERTER_SWING_MS } from './inserters'
import { emptyInventory, ITEMS, inventoryTotal } from './items'
import type { Inventory, Item } from './items'
import { allocatePower, workingDemand } from './power'
import { changeFurnaceRecipe } from './smelting'
import { advanceWorld, STEP_MS } from './step'
import { poweredWorld } from './testFixtures'
import { buildingAt, createWorld, DIRECTIONS, offsets, placeBuilding, removeBuilding, SIZE } from './world'
import type { Assembler, Belt, BuildingKind, Direction, Furnace, Inserter, Storage, World } from './world'

function add(world: World, x: number, y: number, kind: BuildingKind, direction: Direction = 'east') { expect(placeBuilding(world, x, y, kind, direction)).toBe(true) }
function arm(world: World, x = 20, y = 20) { return buildingAt(world, x, y) as Inserter }
function chest(world: World, x: number, y: number) { return buildingAt(world, x, y) as Storage }
function furnace(world: World, x: number, y: number) { return buildingAt(world, x, y) as Furnace }
function belt(world: World, x: number, y: number) { return buildingAt(world, x, y) as Belt }
function setup(target: BuildingKind = 'storage', source: BuildingKind = 'storage') {
  const world = poweredWorld(() => .5)
  add(world, 19, 20, source); add(world, 20, 20, 'inserter'); add(world, 21, 20, target)
  return world
}
function hold(world: World, item: Item, x = 20, y = 20) {
  const a = arm(world, x, y)
  a.item = item; a.phase = 'carrying'; a.elapsedMs = INSERTER_SWING_MS
}
function totalMaterials(world: World) {
  const total = { iron: 0, copper: 0 }
  function count(inv: Readonly<Partial<Inventory>>) {
    total.iron += (inv.iron ?? 0) + (inv.ironPlate ?? 0) + 2 * (inv.ironGear ?? 0) + (inv.electronicCircuit ?? 0)
    total.copper += 2 * ((inv.copper ?? 0) + (inv.copperPlate ?? 0)) + (inv.copperCable ?? 0) + 3 * (inv.electronicCircuit ?? 0)
    for (const item of ITEMS) { expect(inv[item] ?? 0).toBeGreaterThanOrEqual(0); expect(Number.isInteger(inv[item] ?? 0)).toBe(true) }
  }
  for (const b of world.buildings) {
    if (!b) continue
    if (b.kind === 'storage') count(b.inventory)
    else if (b.kind === 'furnace' || b.kind === 'assembler') {
      count(b.input); count(b.output); if (b.job) count(b.job.inputs)
      expect(inventoryTotal(b.output) + inventoryTotal(b.job?.outputs ?? {})).toBeLessThanOrEqual(b.kind === 'furnace' ? 2 : 4)
    } else if ((b.kind === 'belt' || b.kind === 'miner' || b.kind === 'inserter') && b.item) count({ [b.item]: 1 })
  }
  return total
}

describe('inserter cycles and ports', () => {
  it.each(DIRECTIONS)('moves one item from behind to ahead facing %s', direction => {
    const world = poweredWorld(() => .5)
    add(world, 20, 20, 'inserter', direction)
    const ports = inserterPorts(arm(world)), d = offsets[direction]
    expect(ports).toEqual({ pickup: { x: 20 - d.x, y: 20 - d.y }, drop: { x: 20 + d.x, y: 20 + d.y } })
    add(world, ports.pickup.x, ports.pickup.y, 'storage'); add(world, ports.drop.x, ports.drop.y, 'storage')
    chest(world, ports.pickup.x, ports.pickup.y).inventory.iron = 3
    advanceWorld(world, STEP_MS)
    expect(arm(world)).toMatchObject({ phase: 'carrying', item: 'iron', elapsedMs: 0 })
    expect(chest(world, ports.pickup.x, ports.pickup.y).inventory.iron).toBe(2)
    advanceWorld(world, 450); expect(chest(world, ports.drop.x, ports.drop.y).inventory.iron).toBe(0)
    advanceWorld(world, STEP_MS)
    expect(arm(world)).toMatchObject({ phase: 'returning', item: null, elapsedMs: 0 })
    expect(chest(world, ports.drop.x, ports.drop.y).inventory.iron).toBe(1)
    advanceWorld(world, 1000)
    expect(chest(world, ports.drop.x, ports.drop.y).inventory.iron).toBe(2)
    expect(totalMaterials(world).iron).toBe(3)
  })
  it.each(ITEMS)('moves %s between chests without changing lifetime counters', item => {
    const world = setup()
    chest(world, 19, 20).inventory[item] = 1
    advanceWorld(world, 1050)
    expect(chest(world, 21, 20).inventory[item]).toBe(1)
    expect(chest(world, 19, 20).inventory[item]).toBe(0)
    expect(world.mined).toEqual(emptyInventory()); expect(world.produced).toEqual(emptyInventory())
  })
  it('waits for an existing belt item to finish travel and does not move an arrival twice', () => {
    const world = setup('storage', 'belt')
    belt(world, 19, 20).item = 'copper'; belt(world, 19, 20).progress = .8
    advanceWorld(world, STEP_MS); expect(arm(world).item).toBe(null)
    advanceWorld(world, STEP_MS); expect(arm(world).item).toBe('copper')
    const other = setup('storage', 'belt')
    add(other, 18, 20, 'belt'); belt(other, 18, 20).item = 'iron'; belt(other, 18, 20).progress = 1
    advanceWorld(other, STEP_MS)
    expect(belt(other, 19, 20).item).toBe('iron'); expect(arm(other).item).toBe(null)
    expect(belt(other, 19, 20).progress).toBe(0)
    advanceWorld(other, 500); expect(arm(other).item).toBe('iron')
  })
  it('inserts into a belt at progress zero and preserves head-on rejection', () => {
    const world = setup('belt')
    chest(world, 19, 20).inventory.iron = 1
    advanceWorld(world, 550)
    expect(belt(world, 21, 20)).toMatchObject({ item: 'iron', entry: 'west', progress: 0 })
    const blocked = setup('belt')
    belt(blocked, 21, 20).direction = 'west'; chest(blocked, 19, 20).inventory.iron = 1
    advanceWorld(blocked, 5000)
    expect(arm(blocked).item).toBe(null); expect(chest(blocked, 19, 20).inventory.iron).toBe(1)
    expect(workingDemand(arm(blocked), blocked)).toBe(0)
  })
  it('allows edge placement but safely waits when a port is outside the world', () => {
    const world = createWorld(() => .5)
    add(world, 0, 0, 'inserter', 'west')
    advanceWorld(world, 5000)
    expect(arm(world, 0, 0)).toMatchObject({ phase: 'idle', item: null })
    expect(inspectBuilding(world, 0)).toMatchObject({ kind: 'inserter', drop: { x: -1, y: 0 }, target: null })
  })
})

describe('machine buffers and recipe behavior', () => {
  it('can collect a miner front buffer without duplicating production', () => {
    const world = poweredWorld(() => .5)
    world.tiles[20 * SIZE + 19] = 'iron'
    add(world, 19, 20, 'miner'); add(world, 20, 20, 'inserter'); add(world, 21, 20, 'storage')
    advanceWorld(world, 1000)
    expect(arm(world).item).toBe(null)
    expect(world.mined.iron).toBe(1)
    advanceWorld(world, 550)
    expect(chest(world, 21, 20).inventory.iron).toBe(1)
    expect(totalMaterials(world).iron).toBe(world.mined.iron)
  })
  it('selects a compatible chest item for a manual furnace and keeps incompatible stock', () => {
    const world = setup('furnace')
    chest(world, 19, 20).inventory.iron = 3; chest(world, 19, 20).inventory.copper = 1
    expect(changeFurnaceRecipe(world, 21, 20, 'copperSmelting')).toBe(null)
    advanceWorld(world, 550)
    expect(chest(world, 19, 20).inventory.iron).toBe(3)
    expect(furnace(world, 21, 20)).toMatchObject({ recipeId: 'copperSmelting', input: { copper: 1 } })
  })
  it('detects Auto furnace recipes through inserter delivery and honors locks', () => {
    const world = setup('furnace')
    chest(world, 19, 20).inventory.copper = 2
    advanceWorld(world, 550)
    expect(furnace(world, 21, 20)).toMatchObject({ recipeMode: 'auto', recipeId: 'copperSmelting', input: { copper: 1 } })
    chest(world, 19, 20).inventory.iron = 2
    advanceWorld(world, 1000)
    expect(arm(world)).toMatchObject({ phase: 'returning', item: null })
    expect(chest(world, 19, 20).inventory.iron).toBe(2)
  })
  it('revalidates recipe changes in transit and holds an incompatible item without loss', () => {
    const world = setup('furnace')
    chest(world, 19, 20).inventory.iron = 1
    advanceWorld(world, STEP_MS)
    expect(changeFurnaceRecipe(world, 21, 20, 'copperSmelting')).toBe(null)
    advanceWorld(world, 5000)
    expect(arm(world)).toMatchObject({ phase: 'carrying', item: 'iron', elapsedMs: 500 })
    expect(furnace(world, 21, 20).input.iron).toBe(0)
    expect(changeFurnaceRecipe(world, 21, 20, 'auto')).toContain('one-time')
    expect(changeFurnaceRecipe(world, 21, 20, 'ironSmelting')).toBe(null)
    advanceWorld(world, STEP_MS)
    expect(furnace(world, 21, 20)).toMatchObject({ recipeId: 'ironSmelting', input: { iron: 1 } })
    expect(totalMaterials(world).iron).toBe(1)
  })
  it.each(['electronicCircuit'] as const)('respects assembler %s per-item capacities without a full cable buffer blocking iron', mode => {
    const world = setup('assembler'), a = buildingAt(world, 21, 20) as Assembler
    expect(changeCraftingRecipe(world, 21, 20, mode)).toBe(null)
    a.input.copperCable = 6
    chest(world, 19, 20).inventory.ironPlate = 1
    advanceWorld(world, 550)
    expect(a.input.ironPlate).toBe(1)
    expect(a.input.copperCable).toBe(6)
    expect(a.job).toBe(null)
    advanceWorld(world, STEP_MS)
    expect(a.job?.recipeId).toBe('electronicCircuit')
  })
  it.each(['furnace', 'assembler'] as const)('extracts only finished %s output from its front face', kind => {
    const world = setup('storage', kind)
    const source = buildingAt(world, 19, 20) as Furnace | Assembler
    source.input.ironPlate = 1
    source.output.ironPlate = 2
    advanceWorld(world, 550)
    expect(source.input.ironPlate).toBe(1); expect(source.output.ironPlate).toBe(1)
    expect(chest(world, 21, 20).inventory.ironPlate).toBe(1)
    source.direction = 'north'
    advanceWorld(world, 5000)
    expect(source.output.ironPlate).toBe(1)
  })
  it('cannot extract committed job ingredients or products completed in the same step', () => {
    const world = setup('storage', 'assembler')
    const source = buildingAt(world, 19, 20) as Assembler
    expect(changeCraftingRecipe(world, 19, 20, 'ironGear')).toBe(null)
    source.input.ironPlate = 2
    advanceWorld(world, 2050)
    expect(source.job).toBe(null); expect(source.output.ironGear).toBe(1)
    expect(arm(world).item).toBe(null)
    advanceWorld(world, STEP_MS)
    expect(arm(world).item).toBe('ironGear'); expect(source.output.ironGear).toBe(0)
    expect(totalMaterials(world).iron).toBe(2)
  })
  it('supports direct furnace → inserter → assembler transfers with the same output reservation rules', () => {
    const world = setup('assembler', 'furnace')
    furnace(world, 19, 20).output.copperPlate = 1
    const a = buildingAt(world, 21, 20) as Assembler
    expect(changeCraftingRecipe(world, 21, 20, 'copperCable')).toBe(null)
    advanceWorld(world, 550); expect(a.input.copperPlate).toBe(1)
    advanceWorld(world, 2050)
    expect(a.output.copperCable).toBe(2); expect(world.produced.copperCable).toBe(2)
    expect(totalMaterials(world).copper).toBe(2)
  })
  it('rejects inserter delivery into a machine output face', () => {
    const world = setup('furnace')
    furnace(world, 21, 20).direction = 'west'; chest(world, 19, 20).inventory.iron = 1
    advanceWorld(world, 5000)
    expect(chest(world, 19, 20).inventory.iron).toBe(1); expect(arm(world).item).toBe(null)
  })
})

describe('contention and snapshot arbitration', () => {
  it('allows only one of two inserters to claim the same chest unit, in tile order', () => {
    const world = poweredWorld(() => .5)
    add(world, 20, 20, 'storage'); chest(world, 20, 20).inventory.iron = 1
    add(world, 20, 19, 'inserter', 'north'); add(world, 20, 18, 'storage')
    add(world, 21, 20, 'inserter'); add(world, 22, 20, 'storage')
    advanceWorld(world, STEP_MS)
    expect(arm(world, 20, 19).item).toBe('iron'); expect(arm(world, 21, 20).item).toBe(null)
    expect(chest(world, 20, 20).inventory.iron).toBe(0)
    expect(totalMaterials(world).iron).toBe(1)
  })
  it('resolves inserter/belt competition for the same source without duplicating a unit', () => {
    const world = setup('storage', 'belt')
    // Belt has a valid north output; direct belt movement retains priority over pickup.
    belt(world, 19, 20).direction = 'north'; belt(world, 19, 20).item = 'iron'; belt(world, 19, 20).progress = 1
    add(world, 19, 19, 'storage')
    advanceWorld(world, STEP_MS)
    expect(chest(world, 19, 19).inventory.iron).toBe(1); expect(arm(world).item).toBe(null)
    expect(totalMaterials(world).iron).toBe(1)
  })
  it('reserves the final furnace input slot against belt and two held inserter deliveries', () => {
    const world = poweredWorld(() => .5)
    add(world, 20, 20, 'furnace')
    furnace(world, 20, 20).input.iron = 1
    furnace(world, 20, 20).recipeId = 'ironSmelting'
    add(world, 19, 20, 'inserter'); hold(world, 'iron', 19, 20)
    add(world, 20, 19, 'inserter', 'south'); hold(world, 'copper', 20, 19)
    add(world, 20, 21, 'belt', 'north'); belt(world, 20, 21).item = 'iron'; belt(world, 20, 21).progress = 1
    advanceWorld(world, STEP_MS)
    expect(arm(world, 19, 20).item).toBe('iron'); expect(arm(world, 20, 19).item).toBe('copper')
    expect(furnace(world, 20, 20).job?.inputs.iron).toBe(1)
    expect(furnace(world, 20, 20).input.iron).toBe(1)
    expect(totalMaterials(world)).toEqual({ iron: 3, copper: 2 })
  })
  it('locks the Auto recipe deterministically across two simultaneous inserter deliveries', () => {
    const world = poweredWorld(() => .5)
    add(world, 20, 20, 'furnace')
    add(world, 20, 19, 'inserter', 'south'); hold(world, 'copper', 20, 19)
    add(world, 19, 20, 'inserter'); hold(world, 'iron', 19, 20)
    advanceWorld(world, STEP_MS)
    expect(furnace(world, 20, 20)).toMatchObject({ recipeId: 'copperSmelting', input: { copper: 1, iron: 0 } })
    expect(arm(world, 19, 20).item).toBe('iron')
  })
  it('arbitrates two held items targeting one belt in stable tile order', () => {
    const world = poweredWorld(() => .5)
    add(world, 20, 20, 'belt')
    add(world, 20, 19, 'inserter', 'south'); hold(world, 'iron', 20, 19)
    add(world, 19, 20, 'inserter'); hold(world, 'copper', 19, 20)
    advanceWorld(world, STEP_MS)
    expect(belt(world, 20, 20)).toMatchObject({ item: 'iron', progress: 0 })
    expect(arm(world, 20, 19).item).toBe(null); expect(arm(world, 19, 20).item).toBe('copper')
    expect(totalMaterials(world)).toEqual({ iron: 1, copper: 2 })
  })
  it('does not treat replacement chest stock as old when two inserters compete', () => {
    const world = poweredWorld(() => .5)
    add(world, 20, 20, 'storage'); chest(world, 20, 20).inventory.iron = 1
    add(world, 19, 20, 'belt'); belt(world, 19, 20).item = 'iron'; belt(world, 19, 20).progress = 1
    add(world, 20, 19, 'inserter', 'north'); add(world, 20, 18, 'storage')
    add(world, 21, 20, 'inserter'); add(world, 22, 20, 'storage')
    advanceWorld(world, STEP_MS)
    expect(arm(world, 20, 19).item).toBe('iron'); expect(arm(world, 21, 20).item).toBe(null)
    expect(chest(world, 20, 20).inventory.iron).toBe(1)
    expect(totalMaterials(world).iron).toBe(2)
  })
  it('does not reuse a belt vacated this step, even if it became empty before delivery', () => {
    const world = setup('belt')
    add(world, 22, 20, 'storage')
    belt(world, 21, 20).item = 'iron'; belt(world, 21, 20).progress = 1
    hold(world, 'copper')
    advanceWorld(world, STEP_MS)
    expect(belt(world, 21, 20).item).toBe(null); expect(arm(world).item).toBe('copper')
    advanceWorld(world, STEP_MS)
    expect(belt(world, 21, 20)).toMatchObject({ item: 'copper', progress: 0 })
  })
  it('does not immediately pick up new chest arrivals from belts or another inserter', () => {
    const world = setup()
    add(world, 18, 20, 'belt'); belt(world, 18, 20).item = 'iron'; belt(world, 18, 20).progress = 1
    advanceWorld(world, STEP_MS)
    expect(chest(world, 19, 20).inventory.iron).toBe(1); expect(arm(world).item).toBe(null)
    advanceWorld(world, STEP_MS); expect(arm(world).item).toBe('iron')
    const other = poweredWorld(() => .5)
    add(other, 20, 19, 'inserter', 'south'); hold(other, 'copper', 20, 19)
    add(other, 20, 20, 'storage'); add(other, 21, 20, 'inserter'); add(other, 22, 20, 'storage')
    advanceWorld(other, STEP_MS)
    expect(chest(other, 20, 20).inventory.copper).toBe(1); expect(arm(other, 21, 20).item).toBe(null)
    advanceWorld(other, STEP_MS); expect(arm(other, 21, 20).item).toBe('copper')
  })
})

describe('power, backpressure, inspection and removal', () => {
  it('requests 10 kW only while ready/moving, and never picks up without power', () => {
    const world = setup()
    expect(inserterDemand(world, arm(world))).toBe(0)
    chest(world, 19, 20).inventory.iron = 1; removeBuilding(world, 21, 18)
    advanceWorld(world, 5000)
    expect(arm(world).item).toBe(null); expect(chest(world, 19, 20).inventory.iron).toBe(1)
    expect(world.power?.consumers[20 * SIZE + 20]).toMatchObject({ requestedKw: 10, speedFraction: 0 })
    add(world, 21, 18, 'generator'); advanceWorld(world, 300)
    removeBuilding(world, 21, 18)
    const frozen = structuredClone(arm(world))
    advanceWorld(world, 5000); expect(arm(world)).toEqual(frozen)
    add(world, 21, 18, 'generator'); advanceWorld(world, 250)
    expect(chest(world, 21, 20).inventory.iron).toBe(1)
    expect(totalMaterials(world).iron).toBe(1)
  })
  it('cannot release a ready held item during an outage and powers the empty return movement', () => {
    const world = setup()
    hold(world, 'iron'); removeBuilding(world, 21, 18)
    advanceWorld(world, 5000)
    expect(arm(world)).toMatchObject({ item: 'iron', phase: 'carrying', elapsedMs: 500 })
    expect(chest(world, 21, 20).inventory.iron).toBe(0)
    add(world, 21, 18, 'generator'); advanceWorld(world, STEP_MS)
    expect(arm(world).phase).toBe('returning'); expect(inserterDemand(world, arm(world))).toBe(10)
    advanceWorld(world, 500)
    expect(arm(world).phase).toBe('idle'); expect(inserterDemand(world, arm(world))).toBe(0)
    expect(chest(world, 21, 20).inventory.iron).toBe(1)
  })
  it('holds at the drop point when a destination is removed, requests zero while blocked, then recovers', () => {
    const world = setup()
    chest(world, 19, 20).inventory.iron = 1
    advanceWorld(world, STEP_MS); removeBuilding(world, 21, 20)
    advanceWorld(world, 5000)
    expect(arm(world)).toMatchObject({ item: 'iron', phase: 'carrying', elapsedMs: 500 })
    expect(inserterDemand(world, arm(world))).toBe(0)
    expect(inspectBuilding(world, 20 * SIZE + 20)).toMatchObject({ kind: 'inserter', status: 'output-blocked', item: 'iron', progress: .5, target: null })
    add(world, 21, 20, 'storage'); advanceWorld(world, STEP_MS)
    expect(chest(world, 21, 20).inventory.iron).toBe(1)
  })
  it('scales movement proportionally with shared generation', () => {
    const world = setup()
    for (const x of [20, 22]) { add(world, x, 21, 'assembler'); const a = buildingAt(world, x, 21) as Assembler; expect(changeCraftingRecipe(world, x, 21, 'ironGear')).toBe(null); a.input.ironPlate = 4 }
    chest(world, 19, 20).inventory.iron = 1
    advanceWorld(world, STEP_MS)
    expect(world.power?.consumers[20 * SIZE + 20]?.speedFraction).toBeCloseTo(100 / 130)
    advanceWorld(world, 325)
    expect(arm(world).elapsedMs).toBeCloseTo(300 * 100 / 130)
    expect(chest(world, 21, 20).inventory.iron).toBe(0)
  })
  it('copies inspector snapshots and discards a removed held item without ghost delivery', () => {
    const world = setup()
    chest(world, 19, 20).inventory.iron = 1; world.mined.iron = 4
    advanceWorld(world, 300)
    const snapshot = inspectBuilding(world, 20 * SIZE + 20)
    expect(snapshot).toMatchObject({ kind: 'inserter', item: 'iron', progress: .25, pickup: { x: 19, y: 20 }, drop: { x: 21, y: 20 }, cycleMs: 1000, electrical: { requirementKw: 10 } })
    expect(worldStats(world).inserters).toBe(1)
    removeBuilding(world, 20, 20); advanceWorld(world, 10000)
    expect(chest(world, 21, 20).inventory.iron).toBe(0); expect(world.mined.iron).toBe(4)
    expect(worldStats(world).inserters).toBe(0); expect(snapshot).toMatchObject({ item: 'iron', progress: .25 })
  })
  it('uses a captured source budget even if several compatible new units arrive later', () => {
    const world = setup()
    const frame = createInserterFrame(world)
    chest(world, 19, 20).inventory.iron = 3
    allocatePower(world)
    advanceInserters(world, STEP_MS, frame)
    expect(arm(world).item).toBe(null); expect(chest(world, 19, 20).inventory.iron).toBe(3)
  })
})

function gearFactory() {
  const world = createWorld(() => .5)
  for (const x of [10, 13, 16, 22]) { add(world, x, 18, 'powerPole'); add(world, x, 17, 'generator') }
  world.tiles[20 * SIZE + 10] = 'iron'
  add(world, 10, 20, 'miner'); add(world, 11, 20, 'belt')
  add(world, 12, 20, 'furnace'); add(world, 13, 20, 'inserter'); add(world, 14, 20, 'storage')
  add(world, 15, 20, 'inserter'); add(world, 16, 20, 'assembler')
  expect(changeCraftingRecipe(world, 16, 20, 'ironGear')).toBe(null)
  add(world, 17, 20, 'inserter'); add(world, 18, 20, 'belt'); add(world, 19, 20, 'storage')
  return world
}
describe('complete production with inserters', () => {
  it('preserves the direct ore belt connection and makes gears through furnace → inserter → chest → inserter → assembler', () => {
    const world = gearFactory()
    for (let i = 0; i < 1600; i++) {
      advanceWorld(world, STEP_MS)
      expect(totalMaterials(world)).toEqual({ iron: world.mined.iron, copper: 0 })
    }
    expect(chest(world, 19, 20).inventory.ironGear).toBeGreaterThan(10)
    expect(world.produced.ironGear).toBeGreaterThanOrEqual(chest(world, 19, 20).inventory.ironGear)
  })
  it('has identical state for large, uneven and frame-sized time advances', () => {
    const a = gearFactory(), b = gearFactory(), c = gearFactory()
    advanceWorld(a, 45017)
    for (let i = 0; i < 450; i++) advanceWorld(b, 100)
    advanceWorld(b, 17)
    for (let i = 0; i < 2700; i++) advanceWorld(c, 1000 / 60)
    advanceWorld(c, 17)
    expect(b).toEqual(a); expect(c.buildings).toEqual(a.buildings); expect(c.mined).toEqual(a.mined); expect(c.produced).toEqual(a.produced)
  })
})
