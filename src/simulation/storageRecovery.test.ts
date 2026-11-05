import { beforeAll, describe, expect, it } from 'vitest'
import { advanceStorageRecovery, planStoreMove, blockedStoreConnection } from './storageRecovery'
import { advanceHomestead, begin, handMillLayout, materialStore } from './homestead'
import { expansionLayout, planChain } from './homesteadExpansion'
import { planConnection, connectionComplete, infrastructurePickupAllowed } from './infrastructure'
import { createPetesWorld } from './petesWorld'
import { advancePetesWorld } from '../pete/simulation'
import { emptyInventory, inventoryTotal } from './items'
import { awardActivity } from './personality'
import { refreshNatureSchedule } from './nature'
import { allocatePower } from './power'
import { advanceInserters, createInserterFrame } from './inserters'
import { advanceTransport } from './transport'
import { placeBuilding, removeBuilding } from './world'
import { ownedStores } from './warehousing'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: World) => encodeSave(w, view, '2026-11-05T00:00:00.000Z')
function bare() {
  const w = createPetesWorld()
  for (let t = 0; t < w.buildings.length; t++) if (t !== w.peace.home) w.buildings[t] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  Object.assign(w.peace, { activity: 'walking', sinceMs: 0, untilMs: 0, destination: null })
  return w
}
function partial() {
  const w = bare(), h = w.homestead!
  h.store = 900
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 30, inventory: emptyInventory(), storeTier: 0 }
  materialStore(w)!.inventory.iron = 4
  const plan = planChain(w, 'iron')!
  expect(plan).not.toBeNull(); h.expansion.plan = plan
  const parts = expansionLayout(plan)
  expect(placeBuilding(w, parts[0].tile % 40, Math.floor(parts[0].tile / 40), parts[0].kind, parts[0].direction)).toBe(true)
  plan.built = 1; h.carried.iron = 6; begin(w, 'buildChain', parts[1].tile); h.elapsedMs = 750
  w.water[parts[1].tile] = true; w.topologyRevision++
  expect(advanceHomestead(w, 50)).toBe(false)
  return { w, oldPole: parts[0].tile, h }
}
function crowdedMill() {
  const w = bare(), h = w.homestead!
  h.store = 654
  w.buildings[654] = { kind: 'supplyCrate', x: 14, y: 16, wood: 100, inventory: emptyInventory(), storeTier: 1 }
  const store = materialStore(w)!
  store.inventory.woodPanel = 20; store.inventory.ironPlate = 40; store.inventory.ironGear = 12
  h.millAnchor = 656; h.millBuilt = 3
  for (const p of handMillLayout(656)) expect(placeBuilding(w, p.tile % 40, Math.floor(p.tile / 40), p.kind, 'east')).toBe(true)
  w.water[576] = true; w.water[736] = true; w.topologyRevision++
  awardActivity(w.personality, { path: 'eco', xp: 200 })
  expect(planChain(w, 'forestry')).toBeNull()
  expect(placeBuilding(w, 14, 24, 'furnace', 'east')).toBe(true); h.expansion.furnace = 974
  const link = planConnection(w, 'iron')
  expect(link).not.toBeNull()
  for (const p of link!.parts) {
    if (p.kind === 'inserter' && !w.research.unlocked.includes('logistics1')) w.research.unlocked.push('logistics1')
    expect(placeBuilding(w, p.tile % 40, Math.floor(p.tile / 40), p.kind, p.direction)).toBe(true)
  }
  h.infrastructure.links.push(link!)
  return w
}
function tick(w: World) { w.timeMs += 50; advanceStorageRecovery(w, 50) }
function until(w: World, done: () => boolean, full = false, limit = 900000) {
  for (let t = 0; t < limit && !done(); t += 50) { if (full) advancePetesWorld(w, 50); else tick(w) }
  expect(done(), JSON.stringify({ h: w.homestead, storage: w.warehousing, pete: w.pete })).toBe(true)
}
function stock(w: World) {
  return ownedStores(w).reduce((n, t) => { const b = w.buildings[t]; return n + (b?.kind === 'supplyCrate' ? b.wood + inventoryTotal(b.inventory) : 0) }, 0) + inventoryTotal(w.warehousing?.move?.paid ?? emptyInventory()) + Number(!!w.warehousing?.move?.salvage) + (w.warehousing?.job?.carried ?? 0)
}
describe('paid construction site recovery', () => {
  it('physically moves a paid prefix, retains work and completes after a different site is chosen', () => {
    const { w, h, oldPole } = partial()
    expect(advanceStorageRecovery(w, 50)).toBe(true)
    expect(w.warehousing?.resite).toBeDefined()
    const next = w.warehousing!.resite!.to.anchor
    until(w, () => !!w.warehousing?.resite?.held)
    expect(w.buildings[oldPole]).toBeNull(); expect(h.carried.iron).toBe(6); expect(h.elapsedMs).toBe(750)
    const loaded = decodeSave(save(w)).world
    until(w, () => !w.warehousing!.resite)
    while (loaded.timeMs < w.timeMs) tick(loaded)
    expect(h.expansion.plan?.anchor).toBe(next)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
    until(w, () => h.expansion.furnace !== null, true, 60000)
    expect(h.carried.iron).toBe(0)
    expect(w.buildings[oldPole]).toBeNull()
  })
  it('returns a carried component before choosing again when its new site becomes blocked', () => {
    const { w, oldPole } = partial()
    advanceStorageRecovery(w, 50)
    until(w, () => !!w.warehousing?.resite?.held)
    const target = expansionLayout(w.warehousing!.resite!.to)[0].tile
    w.water[target] = true; w.topologyRevision++
    tick(w)
    expect(w.warehousing!.resite!.rollback).toBe(true)
    const loaded = decodeSave(save(w)).world
    until(w, () => !w.warehousing!.resite)
    while (loaded.timeMs < w.timeMs) tick(loaded)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
    expect(w.buildings[oldPole]?.kind).toBe('powerPole')
    expect(w.homestead!.carried.iron).toBe(6)
  })
  it('protects parts while they are being physically relocated', () => {
    const { w, oldPole } = partial()
    advanceStorageRecovery(w, 50)
    expect(removeBuilding(w, oldPole % 40, Math.floor(oldPole / 40))).toBe(false)
    expect(() => decodeSave(save(w))).not.toThrow()
  })
})
describe('staged connected warehouse relocation', () => {
  it('finds a replacement that frees a blocked forestry site and preserves connected production', () => {
    const w = crowdedMill(), h = w.homestead!, original = h.store!
    const planned = planStoreMove(w)
    expect(planned).not.toBeNull()
    const before = stock(w), expense = inventoryTotal(planned!.cost)
    expect(advanceStorageRecovery(w, 50)).toBe(true)
    const m = w.warehousing!.move!
    const arm = m.previous[0].parts[2].tile
    expect(infrastructurePickupAllowed(w, arm, 'ironPlate')).toBe(false)
    expect(removeBuilding(w, original % 40, Math.floor(original / 40))).toBe(false)
    until(w, () => w.warehousing!.move?.phase === 'connect')
    expect(w.buildings[original]?.kind).toBe('supplyCrate')
    expect(h.store).toBe(original)
    until(w, () => w.warehousing!.move!.index >= 1)
    const installed = w.warehousing!.move!.links[0].parts[0].tile
    expect(removeBuilding(w, installed % 40, Math.floor(installed / 40))).toBe(false)
    const loaded = decodeSave(save(w)).world
    until(w, () => !w.warehousing!.move)
    while (loaded.timeMs < w.timeMs) tick(loaded)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
    expect(h.store).not.toBe(original)
    expect(w.buildings[original]).toBeNull()
    expect(materialStore(w)!.storeTier).toBe(1)
    expect(h.infrastructure.links.every(p => connectionComplete(w, p))).toBe(true)
    expect(h.infrastructure.links.find(p => p.kind === 'iron')?.target).toBe(h.store)
    expect(planChain(w, 'forestry')).not.toBeNull()
    expect(stock(w)).toBe(before - expense)
    const furnace = w.buildings[h.expansion.furnace!]
    if (furnace?.kind !== 'furnace') throw new Error('missing furnace')
    furnace.output.ironPlate = 2
    const plates = materialStore(w)!.inventory.ironPlate
    for (let t = 0; t < 60000; t += 50) { w.timeMs += 50; advanceTransport(w, 50); allocatePower(w); advanceInserters(w, 50, createInserterFrame(w)) }
    expect(materialStore(w)!.inventory.ironPlate).toBe(plates + 2)
  })
  it('completes through the normal world scheduler and resumes the blocked forestry project', () => {
    const w = crowdedMill(), original = w.homestead!.store
    advanceStorageRecovery(w, 50)
    until(w, () => !w.warehousing!.move, true)
    expect(w.homestead!.store).not.toBe(original)
    expect(w.buildings[original!]).toBeNull()
    expect(() => decodeSave(save(w))).not.toThrow()
  })
  it('chooses another warehouse site without charging again when the funded destination is obstructed', () => {
    const w = crowdedMill()
    advanceStorageRecovery(w, 50)
    until(w, () => w.warehousing!.move?.phase === 'store')
    const old = w.warehousing!.move!, invoice = { ...old.paid }
    w.water[old.to] = true; w.topologyRevision++
    until(w, () => w.warehousing!.move!.to !== old.to, false, 10000)
    expect(w.warehousing!.move!.to).not.toBe(old.to)
    expect(w.warehousing!.move!.paid).toEqual(invoice)
    expect(() => decodeSave(save(w))).not.toThrow()
    until(w, () => !w.warehousing!.move)
  })
  it('salvages real belt packets instead of deleting them during dismantling', () => {
    const w = crowdedMill(), link = w.homestead!.infrastructure.links[0]
    const belt = w.buildings[link.parts[3].tile]
    if (belt?.kind !== 'belt') throw new Error('missing belt')
    belt.item = 'copperCable'; belt.progress = .5
    const before = stock(w) + 1
    advanceStorageRecovery(w, 50)
    const expense = inventoryTotal(w.warehousing!.move!.cost)
    until(w, () => !w.warehousing!.move)
    expect(stock(w)).toBe(before - expense)
    expect(ownedStores(w).reduce((n, t) => { const b = w.buildings[t]; return n + (b?.kind === 'supplyCrate' ? b.inventory.copperCable : 0) }, 0)).toBe(1)
  })
  describe('overflow during dismantling', () => {
    let w: World, loaded: World, before: number, expense: number
    beforeAll(() => {
      w = crowdedMill()
      let packets = 0
      for (const part of w.homestead!.infrastructure.links[0].parts) {
        const b = w.buildings[part.tile]
        if (b?.kind === 'belt') { b.item = 'copperCable'; b.progress = .5; packets++ }
      }
      advanceStorageRecovery(w, 50)
      until(w, () => w.warehousing!.move?.phase === 'retire')
      // Concurrent external deliveries can fill both crates after the move was paid.
      for (const t of ownedStores(w)) {
        const b = w.buildings[t]
        if (b?.kind === 'supplyCrate') b.wood = 400 - inventoryTotal(b.inventory)
      }
      before = stock(w) + packets; expense = inventoryTotal(w.warehousing!.move!.cost)
      until(w, () => !!w.warehousing?.job?.carried)
      loaded = decodeSave(save(w)).world
    }, 60000)
    // Keep every original 50 ms step and the same simulation bound. The shared
    // preparation separates physical completion from its exact saved replay.
    beforeAll(() => { until(w, () => !w.warehousing!.move) }, 60000)
    beforeAll(() => { while (loaded.timeMs < w.timeMs) tick(loaded) }, 60000)
    it('builds real overflow capacity when dismantling packets would fill every warehouse', () => {
      expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
      expect(w.warehousing!.stores.length).toBeGreaterThan(0)
      expect(stock(w)).toBe(before - expense - 6 * w.warehousing!.stores.length)
    })
  })
  it('keeps a buildable earlier connection ahead of a later blocked feed', () => {
    const { w, h } = partial()
    w.water.fill(false); w.topologyRevision++
    h.task = null; h.target = null; delete h.paused; h.carried = emptyInventory(); h.expansion.plan = null
    h.cargoBicycle = true; h.bikeTile = w.pete.tile
    expect(placeBuilding(w, 14, 24, 'furnace', 'east')).toBe(true); h.expansion.furnace = 974
    expect(placeBuilding(w, 21, 17, 'assembler', 'east')).toBe(true); h.expansion.gearAssembler = 701
    for (const t of [700, 661, 741]) expect(placeBuilding(w, t % 40, Math.floor(t / 40), 'powerPole', 'east')).toBe(true)
    materialStore(w)!.inventory.ironPlate = 40; materialStore(w)!.inventory.ironGear = 12
    expect(planConnection(w, 'iron')).not.toBeNull()
    expect(planConnection(w, 'gearFeed')).toBeNull()
    expect(blockedStoreConnection(w)).toBeNull()
    expect(planStoreMove(w)).toBeNull()
  })
  it('rejects unfunded forged moves and accepts legacy version 58 without recovery fields', () => {
    const w = crowdedMill(); advanceStorageRecovery(w, 50)
    const bad = JSON.parse(save(w)); bad.game.warehousing.move.phase = 'connect'
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    const legacy = JSON.parse(save(crowdedMill())); legacy.version = 58
    expect(() => decodeSave(JSON.stringify(legacy))).not.toThrow()
  })
})
