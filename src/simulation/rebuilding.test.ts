import { stripVersion52State } from './testFixtures'
import { stripVersion48Homestead } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { materialStore } from './homestead'
import { chooseExpansion, advanceExpansion, chainCost, expansionLayout } from './homesteadExpansion'
import { emptyInventory, inventoryTotal } from './items'
import { awardActivity, rewardProject } from './personality'
import { createPetesWorld, placeGrove, placeIron } from './petesWorld'
import { advanceRebuilding, chooseRebuild, clearResource, rebuildCost } from './rebuilding'
import { resourcePreference } from './resourcePreference'
import { projectBuilding } from './secretProject'
import { advancePetesWorld as advanceWorld } from '../pete/simulation'
import { buildingAt, placeBuilding, removeBuilding } from './world'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-26T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function setup() {
  const w = createPetesWorld(), tile = 824
  w.buildings[tile] = { kind: 'supplyCrate', x: 24, y: 20, inventory: emptyInventory(), wood: 100, storeTier: 0 }
  w.homestead!.store = tile
  w.project = { home: 820, direction: 'east', tiles: [699, 700, 701], spots: [739, 740, 741], built: 3, phase: 'complete', carried: 0, elapsedMs: 0, crate: null }
  for (const i of w.project.tiles) w.buildings[i] = projectBuilding(w.project, i)
  rewardProject(w.personality, 'fence')
  return w
}
function repair(w: World, tile: number, limit = 60000) {
  for (let t = 0; t < limit && !w.buildings[tile]; t += 50) { chooseRebuild(w); w.timeMs += 50; advanceRebuilding(w, 50) }
  expect(w.buildings[tile], JSON.stringify(w.rebuilding)).not.toBeNull()
}
describe('explicit removal and autonomous paid rebuilding', () => {
  it('clears actual resources without yield, stored/carrying/XP loss, or automatic replanting', () => {
    const w = setup(); expect(placeGrove(w, 26, 15)).toBeNull(); expect(placeIron(w, 14, 15)).toBeNull()
    const wood = w.nature.wood, xp = structuredClone(w.personality), affinity = resourcePreference(w, 'craftsman')
    w.homestead!.carried.wood = 3
    expect(clearResource(w, 26, 15)).toBeNull(); expect(w.buildings[626]).toBeNull()
    expect(clearResource(w, 14, 15)).toBeNull(); expect(w.tiles[614]).toBeNull(); expect(resourcePreference(w, 'craftsman')).toBeLessThan(affinity)
    expect(w.nature.wood).toBe(wood); expect(w.homestead!.carried.wood).toBe(3); expect(materialStore(w)!.wood).toBe(100); expect(w.personality).toEqual(xp)
    expect(clearResource(w, 20, 20)).not.toBeNull()
  })
  it('protects committed miner ore while allowing unrelated ore clearing', () => {
    const w = setup(); placeIron(w, 14, 15)
    w.homestead!.expansion.plan = { kind: 'ironMining', anchor: 614, direction: 'south', route: [614, 615], built: 0 }
    expect(clearResource(w, 14, 15)).toMatch(/reserviert/)
    expect(w.tiles[614]).toBe('iron')
    expect(clearResource(w, 13, 15)).toBeNull()
    expect(w.tiles[613]).toBeNull()
  })
  it('repairs one fence section repeatedly, charging two Wood without resetting the enclosure or rewarding again', () => {
    const w = setup(), xp = structuredClone(w.personality)
    const intact = w.buildings[699]
    for (let n = 0; n < 2; n++) {
      expect(removeBuilding(w, 20, 17)).toBe(true)
      expect(w.project!.phase).toBe('complete'); expect(w.buildings[699]).toBe(intact)
      repair(w, 700)
      expect(materialStore(w)!.wood).toBe(98 - n * 2)
      expect(w.personality).toEqual(xp)
      expect(load(w).project).toEqual(w.project)
    }
  })
  it('continues paid repair and its cargo exactly through save/load', () => {
    const w = setup(); removeBuilding(w, 20, 17); chooseRebuild(w)
    for (let i = 0; i < 500 && !w.rebuilding!.jobs[0].funded; i++) { w.timeMs += 50; advanceRebuilding(w, 50) }
    expect(w.rebuilding!.jobs[0].funded).toBe(true)
    const saved = load(w)
    for (let i = 0; i < 600; i++) {
      w.timeMs += 50; saved.timeMs += 50; advanceRebuilding(w, 50); advanceRebuilding(saved, 50)
    }
    expect(snapshot(saved)).toEqual(snapshot(w))
    expect(w.buildings[700]?.kind).toBe('peteFence')
  })
  it('keeps paid original construction cargo and surviving components when a partial machine chain loses a built part', () => {
    const w = setup(), h = w.homestead!
    h.expansion.plan = { kind: 'iron', anchor: 950, direction: 'south', built: 1 }
    h.task = 'buildChain'; h.target = 824; h.carried.iron = chainCost('iron').iron!
    const pole = expansionLayout(h.expansion.plan)[0]
    placeBuilding(w, pole.tile % 40, Math.floor(pole.tile / 40), pole.kind, pole.direction)
    removeBuilding(w, pole.tile % 40, Math.floor(pole.tile / 40))
    expect(h.carried.iron).toBe(6); expect(h.expansion.plan.built).toBe(1)
    const job = w.rebuilding!.jobs[0]; expect(rebuildCost(w, job).iron).toBe(2)
    expect(load(w).homestead!.carried).toEqual(h.carried)
  })
  it('rebuilds a demolished material store from physically collected resources while preserving committed cargo', () => {
    const w = setup(), h = w.homestead!, before = structuredClone(w.personality)
    placeGrove(w, 26, 15)
    h.task = 'returnStock'; h.target = 824; h.carried.ironPlate = 2
    removeBuilding(w, 24, 20)
    expect(load(w).homestead!.carried.ironPlate).toBe(2)
    repair(w, 824, 120000)
    expect(materialStore(w)!.wood).toBe(0); expect(inventoryTotal(materialStore(w)!.inventory)).toBe(0)
    expect(h.carried.ironPlate).toBe(2); expect(w.personality).toEqual(before)
    expect(load(w).homestead!.carried.ironPlate).toBe(2)
  })
  it('retains peaceful Petes Welt and progression when its home is missing, then pays for rebuilding', () => {
    const w = setup(), xp = structuredClone(w.personality)
    removeBuilding(w, 20, 20)
    expect(w.peace.home).toBe(820); expect(load(w).peace.home).toBe(820)
    repair(w, 820)
    expect(materialStore(w)!.wood).toBe(80); expect(w.personality).toEqual(xp)
    expect(load(w).buildings[820]?.kind).toBe('treehouse')
  })
  it('migrates old missing sections without replaying completion and rejects invalid ownership/funding', () => {
    const w = setup(); w.buildings[700] = null
    const old = snapshot(w); stripVersion52State(old.game); old.version = 44; stripVersion48Homestead(old.game); for (const key of ['copperMiner', 'circuitAssembler', 'steamEngine', 'coalMiner', 'fuelStore', 'coalInserter', 'briquetteAssembler', 'steamWorkshop', 'steamHoist']) delete old.game.homestead.expansion[key]
    const migrated = decodeSave(JSON.stringify(old)).world
    expect(migrated.rebuilding!.jobs[0].tile).toBe(700); expect(migrated.personality).toEqual(w.personality)
    const bad = snapshot(migrated); bad.game.rebuilding.jobs[0].paid.wood = 2
    expect(() => decodeSave(JSON.stringify(bad))).toThrow(/funding/)
    const wrong = snapshot(migrated); wrong.game.rebuilding.jobs[0].tile = 777
    expect(() => decodeSave(JSON.stringify(wrong))).toThrow(/owned/)
  })
  it('repairs separate chain components without duplicating survivors or their inventories', () => {
    const w = setup(), h = w.homestead!, plan = { kind: 'iron' as const, anchor: 950, direction: 'south' as const, built: 0 }
    for (const part of expansionLayout(plan)) placeBuilding(w, part.tile % 40, Math.floor(part.tile / 40), part.kind, part.direction)
    h.expansion.furnace = 950
    materialStore(w)!.inventory.iron = 20
    const pole = w.buildings[990], furnace = w.buildings[950]!
    if (furnace.kind !== 'furnace') throw new Error('fixture')
    furnace.output.ironPlate = 4
    removeBuilding(w, 30, 23); removeBuilding(w, 31, 24)
    expect(w.rebuilding!.jobs).toHaveLength(2)
    repair(w, 950); repair(w, 991)
    expect(w.buildings[990]).toBe(pole)
    const rebuilt = w.buildings[950]!
    expect(rebuilt.kind === 'furnace' && inventoryTotal(rebuilt.output)).toBe(0)
    expect(materialStore(w)!.inventory.iron).toBe(16)
    expect(w.buildings.filter(b => b?.kind === 'furnace')).toHaveLength(1)
    expect(load(w).homestead!.expansion.furnace).toBe(950)
  })
  it('repays lost host upgrades without farming their original rewards', () => {
    const w = setup(), h = w.homestead!
    awardActivity(w.personality, { path: 'eco', xp: 100 })
    w.coopProject = { kind: 'coop', home: 820, direction: 'south', tiles: [823], spots: [822], phase: 'complete', built: 1, carried: 0, elapsedMs: 0, crate: null }
    w.buildings[823] = projectBuilding(w.coopProject, 823); rewardProject(w.personality, 'coop')
    h.expansion.improvements.coopAwning = 823
    const store = materialStore(w)!; store.storeTier = 1; store.inventory.woodPanel = 6
    const xp = structuredClone(w.personality)
    removeBuilding(w, 23, 20); expect(h.expansion.improvements.coopAwning).toBeUndefined()
    repair(w, 823); expect(w.personality).toEqual(xp)
    expect(chooseExpansion(w, 'eco')).toBe(true)
    expect(h.expansion.improvement).toBe('coopAwning')
    for (let i = 0; i < 1000 && h.task; i++) { w.timeMs += 50; advanceExpansion(w, 50) }
    expect(h.expansion.improvements.coopAwning).toBe(823)
    expect(store.inventory.woodPanel).toBe(0); expect(w.personality).toEqual(xp)
  })
  it('keeps partial physical store funding through reload while a removed source is replaced', () => {
    const w = setup(); placeGrove(w, 26, 15); removeBuilding(w, 24, 20)
    for (let i = 0; i < 2000 && inventoryTotal(w.rebuilding!.jobs[0].paid) < 3; i++) { w.timeMs += 50; advanceRebuilding(w, 50) }
    expect(inventoryTotal(w.rebuilding!.jobs[0].paid)).toBe(3)
    const saved = load(w)
    repair(w, 824, 120000); repair(saved, 824, 120000)
    expect(snapshot(saved)).toEqual(snapshot(w))
  })
  it('finishes an original paid fence stage after a built section is demolished, then repairs only the missing section', () => {
    const w = setup(), p = w.project!
    p.built = 1; p.phase = 'building'; p.carried = 4; p.selected = true
    w.personality.rewardedProjects = []
    w.buildings[700] = null; w.buildings[701] = null
    Object.assign(w.peace, { activity: 'project', sinceMs: 0, untilMs: 0, destination: null })
    removeBuilding(w, 19, 17)
    expect(load(w).project!.carried).toBe(4)
    advanceWorld(w, 120000)
    expect(p.phase).toBe('complete'); expect(p.carried).toBe(0)
    expect(w.buildings[699]?.kind).toBe('peteFence'); expect(buildingAt(w, 21, 17)?.kind).toBe('peteFence')
    expect(w.personality.rewardedProjects.filter(id => id === 'fence')).toHaveLength(1)
    expect(() => load(w)).not.toThrow()
  })
  it('lets daily life and save deadlines continue while a lost store has no reachable raw supply', () => {
    const w = setup(), h = w.homestead!
    h.task = 'returnStock'; h.target = 824; h.carried.ironPlate = 2
    removeBuilding(w, 24, 20)
    advanceWorld(w, 1000000)
    expect(w.buildings[824]).toBeNull(); expect(h.carried.ironPlate).toBe(2)
    expect(w.peace.nextGiftAtMs).toBeGreaterThan(w.timeMs)
    expect(h.nextRestAtMs).toBeGreaterThan(w.timeMs - 180000)
    expect(() => load(w)).not.toThrow()
  })
  it('resumes normal autonomous life after a repair without replacing other projects', () => {
    const w = setup(); removeBuilding(w, 20, 17)
    advanceWorld(w, 120000)
    expect(w.buildings[700]?.kind).toBe('peteFence')
    expect(w.personality.rewardedProjects.filter(id => id === 'fence')).toHaveLength(1)
    expect(() => load(w)).not.toThrow()
  })
})
