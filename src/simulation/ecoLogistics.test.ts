import { createDevelopmentLife, developmentTargetValid, finishDevelopment } from './peteDevelopments'
import { homesteadProjectDelay } from './projectRegistry'
import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { begin, materialStore, freeSite } from './homestead'
import { emptyInventory } from './items'
import { advanceInfrastructure, chooseInfrastructure, connectionComplete, infrastructurePickupAllowed, planConnection } from './infrastructure'
import { allocatePower } from './power'
import { createInserterFrame, advanceInserters } from './inserters'
import { advanceTransport, outputMachines } from './transport'
import { changeCraftingRecipe, advanceCrafting } from './crafting'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { World } from './world'
import type { LinkKind } from './infrastructureRules'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { forestryOutput } from './forestryStation'
import { refreshNatureSchedule } from './nature'
import { ecoPickup } from './ecoLogistics'
import { ecoWoodReserve } from './productionLogistics'
import { peteStatus } from './peteStatus'
import { chooseExpansion } from './homesteadExpansion'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snap = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-28T00:00:00.000Z'))
function world() {
  const w = createPetesWorld(), h = w.homestead!
  for (let i = 0; i < w.buildings.length; i++) if (i !== w.peace.home) w.buildings[i] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  h.store = 900; w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 18, inventory: emptyInventory(), storeTier: 0 }
  h.millAnchor = 694; h.millBuilt = 3; h.expansion.forestry = 614; h.expansion.assembler = 696
  for (const id of ['automation1', 'logistics1'] as const) if (!w.research.unlocked.includes(id)) w.research.unlocked.push(id)
  for (const [at, kind, direction] of [[694, 'sawmill', 'east'], [654, 'belt', 'south'], [614, 'forester', 'south'], [695, 'belt', 'east'], [696, 'assembler', 'east'], [734, 'powerPole', 'east'], [735, 'generator', 'east']] as const) expect(placeBuilding(w, at % SIZE, Math.floor(at / SIZE), kind, direction)).toBe(true)
  changeCraftingRecipe(w, 16, 17, 'woodenCrate')
  return w
}
it('preserves shore construction priority before funding new material returns', () => {
  const w = world(), h = w.homestead!
  w.personality.paths.eco.level = 4; w.water[1220] = true
  w.orchardProject = { kind: 'orchard', home: 820, direction: 'east', tiles: [950], spots: [949], phase: 'complete', crate: null, built: 1, carried: 0, elapsedMs: 0 }
  expect(h.waterworks.dock).toBeNull(); expect(h.infrastructure.wheel).toBeNull()
  expect(chooseInfrastructure(w, 'eco')).toBe(false)
  expect(h.infrastructure.plan).toBeNull()
  expect(materialStore(w)!.wood).toBe(18)
  expect(h.infrastructure.links).toEqual([])
})
function build(w: World) {
  for (let t = 0; t < 240000 && w.homestead!.task; t += 50) { w.timeMs += 50; advanceInfrastructure(w, 50) }
  expect(w.homestead!.task).toBeNull()
}
function link(w: World, kind: LinkKind) {
  const h = w.homestead!, p = planConnection(w, kind)
  expect(p, kind).not.toBeNull()
  h.infrastructure.plan = p; begin(w, 'buildConnection', h.store); build(w)
  expect(connectionComplete(w, p!)).toBe(true)
  return p!
}
function tick(w: World, ms: number) {
  for (let t = 0; t < ms; t += 50) { w.timeMs += 50; const frame = createInserterFrame(w), vacated = advanceTransport(w, 50); outputMachines(w, vacated); allocatePower(w, frame); advanceInserters(w, 50, frame); advanceCrafting(w, 50) }
}
describe('Eco returns on the existing physical production chain', () => {
  it('reserves original crate improvements before additional furnishing orders', () => {
    const w = world(), h = w.homestead!, store = materialStore(w)!
    for (const kind of ['woodReturn', 'panelReturn', 'crateReturn'] as const) link(w, kind)
    w.personality.paths.eco.level = 4; store.storeTier = 1
    w.orchardProject = { kind: 'orchard', home: 820, direction: 'east', tiles: [816], spots: [817], phase: 'complete', crate: null, built: 1, carried: 0, elapsedMs: 0 }
    w.gardenProject = { ...w.orchardProject, kind: 'garden', tiles: [818], spots: [858] }
    w.buildings[818] = { kind: 'peteGarden', x: 18, y: 20, feed: 0 }
    w.coopProject = { ...w.orchardProject, kind: 'coop', tiles: [940], spots: [941] }
    w.buildings[940] = { kind: 'peteCoop', x: 20, y: 23 }
    h.infrastructure.wheel = { tile: 1100, direction: 'east', poles: [] }
    w.buildings[1100] = { kind: 'waterwheel', x: 20, y: 27, direction: 'east', rotationMs: 0 }
    store.inventory.woodenCrate = 2
    expect(chooseInfrastructure(w, 'eco')).toBe(false)
    store.inventory.woodenCrate = 4
    expect(chooseExpansion(w, 'eco')).toBe(true); expect(h.expansion.improvement).toBe('storeShelves')
    h.task = null; h.expansion.improvement = null; h.expansion.improvements.storeShelves = h.store!
    store.inventory.woodenCrate = 2
    expect(chooseInfrastructure(w, 'eco')).toBe(false)
    store.inventory.woodenCrate = 3
    expect(chooseExpansion(w, 'eco')).toBe(true); expect(h.expansion.improvement).toBe('gardenBoxes')
  })
  it('pays six real Wood per route and transports all three products through ordinary powered arms', () => {
    const w = world(), store = materialStore(w)!, h = w.homestead!
    store.wood = 30
    for (const kind of ['woodReturn', 'panelReturn', 'crateReturn'] as const) link(w, kind)
    expect(store.wood).toBe(12)
    store.wood = 0
    const forest = w.buildings[614]!, mill = w.buildings[694]!, asm = w.buildings[696]!
    if (forest.kind !== 'forester' || mill.kind !== 'sawmill' || asm.kind !== 'assembler') throw Error('chain')
    forest.output.wood = 8; mill.output.woodPanel = 8; asm.output.woodenCrate = 4
    tick(w, 60000)
    expect(store.wood).toBeGreaterThan(0); expect(store.inventory.woodPanel, JSON.stringify({links:h.infrastructure.links, stock:store, machine:mill, arms:h.infrastructure.links.map(p=>({arm:w.buildings[p.parts[2].tile],power:w.power?.consumers[p.parts[2].tile]}))})).toBeGreaterThan(0); expect(store.inventory.woodenCrate).toBeGreaterThan(0)
    expect(w.buildings[654]?.kind).toBe('belt'); expect(w.buildings[695]?.kind).toBe('belt')
    expect(h.infrastructure.links.map(p => p.kind)).toEqual(['woodReturn', 'panelReturn', 'crateReturn'])
    expect(snap(decodeSave(JSON.stringify(snap(w))).world)).toEqual(snap(w))
  })
  it('retains the seedling and production input reserves; quotas include carried and moving packets', () => {
    const w = world(), store = materialStore(w)!, h = w.homestead!, forest = w.buildings[614]!, mill = w.buildings[694]!, asm = w.buildings[696]!
    if (forest.kind !== 'forester' || mill.kind !== 'sawmill' || asm.kind !== 'assembler') throw Error('chain')
    forest.output.wood = 1; forest.replant = true; forest.plots = [613]
    expect(forestryOutput(forest, w)).toBe(0)
    store.wood = 24; expect(ecoPickup(w, 'woodReturn', 'wood')).toBe(false)
    store.wood = 23; expect(ecoPickup(w, 'woodReturn', 'wood')).toBe(true)
    store.wood = 24; mill.input.wood = 2; expect(ecoPickup(w, 'woodReturn', 'wood')).toBe(true)
    store.wood = 47; h.carried.wood = 1; expect(ecoPickup(w, 'woodReturn', 'wood')).toBe(false)
    store.inventory.woodPanel = 8; expect(ecoPickup(w, 'panelReturn', 'woodPanel')).toBe(false)
    asm.input.woodPanel = 4; expect(ecoPickup(w, 'panelReturn', 'woodPanel')).toBe(true)
    store.inventory.woodPanel = 32; expect(ecoPickup(w, 'panelReturn', 'woodPanel')).toBe(false)
    const p = link(w, 'crateReturn'), arm = p.parts[2].tile
    store.inventory.woodenCrate = 7; h.carried.woodenCrate = 1
    expect(infrastructurePickupAllowed(w, arm, 'woodenCrate')).toBe(false)
    h.carried.woodenCrate = 0
    const b = w.buildings[p.parts[3].tile]!
    if (b.kind !== 'belt') throw Error('belt')
    b.item = 'woodenCrate'; b.progress = 1
    expect(infrastructurePickupAllowed(w, arm, 'woodenCrate')).toBe(false)
    b.item = null; expect(infrastructurePickupAllowed(w, arm, 'woodenCrate')).toBe(true)
    expect(infrastructurePickupAllowed(w, arm, 'woodPanel')).toBe(false)
  })
  it('holds physical cargo through power loss and repairs the original route with one Wood per missing part', () => {
    const w = world(), h = w.homestead!, store = materialStore(w)!, p = link(w, 'crateReturn'), asm = w.buildings[696]!
    if (asm.kind !== 'assembler') throw Error('assembler')
    asm.output.woodenCrate = 1
    const generator = p.parts[1], arm = w.buildings[p.parts[2].tile]!
    removeBuilding(w, generator.tile % SIZE, Math.floor(generator.tile / SIZE))
    tick(w, 5000); expect(store.inventory.woodenCrate).toBe(0); expect(asm.output.woodenCrate).toBe(1)
    const before = store.wood, xp = w.personality.paths.eco.xp
    h.infrastructure.plan = structuredClone(p); h.infrastructure.repair = true; begin(w, 'buildConnection', h.store); build(w)
    expect(store.wood).toBe(before - 1); expect(w.personality.paths.eco.xp).toBe(xp)
    tick(w, 10000); expect(store.inventory.woodenCrate).toBe(1); expect(arm.kind).toBe('inserter')
    const next = peteStatus(w).next!
    expect(next.every(s => s.phase && s.progress && Array.isArray(s.missing))).toBe(true)
  })
})

