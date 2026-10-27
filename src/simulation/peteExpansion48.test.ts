import { describe, expect, it } from 'vitest'
import { createPetesWorld, placeIron } from './petesWorld'
import { arrived, begin, materialStore } from './homestead'
import { advanceCraftsman, chooseCraftsman } from './craftsman'
import { advanceShoreline, chooseShoreline, planNeededBridge, planShoreDock, shoreTiles } from './shoreline'
import { awardActivity, rewardProject } from './personality'
import { emptyInventory, inventoryTotal } from './items'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { World } from './world'
import { projectCandidates, projectBuilding } from './secretProject'
import type { SecretProject } from './secretProject'
import { PETE_PROJECTS, materialPath, projectUnlocked, retiredIndustrial } from './projectRegistry'
import { changeCraftingRecipe } from './crafting'
import { advanceWorld } from './step'
import { peteReachableTiles } from './navigation'
import { fishingSpot } from './fishingDock'
import { planRowboat } from './rowboat'
import { waterEditError } from './waterLandscaping'
import { commitFootbridge } from './footbridge'
import { developmentDecision } from './peteDevelopments'
import { decodeSave, encodeSave } from '../persistence/saveGame'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function stored() {
  const w = createPetesWorld(), tile = 900
  w.buildings[tile] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  w.homestead!.store = tile
  return w
}
function completed(w: World, kind: 'workshop' | 'bicycle', tile: number, spot: number) {
  const p: SecretProject = { kind, home: 820, direction: kind === 'workshop' ? 'east' : 'south', tiles: [tile], spots: [spot], phase: 'complete', crate: null, built: 1, carried: 0, carriedIron: 0, elapsedMs: 0, ...(kind === 'workshop' ? { readyAtMs: 0 } : { carriedGears: 0, carriedModules: 0 }) }
  if (kind === 'bicycle') w.bicycleProject = p; else w.workshopProject = p
  w.buildings[tile] = projectBuilding(p, tile); rewardProject(w.personality, kind)
}
function tick(w: World, fn: (w: World, ms: number) => boolean, done: () => boolean, limit = 120000) {
  for (let t = 0; t < limit && !done(); t += 50) { w.timeMs += 50; fn(w, 50) }
  expect(done(), JSON.stringify(w.homestead)).toBe(true)
}
function run(w: World, done: () => boolean) {
  for (let t = 0; t < 120000 && !done(); t += 50) advanceWorld(w, 50)
  expect(done()).toBe(true)
}
function river() {
  const w = stored()
  w.water.fill(false)
  for (let y = 0; y < SIZE; y++) w.water[y * SIZE + 24] = true
  expect(placeIron(w, 28, 20)).toBeNull()
  awardActivity(w.personality, { path: 'eco', xp: 20 })
  materialStore(w)!.wood = 12
  return w
}

