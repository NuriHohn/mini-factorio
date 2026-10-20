import { describe, expect, it } from 'vitest'
import { assemblerInputCapacity } from './assemblerRecipes'
import { changeCraftingRecipe } from './crafting'
import { inspectBuilding } from './inspection'
import { advanceWorld } from './step'
import { poweredWorld } from './testFixtures'
import { canReceive, deliverItem } from './transport'
import { buildingAt, placeBuilding, removeBuilding } from './world'
import type { Assembler, Belt } from './world'

function setup() {
  const world = poweredWorld(() => .5)
  placeBuilding(world, 20, 20, 'assembler', 'east')
  placeBuilding(world, 19, 20, 'belt', 'east')
  const machine = buildingAt(world, 20, 20) as Assembler
  return { world, machine, belt: buildingAt(world, 19, 20) as Belt }
}
describe('explicit assembler recipe selection', () => {
  it('starts unconfigured, consumes no power and refuses every ingredient until manual selection', () => {
    const { world, machine, belt } = setup()
    expect(machine).toMatchObject({ recipeMode: 'manual', recipeId: null, recipeLocked: false })
    for (const item of ['ironPlate', 'copperCable', 'copperPlate'] as const) {
      expect(assemblerInputCapacity(machine, item)).toBe(0)
      expect(canReceive(machine, item, 'east')).toBe(false)
      belt.item = item; belt.progress = 1
      advanceWorld(world, 5000)
      expect(belt.item).toBe(item)
      expect(machine.job).toBeNull()
    }
    expect(world.power?.consumers[820].requestedKw).toBe(0)
    expect(inspectBuilding(world, 820)).toMatchObject({ recipeId: null, recipeChangeError: null })
    expect(changeCraftingRecipe(world, 20, 20, 'auto')).toContain('manual')
  })
  it.each([
    ['ironGear', 'ironPlate', 2, 'ironGear', 1],
    ['copperCable', 'copperPlate', 1, 'copperCable', 2],
  ] as const)('starts manually selected %s immediately without a detection wait', (recipe, input, quantity, output, amount) => {
    const { world, machine } = setup()
    expect(changeCraftingRecipe(world, 20, 20, recipe)).toBeNull()
    for (let i = 0; i < quantity; i++) expect(deliverItem(machine, input, 'east')).toBe(true)
    advanceWorld(world, 50)
    expect(machine.job?.elapsedMs).toBe(0)
    expect(changeCraftingRecipe(world, 20, 20, 'electronicCircuit')).toContain('active batch')
    advanceWorld(world, 2000)
    expect(machine.output[output]).toBe(amount)
    expect(changeCraftingRecipe(world, 20, 20, 'electronicCircuit')).toContain('Empty both')
  })
  it('keeps a manually chosen gear recipe when later circuit ingredients arrive', () => {
    const { world, machine, belt } = setup()
    changeCraftingRecipe(world, 20, 20, 'ironGear')
    machine.input.ironPlate = 4
    belt.item = 'copperCable'; belt.progress = 1
    advanceWorld(world, 5000)
    expect(machine.recipeId).toBe('ironGear')
    expect(machine.output.ironGear).toBe(2)
    expect(belt.item).toBe('copperCable')
    expect(machine.input.copperCable).toBe(0)
  })
  it('accepts circuit ingredients in either order within independent capacities', () => {
    for (const order of [['ironPlate', 'copperCable', 'copperCable', 'copperCable'], ['copperCable', 'copperCable', 'copperCable', 'ironPlate']] as const) {
      const { world, machine } = setup()
      changeCraftingRecipe(world, 20, 20, 'electronicCircuit')
      for (const item of order) expect(deliverItem(machine, item, 'east')).toBe(true)
      expect(assemblerInputCapacity(machine, 'copperCable')).toBe(6)
      advanceWorld(world, 3050)
      expect(machine.output.electronicCircuit).toBe(1)
      expect(machine.input.ironPlate).toBe(0); expect(machine.input.copperCable).toBe(0)
      expect(world.analytics.samples.reduce((n, s) => n + s.consumed.copperCable, 0)).toBe(3)
    }
  })
  it('rejects wrong-machine recipes and preserves safe manual switching restrictions', () => {
    const { world, machine } = setup()
    expect(changeCraftingRecipe(world, 20, 20, 'ironSmelting')).toContain('not compatible')
    changeCraftingRecipe(world, 20, 20, 'ironGear')
    machine.input.ironPlate = 1
    expect(changeCraftingRecipe(world, 20, 20, 'copperCable')).toContain('Empty both')
    machine.input.ironPlate = 0
    expect(changeCraftingRecipe(world, 20, 20, 'copperCable')).toBeNull()
    expect(machine.recipeId).toBe('copperCable')
  })
  it('preserves power interruption, reservations and output backpressure without duplicate products', () => {
    const { world, machine } = setup()
    changeCraftingRecipe(world, 20, 20, 'copperCable'); machine.input.copperPlate = 2
    machine.output.copperCable = 4
    advanceWorld(world, 1000)
    expect(machine.job).toBeNull(); expect(machine.input.copperPlate).toBe(2)
    machine.output.copperCable = 2
    advanceWorld(world, 1050)
    expect(machine.job?.elapsedMs).toBe(1000)
    removeBuilding(world, 21, 18)
    const frozen = structuredClone(machine)
    advanceWorld(world, 5000)
    expect(machine).toEqual(frozen)
    placeBuilding(world, 21, 18, 'generator', 'east'); advanceWorld(world, 1000)
    expect(machine.output.copperCable).toBe(4)
    expect(machine.input.copperPlate).toBe(1)
    expect(world.produced.copperCable).toBe(2)
  })
})
