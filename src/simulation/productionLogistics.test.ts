import { stripVersion52State } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { begin, materialStore } from './homestead'
import { advanceInfrastructure, chooseInfrastructure, connectionRunning, infrastructurePickupAllowed, planConnection } from './infrastructure'
import { linkCost, linkCurrency } from './infrastructureRules'
import type { LinkKind } from './infrastructureRules'
import { advanceLoading, chooseLoading } from './loading'
import { circuitStock, inFlight, mainFuel } from './productionLogistics'
import { connectionGuide } from './connectionGuide'
import { emptyInventory } from './items'
import { changeCraftingRecipe, advanceCrafting } from './crafting'
import { refreshNatureSchedule } from './nature'
import { advanceWorld } from './step'
import { advanceExpansion, planChain, chooseExpansion } from './homesteadExpansion'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { advanceTransport, outputMachines } from './transport'
import { advanceInserters, createInserterFrame } from './inserters'
import { allocatePower } from './power'
import { pruneAnalytics } from './analytics'
import { awardActivity } from './personality'
import { advanceSteamWork } from './steamWork'
import { chooseRebuild, advanceRebuilding } from './rebuilding'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z'))
function stored() {
  const w = createPetesWorld(), h = w.homestead!
  for (let i = 0; i < w.buildings.length; i++) if (i !== w.peace.home) w.buildings[i] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  h.store = 900; w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  return w
}
function build(w: World, advance = advanceInfrastructure) {
  for (let t = 0; t < 240000 && w.homestead!.task; t += 50) { w.timeMs += 50; advance(w, 50) }
  expect(w.homestead!.task, JSON.stringify(w.homestead)).toBeNull()
}
function link(w: World, kind: LinkKind) {
  const plan = planConnection(w, kind)
  expect(plan, kind).not.toBeNull()
  w.homestead!.infrastructure.plan = plan
  materialStore(w)!.inventory[linkCurrency(kind)] += linkCost(kind)
  begin(w, 'buildConnection', 900); build(w)
  return plan!
}
function machinery(w: World, ms: number, check?: () => void) {
  for (let t = 0; t < ms; t += 50) {
    w.timeMs += 50
    const frame = createInserterFrame(w), vacated = advanceTransport(w, 50)
    outputMachines(w, vacated); allocatePower(w, frame); advanceInserters(w, 50, frame); advanceCrafting(w, 50); pruneAnalytics(w); check?.()
  }
}
function circuits() {
  const w = stored()
  placeBuilding(w, 14, 24, 'assembler', 'east'); w.homestead!.expansion.circuitAssembler = 974
  changeCraftingRecipe(w, 14, 24, 'electronicCircuit')
  return w
}
function industrial(hoistX = 26) {
  const w = stored(), h = w.homestead!
  placeBuilding(w, 24, 20, 'steamEngine', 'east'); h.expansion.steamEngine = 824
  const engine = w.buildings[824]!
  if (engine.kind === 'steamEngine') engine.fuel = 6
  placeBuilding(w, 24, 21, 'powerPole', 'east')
  placeBuilding(w, 22, 20, 'fuelDepot', 'east'); h.expansion.fuelStore = 822
  const depot = w.buildings[822]!
  if (depot.kind === 'fuelDepot') depot.inventory.coal = 12
  placeBuilding(w, hoistX, 20, 'steamHoist', 'east'); h.expansion.steamHoist = 800 + hoistX
  const hoist = w.buildings[800 + hoistX]!
  if (hoist.kind === 'steamHoist') hoist.cycles = 1
  materialStore(w)!.inventory.coal = 6
  expect(chooseLoading(w)).toBe(true); build(w, advanceLoading)
  placeBuilding(w, 14, 17, 'assembler', 'east'); h.expansion.briquetteAssembler = 694
  placeBuilding(w, 14, 18, 'powerPole', 'east'); placeBuilding(w, 13, 18, 'generator', 'east')
  changeCraftingRecipe(w, 14, 17, 'coalBriquette')
  return w
}
describe('mixed circuit supply', () => {
  it('retains paid personal cable production when a compact store cannot fit both bands', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!
    placeBuilding(w, 14, 17, 'furnace', 'east'); h.expansion.copperFurnace = 694
    for (const tile of [860, 901, 940]) placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'powerPole', 'east')
    const plan = planChain(w, 'cables')
    if (!plan) throw Error('No personal cable production site')
    h.expansion.plan = plan; store.inventory.copperPlate = 8; begin(w, 'buildChain', plan.anchor); build(w, advanceExpansion)
    const tile = h.expansion.cableAssembler
    if (tile === null) throw Error('No cable assembler')
    store.inventory.copperPlate = 2
    expect(chooseExpansion(w, 'inventor')).toBe(true); expect(h.task).toBe('fetchCable'); build(w, advanceExpansion)
    const machine = w.buildings[tile]
    expect(machine?.kind === 'assembler' && machine.input.copperPlate).toBe(2)
    expect(h.infrastructure.links).toHaveLength(0)
  })
  it('restores an actual crate visit over an owned arm and rejects unowned crossing state', () => {
    const w = circuits(), plan = link(w, 'circuitFeed'), tile = plan.parts[2].tile
    Object.assign(w.pete, { tile, x: tile % SIZE, y: Math.floor(tile / SIZE), next: null, travelMs: 0, path: [], pathRevision: -1 })
    Object.assign(w.peace, { activity: 'checkingCrate', destination: tile, sinceMs: w.timeMs, untilMs: w.timeMs + 4000 })
    const saved = snapshot(w)
    expect(snapshot(decodeSave(JSON.stringify(saved)).world)).toEqual(saved)
    const bad = structuredClone(saved); bad.game.homestead.infrastructure.links = []
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  })
  it('saves twelve paid circuit plates and restores the original side-powered layout', () => {
    const w = stored(), h = w.homestead!
    h.expansion.plan = { kind: 'circuits', anchor: 974, direction: 'east', built: 0 }
    h.carried.copperPlate = 12; begin(w, 'buildChain', 974)
    const paid = snapshot(w), loaded = decodeSave(JSON.stringify(paid)).world
    expect(snapshot(loaded)).toEqual(paid)
    const old = structuredClone(paid); stripVersion52State(old.game); old.version = 50
    delete old.game.homestead.infrastructure.industrial; delete old.game.homestead.infrastructure.cargoCycles
    expect(() => decodeSave(JSON.stringify(old))).toThrow()
    build(w, advanceExpansion); build(loaded, advanceExpansion)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    expect(w.buildings[977]?.kind).toBe('powerPole'); expect(w.buildings[978]?.kind).toBe('generator')
    const xp = w.personality.paths.inventor.xp
    removeBuilding(w, 18, 24)
    const interrupted = decodeSave(JSON.stringify(snapshot(w))).world
    expect(interrupted.rebuilding!.jobs.find(j => j.tile === 978)?.owner).toMatchObject({ type: 'chain', plan: { direction: 'east' } })
    materialStore(interrupted)!.inventory.copperPlate = 4
    for (let t = 0; t < 60000 && !interrupted.buildings[978]; t += 50) { chooseRebuild(interrupted); interrupted.timeMs += 50; advanceRebuilding(interrupted, 50) }
    expect(interrupted.buildings[978]?.kind).toBe('generator')
    expect(interrupted.personality.paths.inventor.xp).toBe(xp)
  })
  it('plans the near inlet while Pete stands there, then physically steps aside before building', () => {
    const w = circuits(), h = w.homestead!
    Object.assign(w.pete, { tile: 899, x: 19, y: 22, next: null, path: [], pathRevision: -1 })
    const before = snapshot(w), plan = planConnection(w, 'circuitFeed')
    expect(snapshot(w)).toEqual(before)
    expect(plan?.parts[2].tile).toBe(899)
    h.infrastructure.plan = plan; materialStore(w)!.inventory.copperPlate = 8; begin(w, 'buildConnection', 900)
    let installed = false
    for (let t = 0; t < 240000 && h.task; t += 50) {
      w.timeMs += 50; advanceInfrastructure(w, 50)
      if (!installed && w.buildings[899]?.kind === 'inserter') { installed = true; expect(w.pete.tile).not.toBe(899) }
    }
    expect(installed).toBe(true); expect(h.task).toBeNull()
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
  })
  it('pays for one mixed line, bounds both ingredients and produces exactly twelve circuits', () => {
    const w = circuits(), store = materialStore(w)!, machine = w.buildings[974]!
    link(w, 'circuitFeed'); link(w, 'circuitReturn')
    store.inventory.ironPlate = 48; store.inventory.copperCable = 48
    machinery(w, 180000, () => {
      if (machine.kind !== 'assembler') throw Error('assembler')
      expect(machine.input.ironPlate + inFlight(w, 'ironPlate', 'circuitFeed')).toBeLessThanOrEqual(2)
      expect(machine.input.copperCable + inFlight(w, 'copperCable', 'circuitFeed')).toBeLessThanOrEqual(6)
      expect(circuitStock(w)).toBeLessThanOrEqual(12)
    })
    expect(store.inventory.electronicCircuit).toBe(12)
    expect(w.produced.electronicCircuit).toBe(12)
    expect(store.inventory.ironPlate).toBe(36); expect(store.inventory.copperCable).toBe(12)
    expect(w.personality.paths.inventor.xp).toBe(0)
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
  })
  it('keeps real packets and reservations through outage, missing parts and active save continuation', () => {
    const w = circuits(), p = link(w, 'circuitFeed'), store = materialStore(w)!
    store.inventory.ironPlate = 30; store.inventory.copperCable = 18
    machinery(w, 2500)
    const loaded = decodeSave(JSON.stringify(snapshot(w))).world
    machinery(w, 3000); machinery(loaded, 3000); expect(snapshot(loaded)).toEqual(snapshot(w))
    removeBuilding(w, p.parts[1].tile % SIZE, Math.floor(p.parts[1].tile / SIZE)); machinery(w, 50)
    expect(connectionRunning(w, 'circuitFeed')).toBe(false)
    expect(connectionGuide(w, p.parts[2].tile)?.action).toContain('Copper cable')
    expect(connectionGuide(w, p.parts[2].tile)?.reason).toContain('Verbindungsteil')
    expect(infrastructurePickupAllowed(w, p.parts[2].tile, 'ironPlate')).toBe(false)
  })
})
describe('fuel production and real loading', () => {
  it('reuses a bounded original coal inlet and preserves its repair ownership through save/load', () => {
    const w = industrial(28), h = w.homestead!
    w.tiles[825] = 'coal'; placeBuilding(w, 25, 20, 'miner', 'north'); h.expansion.coalMiner = 825
    for (const tile of [785, 784, 783, 782]) placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', tile === 782 ? 'south' : 'west')
    for (const tile of [865, 823, 862]) placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'powerPole', 'east')
    const plan = link(w, 'loadingReturn')
    expect(plan.inlet).toEqual([825, 785, 784, 783, 782, 822]); expect(plan.receiver).toBeDefined()
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
    removeBuilding(w, 25, 19)
    expect(connectionRunning(w, 'loadingReturn')).toBe(false)
    const loaded = decodeSave(JSON.stringify(snapshot(w))).world
    expect(loaded.rebuilding!.jobs.some(j => j.tile === 785 && j.owner.type === 'chain' && j.owner.plan.kind === 'coalMining')).toBe(true)
    for (let t = 0; t < 60000 && !loaded.buildings[785]; t += 50) { chooseRebuild(loaded); loaded.timeMs += 50; advanceRebuilding(loaded, 50) }
    expect(loaded.buildings[785]?.kind).toBe('belt')
    expect(loaded.homestead!.infrastructure.links[0].inlet).toEqual(plan.inlet)
  })
  it('reserves simultaneous depot arrivals without deleting old excess or changing ordinary depots', () => {
    const w = industrial(); link(w, 'stampFeed')
    const depot = w.buildings[822]!
    if (depot.kind !== 'fuelDepot') throw Error('depot')
    const free = [821, 823, 782, 862].filter(t => !w.buildings[t]).slice(0, 2)
    expect(free).toHaveLength(2)
    for (const tile of free) {
      const direction = tile === 821 ? 'east' : tile === 823 ? 'west' : tile === 782 ? 'south' : 'north'
      placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'belt', direction)
      const belt = w.buildings[tile]!
      if (belt.kind === 'belt') { belt.item = 'coal'; belt.progress = 1 }
    }
    depot.inventory.coal = 11
    advanceTransport(w, 50); expect(depot.inventory.coal).toBe(12)
    depot.inventory.coal = 24
    advanceTransport(w, 50); expect(depot.inventory.coal).toBe(24)
    w.homestead!.infrastructure.links = []
    depot.inventory.coal = 23
    advanceTransport(w, 50); expect(depot.inventory.coal).toBe(24)
  })
  it('banks furnishing briquettes only while raw coal can feed the boiler', () => {
    const w = industrial(); link(w, 'stampFeed')
    const h = w.homestead!, depot = w.buildings[822]!
    if (depot.kind !== 'fuelDepot') throw Error('depot')
    placeBuilding(w, 23, 20, 'inserter', 'east'); h.expansion.coalInserter = 823
    h.infrastructure.cargoCycles = 10; depot.inventory.coalBriquette = 6
    expect(infrastructurePickupAllowed(w, 823, 'coalBriquette')).toBe(false)
    expect(infrastructurePickupAllowed(w, 823, 'coal')).toBe(true)
    depot.inventory.coal = 0
    expect(infrastructurePickupAllowed(w, 823, 'coalBriquette')).toBe(true)
  })
  it('protects eight fuel and four input coal without spending iron in a coal-only connection', () => {
    const w = industrial(), p = link(w, 'stampFeed'), depot = w.buildings[822]!
    if (depot.kind !== 'fuelDepot') throw Error('depot')
    machinery(w, 40000)
    expect(mainFuel(w)).toBeGreaterThanOrEqual(8)
    expect(w.produced.coalBriquette).toBeGreaterThan(0)
    depot.inventory.coal = 8
    expect(infrastructurePickupAllowed(w, p.parts[2].tile, 'coal')).toBe(false)
    expect(materialStore(w)!.inventory.ironPlate).toBe(0)
    expect(w.personality.paths.industrial.xp).toBe(0)
  })
  it('counts only completed cargo, preserves full-output work and migrates genuine Save 50', () => {
    const w = industrial(), s = w.homestead!.infrastructure, site = s.loading!
    const old = snapshot(w); stripVersion52State(old.game); old.version = 50
    delete old.game.homestead.infrastructure.industrial; delete old.game.homestead.infrastructure.cargoCycles
    const legacy = decodeSave(JSON.stringify(old)).world
    expect(legacy.homestead!.infrastructure.cargoCycles).toBe(0)
    advanceWorld(w, 2000)
    expect(s.loadingCargo).toBe('coal'); expect(s.cargoCycles).toBe(0)
    const loaded = decodeSave(JSON.stringify(snapshot(w))).world
    advanceWorld(w, 6000); advanceWorld(loaded, 6000)
    expect(snapshot(loaded)).toEqual(snapshot(w)); expect(s.cargoCycles).toBe(1)
    const output = w.buildings[site.output]!
    if (output.kind !== 'fuelDepot') throw Error('buffer')
    output.inventory.coal = 24
    advanceSteamWork(w, 16000); expect(s.cargoCycles).toBe(1)
  })
  it('does not recycle the main depot into a connected loading inlet and saves typed fallback cargo', () => {
    const w = industrial(), h = w.homestead!, s = h.infrastructure
    link(w, 'loadingFeed')
    const part = s.links[0].parts[1]
    removeBuilding(w, part.tile % SIZE, Math.floor(part.tile / SIZE))
    const stamp = w.buildings[694]!, input = w.buildings[s.loading!.input]!
    if (stamp.kind !== 'assembler' || input.kind !== 'fuelDepot') throw Error('loading')
    input.inventory.coal = 0; stamp.output.coalBriquette = 2
    expect(chooseLoading(w)).toBe(true)
    expect(h.target).toBe(694)
    for (let t = 0; t < 100000 && h.task === 'fetchLoading'; t += 50) { w.timeMs += 50; advanceLoading(w, 50) }
    expect(h.task).toBe('feedLoading'); expect(h.carried.coalBriquette).toBe(2)
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
  })
  it('funds bounded Industrial furnishings with six briquettes and one completion reward', () => {
    const w = industrial(), h = w.homestead!, s = h.infrastructure, depot = w.buildings[822]!
    placeBuilding(w, 28, 20, 'steamWorkshop', 'east'); h.expansion.steamWorkshop = 828
    if (depot.kind !== 'fuelDepot') throw Error('depot')
    depot.inventory.coal = 8; depot.inventory.coalBriquette = 6; s.cargoCycles = 10
    awardActivity(w.personality, { path: 'industrial', xp: 1000 })
    expect(chooseInfrastructure(w, 'industrial')).toBe(true)
    expect(h.task).toBe('finishOrder')
    for (let t = 0; t < 100000 && !h.elapsedMs; t += 50) { w.timeMs += 50; advanceInfrastructure(w, 50) }
    expect(h.carried.coalBriquette).toBe(6); expect(mainFuel(w)).toBe(8)
    const loaded = decodeSave(JSON.stringify(snapshot(w))).world, xp = w.personality.paths.industrial.xp
    build(w); build(loaded); expect(snapshot(loaded)).toEqual(snapshot(w))
    expect(s.industrial).toBe(1); expect(w.personality.paths.industrial.xp).toBe(xp + 8)
    expect(chooseInfrastructure(w, 'industrial')).toBe(false)
  })
})
it.each(['legacy', 'counter', 'kind', 'invoice'] as const)('rejects malformed %s without mutating the world', mode => {
  const w = circuits(), plan = link(w, 'circuitFeed'), original = snapshot(w), bad = structuredClone(original)
  if (mode === 'legacy') bad.version = 50
  if (mode === 'counter') bad.game.homestead.infrastructure.cargoCycles = 1
  if (mode === 'kind') bad.game.homestead.infrastructure.links[0].kind = 'loadingReturn'
  if (mode === 'invoice') { bad.game.homestead.task = 'buildConnection'; bad.game.homestead.target = 900; bad.game.homestead.infrastructure.plan = plan; bad.game.homestead.infrastructure.repair = true; bad.game.homestead.carried.copperPlate = 2 }
  expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  expect(snapshot(w)).toEqual(original)
})
