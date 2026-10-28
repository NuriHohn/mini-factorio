import { createDevelopmentLife } from './peteDevelopments'
import { PETE_PROJECTS } from './projectRegistry'
import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { advancePavilion, choosePavilion } from './pavilion'
import { begin, materialStore } from './homestead'
import { emptyInventory } from './items'
import { awardActivity } from './personality'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { World } from './world'
import { peteStatus } from './peteStatus'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { stripVersion52State } from './testFixtures'

function world() {
  const w = createPetesWorld(), h = w.homestead!
  for (let t = 0; t < w.buildings.length; t++) if (t !== w.peace.home) w.buildings[t] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++
  h.store = 824; w.buildings[824] = { kind: 'supplyCrate', x: 24, y: 20, wood: 12, inventory: emptyInventory(), storeTier: 0 }
  materialStore(w)!.inventory.woodPanel = 12; materialStore(w)!.inventory.woodenCrate = 6
  w.orchardProject = { kind: 'orchard', home: 820, direction: 'east', tiles: [816], spots: [817], phase: 'complete', built: 1, carried: 0, carriedIron: 0, carriedGears: 0, carriedModules: 0, crate: null, elapsedMs: 0 }
  w.buildings[816] = { kind: 'peteDevelopment', development: 'orchard', x: 16, y: 20, fruit: 0, gears: 0, modules: 0, readyAtMs: 0 }
  for (const definition of PETE_PROJECTS.filter(p => p.path === 'eco' && !p.repeatable && p.id !== 'orchard')) Object.assign(w, { [definition.state]: { ...w.orchardProject, kind: definition.id, tiles: [100 + PETE_PROJECTS.indexOf(definition)], spots: [140 + PETE_PROJECTS.indexOf(definition)] } })
  h.infrastructure.eco = 3; w.produced.woodenCrate = 8
  awardActivity(w.personality, { path: 'eco', xp: 450 })
  return w
}
function work(w: World, done: () => boolean) {
  for (let t = 0; t < 120000 && !done(); t += 50) { w.timeMs += 50; advancePavilion(w, 50) }
  expect(done(), JSON.stringify(w.homestead)).toBe(true)
}
describe('paid staged orchard pavilion', () => {
  it('pays each invoice once, builds three stages with cooldown and rewards only new stages', () => {
    const w = world(), h = w.homestead!, store = materialStore(w)!, xp = w.personality.paths.eco.xp
    expect(choosePavilion(w)).toBe(true)
    const site = h.infrastructure.pavilion!
    work(w, () => h.task === null)
    expect(site.stage).toBe(1); expect(store.inventory.woodPanel).toBe(8); expect(store.inventory.woodenCrate).toBe(4)
    expect(store.wood).toBe(12); expect(w.personality.paths.eco.xp).toBe(xp + 8)
    expect(choosePavilion(w)).toBe(false)
    for (const stage of [2, 3]) { w.timeMs = h.infrastructure.nextOrderAtMs; expect(choosePavilion(w)).toBe(true); work(w, () => h.task === null); expect(site.stage).toBe(stage) }
    expect(store.inventory.woodPanel).toBe(0); expect(store.inventory.woodenCrate).toBe(0); expect(w.personality.paths.eco.xp).toBe(xp + 24)
    expect(choosePavilion(w)).toBe(false)
    removeBuilding(w, site.tile % SIZE, Math.floor(site.tile / SIZE))
    store.inventory.woodPanel = 4; store.inventory.woodenCrate = 2
    expect(choosePavilion(w)).toBe(true); expect(site.repair).toBe(true)
    work(w, () => h.task === null)
    expect(site.stage).toBe(3); expect(w.personality.paths.eco.xp).toBe(xp + 24)
    expect(w.buildings[site.tile]?.kind).toBe('petePavilion')
  })
  it('holds the exact paid invoice through blocked sites and loss of its orchard host', () => {
    const w = world(), h = w.homestead!
    expect(choosePavilion(w)).toBe(true)
    const site = h.infrastructure.pavilion!
    work(w, () => h.carried.woodPanel === 4)
    expect(placeBuilding(w, site.tile % SIZE, Math.floor(site.tile / SIZE), 'storage', 'east')).toBe(true)
    for (let t = 0; t < 20000; t += 50) { w.timeMs += 50; advancePavilion(w, 50) }
    expect(site.stage).toBe(0); expect(h.carried.woodenCrate).toBe(2)
    expect(peteStatus(w).next!.find(p => p.path === 'eco')?.blockage).toContain('Bauplatz')
    removeBuilding(w, site.tile % SIZE, Math.floor(site.tile / SIZE)); removeBuilding(w, 16, 20)
    for (let t = 0; t < 20000; t += 50) { w.timeMs += 50; advancePavilion(w, 50) }
    expect(site.stage).toBe(0); expect(h.carried.woodPanel).toBe(4)
    w.buildings[816] = { kind: 'peteDevelopment', development: 'orchard', x: 16, y: 20, fruit: 0, gears: 0, modules: 0, readyAtMs: 0 }
    work(w, () => h.task === null); expect(site.stage).toBe(1)
  })
  it('reports actual material shortages and preserves a detached read-only overview', () => {
    const w = world(), h = w.homestead!, store = materialStore(w)!
    store.inventory.woodPanel = 3; store.inventory.woodenCrate = 1
    h.infrastructure.pavilion = { tile: 815, spot: 775, stage: 1, repair: false }
    begin(w, 'buildPavilion', 815)
    const before = structuredClone(w), step = peteStatus(w).next!.find(s => s.path === 'eco')!
    expect(step.name).toBe('Obstgarten-Pavillon'); expect(step.missing).toEqual(['1 Wood panel', '1 Wooden crate'])
    step.missing.push('test'); expect(w).toEqual(before)
  })
})
it('migrates genuine Save 51 without granting a pavilion, materials or cooldown', () => {
  const w = createPetesWorld(), view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
  const old = JSON.parse(encodeSave(w, view)); old.version = 51; stripVersion52State(old.game)
  const loaded = decodeSave(JSON.stringify(old)).world
  expect(loaded.homestead!.infrastructure.pavilion).toBeNull()
  expect(loaded.buildings).toEqual(w.buildings)
  const bad = structuredClone(old); bad.game.homestead.infrastructure.pavilion = null
  expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
})

it.each(['orphan', 'site', 'stage', 'invoice', 'clock', 'task'] as const)('rejects forged pavilion %s state without changing a valid save', mode => {
  const w = createPetesWorld(), view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
  const original = encodeSave(w, view), bad = JSON.parse(original)
  if (mode === 'orphan') bad.game.buildings[815] = { kind: 'petePavilion', x: 15, y: 20 }
  if (mode === 'site' || mode === 'stage') bad.game.homestead.infrastructure.pavilion = { tile: 815, spot: 775, stage: mode === 'stage' ? 4 : 1, repair: false }
  if (mode === 'invoice') { bad.game.homestead.task = 'buildPavilion'; bad.game.homestead.carried.woodPanel = 3; bad.game.homestead.carried.woodenCrate = 2 }
  if (mode === 'clock' || mode === 'task') { bad.game.developmentLife = createDevelopmentLife(); if (mode === 'clock') bad.game.developmentLife.nextAt.pavilionRest = 300050; else { bad.game.developmentLife.task = 'pavilionRest'; bad.game.developmentLife.target = 775; bad.game.peace.activity = 'developmentward'; bad.game.peace.destination = 775 } }
  expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
  expect(encodeSave(w, view, JSON.parse(original).savedAt)).toBe(original)
})
