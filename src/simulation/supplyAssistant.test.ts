import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import type { Belt, Storage, SupplyCrate } from './world'
import { supplyOffers, supplyProject } from './supplyAssistant'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { useGameStore } from '../state/gameStore'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function fixture() {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  placeBuilding(w, 24, 22, 'storage', 'east'); placeBuilding(w, 24, 23, 'storage', 'east'); placeBuilding(w, 24, 24, 'storage', 'east')
  return { w, crate: w.buildings[824] as SupplyCrate, near: w.buildings[904] as Storage, second: w.buildings[944] as Storage, far: w.buildings[984] as Storage }
}
describe('explicit project material handoff', () => {
  it('shows exact existing supplies without changing any authoritative state', () => {
    const { w, crate, near } = fixture(); crate.inventory.ironPlate = 3; near.inventory.ironPlate = 6
    const before = structuredClone(w), offer = supplyOffers(w, 824).find(o => o.id === 'workshop')!
    expect(offer.amounts).toEqual([{ material: 'ironPlate', label: 'Iron plate', required: 12, stored: 3, available: 6 }]); expect(offer.transferable).toBe(6); expect(w).toEqual(before)
    expect(supplyOffers(w, 824).some(o => o.id === 'orchard')).toBe(false)
  })
  it('moves only shortages from nearby chests, without manufacturing, consumption or XP', () => {
    const { w, crate, near, second, far } = fixture()
    near.inventory.ironPlate = 7; second.inventory.ironPlate = 10; far.inventory.ironPlate = 99; near.inventory.copperPlate = 4
    const produced = structuredClone(w.produced), analytics = structuredClone(w.analytics), personality = structuredClone(w.personality)
    expect(supplyProject(w, 824, 'workshop')).toBe(12)
    expect(crate.inventory.ironPlate).toBe(12); expect(near.inventory.ironPlate).toBe(0); expect(second.inventory.ironPlate).toBe(5); expect(far.inventory.ironPlate).toBe(99)
    expect(near.inventory.copperPlate).toBe(4); expect(supplyProject(w, 824, 'workshop')).toBe(0)
    expect(w.produced).toEqual(produced); expect(w.analytics).toEqual(analytics); expect(w.personality).toEqual(personality)
  })
  it('shares the crate capacity with Wood and all items, revalidating stale and missing sources', () => {
    const { w, crate, near } = fixture(); crate.wood = 197; near.inventory.ironPlate = 20
    expect(supplyProject(w, 824, 'workshop')).toBe(3); expect(crate.inventory.ironPlate).toBe(3); expect(near.inventory.ironPlate).toBe(17)
    expect(supplyProject(w, 824, 'fence')).toBe(0)
    crate.wood = 0; removeBuilding(w, 24, 22); expect(supplyProject(w, 824, 'workshop')).toBe(0)
    removeBuilding(w, 24, 20); expect(supplyProject(w, 824, 'workshop')).toBe(0); expect(supplyProject(w, -1, 'workshop')).toBe(0)
  })
  it('moves Wood through the existing global-stock command and rejects unknown projects', () => {
    const { w, crate } = fixture(), wood = w.nature.wood
    expect(supplyProject(w, 824, 'fence')).toBe(6); expect(crate.wood).toBe(6); expect(w.nature.wood).toBe(wood - 6)
    expect(supplyProject(w, 824, 'fence')).toBe(0); expect(supplyProject(w, 824, 'unknown')).toBe(0)
    w.nature.wood = 0; expect(supplyProject(w, 824, 'garden')).toBe(0)
  })
  it('handles mixed-material partial supplies and keeps old saves/continued simulation exact', () => {
    const { w, crate, near } = fixture(); near.inventory.copperPlate = 8; near.inventory.copperCable = 2
    expect(supplyProject(w, 824, 'experiment')).toBe(10); expect(crate.inventory.copperPlate).toBe(8); expect(crate.inventory.copperCable).toBe(2)
    const saved = encodeSave(w, view, '2026-10-24T00:00:00.000Z'), loaded = decodeSave(saved).world
    advanceWorld(w, 3700); advanceWorld(loaded, 3700)
    expect(JSON.parse(encodeSave(loaded, view, '2026-10-24T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-24T00:00:00.000Z')))
  })
  it('publishes usable paused inspection offers and applies a queued handoff only once', () => {
    const { w, crate, near } = fixture(); near.inventory.ironPlate = 20
    useGameStore.setState(useGameStore.getInitialState(), true); useGameStore.getState().select(null); useGameStore.getState().inspect(w, 24, 20)
    expect(useGameStore.getState().supplies.find(o => o.id === 'workshop')?.transferable).toBe(12)
    useGameStore.setState({ supplyRequest: { index: 824, id: 'workshop' } }); useGameStore.getState().applySupply(w); useGameStore.getState().applySupply(w)
    expect(crate.inventory.ironPlate).toBe(12); expect(near.inventory.ironPlate).toBe(8); expect(useGameStore.getState().supplyRequest).toBeNull()
  })
  it('retains incoming belt items when the handoff fills the last shared crate slots', () => {
    const { w, crate, near } = fixture(); crate.wood = 197; near.inventory.ironPlate = 10
    placeBuilding(w, 23, 20, 'belt', 'east'); const belt = w.buildings[823] as Belt; belt.item = 'copperPlate'; belt.progress = 1
    expect(supplyProject(w, 824, 'workshop')).toBe(3); advanceWorld(w, 50)
    expect(crate.wood + crate.inventory.ironPlate).toBe(200); expect(belt.item).toBe('copperPlate'); expect(near.inventory.ironPlate).toBe(7)
  })
})
