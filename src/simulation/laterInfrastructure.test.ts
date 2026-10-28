import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { begin, materialStore } from './homestead'
import { advanceInfrastructure, connectionComplete, chooseInfrastructure, planConnection } from './infrastructure'
import { projectBuilding } from './secretProject'
import { awardActivity, rewardProject } from './personality'
import { connectionGuide, loadingGuide } from './connectionGuide'
import { advanceLoading, chooseLoading } from './loading'
import { emptyInventory, inventoryTotal } from './items'
import { changeCraftingRecipe } from './crafting'
import { refreshNatureSchedule } from './nature'
import { advanceWorld } from './step'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { advanceCrafting } from './crafting'
import { advanceTransport, outputMachines } from './transport'
import { advanceInserters, createInserterFrame } from './inserters'
import { allocatePower } from './power'
import { pruneAnalytics } from './analytics'

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
function copper() {
  const w = stored(), h = w.homestead!
  placeBuilding(w, 14, 17, 'furnace', 'east'); h.expansion.copperFurnace = 694
  placeBuilding(w, 14, 24, 'assembler', 'east'); h.expansion.cableAssembler = 974
  changeCraftingRecipe(w, 14, 24, 'copperCable')
  return w
}
function link(w: World, kind: 'copper' | 'cableFeed' | 'cableReturn') {
  const p = planConnection(w, kind)
  expect(p).not.toBeNull(); w.homestead!.infrastructure.plan = p
  materialStore(w)!.inventory.copperPlate += 8; begin(w, 'buildConnection', 900); build(w)
  return p!
}
function machinery(w: World, ms: number) {
  for (let t = 0; t < ms; t += 50) {
    w.timeMs += 50
    const frame = createInserterFrame(w), vacated = advanceTransport(w, 50)
    outputMachines(w, vacated); allocatePower(w, frame); advanceInserters(w, 50, frame); advanceCrafting(w, 50); pruneAnalytics(w)
  }
}
function loader() {
  const w = stored(), h = w.homestead!
  placeBuilding(w, 24, 20, 'steamEngine', 'east'); h.expansion.steamEngine = 824
  const engine = w.buildings[824]!
  if (engine.kind === 'steamEngine') engine.fuel = 6
  placeBuilding(w, 24, 21, 'powerPole', 'east')
  placeBuilding(w, 26, 20, 'steamHoist', 'east'); h.expansion.steamHoist = 826
  const hoist = w.buildings[826]!
  if (hoist.kind === 'steamHoist') hoist.cycles = 1
  materialStore(w)!.inventory.coal = 6
  expect(chooseLoading(w)).toBe(true); build(w, advanceLoading)
  return w
}
describe('Inventor supply and actual connection explanations', () => {
  it('pays both ingredients once, retains active work and bounds visible Inventor orders', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!
    for (const [key, kind, tile] of [['experimentProject', 'experiment', 818], ['flightProject', 'flightpad', 1060]] as const) {
      w[key] = { kind, home: w.peace.home!, direction: 'south', tiles: [tile], spots: [tile + 1], phase: 'complete', built: 1, carried: 0, ...(kind === 'experiment' ? { carriedGears: 0, readyAtMs: 0 } : { carriedCircuits: 0 }), carriedCopper: 0, carriedCable: 0, crate: null, elapsedMs: 0 }
      w.buildings[tile] = projectBuilding(w[key]!, tile)
      rewardProject(w.personality, kind)
    }
    store.inventory.copperCable = 12; store.inventory.electronicCircuit = 6
    awardActivity(w.personality, { path: 'inventor', xp: 200 })
    const initialXp = w.personality.paths.inventor.xp
    h.infrastructure.order = 'inventor'; begin(w, 'finishOrder', 818)
    for (let n = 0; n < 2000 && !h.elapsedMs; n++) { w.timeMs += 50; advanceInfrastructure(w, 50) }
    expect(h.carried.copperCable).toBe(4); expect(h.carried.electronicCircuit).toBe(2)
    const loaded = decodeSave(JSON.stringify(snapshot(w))).world
    build(w); build(loaded); expect(snapshot(loaded)).toEqual(snapshot(w))
    expect(store.inventory.copperCable).toBe(8); expect(store.inventory.electronicCircuit).toBe(4)
    expect(h.infrastructure.inventor).toBe(1)
    expect(w.personality.paths.inventor.xp).toBe(initialXp + 8)
    expect(chooseInfrastructure(w, 'inventor')).toBe(false)
    for (let stage = 1; stage < 3; stage++) { h.infrastructure.order = 'inventor'; begin(w, 'finishOrder', 1060); build(w) }
    w.timeMs = h.infrastructure.nextOrderAtMs
    expect(chooseInfrastructure(w, 'inventor')).toBe(false)
    expect(h.infrastructure.inventor).toBe(3)
    expect(inventoryTotal(h.carried)).toBe(0)
  })
  it('validates and follows an ordinary shared incoming belt without losing downstream damage', () => {
    const w = copper(), direct = link(w, 'copper')
    for (const tile of [860, 901, 940, 899]) if (!w.buildings[tile]) placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')
    const returning = link(w, 'cableReturn')
    expect(returning.receiver).toBeDefined()
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
    const bad = snapshot(w)
    bad.game.homestead.infrastructure.links[1].receiver = 0
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    // A second incoming route can terminate at an owned belt on the same store route.
    const tail = returning.parts.at(-1)!, direction = tail.direction
    const receiver = tail.tile + (direction === 'east' ? 1 : direction === 'west' ? -1 : direction === 'south' ? SIZE : -SIZE)
    expect(receiver).toBe(returning.receiver ?? returning.target)
    expect(connectionComplete(w, direct)).toBe(true)
    const part = direct.parts.at(-1)!
    removeBuilding(w, part.tile % SIZE, Math.floor(part.tile / SIZE))
    expect(connectionComplete(w, direct)).toBe(false)
    expect(connectionComplete(w, returning)).toBe(false)
  })
  it('pays copper for ordinary copper delivery and reports missing stock, quota and outage', () => {
    const w = copper(), p = link(w, 'copper'), f = w.buildings[694]!
    if (f.kind !== 'furnace') throw Error('furnace')
    machinery(w, 50)
    expect(connectionGuide(w, p.parts[3].tile)?.reason).toContain('Quelle')
    const before = snapshot(w); connectionGuide(w, 694); expect(snapshot(w)).toEqual(before)
    f.output.copperPlate = 2; machinery(w, 30000)
    expect(materialStore(w)!.inventory.copperPlate).toBe(2)
    materialStore(w)!.inventory.copperPlate = 40; f.output.copperPlate = 2
    expect(connectionGuide(w, p.parts[3].tile)?.reason).toContain('Vorratsziel')
    const generator = p.parts.find(p => p.kind === 'generator')!
    removeBuilding(w, generator.tile % SIZE, Math.floor(generator.tile / SIZE)); machinery(w, 50)
    expect(connectionGuide(w, 694)?.reason).toContain('Verbindungsteil')
    expect(w.personality.paths.inventor.xp).toBe(0)
  })
  it('physically feeds and returns shared two-output cable batches with bounded stock and exact saves', () => {
    const w = copper(); link(w, 'cableFeed'); link(w, 'cableReturn')
    materialStore(w)!.inventory.copperPlate = 36
    machinery(w, 90000)
    expect(materialStore(w)!.inventory.copperCable).toBeGreaterThan(0)
    expect(materialStore(w)!.inventory.copperCable).toBeLessThanOrEqual(16)
    expect(materialStore(w)!.inventory.copperPlate).toBeGreaterThanOrEqual(24)
    expect(w.produced.copperCable).toBeGreaterThan(0)
    expect(w.personality.paths.inventor.xp).toBe(0)
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
  })
})
describe('real fuel loading on the existing hoist', () => {
  it('commissions six actual coal, moves one physical item per powered lift and resumes exactly', () => {
    const w = loader(), s = w.homestead!.infrastructure, site = s.loading!
    expect(materialStore(w)!.inventory.coal).toBe(0)
    const input = w.buildings[site.input]!, output = w.buildings[site.output]!
    if (input.kind !== 'fuelDepot' || output.kind !== 'fuelDepot') throw Error('buffers')
    expect(input.inventory.coal).toBe(6)
    advanceWorld(w, 2000)
    expect(s.loadingCargo).toBe('coal')
    const loaded = decodeSave(JSON.stringify(snapshot(w))).world
    advanceWorld(w, 6000); advanceWorld(loaded, 6000)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    expect(output.inventory.coal).toBe(1)
    expect(input.inventory.coal + output.inventory.coal + Number(s.loadingCargo !== null)).toBe(6)
    expect(loadingGuide(w, 826)?.action).toContain('Ausgang 1/24')
  })
  it('retains cargo and progress through a full output, power loss and missing-buffer repair', () => {
    const w = loader(), h = w.homestead!, s = h.infrastructure, site = s.loading!
    advanceWorld(w, 1000)
    const output = w.buildings[site.output]!, hoist = w.buildings[826]!
    if (output.kind !== 'fuelDepot' || hoist.kind !== 'steamHoist') throw Error('loader')
    output.inventory.coal = 24
    const elapsed = hoist.elapsedMs, cycles = hoist.cycles
    advanceWorld(w, 2000); expect(hoist.elapsedMs).toBe(elapsed); expect(hoist.cycles).toBe(cycles)
    expect(s.loadingCargo).toBe('coal'); expect(loadingGuide(w, 826)?.reason).toContain('voll')
    removeBuilding(w, site.output % SIZE, Math.floor(site.output / SIZE))
    expect(s.loadingCargo).toBe('coal')
    expect(chooseLoading(w)).toBe(true); build(w, advanceLoading)
    expect(s.loadingCargo).toBe('coal')
    const restored = w.buildings[site.output]!
    expect(restored.kind === 'fuelDepot' && inventoryTotal(restored.inventory)).toBe(0)
    hoist.sabotageUntilMs = w.timeMs + 2000
    advanceWorld(w, 1000); expect(hoist.elapsedMs).toBe(elapsed)
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
  })
  it('discards the one held item only when its hoist is demolished', () => {
    const w = loader(); advanceWorld(w, 1000)
    expect(w.homestead!.infrastructure.loadingCargo).toBe('coal')
    removeBuilding(w, 26, 20)
    expect(w.homestead!.infrastructure.loadingCargo).toBeNull()
  })
})
it('upgrades a genuine Save 49 without fabricating cable work or fuel', () => {
  const w = stored(), old = snapshot(w), s = old.game.homestead.infrastructure
  old.version = 49
  for (const key of ['industrial', 'cargoCycles', 'inventor', 'loading', 'loadingPlan', 'loadingCargo']) delete s[key]
  const loaded = decodeSave(JSON.stringify(old)).world
  expect(loaded.homestead!.infrastructure.inventor).toBe(0)
  expect(loaded.homestead!.infrastructure.loading).toBeNull()
  expect(materialStore(loaded)).toEqual(materialStore(w))
})
