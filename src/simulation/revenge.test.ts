import { describe, expect, it } from 'vitest'
import { combatPosition, createRevenge } from './revenge'
import { attackWalker, advanceRevenge, damageWalker, recordArrest, walkerHit } from '../factory/revengeSystem'
import { createWorld, placeBuilding, placementError, SIZE } from './world'
import type { CraftingMachine, World } from './world'
import { advanceWorld } from './step'
import { allocatePower } from './power'
import { changeFurnaceRecipe } from './smelting'
import { advancePolice } from '../factory/policeSystem'
import { advanceSprinklers } from '../factory/sprinklerSystem'
import { emptyInventory } from './items'
import { createResearch, RP_UNITS } from './research'
import { purchaseTechnology } from '../factory/research'

// Original combat fixtures retain their dry map; terrain navigation has separate coverage.
export function encounter() {
  const world = createWorld(() => .5, { water: false })
  for (let i = 0; i < 3; i++) recordArrest(world)
  advanceWorld(world, 5000)
  return world
}
function relocate(world: World, x: number, y: number) {
  Object.assign(world.revenge.boss!, { x, y, tile: y * SIZE + x, next: null, travelMs: 0 })
}
function furnace(world: World, x: number, y: number) {
  placeBuilding(world, x, y, 'furnace', 'east'); changeFurnaceRecipe(world, x, y, 'ironSmelting')
  const b = world.buildings[y * SIZE + x] as CraftingMachine
  b.job = { recipeId: 'ironSmelting', elapsedMs: 0, inputs: { ...emptyInventory(), iron: 1 }, outputs: { ...emptyInventory(), ironPlate: 1 } }
  return b
}
describe('Revenge events and shared combat', () => {
  it('escalates 3, 5, 7, 9 completed arrests with one pending/active event', () => {
    const world = createWorld(() => .5)
    expect(world.revenge).toEqual(createRevenge())
    for (const threshold of [3, 5, 7, 9]) {
      for (let i = 0; i < threshold - 1; i++) recordArrest(world)
      expect(world.revenge).toMatchObject({ stage: 'idle', arrests: threshold - 1, threshold })
      recordArrest(world); recordArrest(world)
      expect(world.revenge).toMatchObject({ stage: 'warning', arrests: threshold })
      advanceWorld(world, 4950); expect(world.revenge.boss).toBeNull()
      advanceWorld(world, 50); expect(world.revenge.stage).toBe('hunting')
      const boss = world.revenge.boss
      recordArrest(world); advanceWorld(world, 50)
      expect(world.revenge.boss).toBe(boss)
      expect(world.revenge.arrests).toBe(threshold)
      damageWalker(world, 100); damageWalker(world, 100); recordArrest(world)
      expect(world.revenge).toMatchObject({ stage: 'defeating', arrests: 0, threshold: threshold + 2 })
      advanceWorld(world, 2000)
      expect(world.revenge).toMatchObject({ stage: 'stunned', boss: null })
      const position = { x: world.pete.x, y: world.pete.y }
      advanceWorld(world, 4950); expect(world.pete).toMatchObject(position)
      recordArrest(world); expect(world.revenge.arrests).toBe(0)
      advanceWorld(world, 50); expect(world.revenge.stage).toBe('idle')
    }
  })
  it('counts the authoritative ARRESTING completion exactly once', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 0, 1, 'prison', 'east')
    const prison = world.buildings[40]!
    if (prison.kind !== 'prison') throw Error('fixture')
    Object.assign(world.pete, { mode: 'ARRESTED', prison, next: null, travelMs: 0 })
    world.police.car = { x: 17, y: 23, tile: 937, next: null, travelMs: 0, path: [], pathRevision: -1, target: 937, phase: 'ARRESTING', arrestElapsedMs: 700, arrestFrom: { x: 17, y: 23 }, prison }
    advancePolice(world, 49); expect(world.revenge.arrests).toBe(0)
    advancePolice(world, 1); expect(world.revenge.arrests).toBe(1)
    advancePolice(world, 50); expect(world.revenge.arrests).toBe(1)
  })
  it('spawns deterministically on a free edge without touching buildings or inventory, and reserves movement tiles', () => {
    const a = createWorld(() => .5)
    placeBuilding(a, 0, 0, 'storage', 'east')
    for (let i = 0; i < 3; i++) recordArrest(a)
    const b = structuredClone(a), buildings = structuredClone(a.buildings)
    advanceWorld(a, 5000); for (let i = 0; i < 100; i++) advanceWorld(b, 50)
    expect(a.revenge).toEqual(b.revenge)
    expect(a.revenge.boss!.tile).toBe(1)
    expect(a.buildings).toEqual(buildings)
    expect(placementError(a, 1, 0, 'storage')).toContain('walker')
  })
  it('waits without overwriting anything when no edge is free', () => {
    const world = createWorld(() => .5)
    for (let i = 0; i < SIZE * SIZE; i++) if (i < SIZE || i >= SIZE * (SIZE - 1) || i % SIZE === 0 || i % SIZE === SIZE - 1) placeBuilding(world, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')
    for (let i = 0; i < 3; i++) recordArrest(world)
    const buildings = structuredClone(world.buildings)
    advanceWorld(world, 5050)
    expect(world.revenge.stage).toBe('warning'); expect(world.revenge.boss).toBeNull()
    expect(world.buildings).toEqual(buildings)
  })
  it('targets productive machines with deterministic priority and moves around obstructions', () => {
    const world = encounter(); relocate(world, 10, 10)
    world.research.unlocked.push('automation1')
    placeBuilding(world, 20, 10, 'assembler', 'east')
    const assembler = world.buildings[420] as CraftingMachine
    Object.assign(assembler, { recipeId: 'ironGear', recipeLocked: true, job: { recipeId: 'ironGear', elapsedMs: 0, inputs: { ...emptyInventory(), ironPlate: 2 }, outputs: { ...emptyInventory(), ironGear: 1 } } })
    furnace(world, 18, 10)
    placeBuilding(world, 19, 9, 'powerPole', 'east'); placeBuilding(world, 19, 8, 'generator', 'east'); placeBuilding(world, 20, 8, 'generator', 'east')
    placeBuilding(world, 11, 10, 'storage', 'east')
    allocatePower(world)
    const other = structuredClone(world)
    for (let n = 0; n < 31; n++) {
      world.timeMs += 50; advanceRevenge(world, 50)
      other.timeMs += 50; advanceRevenge(other, 50)
    }
    expect(world.revenge.boss!.target).toBe(420)
    expect(world.revenge.boss!.tile).not.toBe(410)
    expect(world.revenge.boss!.tile).not.toBe(411)
    expect(world.revenge).toEqual(other.revenge)
  })
  it.each([1, 2] as const)('fires phase %i EMP at range 6 with inclusive radius 3 and six-second sabotage', phase => {
    const world = encounter(); relocate(world, 14, 20)
    const target = furnace(world, 20, 20), edge = furnace(world, 23, 20), outside = furnace(world, 24, 20)
    placeBuilding(world, 20, 18, 'powerPole', 'east'); placeBuilding(world, 20, 17, 'generator', 'east')
    allocatePower(world)
    Object.assign(world.revenge.boss!, { phase, hp: phase === 1 ? 100 : 50, stomped: phase === 2, target: 820, empAtMs: world.timeMs })
    advanceRevenge(world, 50)
    expect(target.sabotageUntilMs).toBe(world.timeMs + 6000)
    expect(edge.sabotageUntilMs).toBe(world.timeMs + 6000)
    expect(outside.sabotageUntilMs).toBeUndefined()
    expect(world.revenge.boss!.empAtMs).toBe(world.timeMs + (phase === 1 ? 4000 : 3000))
    expect(world.revenge.blast).toMatchObject({ kind: 'emp', position: { x: 20, y: 20 } })
    expect(world.buildings[820]).toBe(target)
  })
  it('telegraphs and executes one stomp at 50 HP; direct lethal damage skips it', () => {
    const world = encounter(); relocate(world, 20, 20)
    const edge = furnace(world, 25, 20), outside = furnace(world, 26, 20)
    damageWalker(world, 50)
    expect(world.revenge.stage).toBe('stomp')
    const before = structuredClone(world.revenge.boss)
    advanceWorld(world, 1450); expect(world.revenge.boss).toEqual(before)
    expect(edge.sabotageUntilMs).toBeUndefined()
    advanceWorld(world, 50)
    expect(edge.sabotageUntilMs).toBe(world.timeMs + 8000)
    expect(outside.sabotageUntilMs).toBeUndefined()
    damageWalker(world, 5); advanceWorld(world, 1500)
    expect(edge.sabotageUntilMs).toBe(14500)
    expect(world.revenge.stage).toBe('hunting')
    const lethal = encounter(); damageWalker(lethal, 100)
    expect(lethal.revenge).toMatchObject({ stage: 'defeating', boss: { stomped: false } })
    advanceWorld(lethal, 1500); expect(lethal.revenge.blast).toBeNull()
  })
  it.each([.5, 1, 1.3, 2.5])('converts actual canvas coordinates accurately at zoom %f', zoom => {
    const world = encounter(); relocate(world, 20, 20)
    const camera = { scrollX: 300, scrollY: 350, zoom, width: 800, height: 600 }
    const project = (x: number, y: number) => ({ x: ((x + .5) * 32 - camera.scrollX - 400) * zoom + 400, y: ((y + .5) * 32 - camera.scrollY - 300) * zoom + 300 })
    expect(walkerHit(world, combatPosition(project(20, 20), camera))).toBe(true)
    expect(walkerHit(world, combatPosition(project(22, 20), camera))).toBe(false)
  })
  it('requires research, uses shared hit/miss cooldown, and makes ground clicks harmless', () => {
    const world = encounter(); relocate(world, 20, 20)
    expect(attackWalker(world, 'drill', { x: 20, y: 20 })).toBeNull()
    const buildings = structuredClone(world.buildings)
    expect(attackWalker(world, 'flySwatter', { x: 22, y: 20 })).toMatchObject({ hit: false, damage: 0, position: { x: 22, y: 20 } })
    expect(world.revenge.boss!.hp).toBe(100)
    world.research.balanceUnits = (180n * RP_UNITS).toString()
    expect(purchaseTechnology(world, 'revengeDefense2')).toContain('Requires')
    expect(purchaseTechnology(world, 'revengeDefense1')).toBeNull()
    expect(purchaseTechnology(world, 'revengeDefense2')).toBeNull()
    expect(attackWalker(world, 'lightningBeam', { x: 20, y: 20 })).toBeNull()
    advanceWorld(world, 1000)
    expect(attackWalker(world, 'drill', { x: 20, y: 20 })).toMatchObject({ damage: 15, hit: true })
    expect(attackWalker(world, 'flySwatter', world.revenge.boss!)).toBeNull()
    advanceWorld(world, 1500)
    expect(attackWalker(world, 'lightningBeam', { x: 20, y: 20 })).toMatchObject({ damage: 30 })
    expect(world.revenge.boss!.hp).toBe(55)
    advanceWorld(world, 2000)
    expect(attackWalker(world, 'flySwatter', world.revenge.boss!)).toMatchObject({ damage: 5 })
    expect(world.revenge.stage).toBe('stomp')
    expect(world.buildings).toEqual(buildings)
  })
  it('dispatches normal radar police toward the walker even when the hidden pilot’s old tile is enclosed', () => {
    const world = encounter(); relocate(world, 8, 8)
    placeBuilding(world, 1, 0, 'storage', 'east'); placeBuilding(world, 0, 1, 'storage', 'east')
    placeBuilding(world, 9, 8, 'radar', 'east')
    placeBuilding(world, 9, 7, 'powerPole', 'east'); placeBuilding(world, 9, 6, 'generator', 'east')
    allocatePower(world); advancePolice(world, 50)
    expect(world.police.car?.phase).toBe('RESPONDING')
    expect(world.police.car?.target).toBe(328)
    for (let n = 0; n < 1000 && world.revenge.boss!.hp === 100; n++) advanceWorld(world, 50)
    expect(world.revenge.boss!.hp).toBeLessThan(100)
    expect(world.revenge.arrests).toBe(3)
  })
  it('limits overlapping powered sprinklers and an actual police car to shared modest damage', () => {
    const world = encounter(); relocate(world, 8, 8)
    for (const [x, y] of [[9, 8], [8, 9], [7, 8]]) placeBuilding(world, x, y, 'sprinkler', 'east')
    placeBuilding(world, 9, 7, 'powerPole', 'east'); placeBuilding(world, 9, 6, 'generator', 'east')
    allocatePower(world)
    advanceSprinklers(world, 50); advanceSprinklers(world, 50)
    expect(world.revenge.boss!.hp).toBe(98)
    placeBuilding(world, 0, 1, 'prison', 'east')
    const prison = world.buildings[40]!
    if (prison.kind !== 'prison') throw Error('fixture')
    world.police.car = { x: 8, y: 7, tile: 288, next: null, travelMs: 0, path: [], pathRevision: -1, target: 328, phase: 'RESPONDING', arrestElapsedMs: 0, arrestFrom: { x: 0, y: 0 }, prison }
    advancePolice(world, 50); advancePolice(world, 50)
    expect(world.revenge.boss!.hp).toBe(96)
    expect(world.revenge.arrests).toBe(3)
    expect(world.pete.mode).toBe('WANDERING')
  })
  it('returns Pete to normal police arrest flow after exactly five stunned seconds', () => {
    const world = encounter()
    damageWalker(world, 100); advanceWorld(world, 2000)
    placeBuilding(world, 1, 0, 'radar', 'east')
    placeBuilding(world, 2, 0, 'powerPole', 'east'); placeBuilding(world, 2, 1, 'generator', 'east')
    advanceWorld(world, 4950)
    expect(world.police.car).toBeNull(); expect(world.revenge.stage).toBe('stunned')
    advanceWorld(world, 50)
    expect(world.revenge.stage).toBe('idle')
    for (let n = 0; n < 1000 && world.revenge.arrests === 0; n++) advanceWorld(world, 50)
    expect(world.revenge.arrests).toBe(1)
    expect(world.pete.mode).toBe('TRANSPORTED')
  })
  it('does not allow unpowered sprinklers to attack, and keeps old research unlocked without Revenge upgrades', () => {
    const world = encounter(); relocate(world, 8, 8)
    placeBuilding(world, 9, 8, 'sprinkler', 'east'); allocatePower(world)
    advanceSprinklers(world, 50)
    expect(world.revenge.boss!.hp).toBe(100)
    expect(createResearch(true).unlocked).not.toContain('revengeDefense1')
  })
})
