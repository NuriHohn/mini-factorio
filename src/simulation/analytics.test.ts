import { describe, expect, it } from 'vitest'
import { analyticsSnapshot, pruneAnalytics, recordProduction } from './analytics'
import { changeCraftingRecipe } from './crafting'
import { changeFurnaceRecipe } from './smelting'
import { advanceWorld } from './step'
import { poweredWorld } from './testFixtures'
import { buildingAt, createWorld, placeBuilding, removeBuilding, SIZE } from './world'
import type { Assembler, Furnace, Miner, World } from './world'

function quiet(world: World) { world.pete.mode = 'CRYING'; world.pete.cryingMs = 10000; world.pete.cooldownMs = 30000 }
function setup() {
  const world = poweredWorld(() => .5); quiet(world)
  placeBuilding(world, 20, 20, 'assembler', 'east')
  const machine = buildingAt(world, 20, 20) as Assembler
  changeCraftingRecipe(world, 20, 20, 'ironGear')
  return { world, machine }
}
describe('production accounting and rolling history', () => {
  it('counts mining, committed recipe ingredients and completion quantities once, excluding transfers and removal', () => {
    const { world, machine } = setup()
    placeBuilding(world, 22, 20, 'miner', 'east')
    machine.input.ironPlate = 2
    advanceWorld(world, 50)
    expect(analyticsSnapshot(world).consumed.ironPlate).toBe(2)
    expect(analyticsSnapshot(world).produced.ironGear).toBe(0)
    advanceWorld(world, 2000)
    const snapshot = analyticsSnapshot(world)
    expect(snapshot.produced.ironGear).toBe(1)
    expect(snapshot.produced.iron).toBe(world.mined.iron)
    expect(snapshot.produced.iron).toBe(1) // blocked miner retains its one physical item
    placeBuilding(world, 21, 20, 'belt', 'east'); placeBuilding(world, 22, 21, 'storage', 'east')
    advanceWorld(world, 50)
    expect(analyticsSnapshot(world).produced).toEqual(snapshot.produced)
    removeBuilding(world, 20, 20); removeBuilding(world, 22, 20)
    expect(analyticsSnapshot(world).produced).toEqual(snapshot.produced)
    expect(world.produced.ironGear).toBe(1)
  })
  it('balances the real miner → belt → furnace → belt → storage chain without counting relocation', () => {
    const world = poweredWorld(() => .5); quiet(world)
    for (const [x, kind] of [[20, 'miner'], [21, 'belt'], [22, 'furnace'], [23, 'belt'], [24, 'storage']] as const) placeBuilding(world, x, 20, kind, 'east')
    advanceWorld(world, 9000)
    const snapshot = analyticsSnapshot(world)
    let oreInBuffers = 0, platesInBuffers = 0
    for (const b of world.buildings) {
      if (b?.kind === 'miner' || b?.kind === 'belt') { oreInBuffers += Number(b.item === 'iron'); platesInBuffers += Number(b.item === 'ironPlate') }
      if (b?.kind === 'furnace') { oreInBuffers += b.input.iron; platesInBuffers += b.output.ironPlate }
      if (b?.kind === 'storage') { oreInBuffers += b.inventory.iron; platesInBuffers += b.inventory.ironPlate }
    }
    expect(snapshot.produced.ironPlate).toBeGreaterThan(0)
    expect(snapshot.produced.iron - snapshot.consumed.iron).toBe(oreInBuffers)
    expect(snapshot.produced.ironPlate).toBe(platesInBuffers)
    expect(snapshot.consumed.ironPlate).toBe(0)
    expect(snapshot.consumed.iron).toBe(snapshot.produced.ironPlate + Number((buildingAt(world, 22, 20) as Furnace).job !== null))
  })
  it('bounds dense rolling samples and minute buckets through long production runs', () => {
    const world = createWorld(() => .5)
    for (let n = 0; n < 15000; n++) {
      world.timeMs += 50
      recordProduction(world, { iron: 1 }, { copper: 1 })
      pruneAnalytics(world)
    }
    expect(world.analytics.samples).toHaveLength(1200)
    expect(world.analytics.buckets.length).toBeLessThanOrEqual(11)
    expect(analyticsSnapshot(world)).toMatchObject({ produced: { iron: 1200 }, consumed: { copper: 1200 } })
  })
  it('counts multi-output cable batches and does not count reserved products as creation', () => {
    const { world, machine } = setup()
    changeCraftingRecipe(world, 20, 20, 'copperCable'); machine.input.copperPlate = 1
    advanceWorld(world, 50)
    expect(analyticsSnapshot(world)).toMatchObject({ consumed: { copperPlate: 1 }, produced: { copperCable: 0 } })
    advanceWorld(world, 2000)
    expect(analyticsSnapshot(world)).toMatchObject({ produced: { copperCable: 2 }, totalPerMinute: 2 })
    advanceWorld(world, 1000)
    expect(analyticsSnapshot(world).produced.copperCable).toBe(2)
  })
  it('uses (now - 60s, now] exactly and retains sparse 60-second buckets across 10 minutes', () => {
    const world = createWorld(() => .5)
    advanceWorld(world, 50); recordProduction(world, { iron: 2 }, { copper: 1 })
    advanceWorld(world, 59950)
    expect(analyticsSnapshot(world).produced.iron).toBe(2)
    recordProduction(world, { copperPlate: 3 })
    advanceWorld(world, 50)
    expect(analyticsSnapshot(world)).toMatchObject({ produced: { iron: 0, copperPlate: 3 }, consumed: { copper: 0 } })
    expect(world.analytics.buckets.map(b => b.startMs)).toEqual([0, 60000])
    advanceWorld(world, 539950)
    expect(world.timeMs).toBe(600000)
    expect(world.analytics.buckets.map(b => b.startMs)).toEqual([0, 60000])
    advanceWorld(world, 120000)
    expect(world.analytics.buckets).toEqual([])
    expect(world.analytics.samples).toEqual([])
  })
  it('chooses recent productive types deterministically and merges simultaneous creation/consumption', () => {
    const world = createWorld(() => .5)
    advanceWorld(world, 50); recordProduction(world, { copper: 1, iron: 1 })
    advanceWorld(world, 50); recordProduction(world, { ironPlate: 1 }); recordProduction(world, { copperPlate: 2 }, { iron: 1 })
    expect(world.analytics.samples).toHaveLength(2)
    expect(analyticsSnapshot(world).recentItems).toEqual(['ironPlate', 'copperPlate', 'iron'])
    expect(analyticsSnapshot(world).consumed.iron).toBe(1)
  })
})
describe('configured utilization and diagnostic priority', () => {
  it('includes idle configured machines as zero but excludes undecided furnaces and unconfigured assemblers', () => {
    const { world, machine } = setup()
    placeBuilding(world, 22, 20, 'assembler', 'east'); placeBuilding(world, 23, 20, 'furnace', 'east')
    expect(analyticsSnapshot(world).configuredMachines).toBe(1)
    machine.input.ironPlate = 2
    advanceWorld(world, 50); advanceWorld(world, 1000)
    expect(analyticsSnapshot(world).utilization).toBeCloseTo(1000 / 1050)
    changeCraftingRecipe(world, 22, 20, 'ironGear'); advanceWorld(world, 50)
    expect(analyticsSnapshot(world).configuredMachines).toBe(2)
    expect(analyticsSnapshot(world).utilization).toBeCloseTo(1050 / 1100 / 2)
  })
  it('counts partially powered progress as active time; outages preserve cumulative productive time', () => {
    const { world, machine } = setup()
    placeBuilding(world, 22, 20, 'assembler', 'east'); changeCraftingRecipe(world, 22, 20, 'ironGear')
    const other = buildingAt(world, 22, 20) as Assembler
    machine.input.ironPlate = 2; other.input.ironPlate = 2
    advanceWorld(world, 50); advanceWorld(world, 1000)
    expect(machine.job?.elapsedMs).toBeCloseTo(1000 * 5 / 6)
    expect(world.analytics.machines[820].productiveMs).toBe(1000)
    removeBuilding(world, 21, 18); advanceWorld(world, 1000)
    expect(world.analytics.machines[820].productiveMs).toBe(1000)
    expect(analyticsSnapshot(world).utilization).toBeCloseTo(1000 / 2050)
  })
  it('reports missing input at exactly 10 continuous seconds and removes it on resolution', () => {
    const { world, machine } = setup()
    advanceWorld(world, 9950); expect(analyticsSnapshot(world).problems).toEqual([])
    advanceWorld(world, 50); expect(analyticsSnapshot(world).problems[0]).toMatchObject({ cause: 'Missing Input', durationMs: 10000 })
    machine.input.ironPlate = 2; advanceWorld(world, 50)
    expect(analyticsSnapshot(world).problems).toEqual([])
    expect(machine.job).not.toBeNull()
  })
  it('prioritizes sabotage then absent power then output blocking, resetting every cause timer', () => {
    const { world, machine } = setup()
    machine.output.ironGear = 4
    removeBuilding(world, 21, 18)
    advanceWorld(world, 10000)
    expect(analyticsSnapshot(world).problems[0]?.cause).toBe('No Power')
    machine.sabotageUntilMs = world.timeMs + 10000
    advanceWorld(world, 50)
    expect(analyticsSnapshot(world).problems).toEqual([])
    expect(world.analytics.machines[820]).toMatchObject({ cause: 'Sabotaged', sinceMs: 10000 })
    // Refresh the test fixture disable once to observe the threshold; real Pete never refreshes it.
    machine.sabotageUntilMs += 50
    advanceWorld(world, 9950)
    expect(analyticsSnapshot(world).problems[0]?.cause).toBe('Sabotaged')
    advanceWorld(world, 50)
    expect(analyticsSnapshot(world).problems).toEqual([])
    expect(world.analytics.machines[820].cause).toBe('No Power')
    placeBuilding(world, 21, 18, 'generator', 'east'); advanceWorld(world, 50)
    expect(world.analytics.machines[820].cause).toBe('Output Blocked')
    advanceWorld(world, 9950)
    expect(analyticsSnapshot(world).problems[0]?.cause).toBe('Output Blocked')
    machine.output.ironGear = 0; advanceWorld(world, 50)
    expect(world.analytics.machines[820].cause).toBe('Missing Input')
    expect(analyticsSnapshot(world).problems).toEqual([])
  })
  it('detects blocked miners, sorts longest first, and clears diagnostics on removal/replacement', () => {
    const { world } = setup()
    placeBuilding(world, 22, 20, 'miner', 'east')
    const miner = buildingAt(world, 22, 20) as Miner
    miner.item = 'iron'
    advanceWorld(world, 1000)
    removeBuilding(world, 20, 20); placeBuilding(world, 20, 20, 'assembler', 'east'); changeCraftingRecipe(world, 20, 20, 'ironGear')
    advanceWorld(world, 10000)
    expect(analyticsSnapshot(world).problems.map(p => p.index)).toEqual([822, 820])
    removeBuilding(world, 22, 20)
    expect(analyticsSnapshot(world).problems.map(p => p.index)).toEqual([820])
    expect(world.analytics.machines[822]).toBeUndefined()
  })
  it('resets utilization and diagnostics on explicit task change, without resetting history', () => {
    const { world } = setup()
    advanceWorld(world, 10000)
    expect(analyticsSnapshot(world).problems).toHaveLength(1)
    changeCraftingRecipe(world, 20, 20, 'copperCable')
    expect(analyticsSnapshot(world)).toMatchObject({ utilization: 0, problems: [] })
  })
  it('is independent of elapsed-time partitioning and does not advance while paused', () => {
    function run(parts: number[]) {
      const { world, machine } = setup(); machine.input.ironPlate = 4
      for (const ms of parts) advanceWorld(world, ms)
      return world
    }
    const whole = run([12000]), partitioned = run(Array(1200).fill(10))
    expect(partitioned).toEqual(whole)
    const before = structuredClone(whole.analytics)
    for (const delta of [0, -1, NaN]) advanceWorld(whole, delta)
    expect(whole.analytics).toEqual(before)
  })
  it('includes a furnace only after its input has uniquely selected a recipe', () => {
    const world = poweredWorld(() => .5)
    placeBuilding(world, 20, 20, 'furnace', 'east')
    expect(analyticsSnapshot(world).configuredMachines).toBe(0)
    changeFurnaceRecipe(world, 20, 20, 'ironSmelting')
    const furnace = buildingAt(world, 20, 20) as Furnace; furnace.input.iron = 1
    advanceWorld(world, 50)
    expect(analyticsSnapshot(world).configuredMachines).toBe(1)
    expect(world.analytics.machines[20 * SIZE + 20].task).toBe('ironSmelting')
  })
})
