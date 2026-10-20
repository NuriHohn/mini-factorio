import { describe, expect, it } from 'vitest'
import { changeCraftingRecipe } from './crafting'
import { inspectBuilding } from './inspection'
import { changeFurnaceRecipe } from './smelting'
import { advanceWorld } from './step'
import { poweredWorld } from './testFixtures'
import { deliverItem } from './transport'
import { buildingAt, placeBuilding, removeBuilding, SIZE } from './world'
import type { Assembler, Furnace, Inserter } from './world'

function setup(kind: 'furnace' | 'assembler') {
  const world = poweredWorld(() => .5)
  placeBuilding(world, 22, 20, kind, 'east')
  const machine = buildingAt(world, 22, 20) as Furnace | Assembler
  return { world, machine }
}
describe('one-time recipe detection and explicit overrides', () => {
  it.each(['furnace', 'assembler'] as const)('%s starts undetected and locks a manual choice permanently', kind => {
    const { world, machine } = setup(kind)
    expect(inspectBuilding(world, 20 * SIZE + 22)).toMatchObject({ recipeLocked: false, detectionStatus: 'undetected' })
    const change = kind === 'furnace' ? changeFurnaceRecipe : changeCraftingRecipe
    expect(change(world, 22, 20, kind === 'furnace' ? 'ironSmelting' : 'ironGear')).toBe(null)
    expect(machine.recipeLocked).toBe(true)
    expect(inspectBuilding(world, 20 * SIZE + 22)).toMatchObject({ detectionStatus: 'manual-locked' })
    const locked = structuredClone(machine)
    expect(change(world, 22, 20, 'auto')).toContain(kind === 'furnace' ? 'one-time' : 'manual')
    expect(machine).toEqual(locked)
    expect(change(world, 22, 20, kind === 'furnace' ? 'copperSmelting' : 'copperCable')).toBe(null)
    expect(machine.recipeLocked).toBe(true)
  })
  it.each(['iron', 'copper'] as const)('locks furnace %s detection on the first accepted item, before power', ore => {
    const { world, machine } = setup('furnace')
    removeBuilding(world, 21, 18)
    expect(deliverItem(machine, ore, 'east')).toBe(true)
    expect(machine).toMatchObject({ recipeLocked: true, recipeId: ore === 'iron' ? 'ironSmelting' : 'copperSmelting', job: null })
    expect(inspectBuilding(world, 20 * SIZE + 22)).toMatchObject({ detectionStatus: 'automatic-locked' })
    expect(deliverItem(machine, ore === 'iron' ? 'copper' : 'iron', 'east')).toBe(false)
  })
  it.each(['furnace', 'assembler'] as const)('%s leaves an incompatible inserter item safely held after locking', kind => {
    const { world, machine } = setup(kind)
    if (kind === 'furnace') deliverItem(machine, 'iron', 'east')
    else { changeCraftingRecipe(world, 22, 20, 'ironGear'); deliverItem(machine, 'ironPlate', 'east'); deliverItem(machine, 'ironPlate', 'east'); advanceWorld(world, 50) }
    placeBuilding(world, 21, 20, 'inserter', 'east')
    const hand = buildingAt(world, 21, 20) as Inserter
    hand.phase = 'carrying'; hand.elapsedMs = 500; hand.item = kind === 'furnace' ? 'copper' : 'copperCable'
    const before = structuredClone(machine.input)
    advanceWorld(world, 500)
    expect(hand.item).toBe(kind === 'furnace' ? 'copper' : 'copperCable')
    expect(hand.phase).toBe('carrying')
    expect(machine.input.copper).toBe(before.copper)
    expect(machine.input.copperCable).toBe(before.copperCable)
  })
  it('starts subsequent batches without changing the manual recipe', () => {
    const { world, machine } = setup('assembler')
    changeCraftingRecipe(world, 22, 20, 'ironGear')
    for (let i = 0; i < 4; i++) deliverItem(machine, 'ironPlate', 'east')
    advanceWorld(world, 2050)
    expect(machine.job).toMatchObject({ recipeId: 'ironGear', elapsedMs: 0 })
    expect(world.produced.ironGear).toBe(1)
    advanceWorld(world, 2000)
    expect(world.produced.ironGear).toBe(2)
    expect(machine.recipeLocked).toBe(true)
  })
})
