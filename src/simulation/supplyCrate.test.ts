import { describe, expect, it } from 'vitest'
import { createBareWorld, poweredWorld } from './testFixtures'
import { placeBuilding, removeBuilding, offsets, DIRECTIONS, SIZE } from './world'
import type { Belt, Inserter, Storage, SupplyCrate, World } from './world'
import { ITEMS, inventoryTotal } from './items'
import { advanceTransport, deliverItem } from './transport'
import { advanceWorld } from './step'
import { inspectBuilding, worldStats } from './inspection'
import { reachableCrateSpot, SUPPLY_CRATE_CAPACITY, SUPPLY_CRATE_WOOD, SUPPLY_INSPECTION_MS } from './supplyCrate'
import { placementInfo } from './construction'
import type { SaveDocument } from '../persistence/saveGame'
import { encodeSave, decodeSave, SAVE_VERSION } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const encode = (w: World) => encodeSave(w, view, '2026-10-22T00:00:00.000Z')
const crate = (w: World, x = 20, y = 20) => w.buildings[y * SIZE + x] as SupplyCrate
function world() { const w = createBareWorld(() => .5); w.nature.wood = 100; return w }
function home() {
  const w = world()
  expect(placeBuilding(w, 20, 20, 'treehouse', 'east')).toBe(true)
  expect(placeBuilding(w, 24, 20, 'supplyCrate', 'east')).toBe(true)
  return w
}
function visit(w: World) {
  for (let t = 0; t < 180000 && w.peace.activity !== 'checkingCrate'; t += 50) advanceWorld(w, 50)
  expect(w.peace.activity).toBe('checkingCrate')
}
describe('Pete supply delivery', () => {
  it('uses ordinary dry-land placement, peaceful-tool availability, funding, collision and demolition', () => {
    const w = world(); w.nature.wood = 5
    expect(placementInfo(w, { x: 20, y: 20 }, 'supplyCrate').state).toBe('unaffordable')
    expect(placeBuilding(w, 20, 20, 'supplyCrate', 'east')).toBe(false)
    w.nature.wood = SUPPLY_CRATE_WOOD; w.water[820] = true
    expect(placeBuilding(w, 20, 20, 'supplyCrate', 'east')).toBe(false)
    expect(w.nature.wood).toBe(SUPPLY_CRATE_WOOD); w.water[820] = false
    expect(placeBuilding(w, 20, 20, 'supplyCrate', 'east')).toBe(true)
    expect(w.nature.wood).toBe(0); expect(inventoryTotal(crate(w).inventory)).toBe(0)
    expect(placeBuilding(w, 20, 20, 'supplyCrate', 'east')).toBe(false)
    expect(removeBuilding(w, 20, 20)).toBe(true); expect(w.nature.wood).toBe(0)
  })
  it.each(DIRECTIONS)('accepts every registered item from a %s belt', direction => {
    const w = world(), d = offsets[direction]
    placeBuilding(w, 20, 20, 'supplyCrate', 'east'); placeBuilding(w, 20 - d.x, 20 - d.y, 'belt', direction)
    const b = w.buildings[(20 - d.y) * SIZE + 20 - d.x] as Belt
    for (const item of ITEMS) { b.item = item; b.progress = 0; advanceTransport(w, 500); expect(b.item).toBeNull(); expect(item === 'wood' ? crate(w).wood : crate(w).inventory[item]).toBe(1) }
    expect(worldStats(w).stored).toEqual(crate(w).inventory)
  })
  it('reserves the last slot across competing mixed-item belts without loss', () => {
    const w = world(); placeBuilding(w, 20, 20, 'supplyCrate', 'east')
    crate(w).inventory.iron = SUPPLY_CRATE_CAPACITY - 1
    for (const [x, y, direction, item] of [[19, 20, 'east', 'copper'], [20, 19, 'south', 'ironGear']] as const) {
      placeBuilding(w, x, y, 'belt', direction); Object.assign(w.buildings[y * SIZE + x]!, { item, progress: 1 })
    }
    advanceTransport(w, 50)
    expect(inventoryTotal(crate(w).inventory)).toBe(SUPPLY_CRATE_CAPACITY)
    const belts = w.buildings.filter(b => b?.kind === 'belt') as Belt[]
    expect(belts.filter(b => b.item).length).toBe(1)
    const held = belts.find(b => b.item)!
    advanceTransport(w, 5000); expect(held.item).not.toBeNull()
    expect(deliverItem(crate(w), 'electronicCircuit', 'north')).toBe(false)
    expect(inventoryTotal(crate(w).inventory) + belts.filter(b => b.item).length).toBe(SUPPLY_CRATE_CAPACITY + 1)
  })
  it('uses powered inserters and retains an in-flight item if a belt fills the final slot', () => {
    const w = poweredWorld(() => .5); w.nature.wood = 20
    placeBuilding(w, 19, 20, 'storage', 'east'); placeBuilding(w, 20, 20, 'inserter', 'east'); placeBuilding(w, 21, 20, 'supplyCrate', 'east')
    const source = w.buildings[819] as Storage, arm = w.buildings[820] as Inserter, target = crate(w, 21)
    source.inventory.electronicCircuit = 2
    advanceWorld(w, 550); expect(target.inventory.electronicCircuit).toBe(1)
    target.inventory.iron = SUPPLY_CRATE_CAPACITY - 2
    advanceWorld(w, 500); expect(arm.item).toBe('electronicCircuit')
    placeBuilding(w, 22, 20, 'belt', 'west'); const b = w.buildings[822] as Belt
    b.item = 'copperCable'; b.progress = 1
    advanceWorld(w, 5000)
    expect(inventoryTotal(target.inventory)).toBe(SUPPLY_CRATE_CAPACITY)
    expect(arm).toMatchObject({ phase: 'carrying', item: 'electronicCircuit', elapsedMs: 500 })
    expect(source.inventory.electronicCircuit + target.inventory.electronicCircuit + Number(arm.item === 'electronicCircuit')).toBe(2)
    const loaded = decodeSave(encode(w)).world
    expect(loaded.buildings[820]).toEqual(arm); expect(crate(loaded, 21).inventory).toEqual(target.inventory)
  })
  it('does not start pickup at capacity or extract supplies from the receiving-only crate', () => {
    const w = poweredWorld(() => .5); w.nature.wood = 20
    placeBuilding(w, 19, 20, 'storage', 'east'); placeBuilding(w, 20, 20, 'inserter', 'east'); placeBuilding(w, 21, 20, 'supplyCrate', 'east')
    const source = w.buildings[819] as Storage, arm = w.buildings[820] as Inserter
    source.inventory.iron = 2; crate(w, 21).inventory.iron = SUPPLY_CRATE_CAPACITY
    advanceWorld(w, 2000); expect(source.inventory.iron).toBe(2); expect(arm.phase).toBe('idle')
    removeBuilding(w, 19, 20); placeBuilding(w, 19, 20, 'supplyCrate', 'east'); crate(w, 19).inventory.copper = 3
    advanceWorld(w, 2000); expect(crate(w, 19).inventory.copper).toBe(3)
  })
})
describe('peaceful supply visits and persistence', () => {
  it('visits, inspects briefly and leaves without consuming or building', () => {
    const w = home(), target = crate(w, 24); target.inventory.iron = 12
    visit(w)
    const inspection = inspectBuilding(w, 824)
    expect(inspection).toMatchObject({ kind: 'supplyCrate', inventory: { iron: 12 }, capacity: 200, inspecting: true })
    expect(w.pete.tile).not.toBe(824); expect(w.pete.next).toBeNull()
    const buildings = w.buildings.filter(Boolean).length
    advanceWorld(w, SUPPLY_INSPECTION_MS)
    expect(w.peace.activity).toBe('walking'); expect(target.inventory.iron).toBe(12)
    expect(w.buildings.filter(Boolean).length).toBe(buildings)
  })
  it('ignores unreachable crates and recovers after demolition, obstruction or loss of peace', () => {
    const w = home(); visit(w)
    expect(removeBuilding(w, 24, 20)).toBe(true); expect(w.peace.activity).toBe('homeward')
    expect(() => decodeSave(encode(w))).not.toThrow()
    placeBuilding(w, 24, 20, 'supplyCrate', 'east')
    for (const [x, y] of [[24, 19], [25, 20], [24, 21], [23, 20]]) {
      // Move Pete away before enclosing all approaches with ordinary storage.
      Object.assign(w.pete, { tile: 822, x: 22, y: 20, next: null, travelMs: 0, path: [], pathRevision: -1 })
      placeBuilding(w, x, y, 'storage', 'east')
    }
    expect(reachableCrateSpot(w)).toBeNull()
    advanceWorld(w, 30000); expect(w.peace.activity).not.toBe('checkingCrate')
    removeBuilding(w, 20, 20); advanceWorld(w, 1000)
    expect(w.peace.home).toBeNull(); expect(w.peace.activity).toBe('homeward')
  })
  it('cancels a removed crate while approaching and does not visit while hostile', () => {
    const w = home()
    for (let t = 0; t < 180000 && w.peace.activity !== 'crateward'; t += 50) advanceWorld(w, 50)
    expect(w.peace.activity).toBe('crateward'); advanceWorld(w, 50)
    removeBuilding(w, 24, 20)
    expect(w.peace.activity).toBe('homeward'); expect(() => decodeSave(encode(w))).not.toThrow()
    removeBuilding(w, 20, 20); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
    advanceWorld(w, 30000); expect(w.peace.activity).toBe('homeward')
  })
  it('restores mid-approach and mid-inspection exactly and remains deterministic across time partitions', () => {
    const w = home()
    for (let t = 0; t < 180000 && w.peace.activity !== 'crateward'; t += 50) advanceWorld(w, 50)
    expect(w.peace.activity).toBe('crateward'); advanceWorld(w, 50)
    let loaded = decodeSave(encode(w)).world
    expect(JSON.parse(encode(loaded))).toEqual(JSON.parse(encode(w)))
    visit(w); loaded = decodeSave(encode(w)).world
    expect(JSON.parse(encode(loaded))).toEqual(JSON.parse(encode(w)))
    advanceWorld(w, 8765)
    for (const ms of [17, 2000, 103, 2645, 4000]) advanceWorld(loaded, ms)
    expect(JSON.parse(encode(loaded))).toEqual(JSON.parse(encode(w)))
    expect(SAVE_VERSION).toBe(42)
  })
  it('accepts genuine prior-version saves and rejects malformed inventory or hidden new state', () => {
    const legacy = JSON.parse(encode(world())); legacy.version = 13; delete legacy.game.personality; delete legacy.game.peace.nextProjectCheckAtMs
    expect(JSON.parse(encode(decodeSave(JSON.stringify(legacy)).world))).toEqual(JSON.parse(encode(world())))
    const w = home(); visit(w)
    for (const mutate of [
      (d: SaveDocument) => { (d.game.buildings[824] as SupplyCrate).inventory.iron = 201 },
      (d: SaveDocument) => { (d.game.buildings[824] as SupplyCrate).inventory.iron = -1 },
      (d: SaveDocument) => { (d.game.buildings[824] as SupplyCrate).inventory.iron = .5 },
      (d: SaveDocument) => { Object.assign((d.game.buildings[824] as SupplyCrate).inventory, { fish: 1 }) },
      (d: SaveDocument) => { Reflect.deleteProperty((d.game.buildings[824] as SupplyCrate).inventory, 'iron') },
      (d: SaveDocument) => { d.game.buildings[824] = null },
      (d: SaveDocument) => { d.game.peace.untilMs++ },
      (d: SaveDocument) => { Object.assign(d, { version: 13 }); Reflect.deleteProperty(d.game, 'personality') },
    ]) {
      const d = JSON.parse(encode(w)); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save')
    }
  })
})
