import { createUnlockedWorld } from './testFixtures'
import { describe, expect, it, vi } from 'vitest'
import { incomingRecipe } from './smelting'
import { RECIPES } from './recipes'
import { buildingAt, placeBuilding } from './world'
import type { Furnace } from './world'

describe('unambiguous furnace recipe detection', () => {
  it('keeps each unique ore mapping and refuses unrelated ingredients', () => {
    const world = createUnlockedWorld(() => .5); placeBuilding(world, 20, 20, 'furnace', 'east')
    const furnace = buildingAt(world, 20, 20) as Furnace
    expect(incomingRecipe(furnace, 'iron')).toBe('ironSmelting')
    expect(incomingRecipe(furnace, 'copper')).toBe('copperSmelting')
    expect(incomingRecipe(furnace, 'ironPlate')).toBeNull()
    expect(furnace.recipeId).toBeNull()
  })
  it('does not arbitrarily choose the first match when an ingredient has two recipes', () => {
    const world = createUnlockedWorld(() => .5); placeBuilding(world, 20, 20, 'furnace', 'east')
    const furnace = buildingAt(world, 20, 20) as Furnace
    // Simulate a future registry extension without adding an unimplemented gameplay recipe.
    const spy = vi.spyOn(Object, 'values').mockImplementationOnce(() => [RECIPES.ironSmelting, { ...RECIPES.copperSmelting, inputs: { iron: 1 } }])
    try { expect(incomingRecipe(furnace, 'iron')).toBeNull() } finally { spy.mockRestore() }
    expect(furnace.recipeId).toBeNull()
  })
})
