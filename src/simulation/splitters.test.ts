import { createUnlockedWorld } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { canReceive, deliverItem, splitterBlocked } from './transport'
import { splitterDirections, splitterPorts } from './splitters'
import { advanceWorld } from './step'
import { buildingAt, DIRECTIONS, offsets, opposite, placeBuilding, removeBuilding } from './world'
import type { Belt, Item, Splitter, Storage, World } from './world'
import { powerRequirement } from './power'
import { poweredWorld } from './testFixtures'
import { inspectBuilding } from './inspection'
import { beltInputs } from './beltConnections'

function setup() {
  const world = createUnlockedWorld(() => .5)
  for (const [x, y, kind, direction] of [[22, 20, 'splitter', 'east'], [21, 20, 'belt', 'east'], [23, 20, 'belt', 'east'], [24, 20, 'storage', 'east'], [22, 19, 'belt', 'north'], [22, 18, 'storage', 'north']] as const) placeBuilding(world, x, y, kind, direction)
  return { world, splitter: world.buildings[822] as Splitter, feeder: world.buildings[821] as Belt, front: world.buildings[823] as Belt, left: world.buildings[782] as Belt }
}
function total(world: World): number {
  return world.buildings.reduce((sum, b) => sum + (!b ? 0 : b.kind === 'belt' || b.kind === 'miner' || b.kind === 'inserter' ? Number(b.item !== null) : b.kind === 'splitter' ? Number(b.input !== null) + b.outputs.filter(Boolean).length : b.kind === 'storage' ? Object.values(b.inventory).reduce((a, b) => a + b, 0) : 0), 0)
}
function feed(world: World, feeder: Belt, items: Item[]) {
  let supplied = 0
  const original = total(world)
  for (let i = 0; i < 600; i++) {
    if (!feeder.item && supplied < items.length) { feeder.item = items[supplied++]; feeder.progress = 0 }
    advanceWorld(world, 50)
    expect(total(world)).toBe(original + supplied)
    for (const b of world.buildings) if (b?.kind === 'splitter') expect(Number(!!b.input) + b.outputs.filter(Boolean).length).toBeLessThanOrEqual(3)
  }
  expect(supplied).toBe(items.length)
}
describe('compact one-tile geometry and ports', () => {
  it.each(DIRECTIONS)('places and orients exactly one tile facing %s', direction => {
    const world = createUnlockedWorld(() => .5)
    expect(placeBuilding(world, 22, 20, 'splitter', direction)).toBe(true)
    const s = buildingAt(world, 22, 20) as Splitter
    expect(s.direction).toBe(direction)
    expect(world.buildings.filter(Boolean)).toHaveLength(1)
    const { input, outputs } = splitterPorts(s), rear = offsets[opposite(direction)]
    expect(input).toEqual({ x: 22 + rear.x, y: 20 + rear.y })
    const left = DIRECTIONS[(DIRECTIONS.indexOf(direction) + 3) % 4]
    expect(splitterDirections(direction)).toEqual([direction, left])
    expect(outputs).toEqual([direction, left].map(d => ({ x: 22 + offsets[d].x, y: 20 + offsets[d].y })))
    for (const travel of DIRECTIONS) expect(canReceive(s, 'iron', travel)).toBe(travel === direction)
    expect(powerRequirement(s)).toBe(0)
  })
  it('rejects occupied tiles, allows edge placement with blocked off-world ports, and removes safely', () => {
    const world = createUnlockedWorld(() => .5)
    expect(placeBuilding(world, 0, 0, 'splitter', 'north')).toBe(true)
    expect(placeBuilding(world, 0, 0, 'belt', 'east')).toBe(false)
    const s = world.buildings[0] as Splitter
    expect(splitterBlocked(world, s, 0)).toBe(true); expect(splitterBlocked(world, s, 1)).toBe(true)
    s.input = { item: 'iron', progress: 1 }; s.outputs = [{ item: 'copper', progress: 1 }, { item: 'ironPlate', progress: 1 }]
    world.mined.iron = 17; world.produced.ironPlate = 9
    expect(removeBuilding(world, 0, 0)).toBe(true)
    expect(world.mined.iron).toBe(17); expect(world.produced.ironPlate).toBe(9)
    expect(placeBuilding(world, 0, 0, 'splitter', 'west')).toBe(true)
    advanceWorld(world, 1000)
    expect(total(world)).toBe(0)
  })
})
describe('round robin, reservations and backpressure', () => {
  it('alternates front/left delivery evenly without changing belt travel speed', () => {
    const { world, splitter, feeder } = setup()
    feed(world, feeder, Array<Item>(12).fill('iron'))
    expect(splitter.delivered).toEqual([6, 6])
    expect((world.buildings[824] as Storage).inventory.iron).toBe(6)
    expect((world.buildings[742] as Storage).inventory.iron).toBe(6)
  })
  it('traverses in two 250 ms stages and never advances newly transferred input in the same tick', () => {
    const { world, splitter, feeder, front } = setup()
    feeder.item = 'copper'; feeder.progress = 1
    advanceWorld(world, 50)
    expect(splitter.input).toEqual({ item: 'copper', progress: 0 })
    advanceWorld(world, 200); expect(splitter.outputs[0]).toBe(null)
    advanceWorld(world, 50); expect(splitter.input).toBe(null); expect(splitter.outputs[0]).toEqual({ item: 'copper', progress: 0 })
    advanceWorld(world, 200); expect(front.item).toBe(null)
    advanceWorld(world, 50); expect(front.item).toBe('copper'); expect(front.progress).toBe(0)
    expect(splitter.delivered).toEqual([1, 0])
  })
  it.each([0, 1] as const)('keeps using the other output when output %s is permanently blocked', output => {
    const { world, splitter, feeder, front, left } = setup()
    removeBuilding(world, output === 0 ? 24 : 22, output === 0 ? 20 : 18)
    const belt = output === 0 ? front : left
    belt.item = 'copper'; belt.progress = 1
    feed(world, feeder, Array<Item>(10).fill('ironPlate'))
    expect(splitter.delivered[output]).toBe(0)
    expect(splitter.delivered[output === 0 ? 1 : 0]).toBe(10)
    expect(belt.item).toBe('copper')
  })
  it('holds safely at the center and backs up the input when both outputs are blocked', () => {
    const { world, splitter, feeder, front, left } = setup()
    removeBuilding(world, 24, 20); removeBuilding(world, 22, 18)
    front.item = 'copper'; front.progress = 1; left.item = 'copper'; left.progress = 1
    deliverItem(splitter, 'iron', 'east')
    feeder.item = 'ironPlate'; feeder.progress = 1
    advanceWorld(world, 3000)
    expect(splitter.input).toEqual({ item: 'iron', progress: 1 })
    expect(splitter.outputs).toEqual([null, null]); expect(splitter.nextOutput).toBe(0)
    expect(feeder.item).toBe('ironPlate'); expect(total(world)).toBe(4)
    placeBuilding(world, 24, 20, 'storage', 'east')
    placeBuilding(world, 22, 18, 'storage', 'north')
    advanceWorld(world, 3000)
    expect(splitter.delivered).toEqual([1, 1]); expect(total(world)).toBe(4)
  })
  it('bounds all three slots, keeps in-flight blocked packets, and recovers without overwriting items', () => {
    const { world, splitter, front, left } = setup()
    deliverItem(splitter, 'iron', 'east'); advanceWorld(world, 250)
    removeBuilding(world, 24, 20); front.item = 'copper'; front.progress = 1
    deliverItem(splitter, 'copperPlate', 'east'); advanceWorld(world, 250)
    removeBuilding(world, 22, 18); left.item = 'copper'; left.progress = 1
    deliverItem(splitter, 'ironGear', 'east'); advanceWorld(world, 250)
    expect(splitter.input?.item).toBe('ironGear')
    expect(splitter.outputs.map(p => p?.item)).toEqual(['iron', 'copperPlate'])
    expect(deliverItem(splitter, 'electronicCircuit', 'east')).toBe(false)
    const before = structuredClone(splitter)
    advanceWorld(world, 1000); expect(splitter).toEqual(before)
    expect(total(world)).toBe(5)
    placeBuilding(world, 24, 20, 'storage', 'east'); placeBuilding(world, 22, 18, 'storage', 'north')
    advanceWorld(world, 3000)
    expect(total(world)).toBe(5); expect(splitter.delivered).toEqual([2, 1])
  })
  it('arbitrates a contested output with ordinary belts against the same unchanged occupancy snapshot', () => {
    const { world, splitter, front } = setup()
    placeBuilding(world, 23, 21, 'belt', 'north')
    const other = world.buildings[863] as Belt
    other.item = 'copper'; other.progress = 1
    splitter.outputs[0] = { item: 'iron', progress: 1 }
    advanceWorld(world, 50)
    expect(front.item).toBe('iron') // splitter anchor index precedes the contending belt
    expect(other.item).toBe('copper'); expect(total(world)).toBe(2)
    expect(front.progress).toBe(0)
  })
  it('reserves furnace recipes for mixed simultaneous belt/splitter arrivals without incorrect conversions', () => {
    const { world, splitter } = setup()
    removeBuilding(world, 23, 20); placeBuilding(world, 23, 20, 'furnace', 'east')
    placeBuilding(world, 23, 21, 'belt', 'north')
    const other = world.buildings[863] as Belt
    splitter.outputs[0] = { item: 'iron', progress: 1 }; other.item = 'copper'; other.progress = 1
    advanceWorld(world, 50)
    expect(world.buildings[823]).toMatchObject({ recipeId: 'ironSmelting', recipeLocked: true, input: { iron: 1, copper: 0 } })
    expect(other.item).toBe('copper')
  })
  it('never reuses a belt that another transfer vacates in the current step', () => {
    const { world, splitter, front } = setup()
    front.item = 'copper'; front.progress = 1
    splitter.outputs[0] = { item: 'iron', progress: 1 }
    advanceWorld(world, 50)
    expect(front.item).toBe(null); expect(splitter.outputs[0]?.item).toBe('iron')
    advanceWorld(world, 50)
    expect(front.item).toBe('iron'); expect(front.progress).toBe(0)
  })
})
describe('chains, curves, inserters and deterministic inspection', () => {
  it('chains splitters without an extra engine or same-step double transfer', () => {
    const { world, splitter, feeder } = setup()
    removeBuilding(world, 22, 19); removeBuilding(world, 23, 20); removeBuilding(world, 24, 20)
    placeBuilding(world, 23, 20, 'splitter', 'east')
    placeBuilding(world, 24, 20, 'belt', 'east'); placeBuilding(world, 25, 20, 'storage', 'east')
    placeBuilding(world, 23, 19, 'belt', 'north'); placeBuilding(world, 23, 18, 'storage', 'north')
    const next = world.buildings[823] as Splitter
    splitter.outputs[0] = { item: 'copper', progress: 1 }
    advanceWorld(world, 50)
    expect(next.input).toEqual({ item: 'copper', progress: 0 }); expect(next.outputs).toEqual([null, null])
    feed(world, feeder, Array<Item>(19).fill('copper'))
    expect(splitter.delivered).toEqual([20, 0]); expect(next.delivered).toEqual([10, 10])
  })
  it('handles a closed transport cycle with bounded deterministic work and no duplication', () => {
    const world = createUnlockedWorld(() => .5)
    for (const [x, y, direction] of [[22, 20, 'east'], [22, 19, 'north'], [21, 19, 'west'], [21, 20, 'south']] as const) placeBuilding(world, x, y, 'splitter', direction)
    deliverItem(world.buildings[822]!, 'iron', 'east')
    for (let i = 0; i < 500; i++) { advanceWorld(world, 50); expect(total(world)).toBe(1) }
  })
  it('connects stable curved belt visuals only to actual output sides', () => {
    const { world, splitter, left } = setup()
    left.direction = 'east'
    expect(beltInputs(world, left)).toEqual(['south'])
    expect(beltInputs(world, world.buildings[821] as Belt)).not.toContain('east')
    deliverItem(splitter, 'iron', 'east'); splitter.nextOutput = 1
    advanceWorld(world, 500)
    expect(left).toMatchObject({ item: 'iron', entry: 'south', progress: 0 })
    expect(beltInputs(world, left)).toEqual(['south'])
    left.direction = 'south'
    expect(canReceive(left, 'iron', 'north')).toBe(false)
  })
  it('supports powered rear inserter supply and outgoing-slot extraction without taking queued input', () => {
    const world = poweredWorld(() => .5)
    for (const [x, y, kind] of [[20, 20, 'storage'], [21, 20, 'inserter'], [22, 20, 'splitter'], [23, 20, 'inserter'], [24, 20, 'storage']] as const) placeBuilding(world, x, y, kind, 'east')
    const source = world.buildings[820] as Storage
    source.inventory.ironPlate = 3
    advanceWorld(world, 8000)
    expect((world.buildings[824] as Storage).inventory.ironPlate).toBe(3)
    expect((world.buildings[822] as Splitter).delivered).toEqual([3, 0])
    expect(total(world)).toBe(3)
    expect(world.power?.consumers[822]).toBeUndefined()
  })
  it('publishes copied buffered packets without exposing mutable simulation slots', () => {
    const { world, splitter } = setup()
    splitter.input = { item: 'copper', progress: .2 }
    splitter.outputs[0] = { item: 'iron', progress: .4 }
    const snapshot = inspectBuilding(world, 822)
    if (snapshot?.kind !== 'splitter' || !snapshot.input || !snapshot.outputs[0]) throw Error('Missing splitter inspection')
    snapshot.input.progress = 1; snapshot.outputs[0].progress = 1
    expect(splitter.input.progress).toBe(.2); expect(splitter.outputs[0].progress).toBe(.4)
  })
  it('preserves full mixed-item results across repeated and uneven fixed-step partitions', () => {
    const { world: a, feeder } = setup()
    feeder.item = 'electronicCircuit'; feeder.progress = .3
    const s = a.buildings[822] as Splitter
    s.input = { item: 'copperCable', progress: .2 }; s.outputs[0] = { item: 'ironGear', progress: .4 }
    const b = structuredClone(a), c = structuredClone(a)
    advanceWorld(a, 10000); advanceWorld(b, 10000)
    for (let i = 0; i < 10; i++) for (const delta of [17, 33, 150, 800]) advanceWorld(c, delta)
    expect(b).toEqual(a); expect(c).toEqual(a); expect(total(a)).toBe(3)
    const snapshot = inspectBuilding(a, 822)
    expect(snapshot).toMatchObject({ kind: 'splitter', delivered: s.delivered })
    if (snapshot?.kind !== 'splitter') throw Error('Wrong inspector')
    snapshot.delivered[0] = 999
    expect(s.delivered[0]).not.toBe(999)
  })
})
