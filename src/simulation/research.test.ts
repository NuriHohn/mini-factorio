import { describe, expect, it } from 'vitest'
import { createWorld, placeBuilding, placementError, removeBuilding, SIZE } from './world'
import type { CraftingMachine, Miner, World } from './world'
import { allocatePower } from './power'
import { advanceWorld } from './step'
import { changeCraftingRecipe } from './crafting'
import { changeFurnaceRecipe } from './smelting'
import { createResearch, RP_UNITS, SPRINT11_TECHNOLOGIES } from './research'
import { purchaseTechnology, researchBalance, researchRate } from '../factory/research'

function machineWorld(kind: 'miner' | 'furnace' | 'assembler') {
  const world = createWorld(() => .5)
  world.research = createResearch(true)
  // Keep Pete remote and stationary without bypassing normal production allocation.
  Object.assign(world.pete, { x: 0, y: 0, tile: 0 })
  placeBuilding(world, 1, 0, 'storage', 'east'); placeBuilding(world, 0, 1, 'storage', 'east')
  placeBuilding(world, 21, 18, 'generator', 'east')
  placeBuilding(world, 21, 19, 'powerPole', 'east')
  placeBuilding(world, 20, 20, kind, 'east')
  if (kind === 'furnace') changeFurnaceRecipe(world, 20, 20, 'ironSmelting')
  if (kind === 'assembler') changeCraftingRecipe(world, 20, 20, 'ironGear')
  return world
}
function feed(world: World) {
  const machine = world.buildings[820]!
  if (machine.kind === 'miner') machine.item = null
  else if (machine.kind === 'furnace' || machine.kind === 'assembler') {
    machine.input.iron = machine.kind === 'furnace' ? 2 : 0
    machine.input.ironPlate = machine.kind === 'assembler' ? 4 : 0
    machine.output.ironPlate = 0; machine.output.ironGear = 0
  }
}
function run(world: World, ms: number) {
  for (let i = 0; i < ms / 50; i++) { feed(world); advanceWorld(world, 50) }
}
describe('research currency and technology commands', () => {
  it('starts with zero RP and only Basic Industry', () => {
    const world = createWorld(() => .5)
    expect(world.research).toEqual({ balanceUnits: '0', unlocked: ['basicIndustry'] })
    expect(researchRate(world)).toBe(0)
    for (const kind of ['miner', 'furnace', 'belt', 'storage', 'generator', 'powerPole'] as const) {
      const coordinate = kind === 'miner' ? 20 : 10
      expect(placeBuilding(world, coordinate, coordinate, kind, 'east')).toBe(true)
      removeBuilding(world, coordinate, coordinate)
    }
  })
  it.each(['inserter', 'assembler', 'splitter'] as const)('rejects locked %s at authoritative placement', kind => {
    const world = createWorld(() => .5)
    expect(placementError(world, 10, 10, kind)).toContain('Requires')
    expect(placeBuilding(world, 10, 10, kind, 'east')).toBe(false)
    expect(world.buildings[410]).toBeNull()
  })
  it('validates prerequisite, balance and duplicates atomically, retaining fractional RP', () => {
    const world = createWorld(() => .5)
    world.research.balanceUnits = (200n * RP_UNITS + 123n).toString()
    const before = structuredClone(world.research)
    expect(purchaseTechnology(world, 'logistics2')).toContain('Requires Logistics I')
    expect(world.research).toEqual(before)
    expect(purchaseTechnology(world, 'analytics1')).toContain('Requires Automation I')
    expect(purchaseTechnology(world, 'logistics1')).toBeNull()
    expect(BigInt(world.research.balanceUnits)).toBe(170n * RP_UNITS + 123n)
    expect(purchaseTechnology(world, 'logistics1')).toBe('Already researched.')
    expect(purchaseTechnology(world, 'logistics2')).toBeNull()
    expect(purchaseTechnology(world, 'automation1')).toBeNull()
    const insufficient = structuredClone(world.research)
    expect(purchaseTechnology(world, 'analytics1')).toContain('Insufficient')
    expect(world.research).toEqual(insufficient)
    expect(placeBuilding(world, 10, 10, 'assembler', 'east')).toBe(true)
    world.research.balanceUnits = (80n * RP_UNITS).toString()
    expect(purchaseTechnology(world, 'analytics1')).toBeNull()
    expect(world.research).toEqual({ balanceUnits: '0', unlocked: SPRINT11_TECHNOLOGIES })
  })
  it.each([['miner', 2], ['furnace', 5], ['assembler', 12]] as const)('awards %s at %i RP per productive minute', (kind, rate) => {
    const world = machineWorld(kind)
    if (kind !== 'miner') { feed(world); advanceWorld(world, 50) } // job start has no processing time
    run(world, 60000)
    expect(researchBalance(world.research)).toBe(rate)
    expect(world.analytics.samples.length).toBeGreaterThan(0)
  })
  it('does not earn during idle input, blocked output, power loss, sabotage or a paused clock', () => {
    for (const kind of ['miner', 'furnace', 'assembler'] as const) {
      const world = machineWorld(kind)
      if (kind === 'miner') (world.buildings[820] as Miner).item = 'iron'
      advanceWorld(world, 1000)
      expect(researchBalance(world.research)).toBe(0)
      feed(world); advanceWorld(world, 50)
      if (kind === 'miner') (world.buildings[820] as Miner).item = 'iron'
      else (world.buildings[820] as CraftingMachine).output[kind === 'furnace' ? 'ironPlate' : 'ironGear'] = kind === 'furnace' ? 2 : 4
      const blocked = world.research.balanceUnits
      advanceWorld(world, 1000)
      expect(world.research.balanceUnits).toBe(blocked)
      feed(world)
      const before = world.research.balanceUnits
      for (const delta of [0, -1, NaN]) advanceWorld(world, delta)
      allocatePower(world); allocatePower(world) // render/publication queries are read-only for RP
      expect(world.research.balanceUnits).toBe(before)
      removeBuilding(world, 21, 18); run(world, 1000)
      expect(world.research.balanceUnits).toBe(before)
      placeBuilding(world, 21, 18, 'generator', 'east')
      world.buildings[820]!.sabotageUntilMs = world.timeMs + 10000
      run(world, 1000)
      expect(world.research.balanceUnits).toBe(before)
      delete world.buildings[820]!.sabotageUntilMs
      run(world, 1000)
      expect(BigInt(world.research.balanceUnits)).toBeGreaterThan(BigInt(before))
      const earned = world.research.balanceUnits
      removeBuilding(world, 20, 20); advanceWorld(world, 1000)
      expect(world.research.balanceUnits).toBe(earned)
    }
  })
  it('scales fractional power and caps crafting at the actual remaining job time', () => {
    const world = machineWorld('assembler')
    feed(world); advanceWorld(world, 50)
    placeBuilding(world, 22, 20, 'assembler', 'east')
    changeCraftingRecipe(world, 22, 20, 'ironGear')
    const second = world.buildings[20 * SIZE + 22] as CraftingMachine
    second.input.ironPlate = 4
    advanceWorld(world, 50)
    expect(world.power!.consumers[820].speedFraction).toBeCloseTo(5 / 6)
    expect(researchBalance(world.research)).toBeCloseTo(12 * (50 * 5 / 6) / 60000, 9)
    second.input.ironPlate = 0; second.job = null
    const machine = world.buildings[820] as CraftingMachine
    machine.job!.elapsedMs = 1990
    world.research.balanceUnits = '0'
    advanceWorld(world, 50)
    expect(researchBalance(world.research)).toBe(.002) // 10 productive ms, not 50
  })
  it('carries fractional progress across steps without rounding bias over completed jobs', () => {
    const world = machineWorld('assembler')
    placeBuilding(world, 22, 20, 'assembler', 'east')
    changeCraftingRecipe(world, 22, 20, 'ironGear')
    const second = world.buildings[822] as CraftingMachine
    for (let i = 0; i < 400; i++) {
      feed(world); second.input.ironPlate = 4; second.output.ironGear = 0
      advanceWorld(world, 50)
    }
    const progressNs = [820, 822].reduce((sum, index) => sum + BigInt(Math.round((world.buildings[index] as CraftingMachine).job!.elapsedMs * 1_000_000)), 0n)
    const completedNs = BigInt(world.produced.ironGear) * 2_000_000_000n
    expect(BigInt(world.research.balanceUnits)).toBe((completedNs + progressNs) * 12n)
  })
  it('is independent of elapsed-time partitioning under fractional supply', () => {
    const a = machineWorld('miner')
    // Extra radars create 105 kW demand, a repeating fractional speed.
    for (const [x, y] of [[20, 19], [22, 19], [20, 18]]) placeBuilding(a, x, y, 'radar', 'east')
    placeBuilding(a, 22, 20, 'assembler', 'east')
    changeCraftingRecipe(a, 22, 20, 'ironGear')
    ;(a.buildings[822] as CraftingMachine).input.ironPlate = 4
    const b = structuredClone(a)
    advanceWorld(a, 1725)
    for (const delta of [17, 33, 125, 50, 1500]) advanceWorld(b, delta)
    expect(a.research).toEqual(b.research)
    expect(a.buildings).toEqual(b.buildings)
  })
  it('keeps already-existing locked buildings functioning', () => {
    const world = machineWorld('assembler')
    world.research = createResearch()
    feed(world); advanceWorld(world, 2050)
    expect(world.produced.ironGear).toBe(1)
    expect(researchBalance(world.research)).toBe(.4)
  })
})