it('reserves construction Wood from optional planting while retaining emergency chicken feed', () => {
  const w = world(), store = materialStore(w)!
  expect(ecoWoodReserve(w)).toBe(18)
  expect(homesteadProjectDelay(w, 'reforestation')).toContain('18 Holz')
  store.wood = 20
  expect(homesteadProjectDelay(w, 'reforestation')).toBeNull()
  const factory = { ...w, homestead: undefined }
  expect(ecoWoodReserve(factory)).toBe(0)
  expect(homesteadProjectDelay(factory, 'reforestation')).toBeNull()
})

it('retains an orchard approach as a walkable owned crate-return crossing', () => {
  const w = world()
  w.orchardProject = { kind: 'orchard', home: 820, direction: 'east', tiles: [658], spots: [698], phase: 'complete', built: 1, carried: 0, carriedIron: 0, carriedGears: 0, carriedModules: 0, crate: null, elapsedMs: 0 }
  w.buildings[658] = { kind: 'peteDevelopment', development: 'orchard', x: 18, y: 16, fruit: 0, gears: 0, modules: 0, readyAtMs: 0 }
  expect(freeSite(w, [698])).toBe(false)
  const p = link(w, 'crateReturn')
  expect(p.parts.find(p => p.tile === 698)?.kind).toBe('belt')
})

it('keeps an already committed nursery pickup valid below the new planning reserve', () => {
  const w = world(), h = w.homestead!, store = materialStore(w)!
  w.nurseryProject = { kind: 'nursery', home: 820, direction: 'south', tiles: [940], spots: [941], phase: 'complete', built: 1, carried: 0, carriedIron: 0, carriedGears: 0, carriedModules: 0, crate: null, elapsedMs: 0 }
  w.buildings[940] = { kind: 'peteDevelopment', development: 'nursery', x: 20, y: 23, fruit: 0, gears: 0, modules: 0, readyAtMs: 0 }
  w.developmentLife = createDevelopmentLife(); w.developmentLife.task = 'collectNurseryWood'; w.developmentLife.target = 901
  store.wood = 2; Object.assign(w.pete, { tile: 901, x: 21, y: 22 })
  expect(ecoWoodReserve(w)).toBe(18)
  expect(developmentTargetValid(w)).toBe(true)
  finishDevelopment(w)
  expect(store.wood).toBe(0); expect(w.developmentLife.carriedWood).toBe(2); expect(h.carried.wood).toBe(0)
})
