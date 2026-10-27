import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { advanceInfrastructure, chooseInfrastructure, connectionComplete, planConnection, planWheel } from './infrastructure'
import { arrived, begin, materialStore } from './homestead'
import { emptyInventory, inventoryTotal } from './items'
import { awardActivity, rewardProject } from './personality'
import { allocatePower } from './power'
import { refreshNatureSchedule } from './nature'
import { advanceTransport, outputMachines } from './transport'
import { advanceInserters, createInserterFrame } from './inserters'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { peteStatus } from './peteStatus'
import { projectBuilding, projectCandidates, trySecretProject } from './secretProject'
import { advanceWorld } from './step'
import { peteWalkableTile, serviceCrossing } from './navigation'
import { finishWorkshop, workshopSpot } from './workshop'
import { advanceCrafting, changeCraftingRecipe } from './crafting'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z'))
function stored() {
  const w = createPetesWorld(), h = w.homestead!
  for (let i = 0; i < w.buildings.length; i++) if (i !== w.peace.home) w.buildings[i] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  h.store = 900
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  placeBuilding(w, 14, 17, 'furnace', 'east'); h.expansion.furnace = 694
  if (!w.research.unlocked.includes('automation1')) w.research.unlocked.push('automation1')
  placeBuilding(w, 14, 24, 'assembler', 'east'); h.expansion.gearAssembler = 974
  changeCraftingRecipe(w, 14, 24, 'ironGear')
  return w
}
function build(w: World) {
  for (let t = 0; t < 240000 && w.homestead!.task; t += 50) { w.timeMs += 50; advanceInfrastructure(w, 50) }
  expect(w.homestead!.task, JSON.stringify({ h: w.homestead, pete: w.pete, arrived: w.homestead!.infrastructure.plan ? arrived(w, w.homestead!.infrastructure.plan.parts[w.homestead!.infrastructure.built]?.tile ?? 0, 50, true) : null })).toBeNull()
}
function link(w: World, kind: 'iron' | 'gearFeed' | 'gearReturn') {
  const plan = planConnection(w, kind)
  expect(plan, `${kind}: ${JSON.stringify(w.homestead!.infrastructure.links)}`).not.toBeNull()
  w.homestead!.infrastructure.plan = plan
  materialStore(w)!.inventory.ironPlate += 8
  begin(w, 'buildConnection', w.homestead!.store)
  build(w)
  expect(connectionComplete(w, plan!)).toBe(true)
  return plan!
}
function wait(w: World, ms: number) {
  for (let t = 0; t < ms; t += 50) {
    w.timeMs += 50
    const frame = createInserterFrame(w), vacated = advanceTransport(w, 50)
    outputMachines(w, vacated); allocatePower(w, frame); advanceInserters(w, 50, frame); advanceCrafting(w, 50)
  }
}

