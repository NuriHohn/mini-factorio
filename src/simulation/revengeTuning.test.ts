import { expect, it } from 'vitest'
import { createUnlockedWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import type { CraftingMachine, World } from './world'
import { emptyInventory } from './items'
import { allocatePower } from './power'
import { advanceWorld } from './step'
import { advanceRevenge, damageWalker, empTargetEligible, productiveTarget, recordArrest } from './revenge'
import { decodeSave, encodeSave } from '../persistence/saveGame'

function encounter() {
  const w = createUnlockedWorld(() => .5)
  for (let i = 0; i < 3; i++) recordArrest(w)
  advanceWorld(w, 5000)
  return w
}
function machine(w: World, x: number, y: number) {
  placeBuilding(w, x, y, 'furnace', 'east')
  const b = w.buildings[y * 40 + x] as CraftingMachine
  Object.assign(b, { recipeId: 'ironSmelting', recipeMode: 'ironSmelting', recipeLocked: true, job: { recipeId: 'ironSmelting', elapsedMs: 0, inputs: { ...emptyInventory(), iron: 1 }, outputs: { ...emptyInventory(), ironPlate: 1 } } })
  placeBuilding(w, x, y + 1, 'powerPole', 'east'); placeBuilding(w, x, y + 2, 'generator', 'east')
  allocatePower(w)
  return b
}
function ticks(w: World, ms: number) {
  for (let i = 0; i < ms; i += 50) { w.timeMs += 50; advanceRevenge(w, 50) }
}
it('holds its selected machine through short idle periods and a newly productive competitor', () => {
  const w = encounter(), boss = w.revenge.boss!
  const first = machine(w, 20, 20)
  ticks(w, 50); expect(boss.target).toBe(820)
  const second = machine(w, 20, 10)
  second.job = null
  first.job = null
  ticks(w, 3000)
  expect(boss.target).toBe(820)
  machine(w, 20, 10)
  ticks(w, 1950)
  expect(boss.target).toBe(820)
  ticks(w, 50)
  expect(boss.target).toBe(420)
  expect(boss.targetInactiveMs).toBe(0)
})
it('recovers immediately from target removal and at a tile boundary from disconnection', () => {
  const w = encounter(), boss = w.revenge.boss!
  machine(w, 20, 20); ticks(w, 750)
  removeBuilding(w, 20, 20); machine(w, 3, 20)
  ticks(w, 50); expect(boss.target).toBe(803)
  machine(w, 20, 20); boss.target = 820
  for (let y = 0; y < 40; y++) w.water[y * 40 + 10] = true
  ticks(w, 750)
  expect(boss.target).toBe(803)
})
it.each([1, 2] as const)('uses phase %s EMP cooldown and promptly attacks independent eligible targets', phase => {
  const w = encounter(), boss = w.revenge.boss!
  Object.assign(boss, { x: 10, y: 10, tile: 410, phase, hp: phase === 1 ? 100 : 50, stomped: phase === 2, empAtMs: w.timeMs })
  machine(w, 16, 10); machine(w, 10, 16)
  ticks(w, 50)
  const first = w.revenge.blast!.atMs, cooldown = phase === 1 ? 4000 : 3000
  expect(boss.empAtMs).toBe(first + cooldown)
  allocatePower(w)
  ticks(w, cooldown - 50)
  expect(w.revenge.blast).toBeNull()
  ticks(w, 50)
  expect(w.revenge.blast?.atMs).toBe(first + cooldown)
})
it('does not refresh overlapping EMP outages before every affected building has recovered for two seconds', () => {
  const w = encounter(), boss = w.revenge.boss!
  const first = machine(w, 8, 0), neighbor = machine(w, 10, 0)
  Object.assign(boss, { x: 4, y: 0, tile: 4, empAtMs: w.timeMs })
  ticks(w, 50)
  const until = first.sabotageUntilMs!
  expect(neighbor.sabotageUntilMs).toBe(until)
  // Keep a productive job available to isolate splash-area recovery eligibility.
  ticks(w, 4000)
  expect(first.sabotageUntilMs).toBe(until)
  expect(empTargetEligible(w, 10)).toBe(false)
  ticks(w, 3950)
  expect(first.sabotageUntilMs).toBe(until)
  ticks(w, 50)
  expect(first.sabotageUntilMs).toBe(w.timeMs + 6000)
})
it('allows real production to recover between repeated EMPs, including after stomp', () => {
  const w = encounter(), boss = w.revenge.boss!
  placeBuilding(w, 20, 20, 'miner', 'east'); placeBuilding(w, 21, 20, 'belt', 'east'); placeBuilding(w, 22, 20, 'storage', 'east')
  placeBuilding(w, 20, 19, 'powerPole', 'east'); placeBuilding(w, 20, 18, 'generator', 'east')
  Object.assign(boss, { x: 14, y: 20, tile: 814, empAtMs: w.timeMs })
  advanceWorld(w, 50)
  expect(w.revenge.blast?.kind).toBe('emp')
  const mined = w.mined.iron
  advanceWorld(w, 12000)
  expect(w.mined.iron).toBeGreaterThan(mined)
  damageWalker(w, 50); advanceWorld(w, 1500)
  expect(w.revenge.blast?.kind).toBe('stomp')
  const afterStomp = w.mined.iron
  advanceWorld(w, 20000)
  expect(w.mined.iron).toBeGreaterThan(afterStomp)
  expect(w.revenge).toMatchObject({ arrests: 3, threshold: 3, stage: 'hunting' })
})
it.each([false, true])('wanders without targets, avoids obstacles and resumes pursuit on the next tick (water=%s)', water => {
  const w = encounter(), boss = w.revenge.boss!
  if (water) for (const i of [2, 42, 80]) w.water[i] = true
  else for (const i of [2, 42, 80]) placeBuilding(w, i % 40, Math.floor(i / 40), 'storage', 'east')
  const visited = new Set<number>()
  for (let i = 0; i < 180; i++) {
    advanceWorld(w, 50); visited.add(boss.tile)
    expect(w.water[boss.tile] || !!w.buildings[boss.tile]).toBe(false)
  }
  expect(visited.size).toBeGreaterThan(2)
  expect(boss.target).toBeNull()
  machine(w, 20, 20)
  expect(productiveTarget(w, 820)).toBe(true)
  ticks(w, 50)
  expect(boss.target).toBe(820)
  const start = { x: boss.x, y: boss.y }
  ticks(w, 750)
  expect({ x: boss.x, y: boss.y }).not.toEqual(start)
})
it('waits only when physically enclosed and resumes wandering when a route opens', () => {
  const w = encounter(), boss = w.revenge.boss!
  w.water[1] = true; w.water[40] = true
  advanceWorld(w, 5000)
  expect(boss).toMatchObject({ tile: 0, next: null, x: 0, y: 0 })
  w.water[1] = false; advanceWorld(w, 750)
  expect(boss.tile).toBe(1)
})
it('keeps wandering, pursuit and inactivity timers exact across partitions, pause and save/load', () => {
  const w = encounter(), other = structuredClone(w)
  for (let i = 0; i < 90; i++) advanceWorld(w, 1000 / 30)
  for (let i = 0; i < 180; i++) advanceWorld(other, 1000 / 60)
  expect(w.revenge).toEqual(other.revenge)
  machine(w, 20, 20); ticks(w, 50)
  const inactive = w.buildings[820] as CraftingMachine
  inactive.job = null
  ticks(w, 1000)
  const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
  const loaded = decodeSave(encodeSave(w, view)).world
  const frozen = structuredClone(w.revenge)
  advanceWorld(w, 0); expect(w.revenge).toEqual(frozen)
  advanceWorld(w, 6000); advanceWorld(loaded, 6000)
  expect(w.revenge).toEqual(loaded.revenge)
})
