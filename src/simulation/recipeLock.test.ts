import { describe, expect, it } from 'vitest'
import { changeCraftingRecipe } from './crafting'
import { inspectBuilding } from './inspection'
import { assemblerInputCapacity } from './assemblerRecipes'
import { changeFurnaceRecipe } from './smelting'
import { advanceWorld } from './step'
import { poweredWorld } from './testFixtures'
import { canReceive, deliverItem } from './transport'
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
    expect(change(world, 22, 20, 'auto')).toContain('one-time')
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
  it('keeps the assembler candidate provisional until the deadline, so complete circuits can win', () => {
    const { world, machine } = setup('assembler')
    deliverItem(machine, 'ironPlate', 'east'); deliverItem(machine, 'ironPlate', 'east')
    advanceWorld(world, 1000)
    expect(machine).toMatchObject({ recipeId: 'ironGear', recipeLocked: false })
    expect(inspectBuilding(world, 20 * SIZE + 22)).toMatchObject({ detectionStatus: 'choosing' })
    for (let i = 0; i < 3; i++) expect(deliverItem(machine, 'copperCable', 'east')).toBe(true)
    advanceWorld(world, 50)
    expect(machine).toMatchObject({ recipeId: 'electronicCircuit', recipeLocked: true, job: { recipeId: 'electronicCircuit' } })
    expect(inspectBuilding(world, 20 * SIZE + 22)).toMatchObject({ detectionStatus: 'automatic-locked', recipeWaitRemainingMs: 0 })
  })
  it('locks on the deadline under no power and backpressure, and rejects later priority changes', () => {
    const { world, machine } = setup('assembler')
    removeBuilding(world, 21, 18)
    machine.output.ironGear = 4
    deliverItem(machine, 'ironPlate', 'east'); deliverItem(machine, 'ironPlate', 'east')
    advanceWorld(world, 2050)
    expect(machine).toMatchObject({ recipeId: 'ironGear', recipeLocked: true, job: null, input: { ironPlate: 2 } })
    expect(canReceive(machine, 'copperCable', 'east')).toBe(false)
    expect(deliverItem(machine, 'copperCable', 'east')).toBe(false)
    advanceWorld(world, 10000)
    expect(machine.recipeId).toBe('ironGear')
    expect(machine.input.copperCable).toBe(0)
  })
  it.each(['furnace', 'assembler'] as const)('%s leaves an incompatible inserter item safely held after locking', kind => {
    const { world, machine } = setup(kind)
    if (kind === 'furnace') deliverItem(machine, 'iron', 'east')
    else { deliverItem(machine, 'ironPlate', 'east'); deliverItem(machine, 'ironPlate', 'east'); advanceWorld(world, 2050) }
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
  it('preserves speculative stock without converting it and rejects further incompatible deliveries', () => {
    const { world, machine } = setup('assembler')
    for (const item of ['ironPlate', 'ironPlate', 'copperPlate'] as const) deliverItem(machine, item, 'east')
    advanceWorld(world, 4050)
    expect(machine).toMatchObject({ recipeId: 'ironGear', recipeLocked: true, input: { copperPlate: 1 }, output: { ironGear: 1 } })
    expect(assemblerInputCapacity(machine as Assembler, 'copperPlate')).toBe(0)
    expect(deliverItem(machine, 'copperPlate', 'east')).toBe(false)
    expect(machine.input.copperPlate).toBe(1)
    expect(world.produced.copperCable).toBe(0)
    expect(changeCraftingRecipe(world, 22, 20, 'copperCable')).toContain('Empty both')
  })
  it('does not repeat the assembler detection delay for subsequent batches of the locked recipe', () => {
    const { world, machine } = setup('assembler')
    for (let i = 0; i < 4; i++) deliverItem(machine, 'ironPlate', 'east')
    advanceWorld(world, 4050)
    expect(machine.job).toMatchObject({ recipeId: 'ironGear', elapsedMs: 0 })
    expect(world.produced.ironGear).toBe(1)
    advanceWorld(world, 2000)
    expect(world.produced.ironGear).toBe(2)
    expect(machine.recipeLocked).toBe(true)
  })
})
