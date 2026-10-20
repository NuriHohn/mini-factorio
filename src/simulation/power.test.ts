import { createUnlockedWorld } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { allocatePower, GENERATOR_KW, POLE_CONNECTION_RANGE, POLE_COVERAGE_RADIUS, powerOverview, withinRange, workingDemand } from './power'
import { advanceWorld } from './step'
import { buildingAt, placeBuilding, removeBuilding, SIZE } from './world'
import type { Belt, BuildingKind, Direction, Furnace, Miner, World } from './world'
import { electricalDetails, inspectBuilding } from './inspection'
import { changeFurnaceRecipe } from './smelting'
import { inventoryTotal } from './items'

function add(world: World, x: number, y: number, kind: BuildingKind, direction: Direction = 'east') {
  if (kind === 'miner') world.tiles[y * SIZE + x] = 'iron'
  expect(placeBuilding(world, x, y, kind, direction)).toBe(true)
  if (kind === 'furnace') expect(changeFurnaceRecipe(world, x, y, 'ironSmelting')).toBe(null)
}
function miner(world: World, x: number, y: number) { return buildingAt(world, x, y) as Miner }
function furnace(world: World, x: number, y: number) { return buildingAt(world, x, y) as Furnace }
function belt(world: World, x: number, y: number) { return buildingAt(world, x, y) as Belt }
function network(world: World, x: number, y: number) { return allocatePower(world).assignments[y * SIZE + x] }
function generatorAndPole(world: World, x = 10, y = 10) {
  add(world, x, y, 'powerPole')
  add(world, x, y - 1, 'generator')
}
function shortageWorld() {
  const world = createUnlockedWorld(() => .5)
  generatorAndPole(world, 20, 19)
  add(world, 19, 20, 'miner')
  add(world, 21, 20, 'miner')
  add(world, 20, 21, 'furnace')
  furnace(world, 20, 21).input.iron = 2
  return world
}
function poweredChain() {
  const world = createUnlockedWorld(() => .5)
  generatorAndPole(world, 21, 19)
  add(world, 20, 20, 'miner')
  add(world, 21, 20, 'belt')
  add(world, 22, 20, 'furnace')
  add(world, 23, 20, 'belt', 'south')
  add(world, 23, 21, 'belt', 'east')
  add(world, 24, 21, 'storage')
  return world
}
function accounted(world: World) {
  return world.buildings.reduce((sum, b) => {
    if (!b) return sum
    if (b.kind === 'storage') return sum + inventoryTotal(b.inventory)
    if (b.kind === 'furnace') return sum + inventoryTotal(b.input) + inventoryTotal(b.output) + (b.job ? inventoryTotal(b.job.inputs) : 0)
    return sum + ((b.kind === 'belt' || b.kind === 'miner') && b.item ? 1 : 0)
  }, 0)
}
describe('power topology and coverage', () => {
  it('uses inclusive Euclidean connection and coverage boundaries', () => {
    expect(POLE_CONNECTION_RANGE).toBe(6)
    expect(POLE_COVERAGE_RADIUS).toBe(3)
    expect(withinRange({ x: 0, y: 0 }, { x: 3, y: 0 }, 3)).toBe(true)
    expect(withinRange({ x: 0, y: 0 }, { x: 3, y: 1 }, 3)).toBe(false)
    const world = createUnlockedWorld()
    generatorAndPole(world)
    add(world, 16, 10, 'powerPole')
    add(world, 22, 11, 'powerPole')
    add(world, 10, 13, 'miner')
    add(world, 13, 11, 'miner')
    const power = allocatePower(world)
    expect(power.networks).toHaveLength(2)
    expect(power.poleConnections).toEqual([[410, 416]])
    expect(power.consumers[13 * SIZE + 10].networkId).toBe(410)
    expect(power.consumers[11 * SIZE + 13].networkId).toBe(null)
  })
  it('merges and splits when a bridge pole is placed and removed', () => {
    const world = createUnlockedWorld()
    generatorAndPole(world)
    add(world, 22, 10, 'powerPole')
    add(world, 22, 11, 'miner')
    expect(allocatePower(world).networks).toHaveLength(2)
    expect(allocatePower(world).consumers[11 * SIZE + 22].suppliedKw).toBe(0)
    add(world, 16, 10, 'powerPole')
    expect(allocatePower(world).networks).toHaveLength(1)
    expect(allocatePower(world).consumers[11 * SIZE + 22].suppliedKw).toBe(30)
    removeBuilding(world, 16, 10)
    expect(allocatePower(world).networks).toHaveLength(2)
    expect(allocatePower(world).consumers[11 * SIZE + 22].suppliedKw).toBe(0)
  })
  it('does not double-count generators or machines covered by multiple poles', () => {
    const world = createUnlockedWorld()
    add(world, 10, 10, 'powerPole')
    add(world, 14, 10, 'powerPole')
    add(world, 12, 10, 'generator')
    add(world, 12, 11, 'miner')
    const power = allocatePower(world)
    expect(power.networks).toHaveLength(1)
    expect(power.networks[0].generatorIndices).toEqual([10 * SIZE + 12])
    expect(power.networks[0].consumerIndices).toEqual([11 * SIZE + 12])
    expect(powerOverview(world).connectedKw).toBe(100)
    expect(powerOverview(world).requestedKw).toBe(30)
  })
  it('assigns coverage independently of placement order and invalidates topology on machine removal', () => {
    const a = createUnlockedWorld(() => .5), b = createUnlockedWorld(() => .5)
    const buildings: [number, number, BuildingKind][] = [[10, 10, 'powerPole'], [14, 10, 'powerPole'], [12, 10, 'generator'], [12, 11, 'miner']]
    for (const [x, y, kind] of buildings) add(a, x, y, kind)
    for (const [x, y, kind] of [...buildings].reverse()) add(b, x, y, kind)
    expect(allocatePower(a)).toEqual(allocatePower(b))
    expect(network(a, 12, 11)).toBe(410)
    const cached = a.power
    allocatePower(a)
    expect(a.power).toBe(cached)
    removeBuilding(a, 12, 11)
    expect(allocatePower(a)).not.toBe(cached)
    expect(a.power?.networks[0].consumerIndices).toEqual([])
  })
  it('disconnects a generator when its last covering pole is removed', () => {
    const world = createUnlockedWorld()
    generatorAndPole(world)
    add(world, 10, 11, 'miner')
    allocatePower(world)
    expect(powerOverview(world).connectedKw).toBe(100)
    removeBuilding(world, 10, 10)
    allocatePower(world)
    expect(powerOverview(world)).toMatchObject({ installedKw: 100, connectedKw: 0, suppliedKw: 0, deficitKw: 30, networks: 0 })
    expect(electricalDetails(world, 11 * SIZE + 10).state).toBe('disconnected')
  })
  it('never treats spare capacity on an independent network as satisfying another network', () => {
    const world = createUnlockedWorld()
    generatorAndPole(world)
    add(world, 30, 30, 'powerPole')
    add(world, 30, 31, 'miner')
    allocatePower(world)
    expect(powerOverview(world)).toMatchObject({ connectedKw: 100, suppliedKw: 0, requestedKw: 30, surplusKw: 100, deficitKw: 30, networks: 2 })
    expect(electricalDetails(world, 31 * SIZE + 30)).toMatchObject({ networkId: 1230, state: 'no-generation' })
  })
})
describe('working demand and proportional allocation', () => {
  it('shares a 100 kW generator proportionally between two miners and a furnace', () => {
    const world = shortageWorld()
    const power = allocatePower(world)
    expect(GENERATOR_KW).toBe(100)
    expect(power.networks[0]).toMatchObject({ capacityKw: 100, requestedKw: 110, suppliedKw: 100 })
    for (const consumer of Object.values(power.consumers)) {
      expect(consumer.speedFraction).toBeCloseTo(100 / 110)
      expect(consumer.suppliedKw).toBeCloseTo(consumer.requestedKw * 100 / 110)
    }
    expect(Object.values(power.consumers).reduce((sum, c) => sum + c.suppliedKw, 0)).toBeCloseTo(100)
    expect(electricalDetails(world, 20 * SIZE + 19).state).toBe('reduced')
  })
  it('adds generator capacity without accelerating machines beyond 100%', () => {
    const world = shortageWorld()
    add(world, 21, 18, 'generator')
    allocatePower(world)
    expect(powerOverview(world)).toMatchObject({ connectedKw: 200, requestedKw: 110, suppliedKw: 110, surplusKw: 90 })
    for (const consumer of Object.values(world.power!.consumers)) expect(consumer.speedFraction).toBe(1)
  })
  it('releases demand when a miner buffer or furnace output is blocked', () => {
    const world = shortageWorld()
    miner(world, 19, 20).item = 'iron'
    furnace(world, 20, 21).output.ironPlate = 2
    allocatePower(world)
    expect(powerOverview(world)).toMatchObject({ requestedKw: 30, suppliedKw: 30 })
    expect(electricalDetails(world, 20 * SIZE + 19).state).toBe('idle')
    expect(workingDemand(furnace(world, 20, 21))).toBe(0)
    expect(workingDemand(miner(world, 21, 20))).toBe(30)
    furnace(world, 20, 21).output.ironPlate = 0
    allocatePower(world)
    expect(powerOverview(world).requestedKw).toBe(80)
  })
  it('does not request furnace power when inputs are missing, but paused jobs still request it', () => {
    const world = shortageWorld(), f = furnace(world, 20, 21)
    f.input.iron = 0
    allocatePower(world)
    expect(workingDemand(f)).toBe(0)
    f.input.iron = 1
    advanceWorld(world, 50)
    expect(f.job).not.toBe(null)
    removeBuilding(world, 20, 18)
    allocatePower(world)
    expect(workingDemand(f)).toBe(50)
    expect(electricalDetails(world, 21 * SIZE + 20).state).toBe('no-generation')
  })
})
describe('power-scaled production', () => {
  it('starts unpowered, retains partial mining progress during outage, and resumes without catch-up', () => {
    const world = createUnlockedWorld()
    add(world, 10, 11, 'miner')
    advanceWorld(world, 10000)
    expect(miner(world, 10, 11).elapsed).toBe(0)
    expect(world.mined.iron).toBe(0)
    generatorAndPole(world)
    advanceWorld(world, 450)
    expect(miner(world, 10, 11).elapsed).toBe(450)
    removeBuilding(world, 10, 9)
    advanceWorld(world, 10000)
    expect(miner(world, 10, 11).elapsed).toBe(450)
    add(world, 10, 9, 'generator')
    advanceWorld(world, 550)
    expect(world.mined.iron).toBe(1)
    expect(miner(world, 10, 11).elapsed).toBe(0)
  })
  it('scales mining and smelting progress by the same supply fraction', () => {
    const world = shortageWorld()
    advanceWorld(world, 50) // start the furnace job at zero elapsed time
    expect(miner(world, 19, 20).elapsed).toBeCloseTo(50 * 100 / 110)
    expect(furnace(world, 20, 21).job?.elapsedMs).toBe(0)
    advanceWorld(world, 500)
    expect(miner(world, 19, 20).elapsed).toBeCloseTo(550 * 100 / 110)
    expect(furnace(world, 20, 21).job?.elapsedMs).toBeCloseTo(500 * 100 / 110)
  })
  it('retains furnace inputs, committed ingredients, reserved output and progress during outages', () => {
    const world = createUnlockedWorld()
    generatorAndPole(world)
    add(world, 10, 11, 'furnace')
    const f = furnace(world, 10, 11)
    f.input.iron = 2
    f.output.ironPlate = 1
    advanceWorld(world, 1050)
    const before = structuredClone(f)
    expect(f.job?.elapsedMs).toBe(1000)
    expect(f.job?.outputs.ironPlate).toBe(1)
    removeBuilding(world, 10, 9)
    advanceWorld(world, 10000)
    expect(f).toEqual(before)
    expect(world.produced.ironPlate).toBe(0)
    add(world, 10, 9, 'generator')
    advanceWorld(world, 999)
    expect(world.produced.ironPlate).toBe(0)
    advanceWorld(world, 1)
    expect(world.produced.ironPlate).toBe(1)
    expect(f.output.ironPlate).toBe(2)
    expect(f.input.iron).toBe(1)
    expect(f.job).toBe(null)
  })
  it('does not commit new furnace inputs without power, and leaves buffered transport operational', () => {
    const world = createUnlockedWorld()
    add(world, 10, 11, 'furnace')
    const f = furnace(world, 10, 11)
    f.input.iron = 2
    f.output.ironPlate = 1
    add(world, 11, 11, 'belt')
    add(world, 12, 11, 'storage')
    advanceWorld(world, 1000)
    expect(f.job).toBe(null)
    expect(f.input.iron).toBe(2)
    expect(f.output.ironPlate).toBe(0)
    const chest = buildingAt(world, 12, 11)
    expect(chest?.kind === 'storage' && chest.inventory.ironPlate).toBe(1)
    expect(world.produced.ironPlate).toBe(0)
  })
  it('preserves all physical items and reservations through generator and pole removal/replacement', () => {
    const world = poweredChain()
    for (let tick = 0; tick < 1000; tick++) {
      if (tick === 100 || tick === 500) removeBuilding(world, 21, 18)
      if (tick === 250 || tick === 600) add(world, 21, 18, 'generator')
      if (tick === 700) removeBuilding(world, 21, 19)
      if (tick === 800) add(world, 21, 19, 'powerPole')
      advanceWorld(world, 50)
      expect(accounted(world)).toBe(world.mined.iron)
      const f = furnace(world, 22, 20)
      expect(inventoryTotal(f.input)).toBeLessThanOrEqual(2)
      expect(inventoryTotal(f.output) + (f.job ? inventoryTotal(f.job.outputs) : 0)).toBeLessThanOrEqual(2)
    }
    expect(world.produced.ironPlate).toBeGreaterThan(5)
  })
  it('is deterministic across large, irregular and 60 FPS time partitions under shortages', () => {
    const a = shortageWorld(), b = shortageWorld(), c = shortageWorld()
    advanceWorld(a, 30000)
    for (let i = 0; i < 300; i++) { advanceWorld(b, 33); advanceWorld(b, 67) }
    for (let i = 0; i < 1800; i++) advanceWorld(c, 1000 / 60)
    expect(b).toEqual(a)
    expect(c.buildings).toEqual(a.buildings)
    expect(c.power).toEqual(a.power)
    expect(c.mined.iron).toBe(a.mined.iron)
    expect(c.produced.ironPlate).toBe(a.produced.ironPlate)
  })
})
describe('power inspection and removal', () => {
  it('explains unpowered/reduced machines and identifies assigned networks', () => {
    const world = shortageWorld()
    allocatePower(world)
    expect(inspectBuilding(world, 20 * SIZE + 19)).toMatchObject({ kind: 'miner', electrical: { state: 'reduced', networkId: 780, requirementKw: 30 } })
    expect(inspectBuilding(world, 19 * SIZE + 20)).toMatchObject({ kind: 'powerPole', coveredMachines: 3, coverageRadius: 3 })
    expect(inspectBuilding(world, 18 * SIZE + 20)).toMatchObject({ kind: 'generator', capacityKw: 100, actualKw: 100 })
    removeBuilding(world, 20, 18)
    allocatePower(world)
    expect(inspectBuilding(world, 20 * SIZE + 19)).toMatchObject({ electrical: { state: 'no-generation', networkId: 780 } })
    removeBuilding(world, 20, 19)
    allocatePower(world)
    expect(inspectBuilding(world, 20 * SIZE + 19)).toMatchObject({ electrical: { state: 'disconnected', networkId: null } })
  })
  it('discards an occupied furnace on removal, retaining lifetime production counters', () => {
    const world = poweredChain()
    advanceWorld(world, 10000)
    const ore = world.mined.iron, plates = world.produced.ironPlate
    const f = furnace(world, 22, 20)
    expect(f.job || f.input.iron || f.output.ironPlate).toBeTruthy()
    removeBuilding(world, 22, 20)
    allocatePower(world)
    expect(inspectBuilding(world, 20 * SIZE + 22)).toBe(null)
    expect(world.power?.consumers[20 * SIZE + 22]).toBe(undefined)
    expect(world.mined.iron).toBe(ore)
    expect(world.produced.ironPlate).toBe(plates)
  })
  it('keeps straight and curved belt movement independent of generation', () => {
    const world = createUnlockedWorld()
    add(world, 1, 1, 'belt')
    add(world, 2, 1, 'belt', 'south')
    add(world, 2, 2, 'storage')
    belt(world, 1, 1).item = 'ironPlate'
    advanceWorld(world, 1050)
    const chest = buildingAt(world, 2, 2)
    expect(chest?.kind === 'storage' && chest.inventory.ironPlate).toBe(1)
    expect(powerOverview(world).requestedKw).toBe(0)
  })
})
