import { expect, it } from 'vitest'
import { createUnlockedWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import { advanceWorld } from './step'
import { productiveTarget, recordArrest } from './revenge'
import { changeFurnaceRecipe } from './smelting'
import type { CraftingMachine } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { reachableTiles } from './navigation'

function populatedFactory(dense: boolean) {
  const w = createUnlockedWorld(() => .5)
  expect(placeBuilding(w, 0, 0, 'prison', 'east')).toBe(true)
  if (dense) {
    for (let y = 0; y < 27; y++) if (y !== 10) w.water[y * SIZE + 8] = true
    for (const y of [8, 12, 16]) for (let x = 0; x < SIZE; x++) {
      if (![4, 10, 27].includes(x) && !w.water[y * SIZE + x]) placeBuilding(w, x, y, 'belt', 'east')
    }
  }
  for (const [x, kind] of [[20, 'miner'], [21, 'belt'], [22, 'furnace'], [23, 'belt'], [24, 'assembler'], [26, 'storage']] as const) expect(placeBuilding(w, x, 20, kind, 'east')).toBe(true)
  placeBuilding(w, 21, 19, 'powerPole', 'east'); placeBuilding(w, 21, 18, 'generator', 'east')
  // A normal incomplete chain: the unconfigured assembler eventually blocks
  // the furnace and miner. No manually frozen jobs or fake power allocation.
  advanceWorld(w, 30000)
  expect(w.buildings[820]).toMatchObject({ kind: 'miner', item: 'iron' })
  expect([820, 822, 824].some(i => productiveTarget(w, i))).toBe(false)
  for (let i = 0; i < 3; i++) recordArrest(w)
  advanceWorld(w, 5000)
  return w
}
it.each([false, true])('pursues a populated factory after the normal spawn beside prison (dense/water=%s)', dense => {
  const w = populatedFactory(dense), boss = w.revenge.boss!
  expect(boss).toMatchObject({ tile: 2, x: 2, y: 0, next: null })
  const reachable = reachableTiles(w, boss.tile)
  expect([...reachable.keys()].some(i => Math.hypot(i % SIZE - 20, Math.floor(i / SIZE) - 20) <= 6)).toBe(true)
  const start = { x: boss.x, y: boss.y }
  advanceWorld(w, 60000)
  expect(w.timeMs).toBe(95000)
  expect(w.revenge.stage).toBe('hunting')
  expect({ x: boss.x, y: boss.y }).not.toEqual(start)
  expect(boss.tile).not.toBe(2)
  expect(w.revenge).toMatchObject({ arrests: 3, threshold: 3, blast: null })
  expect(w.buildings.every(b => !b?.sabotageUntilMs)).toBe(true)
})

it('moves without power and still reserves idle targets for pursuit rather than EMP attacks', () => {
  const w = populatedFactory(false), boss = w.revenge.boss!
  removeBuilding(w, 21, 18)
  advanceWorld(w, 1500)
  expect(boss.tile).not.toBe(2)
  expect(w.revenge.blast).toBeNull()
})
it('prefers a newly productive furnace over an idle assembler when reconsidering pursuit', () => {
  const w = populatedFactory(false), boss = w.revenge.boss!
  advanceWorld(w, 100)
  expect(boss.target).toBe(824)
  placeBuilding(w, 25, 24, 'furnace', 'east'); changeFurnaceRecipe(w, 25, 24, 'ironSmelting')
  const furnace = w.buildings[985] as CraftingMachine
  furnace.input.iron = 2
  placeBuilding(w, 25, 23, 'powerPole', 'east'); placeBuilding(w, 25, 22, 'generator', 'east')
  advanceWorld(w, 1500)
  expect(productiveTarget(w, 985)).toBe(true)
  expect(boss.target).toBe(985)
})
it('keeps actual full-tick movement identical at 30/60 FPS and after mid-pursuit save/load', () => {
  const w = populatedFactory(true), other = structuredClone(w)
  const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
  for (let i = 0; i < 90; i++) advanceWorld(w, 1000 / 30)
  for (let i = 0; i < 180; i++) advanceWorld(other, 1000 / 60)
  expect(other.revenge).toEqual(w.revenge)
  expect(w.revenge.boss!.tile).not.toBe(2)
  const loaded = decodeSave(encodeSave(w, view)).world
  advanceWorld(w, 4500); advanceWorld(loaded, 4500)
  expect(loaded.revenge).toEqual(w.revenge)
})
it.each([false, true])('continues pursuing when real production resumes (dense/water=%s)', dense => {
  const w = populatedFactory(dense), boss = w.revenge.boss!
  const mined = w.mined.iron, produced = w.produced.ironPlate
  removeBuilding(w, 24, 20); placeBuilding(w, 24, 20, 'storage', 'east')
  advanceWorld(w, 15000)
  expect(w.mined.iron).toBeGreaterThan(mined)
  expect(w.produced.ironPlate).toBeGreaterThan(produced)
  expect(boss.tile).not.toBe(2)
})
it('recovers from a newly placed obstruction and removal of its idle pursuit target', () => {
  const w = populatedFactory(false), boss = w.revenge.boss!
  advanceWorld(w, 1500)
  expect(boss.tile).toBe(3)
  expect(placeBuilding(w, 4, 0, 'storage', 'east')).toBe(true)
  advanceWorld(w, 1500)
  expect(boss.tile).not.toBe(3); expect(boss.tile).not.toBe(4)
  const tile = boss.tile
  removeBuilding(w, 24, 20)
  advanceWorld(w, 1500)
  expect(boss.target).toBe(822)
  expect(boss.tile).not.toBe(tile)
})
