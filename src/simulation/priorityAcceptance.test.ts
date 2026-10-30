import { recurringOrderReady } from './infrastructure'
import { expect, it } from 'vitest'
import { prioritizeProject } from '../pete/priorities'
import { advancePetesWorld } from '../pete/simulation'
import { createPetesWorld, placeIron, placeCopper } from './petesWorld'
import { materialStore } from './homestead'
import { peteStatus } from './peteStatus'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { projectDemand } from './projectDemand'
import { preferredPaths } from './resourcePreference'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-30T12:00:00.000Z'))
function until(w: World, done: () => boolean, limit: number) {
  for (let t = 0; t < limit && !done(); t += 50) advancePetesWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, task: w.homestead?.task, priority: w.homestead?.priority, paths: w.personality.paths })).toBe(true)
}
it('makes a player decision change the actual raw resource job without injecting stock', () => {
  const a = createPetesWorld()
  expect(placeIron(a, 26, 18)).toBeNull(); expect(placeCopper(a, 14, 18)).toBeNull()
  const b = structuredClone(a)
  expect(prioritizeProject(a, 'workshop')).toBe(true)
  expect(prioritizeProject(b, 'experiment')).toBe(true)
  expect(preferredPaths(a)[0]).toBe('craftsman'); expect(preferredPaths(b)[0]).toBe('inventor')
  until(a, () => a.homestead!.task !== null, 60000); until(b, () => b.homestead!.task !== null, 60000)
  expect(a.homestead!.task).toBe('mineIron'); expect(b.homestead!.task).toBe('mineCopper')
  expect(a.mined.iron + a.mined.copper).toBe(0)
  expect(prioritizeProject(a, 'flightpad')).toBe(false)
  expect(prioritizeProject(a, 'harvesting')).toBe(false)
  expect(a.homestead!.priority).toBe('workshop')
  const committed = structuredClone(a.homestead)
  expect(prioritizeProject(a, 'experiment')).toBe(true)
  expect({ ...a.homestead, priority: committed!.priority }).toEqual(committed)
})
it('keeps the wish and exact continuation across saves, validates it and upgrades old saves', () => {
  const w = createPetesWorld()
  expect(prioritizeProject(w, 'experiment')).toBe(true)
  advancePetesWorld(w, 150)
  const loaded = decodeSave(encodeSave(w, view)).world
  advancePetesWorld(w, 10350); advancePetesWorld(loaded, 10350)
  expect(snapshot(loaded)).toEqual(snapshot(w))
  const bad = snapshot(w); bad.game.homestead.priority = 'free-items'
  expect(() => decodeSave(JSON.stringify(bad))).toThrow('homestead.priority')
  const old = snapshot(w); old.version = 53
  delete old.game.homestead.priority; delete old.game.homestead.nextMealAtMs
  const upgraded = decodeSave(JSON.stringify(old)).world
  expect(upgraded.homestead!.priority).toBeNull()
  expect(upgraded.homestead!.nextMealAtMs).toBe((Math.floor(upgraded.timeMs / 600000) + 1) * 600000)
})
it('builds from raw iron at normal speed and repeatedly consumes and replaces real conveyor products', () => {
  const w = createPetesWorld(), milestones: Record<string, number> = {}
  expect(placeIron(w, 26, 18)).toBeNull()
  expect(prioritizeProject(w, 'workshop')).toBe(true)
  until(w, () => materialStore(w) !== null, 300000); milestones.store = w.timeMs
  until(w, () => w.homestead!.expansion.furnace !== null, 600000 - w.timeMs); milestones.machine = w.timeMs
  until(w, () => w.workshopProject?.phase === 'complete', 600000 - w.timeMs); milestones.project = w.timeMs
  expect(peteStatus(w).projects.find(p => p.id === 'workshop')?.completed).toBe(true)
  expect(prioritizeProject(w, 'veranda')).toBe(true)
  const demand = projectDemand(w, materialStore(w)!)!
  expect(demand.id).toBe('veranda'); expect(demand.costs.ironPlate).toBeGreaterThan(0)
  until(w, () => w.homestead!.infrastructure.links.some(link => link.kind === 'iron'), 900000 - w.timeMs); milestones.return = w.timeMs
  until(w, () => recurringOrderReady(w, 'craftsman'), 7200000)
  const orders = w.homestead!.infrastructure.nextOrderAtMs, produced = w.produced.ironGear
  let moving = 0
  for (let elapsed = 0; elapsed < 600000; elapsed += 50) {
    advancePetesWorld(w, 50)
    if (elapsed % 1000 === 0 && w.homestead!.infrastructure.links.some(link => link.parts.some(p => { const b = w.buildings[p.tile]; return b?.kind === 'belt' && b.item !== null }))) moving++
  }
  expect(w.produced.ironGear).toBeGreaterThan(produced)
  expect(w.homestead!.infrastructure.nextOrderAtMs).toBeGreaterThan(orders)
  expect(moving).toBeGreaterThan(10)
  expect(w.homestead!.infrastructure.craftsman).toBe(3)
  console.info('Normal-speed raw iron milestones (simulation seconds)', Object.fromEntries(Object.entries(milestones).map(([key, ms]) => [key, ms / 1000])))
}, 60000)