describe('ordinary paid Pete transport', () => {
  it('funds an original project when the store is accessible only over its owned transport', () => {
    const w = stored(), store = materialStore(w)!
    link(w, 'iron')
    for (const tile of [860, 901, 940]) expect(placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'powerPole', 'east')).toBe(true)
    store.inventory.ironPlate = 12
    expect(projectCandidates(w).some(p => p.definition.id === 'workshop')).toBe(true)
    expect(trySecretProject(w)).toBe(true)
    for (let t = 0; t < 120000 && w.workshopProject?.phase !== 'building'; t += 50) advanceWorld(w, 50)
    expect(w.workshopProject?.phase).toBe('building')
    expect(w.workshopProject?.carriedIron).toBe(12)
    expect(store.inventory.ironPlate).toBe(0)
  })
  it('retains actual anvil practice on a completed workshop service crossing', () => {
    const w = stored()
    const h = w.homestead!, route = [696, 697, 698, 699, 739, 779, 819, 859, 899]
    h.infrastructure.plan = { kind: 'iron', source: 694, target: 900, parts: [{ tile: 693, kind: 'powerPole', direction: 'east' }, { tile: 653, kind: 'generator', direction: 'east' }, { tile: 695, kind: 'inserter', direction: 'east' }, ...route.map((tile, i) => ({ tile, kind: 'belt' as const, direction: i < 3 || i === route.length - 1 ? 'east' as const : 'south' as const }))] }
    materialStore(w)!.inventory.ironPlate = 8; begin(w, 'buildConnection', h.store); build(w)
    const tile = 818, spot = 819
    expect(serviceCrossing(w, spot)).toBe(true)
    w.workshopProject = { kind: 'workshop', home: w.peace.home!, direction: 'south', tiles: [tile], spots: [spot], phase: 'complete', built: 1, carried: 0, carriedIron: 0, crate: null, elapsedMs: 0, readyAtMs: 0 }
    w.buildings[tile] = projectBuilding(w.workshopProject, tile)
    rewardProject(w.personality, 'workshop')
    Object.assign(w.pete, { tile: spot, x: spot % SIZE, y: Math.floor(spot / SIZE), next: null, travelMs: 0, path: [] })
    expect(workshopSpot(w)).toBe(spot)
    Object.assign(w.peace, { activity: 'hammering', destination: spot, sinceMs: w.timeMs, untilMs: w.timeMs + 5000 })
    w.timeMs += 5000
    expect(finishWorkshop(w)).toBe(true)
    expect(w.personality.paths.craftsman.xp).toBe(13)
  })
  it('physically fetches and reparks a bicycle that occupies a future connection', () => {
    const w = stored(), h = w.homestead!, original = 695
    h.cargoBicycle = true; h.bikeTile = original
    expect(chooseInfrastructure(w, 'craftsman')).toBe(true)
    expect(h.task).toBe('parkBicycle')
    advanceInfrastructure(w, 0)
    expect(h.bikeTile).toBe(original)
    expect(w.pete.tile).not.toBe(original)
    build(w)
    expect(h.bikeTile).toBe(w.pete.tile)
    expect(h.bikeTile).not.toBe(original)
  })
  it('keeps only owned ground transport crossable and saves an active crossing exactly', () => {
    const w = stored(), h = w.homestead!, p = link(w, 'iron'), tile = p.parts.find(p => p.kind === 'inserter')!.tile
    expect(peteWalkableTile(w, tile)).toBe(true)
    expect(serviceCrossing(w, tile)).toBe(true)
    w.pete.tile = tile; w.pete.x = tile % SIZE; w.pete.y = Math.floor(tile / SIZE); w.pete.next = null; w.pete.travelMs = 0
    h.carried.ironPlate = 1; begin(w, 'returnStock', h.store)
    expect(snapshot(decodeSave(JSON.stringify(snapshot(w))).world)).toEqual(snapshot(w))
    placeBuilding(w, 10, 10, 'belt', 'east')
    expect(peteWalkableTile(w, 410)).toBe(false)
    const factory = { ...w, homestead: undefined }
    expect(peteWalkableTile(factory, tile)).toBe(false)
  })
  it('constructs a real powered furnace-to-store route and respects its quota and outages', () => {
    const w = stored(), store = materialStore(w)!, plan = link(w, 'iron'), f = w.buildings[694]!
    if (f.kind !== 'furnace') throw Error('furnace')
    f.output.ironPlate = 2
    wait(w, 30000)
    expect(store.inventory.ironPlate).toBe(2)
    expect(f.output.ironPlate).toBe(0)
    expect(w.personality.paths.craftsman.xp).toBe(0)
    store.inventory.ironPlate = 40; f.output.ironPlate = 2
    wait(w, 5000); expect(f.output.ironPlate).toBe(2)
    store.inventory.ironPlate = 0
    const generator = plan.parts.find(p => p.kind === 'generator')!
    removeBuilding(w, generator.tile % SIZE, Math.floor(generator.tile / SIZE))
    wait(w, 5000); expect(f.output.ironPlate).toBe(2)
  })
  it('uses separate physical gear input/output links with bounded stocks and no transfer XP', () => {
    const w = stored(), store = materialStore(w)!
    link(w, 'gearFeed'); link(w, 'gearReturn')
    store.inventory.ironPlate = 32
    const xp = w.personality.paths.craftsman.xp
    wait(w, 80000)
    expect(store.inventory.ironGear).toBeGreaterThan(0)
    expect(store.inventory.ironGear).toBeLessThanOrEqual(12)
    expect(store.inventory.ironPlate).toBeGreaterThanOrEqual(24)
    expect(w.personality.paths.craftsman.xp).toBe(xp)
    expect(w.produced.ironGear).toBeGreaterThan(0)
  })
  it('retains paid work behind obstruction and resumes exactly after save/load', () => {
    const w = stored(), h = w.homestead!, plan = planConnection(w, 'iron')!
    h.infrastructure.plan = plan; materialStore(w)!.inventory.ironPlate = 8
    begin(w, 'buildConnection', h.store)
    for (let n = 0; n < 2000 && !h.carried.ironPlate; n++) { w.timeMs += 50; advanceInfrastructure(w, 50) }
    expect(h.carried.ironPlate).toBe(8)
    const blocked = plan.parts[0].tile
    w.water[blocked] = true; w.topologyRevision++
    const before = snapshot(w), loaded = decodeSave(JSON.stringify(before)).world
    expect(snapshot(loaded)).toEqual(before)
    for (const candidate of [w, loaded]) {
      for (let n = 0; n < 10; n++) { candidate.timeMs += 50; advanceInfrastructure(candidate, 50) }
      expect(candidate.homestead!.carried.ironPlate).toBe(8)
      candidate.water[blocked] = false; candidate.topologyRevision++; build(candidate)
    }
    expect(snapshot(loaded)).toEqual(snapshot(w))
  })
  it('repairs the original missing component for one plate without repeat rewards', () => {
    const w = stored(), h = w.homestead!, p = link(w, 'iron'), part = p.parts.at(-1)!
    removeBuilding(w, part.tile % SIZE, Math.floor(part.tile / SIZE))
    h.cargoBicycle = true
    materialStore(w)!.inventory.ironPlate = 1
    expect(chooseInfrastructure(w, 'craftsman')).toBe(true)
    build(w)
    expect(materialStore(w)!.inventory.ironPlate).toBe(0)
    expect(connectionComplete(w, p)).toBe(true)
    expect(w.personality.paths.craftsman.xp).toBe(0)
  })
})
describe('Eco wheel and orientation', () => {
  it('pays actual store Wood, connects to the mill network and keeps global Wood unchanged', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!
    h.millAnchor = 1098; h.millBuilt = 3
    placeBuilding(w, 18, 27, 'sawmill', 'east'); placeBuilding(w, 18, 28, 'powerPole', 'east'); placeBuilding(w, 19, 28, 'generator', 'east')
    w.water[1100] = true; w.topologyRevision++
    awardActivity(w.personality, { path: 'eco', xp: 80 }); store.wood = 10
    h.infrastructure.wheelPlan = planWheel(w)
    expect(h.infrastructure.wheelPlan).not.toBeNull(); begin(w, 'buildWheel', h.store)
    build(w)
    const site = h.infrastructure.wheel!
    expect(w.buildings[site.tile]?.kind).toBe('waterwheel'); expect(store.wood).toBe(0); expect(w.nature.wood).toBe(0)
    allocatePower(w)
    expect(decodeSave(JSON.stringify(snapshot(w))).world.homestead!.infrastructure.wheel).toEqual(site)
  })
  it('shows four read-only next steps with concrete stock and a focus tile', () => {
    const w = stored(), before = snapshot(w), status = peteStatus(w)
    expect(status.next).toHaveLength(4)
    expect(status.next!.every(p => p.target !== null && p.reason.length > 0)).toBe(true)
    expect(snapshot(w)).toEqual(before)
  })
  it('finishes paid visible Craftsman orders with bounded stages/cooldown and exact active saves', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!, tile = 818
    w.workshopProject = { kind: 'workshop', home: w.peace.home!, direction: 'south', tiles: [tile], spots: [tile + 1], phase: 'complete', built: 1, carried: 0, carriedIron: 0, crate: null, elapsedMs: 0, readyAtMs: 0 }
    w.buildings[tile] = projectBuilding(w.workshopProject, tile)
    rewardProject(w.personality, 'workshop')
    store.inventory.ironGear = 4; h.infrastructure.order = 'craftsman'; begin(w, 'finishOrder', tile)
    for (let n = 0; n < 2000 && !h.elapsedMs; n++) { w.timeMs += 50; advanceInfrastructure(w, 50) }
    expect(inventoryTotal(h.carried)).toBe(4)
    const restored = decodeSave(JSON.stringify(snapshot(w))).world
    build(w); build(restored)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(h.infrastructure.craftsman).toBe(1); expect(h.infrastructure.nextOrderAtMs).toBe(w.timeMs + 300000)
    expect(w.personality.paths.craftsman.xp).toBe(18)
    expect(arrived(w, tile, 0)).toBe(true)
  })
})
it.each(['duplicate', 'clock', 'invoice', 'geometry', 'hiddenLegacy'] as const)('rejects malformed %s state without modifying the source', kind => {
  const w = stored(), p = link(w, 'iron'), original = snapshot(w), bad = structuredClone(original)
  if (kind === 'duplicate') bad.game.homestead.infrastructure.links.push(p)
  if (kind === 'clock') bad.game.homestead.infrastructure.nextOrderAtMs = w.timeMs + 300050
  if (kind === 'invoice') { bad.game.homestead.task = 'buildConnection'; bad.game.homestead.target = 900; bad.game.homestead.infrastructure.plan = p; bad.game.homestead.infrastructure.repair = true; bad.game.homestead.carried.ironPlate = 2 }
  if (kind === 'geometry') bad.game.homestead.infrastructure.links[0].parts[3].direction = 'west'
  if (kind === 'hiddenLegacy') bad.version = 48
  expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  expect(snapshot(w)).toEqual(original)
})
it('migrates genuine Save 48 without granting items or altering water', () => {
  const w = stored(), old = snapshot(w)
  old.version = 48; delete old.game.homestead.infrastructure
  const loaded = decodeSave(JSON.stringify(old)).world
  expect(loaded.water).toEqual(w.water); expect(materialStore(loaded)).toEqual(materialStore(w))
  expect(loaded.homestead!.infrastructure.links).toEqual([])
})
