import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { createWorld } from '../simulation/world'
import { attackWalker } from '../factory/revengeSystem'
import { RP_UNITS } from '../simulation/research'
import { purchaseTechnology } from '../factory/research'
beforeEach(() => useGameStore.setState(useGameStore.getInitialState(), true))
describe('combat toolbar access and existing tool behavior', () => {
  it('exposes the swatter by default and enforces both Revenge research gates', () => {
    const world = createWorld(() => .5)
    useGameStore.getState().publish(world)
    useGameStore.getState().select('flySwatter')
    expect(useGameStore.getState()).toMatchObject({ tool: 'flySwatter', buildTab: 'pete' })
    useGameStore.getState().select('drill')
    expect(useGameStore.getState()).toMatchObject({ tool: 'flySwatter', message: 'Requires Revenge Defense I.' })
    world.research.balanceUnits = (180n * RP_UNITS).toString()
    purchaseTechnology(world, 'revengeDefense1'); useGameStore.getState().publish(world)
    useGameStore.getState().select('drill'); expect(useGameStore.getState().tool).toBe('drill')
    useGameStore.getState().select('lightningBeam'); expect(useGameStore.getState().tool).toBe('drill')
    purchaseTechnology(world, 'revengeDefense2'); useGameStore.getState().publish(world)
    useGameStore.getState().select('lightningBeam'); expect(useGameStore.getState().tool).toBe('lightningBeam')
  })
  it('leaves the shared cooldown intact across tool changes, misses, tabs and existing hotkeys', () => {
    const world = createWorld(() => .5)
    world.research.unlocked.push('revengeDefense1', 'revengeDefense2')
    useGameStore.getState().publish(world)
    const buildings = structuredClone(world.buildings)
    const impact = attackWalker(world, 'flySwatter', { x: 20, y: 20 })
    expect(impact).toMatchObject({ hit: false, damage: 0 })
    useGameStore.getState().select('drill')
    expect(attackWalker(world, 'drill', { x: 20, y: 20 })).toBeNull()
    useGameStore.getState().setBuildTab('factory')
    useGameStore.getState().handleToolKey({ code: 'Digit4', repeat: false })
    expect(useGameStore.getState()).toMatchObject({ tool: 'furnace', buildTab: 'factory' })
    useGameStore.getState().select('lightningBeam')
    useGameStore.getState().handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState().tool).toBeNull()
    expect(world.revenge.playerReadyAtMs).toBe(1000)
    expect(world.buildings).toEqual(buildings)
  })
})
