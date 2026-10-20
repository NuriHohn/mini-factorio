import { createUnlockedWorld } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { isSabotageable } from './buildingCapabilities'
import { advanceWorld } from './step'
import { poweredWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import type { Assembler, BuildingKind, Furnace, Inserter, Miner, World } from './world'
import { allocatePower, powerOverview } from './power'
import { inspectBuilding } from './inspection'
import { deliverItem } from './transport'
import { changeCraftingRecipe } from './crafting'
import { inventoryTotal } from './items'
function setup(kind: 'miner' | 'furnace' | 'assembler' | 'inserter' | 'generator') {
  const w = poweredWorld(() => .5)
  removeBuilding(w, 21, 18); placeBuilding(w, 23, 18, 'generator', 'east')
  Object.assign(w.pete, { x: 22, y: 21, tile: 862, cooldownMs: 20000 })
  for (const [x, y] of [[21, 21], [22, 22], [23, 21]]) placeBuilding(w, x, y, 'storage', 'east')
  w.tiles[822] = 'iron'; expect(placeBuilding(w, 22, 20, kind, 'east')).toBe(true)
  const b = w.buildings[822]!
  if (b.kind === 'furnace') deliverItem(b, 'iron', 'east')
  if (b.kind === 'assembler') { changeCraftingRecipe(w, 22, 20, 'ironGear'); deliverItem(b, 'ironPlate', 'east'); deliverItem(b, 'ironPlate', 'east') }
  if (b.kind === 'inserter') {
    placeBuilding(w, 21, 20, 'storage', 'east'); placeBuilding(w, 23, 20, 'storage', 'east')
    const source = w.buildings[821]!; if (source.kind === 'storage') source.inventory.iron = 3
  }
  if (b.kind === 'generator') {
    w.tiles[740] = 'iron'; placeBuilding(w, 20, 18, 'miner', 'north'); placeBuilding(w, 20, 17, 'belt', 'north'); placeBuilding(w, 20, 16, 'storage', 'east')
  }
  advanceWorld(w, 100); w.pete.cooldownMs = 0
  return { w, b }
}
function hit(w: World) { advanceWorld(w, 50); expect(w.pete.pumpkin?.index).toBe(822); advanceWorld(w, 400) }
describe('centralized expanded sabotage capabilities', () => {
  it.each(['miner', 'furnace', 'assembler', 'inserter', 'generator'] as const)('disables active %s for ten seconds and recovers', kind => {
    const { w, b } = setup(kind); hit(w)
    expect(b.sabotageUntilMs).toBe(w.timeMs + 10000)
    expect(inspectBuilding(w, 822)).toMatchObject({ electrical: { state: 'sabotaged', sabotageRemainingMs: 10000 } })
    if (kind !== 'generator') expect(w.power!.consumers[822].suppliedKw).toBe(0)
    const until = b.sabotageUntilMs!
    advanceWorld(w, 9950); expect(b.sabotageUntilMs).toBe(until)
    advanceWorld(w, 50); expect(inspectBuilding(w, 822)).not.toMatchObject({ electrical: { state: 'sabotaged' } })
  })
  it.each(['belt', 'splitter', 'storage', 'powerPole', 'radar', 'sprinkler', 'prison'] as BuildingKind[])('excludes %s in the shared capability registry', kind => {
    expect(isSabotageable({ kind })).toBe(false)
  })
  it('prefers an operational machine over a lower-index idle machine', () => {
    const { w } = setup('furnace')
    w.tiles[821] = 'iron'; placeBuilding(w, 21, 20, 'miner', 'north')
    ;(w.buildings[821] as Miner).item = 'iron'
    advanceWorld(w, 50)
    expect(w.pete.pumpkin?.index).toBe(822)
  })
  it('does not attack an idle disconnected generator', () => {
    const w = createUnlockedWorld(() => .5)
    placeBuilding(w, 18, 23, 'generator', 'east'); w.pete.cooldownMs = 0
    advanceWorld(w, 50); expect(w.pete.pumpkin).toBeNull()
  })
  it('never extends a disable already applied before projectile impact', () => {
    const { w, b } = setup('inserter'); advanceWorld(w, 50)
    b.sabotageUntilMs = w.timeMs + 10000
    const originalEnd = b.sabotageUntilMs
    advanceWorld(w, 400); expect(b.sabotageUntilMs).toBe(originalEnd)
  })
  it('freezes held items and arm progress through the disable and conserves inventory after recovery', () => {
    const { w, b } = setup('inserter'); hit(w)
    const arm = b as Inserter, held = structuredClone(arm)
    expect(arm.phase).toBe('carrying'); expect(arm.item).toBe('iron')
    advanceWorld(w, 9950); expect(arm).toEqual(held)
    Object.assign(w.pete, { x: 0, y: 39, tile: 1560 }) // Isolate recovery from a later independent attack.
    advanceWorld(w, 2050)
    const source = w.buildings[821]!, target = w.buildings[823]!
    expect(source.kind === 'storage' && target.kind === 'storage' && source.inventory.iron + target.inventory.iron + Number(arm.item !== null)).toBe(3)
    expect(target.kind === 'storage' && target.inventory.iron).toBeGreaterThan(0)
  })
  it('removes only sabotaged generator capacity and reports correct load sharing and installed capacity', () => {
    const { w, b } = setup('generator'); hit(w)
    expect(powerOverview(w)).toMatchObject({ installedKw: 200, connectedKw: 100 })
    expect(inspectBuilding(w, 822)).toMatchObject({ actualKw: 0, electrical: { network: { generators: 2, activeGenerators: 1 } } })
    allocatePower(w)
    const network = w.power!.networks[0]
    expect(inspectBuilding(w, 743)).toMatchObject({ actualKw: network.suppliedKw })
    advanceWorld(w, 10000); expect(w.power!.networks[0].capacityKw).toBe(200)
    expect(b.sabotageUntilMs).toBe(w.timeMs)
  })
  it('retains committed crafting ingredients and reservations during the disable', () => {
    for (const kind of ['furnace', 'assembler'] as const) {
      const { w, b } = setup(kind); hit(w)
      const machine = b as Furnace | Assembler, job = structuredClone(machine.job)
      expect(job).not.toBeNull()
      const input = inventoryTotal(machine.input), output = inventoryTotal(machine.output)
      advanceWorld(w, 9950)
      expect(machine.job).toEqual(job); expect(inventoryTotal(machine.input)).toBe(input); expect(inventoryTotal(machine.output)).toBe(output)
    }
  })
})