describe('independent modern paths and real gears', () => {
  it('repairs the owned gear assembler with real plates and its original recipe without build XP', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!
    placeBuilding(w, 23, 18, 'assembler', 'east'); h.expansion.gearAssembler = 743
    placeBuilding(w, 23, 17, 'powerPole', 'east'); placeBuilding(w, 24, 17, 'generator', 'east')
    changeCraftingRecipe(w, 23, 18, 'ironGear')
    awardActivity(w.personality, { path: 'craftsman', xp: 80 }); store.inventory.ironPlate = 8
    expect(removeBuilding(w, 23, 18)).toBe(true)
    run(w, () => !!w.rebuilding?.jobs[0]?.funded)
    const loaded = load(w), xp = w.personality.paths.craftsman.xp
    advanceWorld(w, 1000); advanceWorld(loaded, 1000)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    run(w, () => w.buildings[743]?.kind === 'assembler')
    expect(store.inventory.ironPlate).toBe(5)
    const machine = w.buildings[743]
    expect(machine?.kind === 'assembler' && machine.recipeId).toBe('ironGear')
    expect(w.personality.paths.craftsman.xp).toBe(xp)
  })
  it('keeps new coal worlds free of legacy gear projects while preserving Factory and old projects', () => {
    const w = stored(), press = PETE_PROJECTS.find(p => p.id === 'press')!
    materialStore(w)!.inventory.ironGear = 30
    expect(materialPath(w, 'ironGear')).toBe('craftsman')
    expect(projectUnlocked(w, press)).toBe(false)
    expect(projectCandidates(w).some(c => ['press', 'mechanic', 'winch'].includes(c.definition.id))).toBe(false)
    const factory = { ...w, homestead: undefined }
    expect(projectUnlocked(factory, press)).toBe(true)
    expect(materialPath(factory, 'ironGear')).toBe('industrial')
    w.pressProject = { kind: 'press', home: 820, direction: 'south', tiles: [823], spots: [822], phase: 'collecting', crate: null, built: 0, carried: 0, carriedIron: 0, carriedGears: 0, elapsedMs: 0 }
    expect(projectUnlocked(w, press)).toBe(true)
    expect(retiredIndustrial(w, PETE_PROJECTS.find(p => p.id === 'mechanic')!)).toBe(false)
    expect(load(w).pressProject).toEqual(w.pressProject)
  })
  it('feeds only real plates into the shared powered gear recipe and awards pickup XP once', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!
    placeBuilding(w, 23, 18, 'assembler', 'east'); h.expansion.gearAssembler = 743
    placeBuilding(w, 23, 17, 'powerPole', 'east'); placeBuilding(w, 24, 17, 'generator', 'east')
    changeCraftingRecipe(w, 23, 18, 'ironGear')
    store.inventory.ironPlate = 4
    begin(w, 'fetchGear', h.store)
    run(w, () => h.task === null)
    expect(store.inventory.ironPlate).toBe(2)
    advanceWorld(w, 3000)
    const machine = w.buildings[743]!
    expect(machine.kind === 'assembler' && machine.output.ironGear).toBe(1)
    const xp = w.personality.paths.craftsman.xp
    begin(w, 'takeGear', 743)
    run(w, () => h.task === 'returnStock')
    expect(h.carried.ironGear).toBe(1)
    expect(w.personality.paths.craftsman.xp).toBe(xp + 1)
    const restored = load(w)
    run(w, () => h.task === null)
    run(restored, () => restored.homestead!.task === null)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(store.inventory.ironGear).toBe(1)
    expect(w.personality.paths.craftsman.xp).toBe(xp + 1)
  })
})

describe('paid cargo bicycle', () => {
  it('keeps leisure rides and exact saves valid when the upgraded bicycle is parked on a shared footbridge', () => {
    const w = stored(), h = w.homestead!
    completed(w, 'workshop', 700, 740); completed(w, 'bicycle', 823, 822)
    awardActivity(w.personality, { path: 'craftsman', xp: 200 })
    w.water.fill(false)
    for (let y = 0; y < SIZE; y++) for (let x = 24; x <= 26; x++) w.water[y * SIZE + x] = true
    w.nature.wood = 9
    expect(commitFootbridge(w, { x: 23, y: 18 }, { x: 27, y: 18 }).error).toBeNull()
    h.cargoBicycle = true; h.bikeTile = 745
    Object.assign(w.pete, { tile: 745, x: 25, y: 18, next: null, travelMs: 0, path: [], pathRevision: -1 })
    const visit = developmentDecision(w)
    expect(visit?.destination).toBe(745)
    Object.assign(w.peace, { activity: 'developmentWork', destination: 745, sinceMs: w.timeMs, untilMs: w.timeMs + 1000 })
    advanceWorld(w, 1000)
    expect(w.peace.activity).toBe('cycling')
    expect(w.pete.path.some(tile => w.water[tile])).toBe(true)
    expect(h.bikeTile).toBeNull()
    const loaded = load(w)
    advanceWorld(w, 1000); advanceWorld(loaded, 1000)
    expect(snapshot(loaded)).toEqual(snapshot(w))
  })
  it('pays once, retains blocked work, resumes a save and physically picks up its parked bicycle', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!
    completed(w, 'workshop', 700, 740); completed(w, 'bicycle', 823, 822)
    awardActivity(w.personality, { path: 'craftsman', xp: 200 })
    store.inventory.ironPlate = 12; store.inventory.ironGear = 6
    expect(chooseCraftsman(w)).toBe(true)
    expect(h.task).toBe('upgradeBicycle')
    tick(w, advanceCraftsman, () => h.elapsedMs >= 500)
    expect(store.inventory.ironPlate + store.inventory.ironGear).toBe(0)
    const restored = load(w), before = w.personality.paths.craftsman.xp
    tick(w, advanceCraftsman, () => h.cargoBicycle)
    tick(restored, advanceCraftsman, () => restored.homestead!.cargoBicycle)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(w.personality.paths.craftsman.xp).toBe(before + 20)
    expect(inventoryTotal(h.carried)).toBe(0)
    expect(h.bikeTile).toBe(w.pete.tile)
    begin(w, 'returnStock', h.store); h.carried.ironPlate = 2
    const start = w.pete.tile
    arrived(w, h.store, 50)
    expect(h.bikeTile).toBeNull()
    expect(w.pete.tile === start && w.pete.travelMs).toBe(100)
    expect(load(w).pete).toEqual(w.pete)
    const walking = stored()
    Object.assign(walking.pete, structuredClone(w.pete)); walking.pete.travelMs = 0; walking.pete.next = null; walking.pete.x = start % SIZE; walking.pete.y = Math.floor(start / SIZE)
    begin(walking, 'returnStock', walking.homestead!.store); walking.homestead!.carried.ironPlate = 2
    arrived(walking, walking.homestead!.store, 50)
    expect(walking.pete.travelMs).toBe(50)
    expect(waterEditError(w, start, 'water')).not.toBeNull()
    h.bikeTile = start
    Object.assign(w.pete, { tile: 740, x: 20, y: 18, next: null, travelMs: 0, path: [], pathRevision: -1 })
    arrived(w, h.store, 50)
    expect(w.peace.destination).toBe(start)
    expect(h.bikeTile).toBe(start)
    expect(w.pete.travelMs).toBe(50)
  })
})

