import { describe, expect, it } from 'vitest'
import { advanceSprinklers, sprinklerDetects, sprinklerPowered, SPRINKLER_KW, SPRINKLER_COOLDOWN_MS } from './sprinklers'
import { createWorld, placeBuilding, removeBuilding, SIZE } from './world'
import type { Miner, Sprinkler, World } from './world'
import { advanceWorld } from './step'
import { clickPete, sabotageRemaining } from './pete'
import { allocatePower, powerRequirement, workingDemand } from './power'
import { inspectBuilding } from './inspection'
import { canReceive } from './transport'
import { inventoryTotal } from './items'
import { releasePete } from './police'
function setup(power = true) {
  const world = createWorld(() => .5)
  Object.assign(world.pete, { x: 8, y: 8, tile: 328 })
  expect(placeBuilding(world, 9, 8, 'sprinkler', 'east')).toBe(true)
  placeBuilding(world, 9, 7, 'powerPole', 'east')
  if (power) placeBuilding(world, 9, 6, 'generator', 'east')
  allocatePower(world)
  return world
}
const sprinkler = (w: World) => w.buildings[329] as Sprinkler
function activated() { const w = setup(); advanceWorld(w, 50); expect(w.pete.mode).toBe('SPRAYED'); return w }
function until(world: World, mode: typeof world.pete.mode) {
  for (let n = 0; n < 2000 && world.pete.mode !== mode; n++) advanceWorld(world, 50)
  expect(world.pete.mode).toBe(mode)
}
describe('sprinkler building, range and electricity', () => {
  it('places and removes a 1×1 inventory-free building and invalidates topology', () => {
    const w = setup(), revision = w.topologyRevision
    expect(sprinkler(w)).toEqual({ kind: 'sprinkler', x: 9, y: 8, sprays: 0, cooldownUntilMs: 0 })
    expect(placeBuilding(w, 9, 8, 'sprinkler', 'north')).toBe(false)
    expect(placeBuilding(w, -1, 8, 'sprinkler', 'east')).toBe(false)
    expect(removeBuilding(w, 9, 8)).toBe(true); expect(w.topologyRevision).toBe(revision + 1)
    expect(w.mined.iron).toBe(0)
  })
  it.each([[6, 8, true], [5.99999, 8, false], [7, 6, true], [6, 6, false]] as const)('uses inclusive Euclidean radar conventions at %s,%s', (x, y, inside) => {
    const w = setup(); Object.assign(w.pete, { x, y })
    expect(sprinklerDetects(w, 329)).toBe(inside)
  })
  it('requires full 5 kW and stays inactive without generation or pole coverage', () => {
    const w = setup(false)
    expect(powerRequirement(sprinkler(w))).toBe(SPRINKLER_KW); expect(workingDemand(sprinkler(w), w)).toBe(5)
    expect(sprinklerPowered(w, 329)).toBe(false)
    advanceWorld(w, 50); expect(w.pete.water).toBeNull()
    expect(inspectBuilding(w, 329)).toMatchObject({ status: 'Unpowered' })
    placeBuilding(w, 9, 6, 'generator', 'east'); removeBuilding(w, 9, 7)
    advanceWorld(w, 50); expect(w.pete.water).toBeNull()
    placeBuilding(w, 9, 7, 'powerPole', 'east'); advanceWorld(w, 50)
    expect(w.pete.mode).toBe('SPRAYED')
  })
  it('shares proportional power with production, but does not activate at partial supply', () => {
    const w = setup()
    for (const [x, y] of [[8, 7], [8, 6], [10, 7], [10, 6]]) {
      w.tiles[y * SIZE + x] = 'iron'; placeBuilding(w, x, y, 'miner', 'east')
    }
    advanceWorld(w, 50)
    expect(w.power!.consumers[329].suppliedKw).toBeCloseTo(4)
    expect(w.pete.water).toBeNull()
    expect((w.buildings[288] as Miner).elapsed).toBeCloseTo(40)
    placeBuilding(w, 9, 5, 'generator', 'east'); advanceWorld(w, 50)
    expect(w.pete.mode).toBe('SPRAYED')
  })
  it('rejects item input and conserves the working production chain during a complete reaction', () => {
    const w = createWorld(() => .5)
    Object.assign(w.pete, { x: 20, y: 23, tile: 940 })
    for (const [x, y, kind, direction] of [[21, 19, 'powerPole', 'east'], [21, 18, 'generator', 'east'], [20, 20, 'miner', 'east'], [21, 20, 'belt', 'east'], [22, 20, 'furnace', 'south'], [22, 21, 'belt', 'south'], [22, 22, 'storage', 'east'], [21, 22, 'sprinkler', 'east']] as const) expect(placeBuilding(w, x, y, kind, direction)).toBe(true)
    expect(canReceive(w.buildings[901]!, 'iron', 'east')).toBe(false)
    advanceWorld(w, 50); expect(w.pete.mode).toBe('SPRAYED')
    for (let n = 0; n < 30; n++) {
      advanceWorld(w, 500)
      let material = 0
      for (const b of w.buildings) {
        if (b?.kind === 'miner' || b?.kind === 'belt') material += Number(b.item !== null)
        if (b?.kind === 'furnace') material += inventoryTotal(b.input) + inventoryTotal(b.output) + (b.job ? inventoryTotal(b.job.inputs) : 0)
        if (b?.kind === 'storage') material += inventoryTotal(b.inventory)
      }
      expect(material).toBe(w.mined.iron)
    }
    expect(w.produced.ironPlate).toBeGreaterThan(0)
    expect(w.buildings[902]?.kind === 'storage' && w.buildings[902].inventory.ironPlate).toBeGreaterThan(0)
  })
  it('uses stable tile order with no unsuccessful cooldowns', () => {
    const w = setup(); placeBuilding(w, 8, 7, 'sprinkler', 'east')
    advanceWorld(w, 50)
    expect(w.pete.water!.source).toBe(288)
    advanceWorld(w, 1000)
    expect((w.buildings[288] as Sprinkler).sprays).toBe(1)
    expect(sprinkler(w)).toMatchObject({ sprays: 0, cooldownUntilMs: 0 })
  })
  it('does not activate on cooldown and reports Ready/Cooling down', () => {
    const w = setup(); sprinkler(w).cooldownUntilMs = 500
    expect(inspectBuilding(w, 329)).toMatchObject({ status: 'Cooling down', cooldownMs: 500 })
    advanceWorld(w, 450); expect(w.pete.water).toBeNull()
    advanceWorld(w, 50); expect(w.pete.mode).toBe('SPRAYED')
  })
})
describe('exact deterministic slapstick sequence', () => {
  it('sprays 1s, slips 1s, complains 2s and flees 8s, without web crying', () => {
    const w = activated(), cooldown = w.pete.cooldownMs
    advanceWorld(w, 950); expect(w.pete.mode).toBe('SPRAYED'); expect(w.pete.water!.remainingMs).toBe(50)
    advanceWorld(w, 50); expect(w.pete.mode).toBe('SLIPPING')
    expect(sprinkler(w)).toMatchObject({ sprays: 1, cooldownUntilMs: w.timeMs + SPRINKLER_COOLDOWN_MS })
    expect(inspectBuilding(w, 329)).toMatchObject({ status: 'Cooling down', sprays: 1, cooldownMs: 10000 })
    advanceWorld(w, 950); expect(w.pete.mode).toBe('SLIPPING')
    advanceWorld(w, 50); expect(w.pete.mode).toBe('COMPLAINING')
    advanceWorld(w, 1950); expect(w.pete.mode).toBe('COMPLAINING')
    advanceWorld(w, 50); expect(w.pete.mode).toBe('WATER_FLEEING')
    advanceWorld(w, 7950); expect(w.pete.mode).toBe('WATER_FLEEING'); expect(w.pete.water!.remainingMs).toBe(50)
    advanceWorld(w, 50); expect(w.pete.mode).toBe('WANDERING'); expect(w.pete.water).toBeNull()
    expect(w.timeMs).toBe(12050); expect(w.pete.cooldownMs).toBe(Math.max(0, cooldown - 12000))
    expect(sprinkler(w).sprays).toBe(1)
  })
  it('pauses spray progress and the jet during power loss, then resumes once', () => {
    const w = activated(); advanceWorld(w, 350)
    removeBuilding(w, 9, 6); advanceWorld(w, 5000)
    expect(w.pete.water!.remainingMs).toBe(650); expect(sprinkler(w).sprays).toBe(0)
    expect(inspectBuilding(w, 329)).toMatchObject({ status: 'Unpowered', sprayProgress: .35 })
    placeBuilding(w, 9, 6, 'generator', 'east'); advanceWorld(w, 650)
    expect(w.pete.mode).toBe('SLIPPING'); expect(sprinkler(w).sprays).toBe(1)
  })
  it('consumes repeated clicks without webs, restarts, destination changes or accidental building actions', () => {
    const w = activated()
    for (const delta of [0, 1000, 1000, 2000, 500]) {
      advanceWorld(w, delta)
      const before = structuredClone(w.pete)
      for (let n = 0; n < 3; n++) expect(clickPete(w, w.pete)).toBe(true)
      expect(w.pete).toEqual(before)
      expect(sprinkler(w).sprays).toBeLessThanOrEqual(1)
    }
  })
  it('interrupts a flying pumpkin without resetting cooldown or clearing old machine sabotage', () => {
    const w = setup()
    placeBuilding(w, 10, 8, 'furnace', 'east')
    const machine = w.buildings[330]!
    machine.sabotageUntilMs = 10000
    w.pete.cooldownMs = 12345
    w.pete.pumpkin = { target: machine, index: 330, from: { x: 8, y: 8 }, elapsedMs: 100 }
    advanceWorld(w, 50)
    expect(w.pete.pumpkin).toBeNull(); expect(w.pete.cooldownMs).toBe(12295)
    expect(sabotageRemaining(w, machine)).toBe(9950)
    advanceWorld(w, 9500)
    expect(machine.sabotageUntilMs).toBe(10000); expect(w.pete.pumpkin).toBeNull()
  })
  it('navigates obstacles, replans after placement, stays in bounds and away from the source', () => {
    const w = activated()
    for (let y = 0; y < 16; y++) if (y !== 12) placeBuilding(w, 6, y, 'storage', 'east')
    advanceWorld(w, 4000)
    let moved = 0
    for (let n = 0; n < 159; n++) {
      advanceWorld(w, 50)
      if (n === 30 && w.pete.path.length > 3) {
        const future = w.pete.path[3]; placeBuilding(w, future % SIZE, Math.floor(future / SIZE), 'storage', 'east')
      }
      expect(w.buildings[w.pete.tile]).toBeNull()
      if (w.pete.next !== null) expect(w.buildings[w.pete.next]).toBeNull()
      expect(w.pete.x).toBeGreaterThanOrEqual(0); expect(w.pete.x).toBeLessThan(SIZE)
      expect(w.pete.y).toBeGreaterThanOrEqual(0); expect(w.pete.y).toBeLessThan(SIZE)
      moved = Math.max(moved, Math.hypot(w.pete.x - 9, w.pete.y - 8))
    }
    expect(moved).toBeGreaterThan(10)
  })
  it('waits safely if enclosed and never enters spider-web crying', () => {
    const w = setup()
    for (const [x, y] of [[8, 7], [7, 8], [8, 9]]) placeBuilding(w, x, y, 'storage', 'east')
    advanceWorld(w, 50); advanceWorld(w, 4000)
    advanceWorld(w, 8000)
    expect(w.pete.mode).toBe('WANDERING'); expect(w.pete.x).toBe(8); expect(w.pete.y).toBe(8)
    expect(sprinkler(w).sprays).toBe(1)
    advanceWorld(w, 50); expect(w.pete.mode).toBe('SPRAYED') // A later boundary may start another eligible reaction.
  })
  it('removing an active sprinkler cancels its jet safely and leaves the committed reaction intact', () => {
    const w = activated(); advanceWorld(w, 350)
    removeBuilding(w, 9, 8)
    expect(w.pete.mode).toBe('SLIPPING'); expect(w.pete.water!.source).toBeNull()
    placeBuilding(w, 9, 8, 'sprinkler', 'east'); advanceWorld(w, 3000)
    expect(w.pete.mode).toBe('WATER_FLEEING'); expect(sprinkler(w).sprays).toBe(0)
  })
  it('matches arbitrary elapsed partitions including remainder and seeded complaint selection', () => {
    const a = setup(), b = structuredClone(a)
    advanceWorld(a, 14675.5)
    for (let n = 0; n < 500; n++) advanceWorld(b, 29.351)
    expect(b.timeMs).toBe(a.timeMs); expect(b.pete).toEqual(a.pete)
    expect(b.buildings).toEqual(a.buildings); expect(b.remainder).toBeCloseTo(a.remainder)
  })
})
describe('web, police, prison and grace compatibility', () => {
  it.each(['FLEEING', 'CRYING', 'ARRESTED', 'TRANSPORTED', 'IMPRISONED'] as const)('rejects %s without consuming cooldown', mode => {
    const w = setup(); w.pete.mode = mode
    advanceSprinklers(w, 50)
    expect(w.pete.water).toBeNull(); expect(sprinkler(w).cooldownUntilMs).toBe(0)
  })
  it('preserves existing spider-web fleeing and crying instead of starting water reactions', () => {
    const w = setup(); clickPete(w, w.pete)
    advanceWorld(w, 50); expect(w.pete.mode).toBe('FLEEING'); expect(w.pete.water).toBeNull()
    until(w, 'CRYING'); advanceWorld(w, 9950)
    expect(w.pete.mode).toBe('CRYING'); expect(w.pete.water).toBeNull()
  })
  it('gives simultaneous radar dispatch priority and preserves imprisonment, release and escape clocks', () => {
    const w = setup(); placeBuilding(w, 10, 8, 'radar', 'east')
    advanceWorld(w, 50)
    expect(w.police.car?.phase).toBe('RESPONDING'); expect(w.pete.water).toBeNull()
    until(w, 'IMPRISONED')
    const at = w.pete.imprisonedAtMs!, index = w.pete.prison!.y * SIZE + w.pete.prison!.x
    expect(w.pete.water).toBeNull()
    advanceWorld(w, 59950); expect(w.pete.mode).toBe('IMPRISONED'); expect(w.pete.imprisonedAtMs).toBe(at)
    const released = structuredClone(w), cooldown = released.pete.cooldownMs
    expect(releasePete(released, index, at)).toBe(true)
    expect(released.pete.cooldownMs).toBe(cooldown)
    advanceWorld(w, 50); expect(w.pete.mode).toBe('WANDERING'); expect(w.pete.jailbreak).not.toBeNull()
  })
  it('prevents new police dispatch during any water phase', () => {
    const w = activated(); placeBuilding(w, 8, 7, 'radar', 'east')
    for (const delta of [500, 500, 1000, 2000, 500]) {
      advanceWorld(w, delta); expect(w.police.car).toBeNull(); expect(w.pete.water).not.toBeNull()
    }
  })
  it('respects post-release grace and activates again when ordinary wandering is eligible', () => {
    const w = setup(); w.pete.graceUntilMs = 500
    advanceSprinklers(w, 50); expect(w.pete.water).toBeNull()
    w.timeMs = 500; advanceSprinklers(w, 50)
    expect(w.pete.mode).toBe('SPRAYED')
  })
})
