import { describe, expect, it } from 'vitest'
import { peteStatus } from './peteStatus'
import { createBareWorld } from './testFixtures'
import { placeBuilding } from './world'
import type { SupplyCrate } from './world'
import { useGameStore } from '../state/gameStore'
function world() { const w = createBareWorld(() => .5); w.nature.wood = 100; placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); return w }
describe('Pete project inspection', () => {
  it('reports exact shortages in one reachable crate, prerequisites and path levels without changing the world', () => {
    const w = world(), crate = w.buildings[824] as SupplyCrate
    crate.wood = 2; crate.inventory.copperPlate = 8; crate.inventory.copperCable = 3
    const before = structuredClone(w), status = peteStatus(w)
    expect(status.current).toBeNull()
    expect(status.projects.find(p => p.id === 'fence')?.reason).toContain('4 Wood')
    expect(status.projects.find(p => p.id === 'experiment')?.reason).toContain('1 Copper cable')
    expect(status.projects.find(p => p.id === 'coop')?.reason).toContain('First I need: Fence')
    expect(status.projects.find(p => p.id === 'garden')?.reason).toContain('level 2')
    expect(w).toEqual(before)
    status.personality.paths.eco.xp = 999
    expect(w.personality.paths.eco.xp).toBe(0)
  })
  it('distinguishes unreachable funding from funded projects without a safe site', () => {
    const w = world(); (w.buildings[824] as SupplyCrate).inventory.ironGear = 10
    for (const [x, y] of [[23, 20], [25, 20], [24, 19], [24, 21]]) placeBuilding(w, x, y, 'storage', 'east')
    expect(peteStatus(w).projects.find(p => p.id === 'press')?.reason).toContain('cannot reach')
    const clear = world(); (clear.buildings[824] as SupplyCrate).inventory.ironGear = 10
    for (const radius of [2, 3, 4, 5, 6]) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) placeBuilding(clear, 20 + dx * radius, 20 + dy * radius, 'storage', 'east')
    expect(peteStatus(clear).projects.find(p => p.id === 'press')?.reason).toContain('free space')
  })
  it('opens only without a tool, refreshes detached values and closes on Escape or tool selection', () => {
    useGameStore.setState(useGameStore.getInitialState(), true)
    const w = world(); useGameStore.getState().inspectPete(w)
    expect(useGameStore.getState().peteInspection).toBeNull()
    useGameStore.getState().select(null); useGameStore.getState().inspectPete(w)
    expect(useGameStore.getState().peteInspection?.wish).not.toBeNull()
    const crate = w.buildings[824] as SupplyCrate; crate.wood = 6
    useGameStore.getState().publish(w)
    expect(useGameStore.getState().peteInspection?.projects.find(p => p.id === 'fence')?.ready).toBe(true)
    useGameStore.getState().handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState().peteInspection).toBeNull()
    useGameStore.getState().inspectPete(w); useGameStore.getState().select('belt')
    expect(useGameStore.getState().peteInspection).toBeNull()
  })
})
