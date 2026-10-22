import { createBareWorld as createWorld } from '../simulation/testFixtures'
import { describe, expect, it } from 'vitest'
import { placeBuilding } from '../simulation/world'
import type { CraftingMachine, World } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { changeCraftingRecipe } from '../simulation/crafting'
import { changeFurnaceRecipe } from '../simulation/smelting'
import { createResearch, purchaseTechnology, RP_UNITS, SPRINT11_TECHNOLOGIES } from '../simulation/research'
import { createAnalytics } from '../simulation/analytics'
import { decodeSave, encodeSave, SAVE_VERSION } from './saveGame'
import type { SaveDocument } from './saveGame'
const view = { scrollX: 12, scrollY: 34, zoom: 1.3, direction: 'east' as const, powerOverlay: true }
const date = '2026-10-20T12:00:00.000Z'
const document = (world: World): SaveDocument => JSON.parse(encodeSave(world, view, date))
function setup() {
  const world = createWorld(() => .5)
  world.research.balanceUnits = (40n * RP_UNITS + 123n).toString()
  purchaseTechnology(world, 'automation1')
  placeBuilding(world, 21, 18, 'generator', 'east'); placeBuilding(world, 21, 19, 'powerPole', 'east')
  placeBuilding(world, 20, 20, 'miner', 'east')
  placeBuilding(world, 21, 20, 'furnace', 'east'); changeFurnaceRecipe(world, 21, 20, 'ironSmelting')
  ;(world.buildings[821] as CraftingMachine).input.iron = 2
  placeBuilding(world, 22, 20, 'assembler', 'east'); changeCraftingRecipe(world, 22, 20, 'copperCable')
  ;(world.buildings[822] as CraftingMachine).input.copperPlate = 2
  advanceWorld(world, 1037.5)
  return world
}
describe('version-5 research persistence', () => {
  it('restores fractional currency, exact unlocks and deterministic continuation alongside analytics and jobs', () => {
    const world = setup(), before = document(world)
    const loaded = decodeSave(JSON.stringify(before))
    expect(SAVE_VERSION).toBe(15)
    expect(loaded.world.research).toEqual(world.research)
    expect(loaded.world.research.unlocked).toEqual(['basicIndustry', 'automation1'])
    expect(loaded.view).toEqual(view)
    expect(document(loaded.world)).toEqual(before)
    for (const delta of [12.5, 50, 750, 1050, 375, 1625, 2000]) {
      advanceWorld(world, delta); advanceWorld(loaded.world, delta)
      expect(document(loaded.world)).toEqual(document(world))
    }
  })
  it.each([1, 2, 3, 4])('migrates genuine version %i fields with zero RP and every Sprint 11 unlock', version => {
    const world = setup(), legacy = document(world)
    Object.assign(legacy, { version }); Reflect.deleteProperty(legacy.game, 'water')
    Reflect.deleteProperty(legacy.game, 'research'); Reflect.deleteProperty(legacy.game, 'peace'); Reflect.deleteProperty(legacy.game, 'nature'); Reflect.deleteProperty(legacy.game, 'revenge')
    if (version < 4) Reflect.deleteProperty(legacy.game, 'analytics')
    if (version < 3) {
      Reflect.deleteProperty(legacy.game, 'webs')
      Reflect.deleteProperty(legacy.game.pete, 'trappedBy'); Reflect.deleteProperty(legacy.game.pete, 'ignoredWebs')
      legacy.game.pete.travelMs *= 1.3
    }
    if (version === 1) Reflect.deleteProperty(legacy.game.pete, 'water')
    const loaded = decodeSave(JSON.stringify(legacy)).world
    expect(loaded.research).toEqual({ balanceUnits: '0', unlocked: SPRINT11_TECHNOLOGIES })
    expect(loaded.buildings).toEqual(world.buildings)
    expect(loaded.mined).toEqual(world.mined)
    expect(loaded.produced).toEqual(world.produced)
    expect(loaded.timeMs).toBe(world.timeMs)
    expect(loaded.remainder).toBe(world.remainder)
    expect(loaded.pete.travelMs).toBeCloseTo(world.pete.travelMs, 10)
    expect({ ...loaded.pete, travelMs: 0 }).toEqual({ ...world.pete, travelMs: 0 })
    expect(loaded.analytics).toEqual(version < 4 ? createAnalytics(world.timeMs) : world.analytics)
    expect(document(loaded).game.research).toEqual(createResearch(true))
  })
  it.each([
    ['missing research', (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'research') }],
    ['negative currency', (d: SaveDocument) => { d.game.research.balanceUnits = '-1' }],
    ['fractional currency', (d: SaveDocument) => { d.game.research.balanceUnits = '1.5' }],
    ['noncanonical currency', (d: SaveDocument) => { d.game.research.balanceUnits = '01' }],
    ['overflow currency', (d: SaveDocument) => { d.game.research.balanceUnits = '1'.repeat(41) }],
    ['numeric currency', (d: SaveDocument) => { Object.assign(d.game.research, { balanceUnits: 3 }) }],
    ['missing Basic Industry', (d: SaveDocument) => { d.game.research.unlocked = ['automation1'] }],
    ['missing prerequisite', (d: SaveDocument) => { d.game.research.unlocked = ['basicIndustry', 'analytics1'] }],
    ['duplicate technology', (d: SaveDocument) => { d.game.research.unlocked.push('basicIndustry') }],
    ['unknown technology', (d: SaveDocument) => { Object.assign(d.game.research, { unlocked: ['basicIndustry', 'labs'] }) }],
    ['unknown field', (d: SaveDocument) => { Object.assign(d.game.research, { rp: 50 }) }],
    ['hidden research in legacy schema', (d: SaveDocument) => { Object.assign(d, { version: 4 }); Reflect.deleteProperty(d.game, 'water') }],
  ] as const)('rejects %s without replacing or resetting the current world', (_name, mutate) => {
    const world = setup(), before = document(world), bad = structuredClone(before)
    mutate(bad)
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    expect(document(world)).toEqual(before)
  })
})