describe('paid water access', () => {
  it('returns unused paid Wood physically when another paid crossing has already completed the same route', () => {
    const w = river(), h = w.homestead!, store = materialStore(w)!
    for (let y = 0; y < SIZE; y++) for (const x of [25, 26]) w.water[y * SIZE + x] = true
    w.topologyRevision++
    expect(chooseShoreline(w)).toBe(true)
    tick(w, advanceShoreline, () => h.carried.wood > 0)
    const plan = h.waterworks.plan!
    if (plan.kind !== 'bridge') throw new Error('missing bridge')
    w.nature.wood = 9
    expect(commitFootbridge(w, { x: plan.start % SIZE, y: Math.floor(plan.start / SIZE) }, { x: plan.end % SIZE, y: Math.floor(plan.end / SIZE) }).error).toBeNull()
    tick(w, advanceShoreline, () => h.task === 'returnStock')
    expect(h.carried.wood).toBe(9)
    const loaded = load(w)
    run(w, () => h.task === null); run(loaded, () => loaded.homestead!.task === null)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    expect(store.wood).toBe(12); expect(w.nature.wood).toBe(0)
  })
  it('plans and pays a needed crossing, exposes real footbridge navigation and restores it without repeat XP', () => {
    const w = river(), h = w.homestead!, store = materialStore(w)!
    const before = structuredClone(w), plan = planNeededBridge(w)
    expect(plan).not.toBeNull(); expect(w).toEqual(before)
    expect(chooseShoreline(w)).toBe(true)
    expect(h.task).toBe('buildBridge')
    tick(w, advanceShoreline, () => h.elapsedMs >= 500)
    expect(store.wood).toBe(9); expect(w.nature.wood).toBe(0)
    const loaded = load(w)
    tick(w, advanceShoreline, () => h.task === null)
    tick(loaded, advanceShoreline, () => loaded.homestead!.task === null)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    const tiles = shoreTiles(plan!)
    expect(tiles.every(tile => w.buildings[tile]?.kind === 'footbridge')).toBe(true)
    expect(peteReachableTiles(w, w.pete.tile).has(28 + 20 * SIZE)).toBe(true)
    const xp = w.personality.paths.eco.xp, tile = tiles[0]
    expect(removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE))).toBe(true)
    expect(chooseShoreline(w)).toBe(true)
    tick(w, advanceShoreline, () => h.task === null)
    expect(store.wood).toBe(6)
    expect(w.personality.paths.eco.xp).toBe(xp)
  })
  it('preserves funded work under obstruction and protects both water and bank edits', () => {
    const w = river(), h = w.homestead!
    chooseShoreline(w)
    tick(w, advanceShoreline, () => h.carried.wood > 0)
    const plan = h.waterworks.plan!, tile = shoreTiles(plan)[0]
    expect(waterEditError(w, tile, 'land')).not.toBeNull()
    if (plan.kind !== 'bridge') throw new Error('missing bridge')
    expect(waterEditError(w, plan.end, 'water')).not.toBeNull()
    w.buildings[tile] = { kind: 'belt', x: tile % SIZE, y: Math.floor(tile / SIZE), direction: 'east', item: null, progress: 0, entry: 'west' }
    tick(w, advanceShoreline, () => w.timeMs >= 20000)
    expect(h.carried.wood).toBe(3); expect(h.task).toBe('buildBridge')
    w.buildings[tile] = null; w.topologyRevision++
    tick(w, advanceShoreline, () => h.task === null)
  })
  it('builds a real dock from stored Wood and continues its existing rowboat trip exactly', () => {
    const w = stored(), h = w.homestead!, store = materialStore(w)!
    store.wood = 20
    const plan = planShoreDock(w)
    expect(plan).not.toBeNull()
    h.waterworks.plan = plan; begin(w, 'buildDock', plan!.tile)
    tick(w, advanceShoreline, () => h.task === null)
    expect(store.wood).toBe(12); expect(w.nature.wood).toBe(0)
    const dock = w.buildings[plan!.tile]
    if (dock?.kind !== 'fishingDock') throw new Error('missing dock')
    expect(planRowboat(w, dock)).not.toBeNull()
    const spot = fishingSpot(w, dock)!
    Object.assign(w.pete, { tile: spot, x: spot % SIZE, y: Math.floor(spot / SIZE), next: null, travelMs: 0, path: [], pathRevision: -1 })
    Object.assign(w.peace, { activity: 'dockward', destination: spot, seed: 0, sinceMs: w.timeMs, untilMs: w.timeMs })
    advanceWorld(w, 2000)
    expect(w.peace.boat).toBeDefined()
    const loaded = load(w)
    advanceWorld(w, 3000); advanceWorld(loaded, 3000)
    expect(snapshot(loaded)).toEqual(snapshot(w))
  })
  it('keeps wider unsupported channels unpaid and does not offer a boat dock on a tiny pool', () => {
    const w = stored()
    w.water.fill(false)
    for (let y = 0; y < SIZE; y++) for (let x = 23; x <= 28; x++) w.water[y * SIZE + x] = true
    w.tiles[30 + 20 * SIZE] = 'iron'; w.topologyRevision++
    expect(planNeededBridge(w)).toBeNull()
    expect(chooseShoreline(w)).toBe(false)
    expect(materialStore(w)!.wood).toBe(0)
    w.water.fill(false); w.water[1062] = true; w.water[1102] = true; w.topologyRevision++
    expect(planShoreDock(w)).toBeNull()
  })
})

