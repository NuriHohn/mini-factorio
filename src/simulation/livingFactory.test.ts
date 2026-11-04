import { beforeAll, describe, expect, it } from 'vitest'
import { prioritizeProject } from '../pete/priorities'
import { advancePetesWorld } from '../pete/simulation'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { createPetesWorld, placeIron, placeCopper } from './petesWorld'
import { advanceHomestead, chooseDemandWork, materialStore } from './homestead'
import { refreshNatureSchedule } from './nature'
import { emptyInventory } from './items'
import { placeBuilding, removeBuilding, SIZE } from './world'
import { developmentFocus } from './developmentFocus'
import { advanceInfrastructure, earlySupplyReady } from './infrastructure'
import { preferredPaths } from './resourcePreference'
import type { World } from './world'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-30T12:00:00.000Z'))
function until(w: World, done: () => boolean, limit: number) {
  for (let t = 0; t < limit && !done(); t += 50) advancePetesWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, task: w.homestead?.task, stock: materialStore(w)?.inventory, paths: w.personality.paths })).toBe(true)
}
it('keeps whole-path choices across paid work and saves and rejects unsupported strategies', () => {
  const w = createPetesWorld()
  expect(placeIron(w, 26, 18)).toBeNull(); expect(placeCopper(w, 14, 18)).toBeNull()
  expect(prioritizeProject(w, 'path:inventor:production')).toBe(true)
  expect(preferredPaths(w)[0]).toBe('inventor')
  until(w, () => w.homestead!.task !== null, 60000)
  const paid = structuredClone(w.homestead!)
  expect(prioritizeProject(w, 'path:craftsman:transport')).toBe(true)
  expect({ ...w.homestead, priority: paid.priority }).toEqual(paid)
  const loaded = decodeSave(encodeSave(w, view)).world
  advancePetesWorld(w, 12550); advancePetesWorld(loaded, 12550)
  expect(save(loaded)).toEqual(save(w))
  expect(developmentFocus(loaded)).toEqual({ path: 'craftsman', strategy: 'transport' })
  expect(prioritizeProject(w, 'path:craftsman:storage')).toBe(false)
  const bad = save(w); bad.game.homestead.priority = 'path:eco:free'
  expect(() => decodeSave(JSON.stringify(bad))).toThrow('homestead.priority')
  const old = save(createPetesWorld()); old.version = 54; delete old.game.deposits
  delete old.game.homestead.infrastructure.nextSupplyAtMs
  expect(decodeSave(JSON.stringify(old)).world.homestead!.priority).toBeNull()
  old.game.homestead.priority = 'path:eco:storage'
  expect(() => decodeSave(JSON.stringify(old))).toThrow('homestead.priority')
})
it('takes the missing invoice batch before unrelated handwork and respects capacity', () => {
  const w = createPetesWorld(), h = w.homestead!, storeTile = 22 * SIZE + 20, furnaceTile = 22 * SIZE + 24
  w.buildings[storeTile] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  h.store = storeTile; h.expansion.furnace = furnaceTile; h.expansion.miner = 18 * SIZE + 26
  expect(placeBuilding(w, 24, 22, 'furnace', 'east')).toBe(true)
  const furnace = w.buildings[furnaceTile]!
  if (furnace.kind !== 'furnace') throw new Error('Expected furnace')
  furnace.output.ironPlate = 2
  expect(prioritizeProject(w, 'path:craftsman:production')).toBe(true)
  expect(chooseDemandWork(w)).toBe(true)
  expect(h.task).toBe('takeIron'); expect(h.target).toBe(furnaceTile)
  h.task = null; h.target = null
  materialStore(w)!.inventory.iron = 200
  expect(chooseDemandWork(w)).toBe(false)
  expect(h.task).toBeNull(); expect(furnace.output.ironPlate).toBe(2)
})
it('makes production and transport choices commit different paid, useful work', () => {
  const a = createPetesWorld(), h = a.homestead!
  for (let i = 0; i < a.buildings.length; i++) if (i !== a.peace.home) a.buildings[i] = null
  a.water.fill(false); a.tiles.fill(null); a.topologyRevision++; refreshNatureSchedule(a)
  h.store = 900
  a.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  expect(placeBuilding(a, 14, 17, 'furnace', 'east')).toBe(true); h.expansion.furnace = 694
  a.tiles[974] = 'iron'
  expect(placeBuilding(a, 14, 24, 'miner', 'east')).toBe(true); h.expansion.miner = 974
  a.personality.paths.craftsman.level = 3
  materialStore(a)!.inventory.ironPlate = 8; materialStore(a)!.inventory.iron = 2
  const b = structuredClone(a)
  expect(prioritizeProject(a, 'path:craftsman:production')).toBe(true)
  expect(prioritizeProject(b, 'path:craftsman:transport')).toBe(true)
  advanceHomestead(a, 50, true); advanceHomestead(b, 50, true)
  expect(a.homestead!.task).toBe('feedIron')
  expect(a.homestead!.carried.iron).toBe(2)
  expect(b.homestead!.task).toBe('buildConnection')
  for (const w of [a, b]) {
    for (let t = 0; t < 240000 && w.homestead!.task; t += 50) { w.timeMs += 50; advanceHomestead(w, 50) }
    expect(w.homestead!.task).toBeNull()
  }
  expect(materialStore(a)!.inventory.iron).toBe(0)
  const furnace = a.buildings[694]!
  expect(furnace.kind === 'furnace' && furnace.input.iron).toBe(2)
  expect(materialStore(b)!.inventory.ironPlate).toBe(0)
  expect(b.homestead!.infrastructure.links.map(link => link.kind)).toEqual(['iron'])
})
it('pays for real store shelves when the player prioritizes Eco storage', () => {
  const w = createPetesWorld(), h = w.homestead!
  h.store = 900
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 1 }
  materialStore(w)!.inventory.woodenCrate = 4
  w.personality.paths.eco.level = 4
  expect(prioritizeProject(w, 'path:eco:storage')).toBe(true)
  advanceHomestead(w, 50, true)
  expect(h.task).toBe('improve'); expect(h.expansion.improvement).toBe('storeShelves')
  for (let t = 0; t < 120000 && h.task; t += 50) { w.timeMs += 50; advanceHomestead(w, 50) }
  expect(h.task).toBeNull()
  expect(materialStore(w)!.inventory.woodenCrate).toBe(0)
  expect(materialStore(w)!.storeTier).toBe(2)
})
describe('early repeated goods flow from an empty iron world', () => {
  let w: World, paid: World, firstLevel = 0, firstStage = 0, produced = 0, samples = 0, deliveries = 0
  const milestones: Record<string, number> = {}
  beforeAll(() => {
    w = createPetesWorld(); expect(placeIron(w, 26, 18)).toBeNull()
    expect(prioritizeProject(w, 'path:craftsman:transport')).toBe(true)
    until(w, () => materialStore(w) !== null, 300000); milestones.store = w.timeMs
    until(w, () => w.workshopProject?.phase === 'complete', 600000 - w.timeMs); milestones.workshop = w.timeMs
  }, 60000)
  beforeAll(() => {
    until(w, () => earlySupplyReady(w, 'craftsman'), 900000 - w.timeMs); milestones.belt = w.timeMs
    until(w, () => w.homestead!.task === 'supplyOrder' && w.homestead!.carried.ironPlate === 2, 900000 - w.timeMs)
    milestones.firstSupply = w.timeMs; firstLevel = w.personality.paths.craftsman.level; firstStage = w.homestead!.infrastructure.craftsman
    paid = structuredClone(w); produced = w.produced.ironPlate
  }, 60000)
  it('delivers paid products before the level-five endgame and preserves active cargo on save', () => {
    expect(firstLevel).toBeLessThan(5); expect(firstStage).toBeLessThan(3)
    expect(materialStore(paid)!.inventory.ironPlate).toBeGreaterThanOrEqual(12)
    const loaded = decodeSave(encodeSave(paid, view)).world
    const bad = save(paid); bad.game.homestead.carried.ironPlate = 3
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    const badClock = save(paid); badClock.game.homestead.infrastructure.nextSupplyAtMs = paid.timeMs + 60050
    expect(() => decodeSave(JSON.stringify(badClock))).toThrow('nextSupplyAtMs')
    const demolished = structuredClone(paid), target = demolished.homestead!.target!
    removeBuilding(demolished, target % SIZE, Math.floor(target / SIZE))
    advanceInfrastructure(demolished, 50)
    expect(demolished.homestead!.task).toBe('returnStock')
    expect(demolished.homestead!.carried.ironPlate).toBe(2)
    advancePetesWorld(paid, 20000); advancePetesWorld(loaded, 20000)
    expect(save(loaded)).toEqual(save(paid))
  })
  beforeAll(() => {
    const oldDeadline = w.homestead!.infrastructure.nextSupplyAtMs
    until(w, () => w.homestead!.task !== 'supplyOrder' && w.homestead!.infrastructure.nextSupplyAtMs > oldDeadline, 120000)
    expect(w.homestead!.infrastructure.craftsman).toBe(firstStage)
    const deadline = w.homestead!.infrastructure.nextSupplyAtMs
    for (let t = 0; t < 600000; t += 50) {
      const supplying = w.homestead!.task === 'supplyOrder' && w.homestead!.carried.ironPlate === 2
      advancePetesWorld(w, 50)
      if (supplying && w.homestead!.task !== 'supplyOrder' && w.homestead!.carried.ironPlate === 0) deliveries++
      if (t % 1000 === 0 && w.buildings.some(b => b?.kind === 'belt' && b.item !== null)) samples++
    }
    expect(w.homestead!.infrastructure.nextSupplyAtMs).toBeGreaterThan(deadline)
  }, 60000)
  it('consumes and replenishes real belt products repeatedly without upgrading order stages', () => {
    expect(w.produced.ironPlate).toBeGreaterThan(produced)
    expect(samples).toBeGreaterThan(10)
    expect(deliveries).toBeGreaterThanOrEqual(2)
    console.info('Early factory milestones at normal speed (seconds)', Object.fromEntries(Object.entries(milestones).map(([key, ms]) => [key, ms / 1000])))
  })
  it('fetches a concrete missing batch without abandoning a running conveyor', () => {
    expect(prioritizeProject(w, 'veranda')).toBe(false)
    expect(prioritizeProject(w, null)).toBe(true)
    const before = structuredClone(w.homestead)
    // The completed goal has no missing invoice; no unrelated material job.
    expect(chooseDemandWork(w)).toBe(false)
    expect(w.homestead).toEqual(before)
  })
})
