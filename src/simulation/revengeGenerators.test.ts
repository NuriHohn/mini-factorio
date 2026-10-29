import { expect, it } from 'vitest'
import { createUnlockedWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { CraftingMachine, World } from './world'
import { advanceWorld } from './step'
import { empTargetEligible, productiveTarget, recordArrest } from '../factory/revengeSystem'
import { changeFurnaceRecipe } from './smelting'
import { paintWater } from './waterLandscaping'
import { decodeSave, encodeSave } from '../persistence/saveGame'

function generatorWorld(kind: 'generator' | 'waterwheel' = 'generator') {
  const w = createUnlockedWorld(() => .5)
  w.nature.wood = 20
  placeBuilding(w, 0, 0, 'prison', 'east')
  if (kind === 'waterwheel') w.water[11] = true
  expect(placeBuilding(w, 10, 0, kind, 'east')).toBe(true)
  return w
}
function spawn(w: World, restock?: () => void) {
  for (let i = 0; i < 3; i++) recordArrest(w)
  if (restock) { advanceWorld(w, 4000); restock(); advanceWorld(w, 1000) }
  else advanceWorld(w, 5000)
  return w.revenge.boss!
}
it.each(['generator', 'waterwheel'] as const)('pursues and EMPs a pre-existing operational %s without consumers, poles or jobs', kind => {
  const w = generatorWorld(kind), original = w.buildings[10], boss = spawn(w)
  expect(w.power?.networks).toHaveLength(0)
  expect(boss.tile).toBe(2)
  advanceWorld(w, 50)
  expect(boss.target).toBe(10)
  expect(boss.x).toBeGreaterThan(2)
  expect(productiveTarget(w, 10)).toBe(true)
  advanceWorld(w, 3950)
  expect(w.revenge.blast).toMatchObject({ kind: 'emp', position: { x: 10, y: 0 }, atMs: 9000 })
  expect(w.buildings[10]).toBe(original)
  expect(original?.sabotageUntilMs).toBe(15000)
  expect(boss.empAtMs).toBe(13000)
  expect(boss.hp).toBe(100)
})
it.each(['miner', 'furnace', 'assembler'] as const)('prioritizes a productive %s over a nearer operational generator', kind => {
  const w = generatorWorld()
  if (kind === 'miner') placeBuilding(w, 20, 20, 'miner', 'east')
  else {
    placeBuilding(w, 20, 20, kind, 'east')
    if (kind === 'furnace') changeFurnaceRecipe(w, 20, 20, 'ironSmelting')
    const b = w.buildings[820] as CraftingMachine
    if (kind === 'assembler') Object.assign(b, { recipeId: 'ironGear', recipeLocked: true })
    b.input[kind === 'furnace' ? 'iron' : 'ironPlate'] = 2
  }
  placeBuilding(w, 21, 20, 'belt', 'east'); placeBuilding(w, 22, 20, 'storage', 'east')
  // This second generator is infrastructure for the productive machine, not a job surrogate.
  placeBuilding(w, 20, 19, 'powerPole', 'east'); placeBuilding(w, 20, 18, 'generator', 'east')
  const boss = spawn(w, () => {
    if (kind !== 'miner') (w.buildings[820] as CraftingMachine).input[kind === 'furnace' ? 'iron' : 'ironPlate'] = 2
  })
  advanceWorld(w, 50)
  expect(productiveTarget(w, 820)).toBe(true)
  expect(boss.target).toBe(820)
})
it('prefers the spawn component of a productive machine to a disconnected generator-only component', () => {
  const w = generatorWorld()
  for (let y = 0; y < SIZE; y++) w.water[y * SIZE + 12] = true
  placeBuilding(w, 20, 20, 'miner', 'east'); placeBuilding(w, 21, 20, 'belt', 'east'); placeBuilding(w, 22, 20, 'storage', 'east'); placeBuilding(w, 20, 19, 'powerPole', 'east'); placeBuilding(w, 20, 18, 'generator', 'east')
  const boss = spawn(w)
  expect(boss.tile % SIZE).toBeGreaterThan(12)
  advanceWorld(w, 50)
  expect(boss.target).toBe(820)
})
it('uses a reachable generator when a productive machine is disconnected after spawn', () => {
  const w = generatorWorld(), boss = spawn(w)
  placeBuilding(w, 20, 20, 'miner', 'east'); placeBuilding(w, 21, 20, 'belt', 'east'); placeBuilding(w, 22, 20, 'storage', 'east'); placeBuilding(w, 20, 19, 'powerPole', 'east'); placeBuilding(w, 20, 18, 'generator', 'east')
  for (let y = 0; y < SIZE; y++) w.water[y * SIZE + 12] = true
  advanceWorld(w, 50)
  expect(productiveTarget(w, 820)).toBe(true)
  expect(boss.target).toBe(10)
})
it.each(['generator', 'waterwheel'] as const)('keeps EMP recovery protection for %s and attacks again only after recovery', kind => {
  const w = generatorWorld(kind)
  spawn(w); advanceWorld(w, 4000)
  expect(w.buildings[10]?.sabotageUntilMs).toBe(15000)
  advanceWorld(w, 6000)
  expect(productiveTarget(w, 10)).toBe(true)
  expect(empTargetEligible(w, 10)).toBe(false)
  advanceWorld(w, 1950)
  expect(w.buildings[10]?.sabotageUntilMs).toBe(15000)
  advanceWorld(w, 50)
  for (let i = 0; i < 200 && w.buildings[10]?.sabotageUntilMs === 15000; i++) advanceWorld(w, 50)
  expect(w.timeMs).toBeGreaterThanOrEqual(17000)
  expect(w.buildings[10]?.sabotageUntilMs).toBe(w.timeMs + 6000)
})
it('preserves a selected generator until removal, then reacquires another operational generator', () => {
  const w = generatorWorld(), boss = spawn(w)
  advanceWorld(w, 50)
  expect(boss.target).toBe(10)
  placeBuilding(w, 12, 0, 'generator', 'east')
  advanceWorld(w, 50); expect(boss.target).toBe(10)
  removeBuilding(w, 10, 0)
  advanceWorld(w, 50); expect(boss.target).toBe(12)
})
it('reconsiders a dry waterwheel after the existing five-second inactivity tolerance and resumes after water is restored', () => {
  const w = generatorWorld('waterwheel'), boss = spawn(w)
  advanceWorld(w, 50)
  expect(boss.target).toBe(10)
  paintWater(w, { x: 11, y: 0 }, { x: 11, y: 0 }, 'land', 1)
  expect(productiveTarget(w, 10)).toBe(false)
  advanceWorld(w, 4950); expect(boss.target).toBe(10)
  advanceWorld(w, 50); expect(boss.target).toBeNull()
  expect(boss.next).not.toBeNull()
  paintWater(w, { x: 11, y: 0 }, { x: 11, y: 0 }, 'water', 1)
  advanceWorld(w, 50); expect(boss.target).toBe(10)
})
it('wanders when the only existing generator is sabotaged instead of treating its installed rating as operational', () => {
  const w = generatorWorld()
  w.buildings[10]!.sabotageUntilMs = 12000
  const boss = spawn(w)
  advanceWorld(w, 750)
  expect(productiveTarget(w, 10)).toBe(false)
  expect(boss.target).toBeNull(); expect(boss.tile).not.toBe(2)
  expect(w.revenge.blast).toBeNull()
})
it('keeps water/obstacle movement, generator attacks and mid-pursuit saves deterministic across frame partitions', () => {
  const w = generatorWorld('waterwheel')
  w.water[3] = true; placeBuilding(w, 3, 1, 'storage', 'east')
  spawn(w)
  const other = structuredClone(w)
  for (let i = 0; i < 90; i++) advanceWorld(w, 1000 / 30)
  for (let i = 0; i < 180; i++) advanceWorld(other, 1000 / 60)
  expect(other.revenge).toEqual(w.revenge)
  expect(w.revenge.boss!.tile).not.toBe(2)
  const b = w.revenge.boss!
  expect(w.water[b.tile] || !!w.buildings[b.tile]).toBe(false)
  const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
  const loaded = decodeSave(encodeSave(w, view)).world
  advanceWorld(w, 6000); advanceWorld(loaded, 6000)
  expect(loaded.revenge).toEqual(w.revenge)
})
