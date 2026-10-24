import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeCopper, placeGrove, placeIron } from './petesWorld'
import { advanceWorld } from './step'
import { advanceHomestead, begin, finish, materialStore } from './homestead'
import { chooseExpansion, expansionLayout } from './homesteadExpansion'
import { preferredPaths, resourcePreference } from './resourcePreference'
import { awardActivity } from './personality'
import { emptyInventory } from './items'
import { placeBuilding, SIZE } from './world'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { projectCandidates } from './secretProject'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const stamp = '2026-10-24T19:00:00.000Z'
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, stamp))
function until(w: World, ready: () => boolean, limit = 1200000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready(), JSON.stringify({ time: w.timeMs, h: w.homestead, stock: materialStore(w), levels: w.personality.paths })).toBe(true)
}
function stored() {
  const w = createPetesWorld(), h = w.homestead!
  w.buildings[22 * SIZE + 20] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  h.store = 22 * SIZE + 20
  return w
}

describe('resource-led development and shared iron automation', () => {
  it('weights nearby offers and useful stored materials monotonically with diminishing returns', () => {
    const w = stored(), store = materialStore(w)!
    const before = snapshot(w)
    expect(resourcePreference(w, 'craftsman')).toBe(1)
    expect(snapshot(w)).toEqual(before)
    expect(placeIron(w, 26, 18)).toBeNull()
    const offer = resourcePreference(w, 'craftsman')
    expect(offer).toBeGreaterThan(1)
    store.inventory.ironPlate = 12
    const ready = resourcePreference(w, 'craftsman')
    expect(ready).toBeGreaterThan(offer)
    store.inventory.ironPlate = 120
    const abundant = resourcePreference(w, 'craftsman')
    expect(abundant).toBeGreaterThan(ready)
    expect(abundant).toBeLessThan(3)
    expect(placeGrove(w, 14, 18)).toBeNull()
    expect(placeCopper(w, 26, 25)).toBeNull()
    const counts = { eco: 0, craftsman: 0, inventor: 0 }
    for (let i = 0; i < 4000; i++) counts[preferredPaths(w)[0]]++
    expect(counts.craftsman).toBeGreaterThan(counts.eco)
    expect(counts.craftsman).toBeGreaterThan(counts.inventor)
    expect(counts.eco).toBeGreaterThan(500)
    expect(counts.inventor).toBeGreaterThan(500)
  })
  it('changes affordable project chances without inventing stock or abandoning paid projects', () => {
    const w = stored(), store = materialStore(w)!
    store.wood = 12; store.inventory.ironPlate = 12
    const candidates = projectCandidates(w), workshop = candidates.find(c => c.definition.id === 'workshop')!
    expect(workshop).toBeDefined()
    expect(placeIron(w, 26, 18)).toBeNull()
    expect(projectCandidates(w).find(c => c.definition.id === 'workshop')!.priorityWeight).toBeGreaterThan(workshop.priorityWeight)
    store.inventory.ironPlate = 0
    expect(projectCandidates(w).some(c => c.definition.id === 'workshop')).toBe(false)
    expect(projectCandidates(w).some(c => c.definition.path === 'eco')).toBe(true)
  })
  it('builds a paid powered miner and continuous belt to the existing furnace, with backpressure and outages', () => {
    const w = stored(), h = w.homestead!, e = h.expansion, store = materialStore(w)!
    placeIron(w, 26, 18)
    placeBuilding(w, 23, 18, 'furnace', 'east'); e.furnace = 18 * SIZE + 23
    placeBuilding(w, 23, 16, 'powerPole', 'east'); placeBuilding(w, 24, 16, 'generator', 'east')
    awardActivity(w.personality, { path: 'craftsman', xp: 80 }); store.inventory.ironPlate = 8
    expect(chooseExpansion(w, 'craftsman')).toBe(true)
    expect(e.plan?.kind).toBe('ironMining')
    const plan = structuredClone(e.plan)!, route = plan.route!
    expect(route.at(-1)).toBe(e.furnace! - 1)
    until(w, () => h.carried.ironPlate === 8 && e.plan?.built === 1)
    const loaded = decodeSave(encodeSave(w, view, stamp)).world
    advanceWorld(w, 500); advanceWorld(loaded, 500)
    expect(snapshot(loaded)).toEqual(snapshot(w))
    const blocked = expansionLayout(plan)[1].tile
    w.water[blocked] = true
    const progress = e.plan!.built
    advanceWorld(w, 10000)
    expect(e.plan!.built).toBe(progress); expect(h.carried.ironPlate).toBe(8)
    w.water[blocked] = false
    until(w, () => e.miner !== null)
    expect(store.inventory.ironPlate).toBe(0)
    expect(w.buildings[e.miner!]?.kind).toBe('miner')
    until(w, () => w.produced.ironPlate >= 4)
    expect(w.mined.iron).toBeGreaterThanOrEqual(w.produced.ironPlate)
    const generators = w.buildings.flatMap((b, tile) => b?.kind === 'generator' ? [{ b, tile }] : [])
    for (const { tile } of generators) w.buildings[tile] = null
    w.topologyRevision++
    const mined = w.mined.iron, made = w.produced.ironPlate
    advanceWorld(w, 5000)
    expect(w.mined.iron).toBe(mined); expect(w.produced.ironPlate).toBe(made)
    for (const { b, tile } of generators) w.buildings[tile] = b
    w.topologyRevision++
    // With collection suspended, the real machine/belt buffers must fill and stop.
    finish(w); h.nextAtMs = w.timeMs + 60000; store.inventory.ironPlate = 0
    advanceWorld(w, 40000)
    const bounded = w.mined.iron
    advanceWorld(w, 10000)
    expect(w.mined.iron).toBe(bounded)
  }, 60000)
  it('rejects corrupt paid routes and migrates a genuine version-41 routine', () => {
    const w = stored(), h = w.homestead!
    placeIron(w, 26, 18); placeBuilding(w, 23, 18, 'furnace', 'east'); h.expansion.furnace = 18 * SIZE + 23
    materialStore(w)!.inventory.ironPlate = 8; awardActivity(w.personality, { path: 'craftsman', xp: 80 })
    chooseExpansion(w, 'craftsman')
    const save = snapshot(w)
    save.game.homestead.expansion.plan.route[1] = 0
    expect(() => decodeSave(JSON.stringify(save))).toThrow()
    const old = snapshot(stored()); old.version = 41
    for (const key of ['miner', 'copperFurnace', 'cableAssembler']) delete old.game.homestead.expansion[key]
    const migrated = decodeSave(JSON.stringify(old)).world
    expect(migrated.homestead!.expansion.miner).toBeNull()
    expect(migrated.homestead!.expansion.copperFurnace).toBeNull()
    expect(migrated.homestead!.expansion.cableAssembler).toBeNull()
  })
  it('reaches iron automation from a real iron-only start while funding the original workshop and veranda', () => {
    const w = createPetesWorld()
    expect(placeIron(w, 26, 18)).toBeNull()
    until(w, () => w.homestead!.expansion.miner !== null, 1800000)
    expect(w.workshopProject?.phase).toBe('complete')
    expect(w.verandaProject?.phase).toBe('complete')
    expect(w.personality.paths.craftsman.level).toBeGreaterThanOrEqual(3)
    expect(w.personality.paths.eco.xp).toBe(0)
    const before = w.produced.ironPlate
    until(w, () => w.produced.ironPlate > before)
    expect(() => decodeSave(encodeSave(w, view, stamp))).not.toThrow()
  }, 60000)
  it('develops mixed wood, iron and copper offers together while retaining original projects', () => {
    const w = createPetesWorld()
    expect(placeGrove(w, 14, 18)).toBeNull()
    expect(placeGrove(w, 14, 25)).toBeNull()
    expect(placeIron(w, 26, 18)).toBeNull()
    expect(placeCopper(w, 26, 25)).toBeNull()
    until(w, () => w.project?.phase === 'complete' && w.produced.ironPlate > 0 && w.produced.copperPlate > 0, 1800000)
    expect(w.personality.paths.eco.xp).toBeGreaterThan(0)
    expect(w.personality.paths.craftsman.level).toBeGreaterThanOrEqual(2)
    expect(w.personality.paths.inventor.level).toBeGreaterThanOrEqual(2)
    const loaded = decodeSave(encodeSave(w, view, stamp)).world
    advanceWorld(w, 1000); advanceWorld(loaded, 1000)
    expect(snapshot(loaded)).toEqual(snapshot(w))
  }, 60000)
})

