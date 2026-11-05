import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { advancePetesWorld } from '../pete/simulation'
import { advanceWarehousing, ownedStores, storeRoom } from './warehousing'
import { advanceHomestead, begin, materialStore } from './homestead'
import { emptyInventory, inventoryTotal } from './items'
import { refreshNatureSchedule } from './nature'
import { removeBuilding } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: World) => encodeSave(w, view, '2026-11-05T00:00:00.000Z')
function fixture(wood = 200, extra = false) {
  const w = createPetesWorld(), h = w.homestead!
  for (let t = 0; t < w.buildings.length; t++) if (t !== w.peace.home) w.buildings[t] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  Object.assign(w.peace, { activity: 'walking', sinceMs: 0, untilMs: 0, destination: null })
  h.store = 900
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood, inventory: emptyInventory(), storeTier: 0 }
  if (extra) {
    w.buildings[906] = { kind: 'supplyCrate', x: 26, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
    w.warehousing = { stores: [906], job: null, nextAtMs: 0 }
  }
  return w
}
function until(w: World, done: () => boolean, full = false, limit = 180000) {
  for (let t = 0; t < limit && !done(); t += 50) {
    if (full) advancePetesWorld(w, 50)
    else { w.timeMs += 50; advanceWarehousing(w, 50) }
  }
  expect(done(), JSON.stringify({ h: w.homestead, storage: w.warehousing, pete: w.pete })).toBe(true)
}
function total(w: World) {
  return ownedStores(w).reduce((n, t) => { const b = w.buildings[t]; return n + (b?.kind === 'supplyCrate' ? b.wood + inventoryTotal(b.inventory) : 0) }, 0) + inventoryTotal(w.homestead!.carried) + (w.warehousing?.job?.carried ?? 0)
}
describe('physical additional stores', () => {
  it('pays for extra capacity and completes a delivery blocked by a full main store', () => {
    const w = fixture(), h = w.homestead!
    h.carried.iron = 3; begin(w, 'returnStock', h.store)
    until(w, () => (w.warehousing?.stores.length ?? 0) === 1 && !h.carried.iron, true)
    expect(ownedStores(w)).toHaveLength(2)
    expect(total(w)).toBe(197) // 200 stored + 3 carried - 6 actual construction material.
    expect(w.nature.wood).toBe(0)
    expect(w.personality.paths.craftsman.xp).toBe(3)
    expect(() => decodeSave(save(w))).not.toThrow()
  })
  it('delivers finished products to an extra store and physically retrieves them for further work', () => {
    const w = fixture(200, true), h = w.homestead!
    h.carried.ironGear = 2; begin(w, 'returnStock', h.store)
    until(w, () => h.task === null, true)
    const extra = w.buildings[906]
    expect(extra?.kind === 'supplyCrate' && extra.inventory.ironGear).toBe(2)
    expect(materialStore(w)!.inventory.ironGear).toBe(0)
    const xp = structuredClone(w.personality), before = total(w)
    until(w, () => materialStore(w)!.inventory.ironGear === 2)
    expect(total(w)).toBe(before); expect(w.personality).toEqual(xp)
    expect(extra?.kind === 'supplyCrate' && extra.inventory.ironGear).toBe(0)
  })
  it('retains a paid invoice when a build site is obstructed and resumes exactly after load', () => {
    const w = fixture(), h = w.homestead!
    h.carried.copper = 3; begin(w, 'returnStock', h.store)
    until(w, () => (w.warehousing?.job?.elapsedMs ?? 0) >= 500)
    const job = w.warehousing!.job!, tile = job.target
    w.buildings[tile] = { kind: 'storage', x: tile % 40, y: Math.floor(tile / 40), inventory: emptyInventory() }; w.topologyRevision++
    const loaded = decodeSave(save(w)).world
    for (let t = 0; t < 30000; t += 50) { w.timeMs += 50; loaded.timeMs += 50; advanceWarehousing(w, 50); advanceWarehousing(loaded, 50) }
    expect(w.warehousing!.stores).toHaveLength(1)
    expect(w.warehousing!.stores[0]).not.toBe(tile)
    expect(w.buildings[tile]?.kind).toBe('storage')
    expect(total(w)).toBe(197)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
  })
  it('keeps an in-flight shipment when its source warehouse is demolished', () => {
    const w = fixture(0, true), extra = w.buildings[906]
    if (extra?.kind !== 'supplyCrate') throw new Error('missing extra store')
    extra.wood = 30
    until(w, () => w.warehousing?.job?.carried === 6)
    expect(removeBuilding(w, 26, 22)).toBe(true)
    const loaded = decodeSave(save(w)).world
    for (let t = 0; t < 30000; t += 50) { w.timeMs += 50; loaded.timeMs += 50; advanceWarehousing(w, 50); advanceWarehousing(loaded, 50) }
    expect(materialStore(w)!.wood).toBe(6)
    expect(w.warehousing!.stores).toEqual([])
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
  })
  it('keeps a delivery saveable immediately after its selected extra store is removed', () => {
    const w = fixture(200, true), h = w.homestead!
    h.carried.ironGear = 2; begin(w, 'returnStock', 906)
    expect(removeBuilding(w, 26, 22)).toBe(true)
    expect(h.target).toBe(h.store)
    expect(h.carried.ironGear).toBe(2)
    expect(() => decodeSave(save(w))).not.toThrow()
  })
  it('does not oscillate stock between full stores and keeps every transferred item', () => {
    const w = fixture(200, true), extra = w.buildings[906]
    if (extra?.kind !== 'supplyCrate') throw new Error('missing extra store')
    extra.inventory.ironPlate = 40
    const before = total(w)
    until(w, () => materialStore(w)!.inventory.ironPlate === 40)
    for (let t = 0; t < 30000; t += 50) { w.timeMs += 50; advanceWarehousing(w, 50) }
    expect(total(w)).toBe(before)
    expect(materialStore(w)!.inventory.ironPlate).toBe(40)
    expect(w.warehousing!.job).toBeNull()
    expect(storeRoom(materialStore(w)!)).toBeGreaterThanOrEqual(0)
  })
  it('retains a blocked delivery while no reachable construction space exists', () => {
    const w = fixture(), h = w.homestead!
    w.water.fill(true)
    for (const t of [w.peace.home!, w.pete.tile, h.store!]) w.water[t] = false
    w.topologyRevision++
    h.carried.copper = 3; begin(w, 'returnStock', h.store)
    expect(advanceWarehousing(w, 50)).toBe(false)
    expect(advanceHomestead(w, 50)).toBe(false)
    expect(h.paused).toBe(true); expect(h.carried.copper).toBe(3)
    expect(decodeSave(save(w)).world.homestead!.carried.copper).toBe(3)
  })
  it('does not take player stock from an unowned crate', () => {
    const w = fixture(0, true)
    delete w.warehousing
    const extra = w.buildings[906]
    if (extra?.kind !== 'supplyCrate') throw new Error('missing crate')
    extra.inventory.ironPlate = 40
    expect(advanceWarehousing(w, 50)).toBe(false)
    expect(extra.inventory.ironPlate).toBe(40)
  })
  it('strictly rejects duplicate ownership and old-version warehouse payloads', () => {
    const w = fixture(0, true), document = JSON.parse(save(w))
    document.game.warehousing.stores.push(906)
    expect(() => decodeSave(JSON.stringify(document))).toThrow('Invalid save')
    const old = JSON.parse(save(w)); old.version = 57
    expect(() => decodeSave(JSON.stringify(old))).toThrow('Invalid save')
    const ordinary = fixture(0)
    advanceWarehousing(ordinary, 50)
    expect(ordinary.warehousing).toBeUndefined()
  })
})