it('upgrades genuine Save 47 and rejects new or malformed state in detached candidates', () => {
  const w = stored(), old = snapshot(w)
  old.version = 47
  for (const key of ['cargoBicycle', 'bikeTile', 'waterworks']) delete old.game.homestead[key]
  delete old.game.homestead.expansion.gearAssembler
  const restored = decodeSave(JSON.stringify(old)).world
  expect(restored.homestead!.cargoBicycle).toBe(false)
  expect(restored.homestead!.waterworks).toEqual({ plan: null, bridges: [], dock: null, nextVisitAtMs: 0, preferBoat: true })
  expect(restored.buildings).toEqual(w.buildings)
  const bad = snapshot(w); bad.game.homestead.waterworks.bridges = [{ kind: 'bridge', start: 820, end: 903 }]
  expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  expect(snapshot(w).game.homestead.waterworks.bridges).toEqual([])
})

it.each(['hiddenLegacy', 'cargoWithoutBicycle', 'parkedWithoutUpgrade', 'shoreWithoutTask', 'unfundedGearDelivery', 'invalidVisitClock', 'duplicateCrossing', 'unknownBridgeReward'])('rejects %s without changing the source world', kind => {
  const w = stored(), before = snapshot(w), bad = structuredClone(before), h = bad.game.homestead
  if (kind === 'hiddenLegacy') bad.version = 47
  if (kind === 'cargoWithoutBicycle') h.cargoBicycle = true
  if (kind === 'parkedWithoutUpgrade') h.bikeTile = 822
  if (kind === 'shoreWithoutTask') h.waterworks.plan = { kind: 'bridge', start: 822, end: 824 }
  if (kind === 'unfundedGearDelivery') { h.task = 'feedGear'; h.target = 743; h.carried.ironGear = 2 }
  if (kind === 'invalidVisitClock') h.waterworks.nextVisitAtMs = 300050
  if (kind === 'duplicateCrossing') h.waterworks.bridges = [{ kind: 'bridge', start: 822, end: 824 }, { kind: 'bridge', start: 824, end: 822 }]
  if (kind === 'unknownBridgeReward') bad.game.rebuilding = { jobs: [], active: null, rewarded: ['shore:822:824'] }
  expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  expect(snapshot(w)).toEqual(before)
})
