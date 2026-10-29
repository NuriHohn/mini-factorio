import { MATURE_TREE_MS, plantTree, reproductionTargets } from './nature'
import { expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { createBareWorld } from './testFixtures'
import { advancePeace, collectGift } from './peace'
import { advanceSecretProject, currentProject } from './secretProject'
import { emptyInventory } from './items'
import { placeBuilding } from './world'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { homesteadProjectDelay, wantsEcoReturns } from './projectRegistry'
import { planHarvest, harvestTreeReady } from './forestry'
import { allocatePower } from './power'
import { advanceForestry } from './forestryStation'
import { yardWorkSpot } from './yard'
function waiting(petes = true) {
  const w = petes ? createPetesWorld() : createBareWorld(() => .5)
  if (!petes) { w.nature.wood = 20; placeBuilding(w, 20, 20, 'treehouse', 'east') }
  Object.assign(w.pete, { tile: 860, x: 20, y: 21, next: null, path: [], travelMs: 0, pathRevision: w.topologyRevision })
  Object.assign(w.peace, { activity: 'walking', sinceMs: 0, untilMs: 0, destination: 860 })
  return w
}
function buildable(due = 0) {
  const w = waiting(), h = w.homestead!
  h.nextRestAtMs = due; h.store = 824
  w.buildings[824] = { kind: 'supplyCrate', x: 24, y: 20, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  w.buildings[824].inventory.ironPlate = 12
  Object.assign(w.peace, { activity: 'waving', untilMs: 0, destination: null })
  return w
}
it('starts affordable construction from a cosmetic pause', () => {
  const w = buildable()
  advancePeace(w, 0)
  expect(w.peace.activity).toBe('project'); expect(currentProject(w)?.kind).toBe('workshop')
})
it('rechecks construction reserves before every unpaid fence section while retaining paid work', () => {
  const w = waiting(), h = w.homestead!
  h.store = 738; h.expansion.assembler = 658; w.personality.paths.eco.level = 4
  w.buildings[738] = { kind: 'supplyCrate', x: 18, y: 18, wood: 8, inventory: emptyInventory(), storeTier: 1 }
  w.orchardProject = { kind: 'orchard', home: 820, direction: 'east', tiles: [900], spots: [901], phase: 'complete', crate: null, built: 1, carried: 0, elapsedMs: 0 }
  w.gardenProject = { ...w.orchardProject, kind: 'garden' }
  w.yard = { kind: 'yard', home: 820, direction: 'east', left: 19, right: 24, top: 17, bottom: 24, entrance: 702, reused: [], tiles: [739], spots: [740], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0, selected: true }
  expect(homesteadProjectDelay(w, 'yard')).not.toBeNull()
  advanceSecretProject(w, 50)
  expect(w.yard.selected).toBeUndefined(); expect(w.buildings[738].wood).toBe(8)
  w.yard.phase = 'building'; w.yard.carried = 2; w.yard.selected = true
  advanceSecretProject(w, 50)
  expect(currentProject(w)).toBe(w.yard); expect(w.yard.carried).toBe(2)
})
it('shows far fewer idle bouquets without changing Factory behavior or consuming construction material', () => {
  const counts: number[] = []
  for (const petes of [true, false]) {
    let flowers = 0
    for (let n = 0; n < 100; n++) {
      const w = waiting(petes), wood = w.nature.wood
      w.peace.seed = Math.imul(n + 1, 0x9e3779b9) >>> 0
      w.timeMs += 50; advancePeace(w, 50)
      if (w.peace.activity === 'flowers') flowers++
      expect(w.nature.wood).toBe(wood)
    }
    counts.push(flowers)
  }
  expect(counts[0]).toBeGreaterThan(0); expect(counts[0]).toBeLessThan(counts[1] / 5)
})
it('keeps affordable fence work available while optional material returns are still missing', () => {
  const w = waiting(), h = w.homestead!
  w.water.fill(false); w.personality.paths.eco.level = 4
  h.store = 824; h.expansion.forestry = 700; h.expansion.assembler = 702
  w.buildings[824] = { kind: 'supplyCrate', x: 24, y: 20, wood: 19, inventory: emptyInventory(), storeTier: 1 }
  w.orchardProject = { kind: 'orchard', home: 820, direction: 'east', tiles: [900], spots: [901], phase: 'complete', crate: null, built: 1, carried: 0, elapsedMs: 0 }
  w.gardenProject = { ...w.orchardProject, kind: 'garden' }
  expect(wantsEcoReturns(w)).toBe(true)
  expect(homesteadProjectDelay(w, 'yard')).toBeNull()
  expect(homesteadProjectDelay(w, 'run')).toContain('18 Holz')
  w.buildings[824].wood = 20
  expect(homesteadProjectDelay(w, 'yard')).toBeNull()
})
it('leaves owned powered forestry trees to automatic harvesting and replanting, with manual outage fallback', () => {
  const w = waiting(), h = w.homestead!
  h.store = 824; w.buildings[824] = { kind: 'supplyCrate', x: 24, y: 20, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  expect(plantTree(w, 26, 17, 'oak')).toBe(true)
  const tree = w.buildings[706]!
  if (tree.kind !== 'tree') throw Error('tree')
  tree.bornAtMs = -MATURE_TREE_MS
  placeBuilding(w, 26, 18, 'forester', 'east'); h.expansion.forestry = 746
  placeBuilding(w, 26, 19, 'powerPole', 'east'); placeBuilding(w, 27, 19, 'generator', 'east')
  allocatePower(w)
  expect(planHarvest(w)).toBeNull()
  const generator = w.buildings[787]; w.buildings[787] = null; w.topologyRevision++; allocatePower(w)
  const manual = planHarvest(w)!
  expect(manual.tiles).toEqual([706]); expect(harvestTreeReady(w, manual)).toBe(true)
  w.buildings[787] = generator; w.topologyRevision++; allocatePower(w)
  expect(harvestTreeReady(w, manual)).toBe(false)
  for (let ms = 0; ms < 9000; ms += 50) { w.timeMs += 50; allocatePower(w); advanceForestry(w, 50) }
  expect(w.mined.wood).toBe(3)
  const station = w.buildings[746]!
  if (station.kind !== 'forester') throw Error('forester')
  expect(station.output.wood).toBe(2); expect(station.plots).toEqual([])
  expect(w.buildings[706]).toMatchObject({ kind: 'tree', bornAtMs: 9000 })
})
it('accepts an owned low transport approach when the last fence replaces the store’s final empty approach', () => {
  const w = waiting(), h = w.homestead!
  h.store = 738
  w.buildings[738] = { kind: 'supplyCrate', x: 18, y: 18, wood: 2, inventory: emptyInventory(), storeTier: 0 }
  w.buildings[698] = { kind: 'generator', x: 18, y: 17 }
  w.buildings[737] = { kind: 'storage', x: 17, y: 18, inventory: emptyInventory() }
  w.buildings[778] = { kind: 'belt', x: 18, y: 19, direction: 'north', entry: 'south', item: null, progress: 0 }
  w.yard = { kind: 'yard', home: 820, direction: 'east', left: 19, right: 24, top: 17, bottom: 24, entrance: 702, reused: [], tiles: [739], spots: [740], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }
  expect(yardWorkSpot(w, w.yard, 739)).toBeNull()
  h.infrastructure.links.push({ kind: 'woodReturn', source: 818, target: 738, parts: [{ tile: 778, kind: 'belt', direction: 'north' }] })
  w.topologyRevision++
  expect(yardWorkSpot(w, w.yard, 739)).not.toBeNull()
})
it('keeps the existing five-second cosmetic pause duration in both modes', () => {
  for (const petes of [true, false]) {
    const w = waiting(petes)
    w.timeMs += 50; advancePeace(w, 50)
    expect(['flowers', 'waving']).toContain(w.peace.activity)
    expect(w.peace.untilMs - w.peace.sinceMs).toBe(5000)
  }
})
it('generates far fewer gifts in a deterministic run while retaining Factory gifts and old uncollected gifts', () => {
  function attempts(w: World) {
    let count = 0
    for (let n = 0; n < 100; n++) {
      w.timeMs = w.peace.nextGiftAtMs; advancePeace(w, 0)
      const gift = w.peace.gifts[0]
      if (gift) { count++; expect(collectGift(w, gift.tile)).not.toBeNull() }
    }
    return count
  }
  const petes = attempts(waiting()), factory = attempts(waiting(false))
  expect(factory).toBe(100); expect(petes).toBeGreaterThan(0); expect(petes).toBeLessThan(15)
  const old = waiting(); old.peace.gifts = [{ id: 1, tile: 859, kind: 'flowers', wood: 0, atMs: 0 }, { id: 2, tile: 861, kind: 'wood', wood: 1, atMs: 0 }]; old.peace.nextId = 3
  const before = structuredClone(old.peace.gifts)
  old.timeMs = old.peace.nextGiftAtMs; advancePeace(old, 0)
  expect(old.peace.gifts).toEqual(before)
})
it('preserves existing cosmetic pauses through both Save 52 and Save 53', () => {
  const w = waiting(), view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
  w.timeMs += 50; advancePeace(w, 50)
  const text = encodeSave(w, view), old = JSON.parse(text)
  expect(decodeSave(text).world.peace).toEqual(w.peace)
  old.version = 52
  expect(decodeSave(JSON.stringify(old)).world.peace.untilMs).toBe(old.game.peace.sinceMs + 5000)
})
it('services gift deadlines during owned work so an immediate save remains valid', () => {
  const w = waiting(), view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
  w.homestead!.task = 'gather'; w.timeMs = w.peace.nextGiftAtMs
  advancePeace(w, 50)
  expect(w.homestead!.task).toBe('gather')
  expect(w.peace.nextGiftAtMs).toBeGreaterThan(w.timeMs)
  expect(decodeSave(encodeSave(w, view)).world.peace).toEqual(w.peace)
})

it('keeps natural regrowth out of reserved Pete construction tiles and work approaches', () => {
  const w = createPetesWorld()
  expect(plantTree(w, 25, 25, 'oak')).toBe(true)
  const tree = w.buildings[1025]!
  if (tree.kind !== 'tree') throw Error('tree')
  expect(reproductionTargets(w, tree)).toContain(984)
  w.project = { home: 820, direction: 'east', tiles: [982, 983, 984], spots: [942, 943, 944], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }
  expect(reproductionTargets(w, tree)).not.toContain(984)
  expect(reproductionTargets(w, tree)).not.toContain(944)
  expect(reproductionTargets(w, tree)).toContain(985)
})
