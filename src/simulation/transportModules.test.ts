import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import type { Inventory } from './items'
import { emptyInventory, inventoryTotal } from './items'
import { placeBuilding } from './world'
import { returnBranchSources } from './infrastructureRules'
import type { LinkKind } from './infrastructureRules'
import type { World } from './world'
import { advanceStorageRecovery } from './storageRecovery'
import { advanceHomestead, begin, materialStore } from './homestead'
import { advanceExpansion, planChain, chainCost, expansionLayout } from './homesteadExpansion'
import { advanceInfrastructure, planConnection, connectionComplete } from './infrastructure'
import { MODULE_LINKS, advanceTransportUpgrade } from './transportModules'
import { advanceCrafting, changeCraftingRecipe } from './crafting'
import { allocatePower } from './power'
import { advanceTransport, outputMachines } from './transport'
import { advanceInserters, createInserterFrame } from './inserters'
import { laterPickup, moduleStock } from './productionLogistics'
import { advanceWarehousing } from './warehousing'
import { projectBuilding } from './secretProject'
import type { SecretProject } from './secretProject'
import { pruneAnalytics } from './analytics'
import { awardActivity, rewardProject } from './personality'
import { cargoBatch, mainStoreTargets, transportUnlocked } from './materialPolicy'
import { refreshNatureSchedule } from './nature'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: World) => encodeSave(w, view, '2026-11-06T00:00:00.000Z')
function setup(partial = false, returns = false) {
  const w = createPetesWorld(), h = w.homestead!
  for (let t = 0; t < w.buildings.length; t++) if (t !== w.peace.home) w.buildings[t] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  h.store = 900; w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  for (const [tile, recipe] of [[656, 'ironGear'], [664, 'peteCircuit']] as const) {
    expect(placeBuilding(w, tile % 40, Math.floor(tile / 40), 'assembler', 'east')).toBe(true)
    if (recipe === 'ironGear') h.expansion.gearAssembler = tile
    else h.expansion.circuitAssembler = tile
    changeCraftingRecipe(w, tile % 40, Math.floor(tile / 40), recipe)
    expect(placeBuilding(w, tile % 40, Math.floor(tile / 40) - 1, 'powerPole', 'east')).toBe(true)
    expect(placeBuilding(w, tile % 40 + 1, Math.floor(tile / 40) - 1, 'generator', 'east')).toBe(true)
  }
  materialStore(w)!.inventory.ironPlate = 80; materialStore(w)!.inventory.copperPlate = 80
  if (returns) { buildLink(w, 'gearReturn'); buildLink(w, 'circuitReturn') }
  const plan = planChain(w, 'transport')
  expect(plan).not.toBeNull(); h.expansion.plan = plan; begin(w, 'buildChain', h.store)
  for (let ms = 0; ms < 240000 && h.task && (!partial || plan!.built < 1); ms += 50) { w.timeMs += 50; advanceExpansion(w, 50) }
  if (partial) return w
  expect(h.task).toBeNull(); expect(h.expansion.transportAssembler).toBe(plan!.anchor)
  for (const kind of MODULE_LINKS) buildLink(w, kind)
  return w
}
function buildLink(w: World, kind: LinkKind) {
  const h = w.homestead!, lane = planConnection(w, kind)
  expect(lane, kind).not.toBeNull(); h.infrastructure.plan = lane; begin(w, 'buildConnection', h.store)
  for (let ms = 0; ms < 240000 && h.task; ms += 50) { w.timeMs += 50; advanceInfrastructure(w, 50) }
  expect(h.task).toBeNull(); expect(connectionComplete(w, lane!)).toBe(true)
}
function step(w: World, ms: number) {
  for (let t = 0; t < ms; t += 50) {
    w.timeMs += 50
    const frame = createInserterFrame(w), vacated = advanceTransport(w, 50)
    outputMachines(w, vacated); allocatePower(w, frame); advanceInserters(w, 50, frame); advanceCrafting(w, 50); pruneAnalytics(w)
  }
}
function ledger(w: World) {
  const total = { iron: 0, copper: 0 }
  const count = (stock: Partial<Inventory>) => {
    total.iron += (stock.ironPlate ?? 0) + 2 * (stock.ironGear ?? 0) + 4 * (stock.transportModule ?? 0)
    total.copper += (stock.copperPlate ?? 0) + .5 * (stock.copperCable ?? 0) + 2.5 * (stock.electronicCircuit ?? 0) + 5 * (stock.transportModule ?? 0)
  }
  for (const b of w.buildings) {
    if (b?.kind === 'supplyCrate') count(b.inventory)
    else if (b?.kind === 'assembler') { count(b.input); count(b.output); if (b.job) count(b.job.inputs) }
    else if ((b?.kind === 'inserter' || b?.kind === 'belt') && b.item) count({ [b.item]: 1 })
  }
  count(w.homestead!.carried)
  return total
}
describe('useful assembled transport modules', () => {
  it('reserves the cross-chain expansion for completed original Inventor development', () => {
    const w = createPetesWorld(), h = w.homestead!
    h.cargoBicycle = true
    h.infrastructure.links = (['iron', 'gearFeed', 'gearReturn', 'circuitReturn', 'circuitCableFeed'] as const).map(kind => ({ kind, source: 1, target: 2, parts: [] }))
    h.infrastructure.inventor = 2
    expect(transportUnlocked(w)).toBe(false)
    h.infrastructure.inventor = 3
    expect(transportUnlocked(w)).toBe(true)
  })
  it('pays for one powered assembler and three physical routes, then stores a real two-chain product', () => {
    const w = setup(), h = w.homestead!, store = materialStore(w)!
    expect(chainCost('transport')).toEqual({ ironPlate: 8, copperPlate: 8 })
    expect(store.inventory.ironPlate).toBe(56); expect(store.inventory.copperPlate).toBe(64)
    const gears = w.buildings[h.expansion.gearAssembler!], circuits = w.buildings[h.expansion.circuitAssembler!]
    if (gears?.kind !== 'assembler' || circuits?.kind !== 'assembler') throw Error('missing producers')
    gears.input.ironPlate = 4; circuits.input.copperPlate = 2; circuits.input.copperCable = 6
    const before = ledger(w)
    step(w, 90000)
    expect(ledger(w)).toEqual(before)
    expect(store.inventory.transportModule).toBe(1)
    expect(w.produced.ironGear).toBe(2); expect(w.produced.electronicCircuit).toBe(2); expect(w.produced.transportModule).toBe(1)
    expect(inventoryTotal(gears.input) + inventoryTotal(circuits.input)).toBe(0)
    expect(Object.values(mainStoreTargets(w)).reduce((n, v) => n + v, 0)).toBe(192)
    expect(() => decodeSave(save(w))).not.toThrow()
  })
  it('resumes an active multi-input job and moving packets exactly, without free materials', () => {
    const w = setup(), h = w.homestead!, gears = w.buildings[h.expansion.gearAssembler!], circuits = w.buildings[h.expansion.circuitAssembler!]
    if (gears?.kind !== 'assembler' || circuits?.kind !== 'assembler') throw Error('missing producers')
    gears.output.ironGear = 4; circuits.output.electronicCircuit = 4
    const machine = w.buildings[h.expansion.transportAssembler!]
    if (machine?.kind !== 'assembler') throw Error('missing module assembler')
    for (let ms = 0; ms < 60000 && !machine.job; ms += 50) step(w, 50)
    step(w, 2000); expect(machine.job).not.toBeNull()
    const loaded = decodeSave(save(w)).world
    step(w, 83000); step(loaded, 83000)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w))); expect(moduleStock(w)).toBe(2)
    expect(inventoryTotal(machine.input)).toBe(0)
  })
  it('branches from real producer returns and supplies modules despite full gear and circuit stock targets', () => {
    const w = setup(false, true), h = w.homestead!, store = materialStore(w)!
    store.inventory.ironGear = 12; store.inventory.electronicCircuit = 12
    for (const [kind, parent] of [['moduleGearFeed', 'gearReturn'], ['moduleCircuitFeed', 'circuitReturn']] as const) {
      const link = h.infrastructure.links.find(p => p.kind === kind)!
      expect(returnBranchSources(h.infrastructure.links, parent)).toContain(link.source)
      expect(w.buildings[link.source]?.kind).toBe('belt')
    }
    const gears = w.buildings[h.expansion.gearAssembler!], circuits = w.buildings[h.expansion.circuitAssembler!]
    if (gears?.kind !== 'assembler' || circuits?.kind !== 'assembler') throw Error('missing producers')
    gears.output.ironGear = 2; circuits.output.electronicCircuit = 2
    const before = ledger(w)
    step(w, 120000)
    expect(store.inventory.transportModule).toBe(1); expect(ledger(w)).toEqual(before)
    expect(() => decodeSave(save(w))).not.toThrow()
  })
  it('stops both ingredient lanes at the target and includes active recipe reservations', () => {
    const w = setup(), h = w.homestead!, machine = w.buildings[h.expansion.transportAssembler!]
    materialStore(w)!.inventory.transportModule = 4
    expect(laterPickup(w, 'moduleGearFeed', 'ironGear')).toBe(false)
    expect(laterPickup(w, 'moduleCircuitFeed', 'electronicCircuit')).toBe(false)
    materialStore(w)!.inventory.transportModule = 0
    w.buildings[1100] = { kind: 'supplyCrate', x: 20, y: 27, wood: 0, inventory: emptyInventory(), storeTier: 0 }
    w.warehousing = { stores: [1100], job: { kind: 'haul', source: h.store!, target: 1100, item: 'transportModule', amount: 4, carried: 4, elapsedMs: 0 }, nextAtMs: 0 }
    expect(moduleStock(w)).toBe(4)
    expect(laterPickup(w, 'moduleGearFeed', 'ironGear')).toBe(false)
    expect(() => decodeSave(save(w))).not.toThrow()
    w.warehousing.job = null
    materialStore(w)!.inventory.transportModule = 3
    if (machine?.kind !== 'assembler') throw Error('missing module assembler')
    machine.input.ironGear = 2; machine.input.electronicCircuit = 2
    expect(laterPickup(w, 'moduleGearFeed', 'ironGear')).toBe(false)
    expect(laterPickup(w, 'moduleCircuitFeed', 'electronicCircuit')).toBe(false)
    step(w, 50)
    expect(machine.job).not.toBeNull()
    expect(laterPickup(w, 'moduleGearFeed', 'ironGear')).toBe(false)
    expect(laterPickup(w, 'moduleCircuitFeed', 'electronicCircuit')).toBe(false)
  })
  it('pays once for the cargo upgrade, resumes paid work and actually carries twelve warehouse goods', () => {
    const w = setup(), h = w.homestead!, store = materialStore(w)!
    for (const [kind, tile, spot] of [['workshop', 1020, 980], ['bicycle', 823, 863]] as const) {
      const p: SecretProject = { kind, home: 820, direction: kind === 'workshop' ? 'east' : 'south', tiles: [tile], spots: [spot], phase: 'complete', crate: null, built: 1, carried: 0, carriedIron: 0, elapsedMs: 0, ...(kind === 'workshop' ? { readyAtMs: 0 } : { carriedGears: 0, carriedModules: 0 }) }
      if (kind === 'workshop') w.workshopProject = p
      else w.bicycleProject = p
      w.buildings[tile] = projectBuilding(p, tile); rewardProject(w.personality, kind)
    }
    awardActivity(w.personality, { path: 'craftsman', xp: 200 })
    h.cargoBicycle = true; h.bikeTile = w.pete.tile
    store.inventory.transportModule = 2
    expect(cargoBatch(w)).toBe(6)
    begin(w, 'upgradeTransport', 823)
    for (let t = 0; t < 120000 && h.elapsedMs < 500; t += 50) { w.timeMs += 50; advanceTransportUpgrade(w, 50) }
    expect(h.carried.transportModule).toBe(2); expect(store.inventory.transportModule).toBe(0)
    const loaded = decodeSave(save(w)).world
    for (const candidate of [w, loaded]) for (let t = 0; t < 120000 && candidate.homestead!.task; t += 50) { candidate.timeMs += 50; advanceTransportUpgrade(candidate, 50) }
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
    expect(h.transportUpgrade).toBe(true); expect(cargoBatch(w)).toBe(12)
    expect(h.carried.transportModule).toBe(0)
    w.buildings[1100] = { kind: 'supplyCrate', x: 20, y: 27, wood: 0, inventory: { ...emptyInventory(), copperPlate: 24 }, storeTier: 0 }
    w.warehousing = { stores: [1100], job: null, nextAtMs: 0 }; store.inventory.copperPlate = 0
    for (let t = 0; t < 120000 && !w.warehousing.job?.carried; t += 50) { w.timeMs += 50; advanceWarehousing(w, 50) }
    expect(w.warehousing.job).toMatchObject({ kind: 'haul', item: 'copperPlate', carried: 12, amount: 12 })
    w.timeMs += 50; advanceWarehousing(w, 50)
    expect(h.bikeTile).toBeNull()
    expect(() => decodeSave(save(w))).not.toThrow()
    const inTransit = decodeSave(save(w)).world
    for (const candidate of [w, inTransit]) for (let t = 0; t < 120000 && candidate.warehousing?.job; t += 50) { candidate.timeMs += 50; advanceWarehousing(candidate, 50) }
    expect(JSON.parse(save(inTransit))).toEqual(JSON.parse(save(w)))
    expect(store.inventory.copperPlate).toBe(12)
    w.warehousing.job = { kind: 'haul', source: 1100, target: h.store!, item: 'copperPlate', amount: 12, carried: 0, elapsedMs: 0 }
    const forged = JSON.parse(save(w)); delete forged.game.homestead.transportUpgrade
    expect(() => decodeSave(JSON.stringify(forged))).toThrow('installed transport upgrade')
  })
  it('resites a blocked paid module prefix and resumes its exact retained invoice', () => {
    const w = setup(true), h = w.homestead!, old = h.expansion.plan!, parts = expansionLayout(old), store = materialStore(w)!
    expect(old.built).toBe(1); expect(h.carried).toMatchObject({ ironPlate: 8, copperPlate: 8 })
    const paid = { iron: store.inventory.ironPlate, copper: store.inventory.copperPlate }
    w.water[parts[1].tile] = true; w.topologyRevision++
    expect(advanceHomestead(w, 50)).toBe(false); expect(h.paused).toBe(true)
    for (let t = 0; t < 240000 && !w.warehousing?.resite?.held; t += 50) { w.timeMs += 50; advanceStorageRecovery(w, 50) }
    expect(w.warehousing?.resite?.held).toBeDefined()
    const loaded = decodeSave(save(w)).world
    for (const candidate of [w, loaded]) for (let t = 0; t < 240000 && candidate.warehousing?.resite; t += 50) { candidate.timeMs += 50; advanceStorageRecovery(candidate, 50) }
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
    expect(h.expansion.plan?.anchor).not.toBe(old.anchor)
    for (let t = 0; t < 240000 && h.expansion.transportAssembler === undefined; t += 50) { w.timeMs += 50; advanceHomestead(w, 50) }
    expect(h.expansion.transportAssembler).toBeDefined()
    expect(store.inventory.ironPlate).toBe(paid.iron); expect(store.inventory.copperPlate).toBe(paid.copper)
    expect(inventoryTotal(h.carried)).toBe(0)
  })
  it('checks every downstream shared return suffix, tolerates upstream damage and rejects receiver cycles', () => {
    const w = createPetesWorld(), h = w.homestead!
    w.water.fill(false)
    for (const [tile, direction] of [[900, 'east'], [901, 'east'], [940, 'east'], [941, 'north']] as const) expect(placeBuilding(w, tile % 40, Math.floor(tile / 40), 'belt', direction)).toBe(true)
    const root = { kind: 'iron' as const, source: 898, target: 902, parts: [{ tile: 900, kind: 'belt' as const, direction: 'east' as const }, { tile: 901, kind: 'belt' as const, direction: 'east' as const }] }
    const middle = { kind: 'copper' as const, source: 981, target: 902, receiver: 901, parts: [{ tile: 941, kind: 'belt' as const, direction: 'north' as const }] }
    const branch = { kind: 'gearReturn' as const, source: 938, target: 902, receiver: 941, parts: [{ tile: 940, kind: 'belt' as const, direction: 'east' as const }] }
    h.infrastructure.links = [root, middle, branch]
    expect(connectionComplete(w, branch)).toBe(true)
    w.buildings[900] = null
    expect(connectionComplete(w, branch)).toBe(true)
    const suffix = w.buildings[901]; w.buildings[901] = null
    expect(connectionComplete(w, branch)).toBe(false)
    w.buildings[901] = suffix; middle.receiver = 940
    expect(connectionComplete(w, branch)).toBe(false)
  })
  it('loads old inventories as zero modules and rejects new goods or hidden module recipes in old schemas', () => {
    const w = createPetesWorld(), old = JSON.parse(save(w)); old.version = 60
    delete old.game.mined.transportModule; delete old.game.produced.transportModule; delete old.game.homestead.carried.transportModule; delete old.game.analytics.lastProducedAt.transportModule
    expect(decodeSave(JSON.stringify(old)).world.produced.transportModule).toBe(0)
    old.game.produced.transportModule = 1
    expect(() => decodeSave(JSON.stringify(old))).toThrow('legacy inventory')
    const fixture = setup(), hidden = JSON.parse(save(fixture)); hidden.version = 60
    expect(() => decodeSave(JSON.stringify(hidden))).toThrow()
  })
})
