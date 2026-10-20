import { changeCraftingRecipe } from './crafting'
import { describe, expect, it } from 'vitest'
import { clickPete, createPete, PUMPKIN_FLIGHT_MS, sabotageRemaining } from './pete'
import { allocatePower, workingDemand } from './power'
import { advanceWorld } from './step'
import { createWorld, placeBuilding, removeBuilding, SIZE } from './world'
import type { CraftingMachine, Miner, World } from './world'
import { poweredWorld } from './testFixtures'
import { deliverItem } from './transport'
import { inspectBuilding } from './inspection'

function movePete(world: World, x: number, y: number) {
  Object.assign(world.pete, { x, y, tile: y * SIZE + x, next: null, travelMs: 0 })
}
function targetWorld(kind: 'miner' | 'furnace' | 'assembler' = 'furnace') {
  const world = poweredWorld(() => .5)
  // Keep the generator outside sabotage range when testing a specific machine.
  removeBuilding(world, 21, 18); placeBuilding(world, 23, 18, 'generator', 'east')
  placeBuilding(world, 22, 20, kind, 'east')
  // An enclosed Pete can still throw, and recovers movement when the enclosure opens.
  placeBuilding(world, 20, 20, 'storage', 'east')
  placeBuilding(world, 21, 21, 'storage', 'east')
  movePete(world, 21, 20)
  world.pete.cooldownMs = 0
  return { world, machine: world.buildings[822]! }
}
function hit(world: World) {
  advanceWorld(world, 50)
  expect(world.pete.pumpkin).not.toBe(null)
  advanceWorld(world, PUMPKIN_FLIGHT_MS)
  expect(world.pete.pumpkin).toBe(null)
}
describe('Pete deterministic movement and fright', () => {
  it('spawns exactly one named NPC, with deterministic independent seeded decisions', () => {
    const world = createWorld(() => .5)
    expect(world.pete).toEqual(createPete())
    expect(world.buildings.every(b => b === null)).toBe(true)
    expect(world.pete.mode).toBe('WANDERING')
  })
  it('matches time partitions and avoids buildings and boundaries across many decisions', () => {
    const a = createWorld(() => .5)
    for (let y = 0; y < SIZE; y++) if (y !== 21) placeBuilding(a, 19, y, 'storage', 'east')
    const b = structuredClone(a)
    advanceWorld(a, 120000)
    for (let i = 0; i < 2400; i++) {
      advanceWorld(b, 50)
      expect(b.pete.x).toBeGreaterThanOrEqual(0); expect(b.pete.x).toBeLessThan(SIZE)
      expect(b.pete.y).toBeGreaterThanOrEqual(0); expect(b.pete.y).toBeLessThan(SIZE)
      expect(b.buildings[b.pete.tile]).toBe(null)
      if (b.pete.next !== null) expect(b.buildings[b.pete.next]).toBe(null)
    }
    expect(a).toEqual(b)
  })
  it('walks 30% faster and preserves the 4.5× fleeing multiplier', () => {
    const walking = createWorld(() => .5), fleeing = structuredClone(walking)
    clickPete(fleeing, fleeing.pete)
    advanceWorld(walking, 500); advanceWorld(fleeing, 500)
    expect(Math.hypot(walking.pete.x - 17, walking.pete.y - 23)).toBeCloseTo(.65)
    expect(Math.hypot(fleeing.pete.x - 17, fleeing.pete.y - 23)).toBeCloseTo(2.925)
  })
  it('preserves position when frightened halfway through a walking segment', () => {
    const world = createWorld(() => .5)
    advanceWorld(world, 500)
    const { x, y } = world.pete
    clickPete(world, world.pete)
    expect(world.pete.x).toBe(x); expect(world.pete.y).toBe(y)
    advanceWorld(world, 50)
    expect(Math.hypot(world.pete.x - x, world.pete.y - y)).toBeCloseTo(.2925)
  })
  it('chooses a reachable corner, reroutes on topology changes, and cries for exactly ten seconds', () => {
    const world = createWorld(() => .5)
    // Make the NW corner unreachable, retaining other reachable corners.
    placeBuilding(world, 1, 0, 'storage', 'east'); placeBuilding(world, 0, 1, 'storage', 'east')
    clickPete(world, world.pete)
    advanceWorld(world, 50)
    expect(world.pete.escape).toBe(SIZE - 1)
    const future = world.pete.path[2]
    placeBuilding(world, future % SIZE, Math.floor(future / SIZE), 'storage', 'east')
    for (let i = 0; i < 2000 && world.pete.mode !== 'CRYING'; i++) advanceWorld(world, 50)
    expect(world.pete.mode).toBe('CRYING')
    expect([SIZE - 1, SIZE * SIZE - 1, SIZE * (SIZE - 1)]).toContain(world.pete.tile)
    expect(world.pete.cryingMs).toBe(10000)
    advanceWorld(world, 9950); expect(world.pete.mode).toBe('CRYING'); expect(world.pete.cryingMs).toBe(50)
    advanceWorld(world, 50); expect(world.pete.mode).toBe('WANDERING')
  })
  it('uses a safe near-corner fallback when enclosed and resumes after obstacles are removed', () => {
    const world = createWorld(() => .5)
    for (const [x, y] of [[17, 22], [18, 23], [17, 24], [16, 23]]) placeBuilding(world, x, y, 'storage', 'east')
    clickPete(world, world.pete); advanceWorld(world, 50)
    expect(world.pete.mode).toBe('CRYING'); expect(world.pete.escape).toBe(world.pete.tile)
    removeBuilding(world, 17, 22); advanceWorld(world, 11000)
    expect(world.pete.mode).toBe('WANDERING'); expect(world.pete.y).toBeLessThan(23)
  })
  it.each(['FLEEING', 'CRYING'] as const)('replays every web in %s without changing behavior or timers', mode => {
    const world = createWorld(() => .5)
    clickPete(world, world.pete)
    if (mode === 'CRYING') {
      for (let i = 0; i < 1000 && world.pete.mode !== 'CRYING'; i++) advanceWorld(world, 50)
    }
    expect(world.pete.mode).toBe(mode)
    for (let i = 0; i < 3; i++) {
      advanceWorld(world, 100)
      const before = structuredClone(world.pete)
      expect(before.webMs).toBeLessThan(700)
      expect(clickPete(world, world.pete)).toBe(true)
      expect(world.pete).toEqual({ ...before, webMs: 700 })
    }
  })
  it('does not extend crying or sabotage cooldown through repeated web hits', () => {
    const { world } = targetWorld()
    world.pete.cooldownMs = 12345
    clickPete(world, world.pete); advanceWorld(world, 50)
    expect(world.pete.mode).toBe('CRYING')
    for (let i = 0; i < 99; i++) { advanceWorld(world, 100); clickPete(world, world.pete) }
    expect(world.pete.cryingMs).toBe(100)
    advanceWorld(world, 100)
    expect(world.pete.mode).toBe('WANDERING')
    expect(world.pete.cooldownMs).toBe(2295)
    expect(world.pete.pumpkin).toBe(null)
  })
  it('keeps faster fleeing deterministic across uneven time partitions and repeated clicks', () => {
    const a = createWorld(() => .5), b = structuredClone(a)
    clickPete(a, a.pete); clickPete(b, b.pete)
    for (let i = 0; i < 12; i++) {
      advanceWorld(a, 500)
      for (const delta of [17, 33, 150, 300]) advanceWorld(b, delta)
      clickPete(a, a.pete); clickPete(b, b.pete)
    }
    expect(a).toEqual(b)
  })
  it('reserves occupied movement tiles against construction and rejects clicks outside the goblin', () => {
    const world = createWorld(() => .5)
    expect(clickPete(world, { x: 0, y: 0 })).toBe(false)
    expect(placeBuilding(world, 17, 23, 'storage', 'east')).toBe(false)
    advanceWorld(world, 50)
    const next = world.pete.next!
    expect(placeBuilding(world, next % SIZE, Math.floor(next / SIZE), 'storage', 'east')).toBe(false)
  })
})
describe('Pumpkin sabotage and production invariants', () => {
  it.each(['miner', 'furnace', 'assembler'] as const)('hits %s only after the pumpkin flight, for exactly ten seconds', kind => {
    const { world, machine } = targetWorld(kind)
    advanceWorld(world, 50)
    expect(sabotageRemaining(world, machine)).toBe(0)
    advanceWorld(world, PUMPKIN_FLIGHT_MS - 50)
    expect(world.pete.pumpkin).not.toBe(null); expect(sabotageRemaining(world, machine)).toBe(0)
    advanceWorld(world, 50)
    expect(sabotageRemaining(world, machine)).toBe(10000)
    expect(workingDemand(machine, world)).toBe(0)
    expect(world.power!.consumers[822]).toMatchObject({ requestedKw: 0, suppliedKw: 0, speedFraction: 0 })
    expect(inspectBuilding(world, 822)).toMatchObject({ electrical: { state: 'sabotaged', sabotageRemainingMs: 10000 } })
    advanceWorld(world, 9950); expect(sabotageRemaining(world, machine)).toBe(50)
    advanceWorld(world, 50); expect(sabotageRemaining(world, machine)).toBe(0)
  })
  it('does not attack non-production, distant, or already-sabotaged buildings', () => {
    const world = createWorld(() => .5)
    movePete(world, 21, 20); world.pete.cooldownMs = 0
    for (const [x, y, kind] of [[20, 20, 'belt'], [21, 19, 'generator'], [21, 21, 'powerPole'], [22, 20, 'storage'], [25, 20, 'furnace']] as const) placeBuilding(world, x, y, kind, 'east')
    advanceWorld(world, 500); expect(world.pete.pumpkin).toBe(null)
    removeBuilding(world, 22, 20); placeBuilding(world, 22, 20, 'assembler', 'east')
    world.buildings[822]!.sabotageUntilMs = world.timeMs + 10000
    advanceWorld(world, 500); expect(world.pete.pumpkin).toBe(null)
  })
  it('spaces eligible attacks by two seconds without extending existing disables', () => {
    const { world, machine } = targetWorld()
    hit(world)
    const firstEnd = machine.sabotageUntilMs
    removeBuilding(world, 20, 20); placeBuilding(world, 20, 20, 'furnace', 'east')
    advanceWorld(world, 1550); expect(world.pete.pumpkin).toBe(null)
    advanceWorld(world, 50); expect(world.pete.pumpkin).not.toBe(null)
    advanceWorld(world, 400)
    expect(machine.sabotageUntilMs).toBe(firstEnd)
    expect(sabotageRemaining(world, world.buildings[820]!)).toBe(10000)
    clickPete(world, world.pete); advanceWorld(world, 50)
    world.pete.cooldownMs = 0
    advanceWorld(world, 5000); expect(world.pete.pumpkin).toBe(null)
  })
  it.each(['furnace', 'assembler'] as const)('preserves %s jobs, reservations, recipes and ingredients, then resumes exactly', kind => {
    const { world, machine } = targetWorld(kind)
    world.pete.cooldownMs = 10000
    const crafting = machine as CraftingMachine
    if (kind === 'furnace') deliverItem(crafting, 'iron', 'east')
    else { changeCraftingRecipe(world, machine.x, machine.y, 'ironGear'); for (let i = 0; i < 2; i++) deliverItem(crafting, 'ironPlate', 'east') }
    advanceWorld(world, 500)
    expect(crafting.job).not.toBe(null)
    world.pete.cooldownMs = 0; hit(world)
    movePete(world, 0, 39) // Isolate recovery from a second independently eligible attack.
    const paused = structuredClone(crafting), produced = structuredClone(world.produced)
    advanceWorld(world, 9950)
    expect(crafting).toEqual(paused); expect(world.produced).toEqual(produced)
    advanceWorld(world, 50)
    expect(crafting.job!.elapsedMs).toBe(paused.job!.elapsedMs + 50)
    advanceWorld(world, 2000)
    expect(crafting.job).toBe(null)
    expect(crafting.recipeId).toBe(paused.recipeId); expect(crafting.recipeLocked).toBe(true)
    expect(crafting.output[kind === 'furnace' ? 'ironPlate' : 'ironGear']).toBe(1)
    expect(crafting.input[kind === 'furnace' ? 'iron' : 'ironPlate']).toBe(0)
  })
  it('preserves miner progress and a buffered item while transport continues', () => {
    const { world, machine } = targetWorld('miner')
    hit(world)
    movePete(world, 0, 39)
    const miner = machine as Miner, elapsed = miner.elapsed
    advanceWorld(world, 9950); expect(miner.elapsed).toBe(elapsed)
    advanceWorld(world, 50); expect(miner.elapsed).toBe(elapsed + 50)
    miner.item = 'iron'
    placeBuilding(world, 23, 20, 'belt', 'east')
    miner.sabotageUntilMs = world.timeMs + 10000
    advanceWorld(world, 50)
    expect(miner.item).toBe(null); expect(world.buildings[823]).toMatchObject({ item: 'iron' })
    expect(allocatePower(world).consumers[822].requestedKw).toBe(0)
  })
  it('keeps attacks, pauses and recovery deterministic across uneven frame partitions', () => {
    const { world: a, machine } = targetWorld()
    deliverItem(machine, 'iron', 'east'); deliverItem(machine, 'iron', 'east')
    const b = structuredClone(a)
    advanceWorld(a, 60000)
    for (let i = 0; i < 60; i++) for (const delta of [17, 33, 150, 800]) advanceWorld(b, delta)
    expect(a).toEqual(b)
  })
  it('cancels a projectile whose target was deleted, without hitting a replacement', () => {
    const { world, machine } = targetWorld()
    advanceWorld(world, 50)
    removeBuilding(world, 22, 20); placeBuilding(world, 22, 20, 'furnace', 'east')
    advanceWorld(world, 400)
    expect(world.pete.pumpkin).toBe(null)
    expect(machine.sabotageUntilMs).toBeUndefined()
    expect(sabotageRemaining(world, world.buildings[822]!)).toBe(0)
  })
  it('removes active sabotage with the deleted building and keeps the NPC alive', () => {
    const { world, machine } = targetWorld()
    hit(world); expect(sabotageRemaining(world, machine)).toBe(10000)
    removeBuilding(world, 22, 20)
    expect(world.buildings[822]).toBe(null); expect(inspectBuilding(world, 822)).toBe(null)
    advanceWorld(world, 2000)
    expect(world.pete).toBeDefined()
    placeBuilding(world, 22, 20, 'furnace', 'east')
    expect(sabotageRemaining(world, world.buildings[822]!)).toBe(0)
  })
})