describe('copper-only gradual inventor path', () => {
  let w: World, starter: World, copper: World, cables: World, cablePaid: World
  beforeAll(() => {
    w = createPetesWorld()
    expect(placeCopper(w, 26, 18)).toBeNull()
    until(w, () => materialStore(w) !== null)
    starter = structuredClone(w)
  }, 60000)
  it('starts with actual personal mining and an ore-funded general store', () => {
    const w = starter
    expect(w.mined.copper).toBe(6)
    expect(w.personality.paths.inventor.xp).toBe(5)
    expect(w.personality.paths.craftsman.xp).toBe(0)
    expect(w.buildings.some(b => b?.kind === 'furnace' || b?.kind === 'assembler')).toBe(false)
    expect(placeCopper(w, 26, 18)).not.toBeNull()
    expect(placeGrove(w, 26, 18)).not.toBeNull()
  })
  beforeAll(() => { until(w, () => w.homestead!.expansion.copperFurnace !== null && w.produced.copperPlate >= 2); copper = structuredClone(w) }, 60000)
  it('uses the shared powered copper recipe and preserves physical cargo exactly through save/load', () => {
    const world = structuredClone(copper), h = world.homestead!
    expect(world.personality.paths.inventor.level).toBeGreaterThanOrEqual(2)
    expect(world.homestead!.expansion.furnace).toBeNull()
    until(world, () => ['feedCopper', 'takeCopper', 'returnStock'].includes(h.task ?? ''))
    const loaded = decodeSave(encodeSave(world, view, stamp)).world
    advanceWorld(world, 1000); advanceWorld(loaded, 1000)
    expect(snapshot(loaded)).toEqual(snapshot(world))
  })
  beforeAll(() => {
    until(w, () => {
      if (!cablePaid && w.homestead!.expansion.plan?.kind === 'cables' && w.homestead!.expansion.plan.built === 1) cablePaid = structuredClone(w)
      return w.homestead!.expansion.cableAssembler !== null
    })
    cables = structuredClone(w)
  }, 60000)
  it('waits for level three before building a real cable assembler from eight plates', () => {
    const w = cables
    expect(w.personality.paths.inventor.level).toBeGreaterThanOrEqual(3)
    expect(w.buildings[w.homestead!.expansion.cableAssembler!]).toMatchObject({ kind: 'assembler', recipeId: 'copperCable', recipeLocked: true })
    expect(w.homestead!.carried.copperPlate).toBe(0)
    expect(cablePaid.homestead!.carried.copperPlate).toBe(8)
    const partial = structuredClone(cablePaid), loaded = decodeSave(encodeSave(partial, view, stamp)).world
    advanceWorld(partial, 500); advanceWorld(loaded, 500)
    expect(snapshot(loaded)).toEqual(snapshot(partial))
  })
  beforeAll(() => { until(w, () => w.experimentProject?.phase === 'complete' && w.treasureProject?.phase === 'complete', 1800000) }, 60000)
  it('physically supplies the original experiment and treasure projects without wood or iron', () => {
    expect(w.produced.copperCable).toBeGreaterThanOrEqual(8)
    expect(w.produced.copperPlate).toBeGreaterThanOrEqual(32)
    expect(w.experimentProject?.phase).toBe('complete')
    expect(w.treasureProject?.phase).toBe('complete')
    expect(w.personality.paths.eco.xp).toBe(0)
    expect(w.personality.paths.craftsman.xp).toBe(0)
    expect(w.flightProject).toBeUndefined()
    expect(() => decodeSave(encodeSave(w, view, stamp))).not.toThrow()
  })
  it('retains copper cargo at a full store and rejects malformed delivery loads', () => {
    const world = stored(), h = world.homestead!, store = materialStore(world)!
    store.wood = 200; h.carried.copper = 3; begin(world, 'returnStock', h.store)
    advanceHomestead(world, 50)
    expect(h.carried.copper).toBe(3)
    const bad = snapshot(world); bad.game.homestead.carried.copper = 4
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    const loaded = decodeSave(encodeSave(world, view, stamp)).world
    expect(loaded.homestead!.carried.copper).toBe(3)
  })
})
